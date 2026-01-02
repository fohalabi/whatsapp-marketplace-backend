import PDFDocument from 'pdfkit';
import prisma from '../config/database';
import fs from 'fs';
import path from 'path';

export class InvoiceService {
  async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    
    // Count invoices created this year
    const count = await prisma.invoice.count({
      where: {
        invoiceNumber: {
          startsWith: `INV-${year}-`,
        },
      },
    });

    const nextNumber = (count + 1).toString().padStart(4, '0');
    return `INV-${year}-${nextNumber}`;
  }

  async createInvoice(orderId: string) {
    // Get order details
    const order = await prisma.customerOrder.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    if (!order) throw new Error('Order not found');

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber();

    // Create invoice record
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        orderId,
      },
    });

    // Generate PDF
    const pdfPath = await this.generatePDF(invoice.invoiceNumber, order);

    // Update invoice with PDF path
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { pdfUrl: pdfPath },
    });

    return { invoice, pdfPath };
  }

  private async generatePDF(invoiceNumber: string, order: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      
      // Create invoices directory if not exists
      const invoicesDir = path.join(process.cwd(), 'invoices');
      if (!fs.existsSync(invoicesDir)) {
        fs.mkdirSync(invoicesDir, { recursive: true });
      }

      const fileName = `${invoiceNumber}.pdf`;
      const filePath = path.join(invoicesDir, fileName);
      const writeStream = fs.createWriteStream(filePath);

      doc.pipe(writeStream);

      // Header
      doc.fontSize(20).text('INVOICE', { align: 'center' });
      doc.moveDown();
      
      doc.fontSize(12).text(`Invoice Number: ${invoiceNumber}`);
      doc.text(`Order Number: ${order.orderNumber}`);
      doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`);
      doc.text(`Payment Reference: ${order.paymentReference}`);
      doc.moveDown();

      // Customer Info
      doc.fontSize(14).text('Customer Information', { underline: true });
      doc.fontSize(10);
      doc.text(`Phone: ${order.customerPhone}`);
      doc.text(`Email: ${order.customerEmail}`);
      doc.moveDown();

      // Order Items
      doc.fontSize(14).text('Order Items', { underline: true });
      doc.fontSize(10);
      doc.moveDown(0.5);

      // Table header
      const tableTop = doc.y;
      doc.text('Item', 50, tableTop);
      doc.text('Qty', 300, tableTop);
      doc.text('Price', 370, tableTop);
      doc.text('Total', 470, tableTop);
      
      doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
      
      let yPosition = tableTop + 25;

      // Table rows
      order.items.forEach((item: any) => {
        const total = item.quantity * item.price;
        doc.text(item.product.name, 50, yPosition, { width: 240 });
        doc.text(item.quantity.toString(), 300, yPosition);
        doc.text(`₦${item.price.toLocaleString()}`, 370, yPosition);
        doc.text(`₦${total.toLocaleString()}`, 470, yPosition);
        yPosition += 25;
      });

      doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
      yPosition += 15;

      // Total
      doc.fontSize(12).text('Total Amount:', 370, yPosition);
      doc.text(`₦${order.totalAmount.toLocaleString()}`, 470, yPosition);
      
      doc.moveDown(2);
      doc.fontSize(10).text('Payment Status: PAID', { align: 'center' });
      doc.text('Thank you for your purchase!', { align: 'center' });

      doc.end();

      writeStream.on('finish', () => resolve(filePath));
      writeStream.on('error', reject);
    });
  }
}