import JSZip from 'jszip';
import { EpubBuilderService } from './epub-builder.service';

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('EpubBuilderService', () => {
  const builder = new EpubBuilderService();

  it('builds a valid EPUB 3 package with pages and images', async () => {
    const epub = await builder.build({
      title: 'La aventura del dragón',
      identifier: 'book-1',
      dedication: 'Para Ana',
      pages: [
        {
          pageNumber: 1,
          content: 'Había una vez un dragón.',
          imageFileName: 'page-1.png',
        },
        { pageNumber: 2, content: 'Fin.', imageFileName: undefined },
      ],
      images: [
        { fileName: 'page-1.png', data: PNG_BYTES, mimeType: 'image/png' },
      ],
    });

    const zip = await JSZip.loadAsync(epub);
    const names = Object.keys(zip.files).sort();

    expect(names).toEqual([
      'META-INF/',
      'META-INF/container.xml',
      'OEBPS/',
      'OEBPS/content.opf',
      'OEBPS/images/',
      'OEBPS/images/page-1.png',
      'OEBPS/nav.xhtml',
      'OEBPS/text/',
      'OEBPS/text/dedication.xhtml',
      'OEBPS/text/page-1.xhtml',
      'OEBPS/text/page-2.xhtml',
      'mimetype',
    ]);

    expect(await zip.file('mimetype')?.async('string')).toBe(
      'application/epub+zip',
    );

    const opf = await zip.file('OEBPS/content.opf')?.async('string');
    expect(opf).toContain('<dc:title>La aventura del dragón</dc:title>');
    expect(opf).toContain('<dc:language>es-AR</dc:language>');
    expect(opf).toContain('text/page-1.xhtml');

    const page1 = await zip.file('OEBPS/text/page-1.xhtml')?.async('string');
    expect(page1).toContain('Había una vez un dragón.');
    expect(page1).toContain('../images/page-1.png');

    const image = await zip
      .file('OEBPS/images/page-1.png')
      ?.async('nodebuffer');
    expect(Buffer.compare(image ?? Buffer.alloc(0), PNG_BYTES)).toBe(0);
  });

  it('escapes XML in titles and content', async () => {
    const epub = await builder.build({
      title: 'A < B & "C"',
      identifier: 'book-2',
      pages: [{ pageNumber: 1, content: '5 < 6 & 7 > 4' }],
      images: [],
    });

    const zip = await JSZip.loadAsync(epub);
    const opf = await zip.file('OEBPS/content.opf')?.async('string');
    expect(opf).toContain('A &lt; B &amp; &quot;C&quot;');

    const page = await zip.file('OEBPS/text/page-1.xhtml')?.async('string');
    expect(page).toContain('5 &lt; 6 &amp; 7 &gt; 4');
  });

  it('omits the dedication page when there is no dedication', async () => {
    const epub = await builder.build({
      title: 'Sin dedicatoria',
      identifier: 'book-3',
      pages: [{ pageNumber: 1, content: 'Hola.' }],
      images: [],
    });

    const zip = await JSZip.loadAsync(epub);
    expect(zip.file('OEBPS/text/dedication.xhtml')).toBeNull();
    expect(zip.file('OEBPS/text/page-1.xhtml')).not.toBeNull();
  });
});
