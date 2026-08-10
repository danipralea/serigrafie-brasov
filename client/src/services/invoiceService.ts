import { jsPDF } from 'jspdf';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { formatDate } from '../utils/dateUtils';
import {
  PositionEntry,
  formatPositioning,
  getPositioningTotalCost,
  normalizePositioning
} from '../utils/positioning';

/** One line on the invoice - mirrors a sub-order of the order. */
export interface InvoiceItem {
  productType: string;
  quantity?: number | null;
  description?: string;
  positioning?: PositionEntry[];
  /** Line total; derived from the positions when not given. */
  amount?: number | null;
}

export interface InvoiceData {
  orderId: string;
  orderNumber: string;
  orderName?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCompany?: string;
  items: InvoiceItem[];
  createdAt?: Date;
  completedAt?: Date;
  /** Invoice total; derived from the item amounts when not given. */
  amount?: number | null;
}

function money(value: number | null | undefined): string {
  return value === null || value === undefined ? '---' : `${value.toFixed(2)} RON`;
}

function getItemAmount(item: InvoiceItem): number | null {
  if (item.amount !== null && item.amount !== undefined) return item.amount;
  return getPositioningTotalCost(item.positioning || []);
}

function getInvoiceTotal(invoiceData: InvoiceData): number | null {
  if (invoiceData.amount !== null && invoiceData.amount !== undefined) return invoiceData.amount;
  const amounts = (invoiceData.items || [])
    .map(getItemAmount)
    .filter((amount): amount is number => amount !== null);
  if (amounts.length === 0) return null;
  return Math.round(amounts.reduce((sum, amount) => sum + amount, 0) * 100) / 100;
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

export function generateInvoicePDF(invoiceData: InvoiceData): jsPDF {
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.getHeight();

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
  doc.text(`Numar factura / Invoice Number: ${invoiceData.orderNumber || '-'}`, 20, 65);
  doc.text(
    `Data / Date: ${formatDate(invoiceData.completedAt || invoiceData.createdAt || new Date())}`,
    20,
    72
  );
  if (invoiceData.orderName) {
    doc.text(`Comanda / Order: ${invoiceData.orderName}`, 20, 79);
  }

  // Client Information
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Date client / Client Information:', 20, 92);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  let y = 100;
  doc.text(`Nume / Name: ${invoiceData.clientName || '-'}`, 20, y);
  if (invoiceData.clientCompany) {
    y += 7;
    doc.text(`Firma / Company: ${invoiceData.clientCompany}`, 20, y);
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

  const items = invoiceData.items || [];

  if (items.length === 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text('Nicio pozitie / No items', 25, y);
    y += 8;
  }

  items.forEach((item, index) => {
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
    doc.text(`${index + 1}. ${item.productType || '-'}`, 25, y);
    doc.text(item.quantity === null || item.quantity === undefined ? '-' : String(item.quantity), 120, y);
    doc.text(money(getItemAmount(item)), 155, y);

    if (detailLines.length > 0) {
      y += 5;
      doc.setFontSize(8);
      doc.setTextColor(90, 90, 90);
      doc.text(detailLines, 29, y);
      doc.setTextColor(0, 0, 0);
      y += detailLines.length * 4;
    }

    y += 6;
  });

  // Total
  ensureSpace(20);
  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, 190, y);
  y += 8;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Total:', 130, y);
  doc.text(money(getInvoiceTotal(invoiceData)), 155, y);

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
  doc.save(`Factura_${invoiceData.orderNumber || invoiceData.orderId}.pdf`);
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
    message: `Invoice for order #${invoiceData.orderNumber} has been sent to ${invoiceData.clientEmail || ''}`,
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
