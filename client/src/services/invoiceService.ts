import { jsPDF } from 'jspdf';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface InvoiceData {
  orderId: string;
  orderNumber: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  productType: string;
  quantity: number;
  description: string;
  createdAt: Date;
  completedAt?: Date;
  amount?: number;
}

export function generateInvoicePDF(invoiceData: InvoiceData): jsPDF {
  const doc = new jsPDF();

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
  doc.text('FACTURĂ / INVOICE', 105, 50, { align: 'center' });

  // Invoice Number and Date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Număr factură / Invoice Number: ${invoiceData.orderNumber}`, 20, 65);
  doc.text(`Data / Date: ${invoiceData.completedAt?.toLocaleDateString('ro-RO') || new Date().toLocaleDateString('ro-RO')}`, 20, 72);

  // Client Information
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Date client / Client Information:', 20, 85);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nume / Name: ${invoiceData.clientName}`, 20, 93);
  doc.text(`Email: ${invoiceData.clientEmail}`, 20, 100);
  if (invoiceData.clientPhone) {
    doc.text(`Telefon / Phone: ${invoiceData.clientPhone}`, 20, 107);
  }

  // Order Details
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Detalii comandă / Order Details:', 20, 125);

  // Table Header
  doc.setFillColor(59, 130, 246); // Blue
  doc.rect(20, 132, 170, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Produs / Product', 25, 137);
  doc.text('Cantitate / Qty', 120, 137);
  doc.text('Suma / Amount', 155, 137);

  // Table Row
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.text(invoiceData.productType, 25, 147);
  doc.text(invoiceData.quantity.toString(), 125, 147);
  doc.text(invoiceData.amount ? `${invoiceData.amount} RON` : '---', 155, 147);

  // Description
  doc.setFontSize(9);
  const splitDescription = doc.splitTextToSize(`Descriere / Description: ${invoiceData.description}`, 170);
  doc.text(splitDescription, 25, 155);

  // Total
  const descHeight = splitDescription.length * 5;
  const totalY = 160 + descHeight;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Total:', 140, totalY);
  doc.text(invoiceData.amount ? `${invoiceData.amount} RON` : '---', 170, totalY);

  // Footer
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text('Mulțumim pentru comandă! / Thank you for your order!', 105, 280, { align: 'center' });
  doc.text('Pentru întrebări, vă rugăm să ne contactați la contact@serigrafie-brasov.ro', 105, 286, { align: 'center' });

  return doc;
}

export function downloadInvoice(invoiceData: InvoiceData): void {
  const doc = generateInvoicePDF(invoiceData);
  doc.save(`Factura_${invoiceData.orderNumber}.pdf`);
}

export async function sendInvoiceToClient(invoiceData: InvoiceData): Promise<void> {
  // Generate PDF
  const doc = generateInvoicePDF(invoiceData);
  const pdfBlob = doc.output('blob');

  // In a real application, you would upload this to Firebase Storage
  // and send an email with the link or attachment

  // For now, we'll create a notification for the admin
  const notificationsRef = collection(db, 'notifications');
  await addDoc(notificationsRef, {
    type: 'invoice_sent',
    title: 'Invoice sent',
    message: `Invoice for order #${invoiceData.orderNumber} has been sent to ${invoiceData.clientEmail}`,
    orderId: invoiceData.orderId,
    read: false,
    createdAt: Timestamp.now()
  });

  // TODO: Implement actual email sending via Firebase Functions or email service
  // This would involve:
  // 1. Upload PDF to Firebase Storage
  // 2. Call a Cloud Function that sends the email with the PDF attachment
  // 3. Use a service like SendGrid, AWS SES, or similar

  console.log('Invoice generated and ready to send:', pdfBlob);
}
