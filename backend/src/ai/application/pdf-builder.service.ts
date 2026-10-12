import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

export const FLYER_PDF_MIME_TYPE = 'application/pdf';

export interface FlyerPdfInput {
  title: string;
  message: string;
  occasion?: string;
  style?: string;
  image?: { data: Buffer };
}

/**
 * SPEC-031B: single-page flyer PDF (title + message + image). Collects
 * the pdfkit stream into a Buffer. Deterministic metadata (fixed dates)
 * so fixtures stay stable.
 */
@Injectable()
export class PdfBuilderService {
  buildFlyer(input: FlyerPdfInput): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 72, bottom: 72, left: 72, right: 72 },
        info: {
          Title: input.title,
          Creator: 'Futurar',
          CreationDate: new Date('2026-01-01T00:00:00Z'),
          ModDate: new Date('2026-01-01T00:00:00Z'),
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (error: Error) => reject(error));

      doc.fontSize(28).text(input.title, { align: 'center' });
      doc.moveDown();

      if (input.image) {
        doc.image(input.image.data, {
          fit: [400, 400],
          align: 'center',
          valign: 'center',
        });
        doc.moveDown();
      }

      doc.fontSize(16).text(input.message, { align: 'center' });

      const meta = [input.occasion, input.style].filter(
        (part): part is string => !!part,
      );
      if (meta.length > 0) {
        doc.moveDown();
        doc.fontSize(12).fillColor('gray').text(meta.join(' • '), {
          align: 'center',
        });
      }

      doc.end();
    });
  }
}
