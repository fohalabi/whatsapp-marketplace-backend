import PDFDocument from 'pdfkit';
import prisma from '../config/database';
import cloudinary from '../config/cloudinary';
import { Readable } from 'stream';

export class InvoiceService {
  async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    
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
    const order = await prisma.customerOrder.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    if (!order) throw new Error('Order not found');

    const invoiceNumber = await this.generateInvoiceNumber();

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        orderId,
      },
    });

    // Generate and upload PDF to Cloudinary
    const pdfUrl = await this.generateAndUploadPDF(invoice.invoiceNumber, order);

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { pdfUrl },
    });

    return { invoice, pdfUrl };
  }

  private async generateAndUploadPDF(invoiceNumber: string, order: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      // Collect PDF data in memory
      doc.on('data', (chunk) => chunks.push(chunk));
      
      doc.on('end', async () => {
        try {
          const pdfBuffer = Buffer.concat(chunks);

          // Upload to Cloudinary
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              resource_type: 'raw',
              folder: 'invoices',
              public_id: invoiceNumber,
              format: 'pdf',
            },
            (error, result) => {
              if (error) {
                reject(error);
              } else {
                resolve(result!.secure_url);
              }
            }
          );

          // Convert buffer to stream and pipe to Cloudinary
          const readableStream = Readable.from(pdfBuffer);
          readableStream.pipe(uploadStream);
        } catch (error) {
          reject(error);
        }
      });

      doc.on('error', reject);

      // Generate PDF content (same as before)
      doc.fontSize(20).text('INVOICE', { align: 'center' });
      doc.moveDown();
      
      doc.fontSize(12).text(`Invoice Number: ${invoiceNumber}`);
      doc.text(`Order Number: ${order.orderNumber}`);
      doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`);
      doc.text(`Payment Reference: ${order.paymentReference}`);
      doc.moveDown();

      doc.fontSize(14).text('Customer Information', { underline: true });
      doc.fontSize(10);
      doc.text(`Phone: ${order.customerPhone}`);
      doc.text(`Email: ${order.customerEmail}`);
      doc.moveDown();

      doc.fontSize(14).text('Order Items', { underline: true });
      doc.fontSize(10);
      doc.moveDown(0.5);

      const tableTop = doc.y;
      doc.text('Item', 50, tableTop);
      doc.text('Qty', 300, tableTop);
      doc.text('Price', 370, tableTop);
      doc.text('Total', 470, tableTop);
      
      doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
      
      let yPosition = tableTop + 25;

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

      doc.fontSize(12).text('Total Amount:', 370, yPosition);
      doc.text(`₦${order.totalAmount.toLocaleString()}`, 470, yPosition);
      
      doc.moveDown(2);
      doc.fontSize(10).text('Payment Status: PAID', { align: 'center' });
      doc.text('Thank you for your purchase!', { align: 'center' });

      doc.end();
    });
  }
}