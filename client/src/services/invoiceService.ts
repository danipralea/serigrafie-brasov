import { jsPDF } from 'jspdf';
import { collection, addDoc, doc as docRef, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { formatDate } from '../utils/dateUtils';
import {
  PositionEntry,
  formatPositioning,
  getPositioningTotalCost,
  normalizePositioning
} from '../utils/positioning';
import {
  DEFAULT_CURRENCY,
  formatMoney,
  getInvoiceClientLabel
} from '../utils/invoicing';

/** One line on the invoice - mirrors a sub-order of an order. */
export interface InvoiceItem {
  productType: string;
  quantity?: number | null;
  description?: string;
  positioning?: PositionEntry[];
  /** Line total; derived from the positions when not given. */
  amount?: number | null;
}

/**
 * A block of lines under its own heading. A single-order invoice has one
 * group; a cumulative invoice has one per order it gathers.
 */
export interface InvoiceGroup {
  title: string;
  subtitle?: string;
  items: InvoiceItem[];
}

export interface InvoiceData {
  orderId: string;
  orderNumber: string;
  orderName?: string;
  /** Fiscal number (`SB-2026-0007`). Falls back to the order number. */
  invoiceNumber?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCompany?: string;
  /** Romanian tax id (CUI / cod fiscal) of the client's company. */
  clientCui?: string;
  clientAddress?: string;
  items: InvoiceItem[];
  /** When set, the document renders these blocks instead of a flat item list. */
  groups?: InvoiceGroup[];
  createdAt?: Date;
  completedAt?: Date;
  issuedAt?: Date;
  dueDate?: Date;
  periodStart?: Date;
  periodEnd?: Date;
  currency?: string;
  /** Percentage. Zero or missing renders a single total, with no VAT split. */
  vatRate?: number | null;
  subtotal?: number | null;
  vatAmount?: number | null;
  notes?: string;
  /** Invoice total; derived from the item amounts when not given. */
  amount?: number | null;
}

function money(value: number | null | undefined, currency = DEFAULT_CURRENCY): string {
  return formatMoney(value, currency);
}

function getItemAmount(item: InvoiceItem): number | null {
  if (item.amount !== null && item.amount !== undefined) return item.amount;
  return getPositioningTotalCost(item.positioning || []);
}

/** Every line in the document, whether it came flat or in groups. */
function getAllItems(invoiceData: InvoiceData): InvoiceItem[] {
  if (invoiceData.groups && invoiceData.groups.length > 0) {
    return invoiceData.groups.flatMap(group => group.items || []);
  }
  return invoiceData.items || [];
}

function getInvoiceSubtotal(invoiceData: InvoiceData): number | null {
  if (invoiceData.subtotal !== null && invoiceData.subtotal !== undefined) return invoiceData.subtotal;
  const amounts = getAllItems(invoiceData)
    .map(getItemAmount)
    .filter((amount): amount is number => amount !== null);
  if (amounts.length === 0) return null;
  return Math.round(amounts.reduce((sum, amount) => sum + amount, 0) * 100) / 100;
}

function getInvoiceTotal(invoiceData: InvoiceData): number | null {
  if (invoiceData.amount !== null && invoiceData.amount !== undefined) return invoiceData.amount;
  const subtotal = getInvoiceSubtotal(invoiceData);
  if (subtotal === null) return null;
  const rate = invoiceData.vatRate || 0;
  return Math.round(subtotal * (1 + rate / 100) * 100) / 100;
}

/**
 * Builds the invoice payload from an order document and its sub-orders.
 * Every field is optional on the order, so nothing here may assume a shape.
 */
export function buildInvoiceData(order: any): InvoiceData {
  const subOrders: any[] = Array.isArray(order?.subOrders) ? order.subOrders : [];

  return {
    orderId: order?.id || '',
    orderNumber: order?.id ? String(order.id).substring(0, 8).toUpperCase() : '',
    orderName: order?.orderName || '',
    clientName: order?.clientName || order?.userName || order?.userEmail || 'Client',
    clientCompany: order?.clientCompany || '',
    clientCui: order?.clientCui || '',
    clientEmail: order?.clientEmail || order?.userEmail || '',
    clientPhone: order?.clientPhone || order?.contactPhone || '',
    items: subOrders.map((subOrder) => ({
      productType: subOrder?.productTypeName || subOrder?.productType || '-',
      quantity: subOrder?.quantity ?? null,
      description: subOrder?.description || '',
      positioning: normalizePositioning(subOrder?.positioning, subOrder)
    })),
    createdAt: order?.createdAt?.toDate?.(),
    completedAt: order?.updatedAt?.toDate?.()
  };
}

/**
 * Builds the payload for a cumulative invoice: one group per order it gathers,
 * with the frozen lines and totals already stored on the invoice document.
 */
export function buildCumulativeInvoiceData(invoice: any): InvoiceData {
  const lines: any[] = Array.isArray(invoice?.lines) ? invoice.lines : [];
  const orderRefs: any[] = Array.isArray(invoice?.orders) ? invoice.orders : [];

  const groups: InvoiceGroup[] = orderRefs.map(orderRef => ({
    title: orderRef?.name ? `#${orderRef.number} - ${orderRef.name}` : `#${orderRef?.number || '-'}`,
    subtitle: orderRef?.createdAtMillis ? formatDate(new Date(orderRef.createdAtMillis)) : '',
    items: lines
      .filter(line => line?.orderId === orderRef?.id)
      .map(line => ({
        productType: line?.productType || '-',
        quantity: line?.quantity ?? null,
        description: line?.description || '',
        positioning: normalizePositioning(line?.positioning),
        amount: line?.amount ?? null
      }))
  }));

  // Lines whose order reference went missing still have to be billed.
  const orphanLines = lines.filter(line => !orderRefs.some(ref => ref?.id === line?.orderId));
  if (orphanLines.length > 0) {
    groups.push({
      title: '-',
      items: orphanLines.map(line => ({
        productType: line?.productType || '-',
        quantity: line?.quantity ?? null,
        description: line?.description || '',
        positioning: normalizePositioning(line?.positioning),
        amount: line?.amount ?? null
      }))
    });
  }

  return {
    orderId: invoice?.id || '',
    orderNumber: invoice?.number || (invoice?.id ? String(invoice.id).substring(0, 8).toUpperCase() : ''),
    invoiceNumber: invoice?.number || '',
    clientName: invoice?.clientName || getInvoiceClientLabel(invoice) || 'Client',
    clientCompany: invoice?.clientCompany || '',
    clientCui: invoice?.clientCui || '',
    clientEmail: invoice?.clientEmail || '',
    clientPhone: invoice?.clientPhone || '',
    clientAddress: invoice?.clientAddress || '',
    items: [],
    groups,
    createdAt: invoice?.createdAt?.toDate?.(),
    issuedAt: invoice?.issuedAt?.toDate?.(),
    dueDate: invoice?.dueDate?.toDate?.(),
    periodStart: invoice?.periodStart?.toDate?.(),
    periodEnd: invoice?.periodEnd?.toDate?.(),
    currency: invoice?.currency || DEFAULT_CURRENCY,
    vatRate: invoice?.vatRate ?? 0,
    subtotal: invoice?.subtotal ?? null,
    vatAmount: invoice?.vatAmount ?? null,
    amount: invoice?.total ?? null,
    notes: invoice?.notes || ''
  };
}

/**
 * Reads the CUI from the client record. Orders placed before the field existed
 * carry no `clientCui`, so the invoice falls back to the client sheet.
 */
export async function fetchClientCui(clientId?: string): Promise<string> {
  if (!clientId) return '';
  try {
    const snapshot = await getDoc(docRef(db, 'clients', clientId));
    return snapshot.exists() ? snapshot.data()?.cui || '' : '';
  } catch {
    return '';
  }
}

export function generateInvoicePDF(invoiceData: InvoiceData): jsPDF {
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.getHeight();
  const currency = invoiceData.currency || DEFAULT_CURRENCY;

  // Company Header
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('SERIGRAFIE BRASOV', 105, 20, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Custom Printing Solutions', 105, 28, { align: 'center' });
  doc.text('Brasov, Romania', 105, 34, { align: 'center' });

  // Invoice Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURA / INVOICE', 105, 50, { align: 'center' });

  // Invoice Number and Date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  let headerY = 65;
  doc.text(
    `Numar factura / Invoice Number: ${invoiceData.invoiceNumber || invoiceData.orderNumber || '-'}`,
    20,
    headerY
  );
  headerY += 7;
  doc.text(
    `Data / Date: ${formatDate(
      invoiceData.issuedAt || invoiceData.completedAt || invoiceData.createdAt || new Date()
    )}`,
    20,
    headerY
  );
  if (invoiceData.dueDate) {
    headerY += 7;
    doc.text(`Scadenta / Due date: ${formatDate(invoiceData.dueDate)}`, 20, headerY);
  }
  if (invoiceData.periodStart && invoiceData.periodEnd) {
    headerY += 7;
    doc.text(
      `Perioada / Period: ${formatDate(invoiceData.periodStart)} - ${formatDate(invoiceData.periodEnd)}`,
      20,
      headerY
    );
  }
  if (invoiceData.orderName) {
    headerY += 7;
    doc.text(`Comanda / Order: ${invoiceData.orderName}`, 20, headerY);
  }

  // Client Information
  let y = headerY + 13;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Date client / Client Information:', 20, y);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  y += 8;
  doc.text(`Nume / Name: ${invoiceData.clientName || '-'}`, 20, y);
  if (invoiceData.clientCompany) {
    y += 7;
    doc.text(`Firma / Company: ${invoiceData.clientCompany}`, 20, y);
  }
  if (invoiceData.clientCui) {
    y += 7;
    doc.text(`CUI / Tax ID: ${invoiceData.clientCui}`, 20, y);
  }
  if (invoiceData.clientAddress) {
    y += 7;
    doc.text(`Adresa / Address: ${invoiceData.clientAddress}`, 20, y);
  }
  if (invoiceData.clientEmail) {
    y += 7;
    doc.text(`Email: ${invoiceData.clientEmail}`, 20, y);
  }
  if (invoiceData.clientPhone) {
    y += 7;
    doc.text(`Telefon / Phone: ${invoiceData.clientPhone}`, 20, y);
  }

  // Order Details
  y += 18;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Detalii comanda / Order Details:', 20, y);

  // Table Header
  y += 7;
  function drawTableHeader() {
    doc.setFillColor(59, 130, 246); // Blue
    doc.rect(20, y, 170, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Produs / Product', 25, y + 5.5);
    doc.text('Cantitate / Qty', 115, y + 5.5);
    doc.text('Suma / Amount', 155, y + 5.5);
    doc.setTextColor(0, 0, 0);
    y += 14;
  }
  drawTableHeader();

  /** Starts a new page when the next block would not fit. */
  function ensureSpace(height: number) {
    if (y + height <= pageHeight - 30) return;
    doc.addPage();
    y = 20;
    drawTableHeader();
  }

  /** Renders one line of the table. */
  function drawItem(item: InvoiceItem, label: string) {
    const positions = item.positioning || [];
    const positioningText = positions.length > 0 ? formatPositioning(positions) : '';
    const detailLines: string[] = [];

    if (positioningText) {
      detailLines.push(...doc.splitTextToSize(`Pozitionare: ${positioningText}`, 160));
    }
    if (item.description) {
      detailLines.push(...doc.splitTextToSize(`Descriere: ${item.description}`, 160));
    }

    ensureSpace(8 + detailLines.length * 5);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${label} ${item.productType || '-'}`, 25, y);
    doc.text(item.quantity === null || item.quantity === undefined ? '-' : String(item.quantity), 120, y);
    doc.text(money(getItemAmount(item), currency), 155, y);

    if (detailLines.length > 0) {
      y += 5;
      doc.setFontSize(8);
      doc.setTextColor(90, 90, 90);
      doc.text(detailLines, 29, y);
      doc.setTextColor(0, 0, 0);
      y += detailLines.length * 4;
    }

    y += 6;
  }

  const groups: InvoiceGroup[] =
    invoiceData.groups && invoiceData.groups.length > 0
      ? invoiceData.groups
      : [{ title: '', items: invoiceData.items || [] }];

  const hasAnyItem = groups.some(group => (group.items || []).length > 0);

  if (!hasAnyItem) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text('Nicio pozitie / No items', 25, y);
    y += 8;
  }

  let itemCounter = 0;

  groups.forEach(group => {
    const items = group.items || [];
    if (items.length === 0) return;

    if (group.title) {
      ensureSpace(12);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(59, 130, 246);
      const heading = group.subtitle ? `${group.title}  -  ${group.subtitle}` : group.title;
      doc.text(doc.splitTextToSize(heading, 165), 22, y);
      doc.setTextColor(0, 0, 0);
      y += 6;
    }

    items.forEach(item => {
      itemCounter++;
      drawItem(item, `${itemCounter}.`);
    });
  });

  // Totals
  const subtotal = getInvoiceSubtotal(invoiceData);
  const vatRate = invoiceData.vatRate || 0;
  const vatAmount =
    invoiceData.vatAmount ?? (subtotal === null ? null : Math.round(subtotal * vatRate) / 100);

  ensureSpace(vatRate > 0 ? 34 : 20);
  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, 190, y);
  y += 8;

  if (vatRate > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', 130, y);
    doc.text(money(subtotal, currency), 155, y);
    y += 7;
    doc.text(`TVA / VAT (${vatRate}%):`, 130, y);
    doc.text(money(vatAmount, currency), 155, y);
    y += 8;
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Total:', 130, y);
  doc.text(money(getInvoiceTotal(invoiceData), currency), 155, y);

  if (invoiceData.notes) {
    y += 12;
    const noteLines = doc.splitTextToSize(invoiceData.notes, 165);
    ensureSpace(6 + noteLines.length * 5);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90, 90, 90);
    doc.text(noteLines, 20, y);
    doc.setTextColor(0, 0, 0);
  }

  // Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(0, 0, 0);
    doc.text('Multumim pentru comanda! / Thank you for your order!', 105, pageHeight - 17, { align: 'center' });
    doc.text('Pentru intrebari, va rugam sa ne contactati la contact@serigrafie-brasov.ro', 105, pageHeight - 11, {
      align: 'center'
    });
  }

  return doc;
}

export function downloadInvoice(invoiceData: InvoiceData): void {
  const doc = generateInvoicePDF(invoiceData);
  doc.save(`Factura_${invoiceData.invoiceNumber || invoiceData.orderNumber || invoiceData.orderId}.pdf`);
}

export async function sendInvoiceToClient(invoiceData: InvoiceData): Promise<void> {
  // Generate PDF
  generateInvoicePDF(invoiceData);

  // In a real application, you would upload this to Firebase Storage
  // and send an email with the link or attachment

  // For now, we'll create a notification for the admin
  const notificationsRef = collection(db, 'notifications');
  await addDoc(notificationsRef, {
    type: 'invoice_sent',
    title: 'Invoice sent',
    message: `Invoice for order #${invoiceData.invoiceNumber || invoiceData.orderNumber} has been sent to ${invoiceData.clientEmail || ''}`,
    orderId: invoiceData.orderId,
    read: false,
    createdAt: Timestamp.now()
  });

  // TODO: Implement actual email sending via Firebase Functions or email service
  // This would involve:
  // 1. Upload PDF to Firebase Storage
  // 2. Call a Cloud Function that sends the email with the PDF attachment
  // 3. Use a service like SendGrid, AWS SES, or similar
}
