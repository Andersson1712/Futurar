import { PdfBuilderService } from './pdf-builder.service';

const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('PdfBuilderService', () => {
  const builder = new PdfBuilderService();

  it('builds a single-page PDF with title, message and image', async () => {
    const pdf = await builder.buildFlyer({
      title: 'Mi fiesta de cumple',
      message: 'Fiesta de cumple el sábado a las 17',
      occasion: 'birthday',
      style: 'Acuarela',
      image: { data: PNG_BYTES },
    });

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it('builds a PDF without image or metadata', async () => {
    const pdf = await builder.buildFlyer({
      title: 'Solo texto',
      message: 'Un mensaje simple',
    });

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(500);
  });
});
