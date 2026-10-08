import { Injectable } from '@nestjs/common';
import JSZip from 'jszip';

export const EPUB_LANGUAGE = 'es-AR';
export const EPUB_MIME_TYPE = 'application/epub+zip';

export interface EpubPageInput {
  pageNumber: number;
  content: string;
  imageFileName?: string;
}

export interface EpubImageInput {
  fileName: string;
  data: Buffer;
  mimeType: string;
}

export interface EpubBookInput {
  title: string;
  identifier: string;
  language?: string;
  dedication?: string;
  pages: EpubPageInput[];
  images: EpubImageInput[];
}

/**
 * SPEC-031: minimal EPUB 3 builder (container + OPF + nav + one XHTML per
 * page + images). Deterministic output for the same input (fixed
 * timestamps) so E2E fixtures stay stable.
 */
@Injectable()
export class EpubBuilderService {
  async build(book: EpubBookInput): Promise<Buffer> {
    const zip = new JSZip();
    const language = book.language ?? EPUB_LANGUAGE;
    const modified = '2026-01-01T00:00:00Z';

    // The mimetype entry goes first and uncompressed (EPUB requirement).
    zip.file('mimetype', EPUB_MIME_TYPE, { compression: 'STORE' });
    zip.file('META-INF/container.xml', containerXml());
    zip.file('OEBPS/content.opf', packageDocument(book, language, modified));
    zip.file('OEBPS/nav.xhtml', navDocument(book, language));

    if (book.dedication) {
      zip.file('OEBPS/text/dedication.xhtml', dedicationPage(book, language));
    }

    for (const page of book.pages) {
      zip.file(
        `OEBPS/text/page-${page.pageNumber}.xhtml`,
        storyPage(book, language, page),
      );
    }

    for (const image of book.images) {
      zip.file(`OEBPS/images/${image.fileName}`, image.data);
    }

    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function containerXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">',
    '  <rootfiles>',
    '    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>',
    '  </rootfiles>',
    '</container>',
    '',
  ].join('\n');
}

function spineItems(book: EpubBookInput): { id: string; href: string }[] {
  const items =
    book.dedication != null
      ? [{ id: 'dedication', href: 'text/dedication.xhtml' }]
      : [];

  return [
    ...items,
    ...book.pages.map((page) => ({
      id: `page-${page.pageNumber}`,
      href: `text/page-${page.pageNumber}.xhtml`,
    })),
  ];
}

function packageDocument(
  book: EpubBookInput,
  language: string,
  modified: string,
): string {
  const manifestItems = [
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    ...spineItems(book).map(
      (item) =>
        `<item id="${item.id}" href="${item.href}" media-type="application/xhtml+xml"/>`,
    ),
    ...book.images.map(
      (image) =>
        `<item id="img-${escapeXml(image.fileName)}" href="images/${escapeXml(image.fileName)}" media-type="${escapeXml(image.mimeType)}"/>`,
    ),
  ];
  const spineRefs = spineItems(book).map(
    (item) => `<itemref idref="${item.id}"/>`,
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<package version="3.0" unique-identifier="book-id" xmlns="http://www.idpf.org/2007/opf">',
    '  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">',
    `    <dc:identifier id="book-id">${escapeXml(book.identifier)}</dc:identifier>`,
    `    <dc:title>${escapeXml(book.title)}</dc:title>`,
    `    <dc:language>${escapeXml(language)}</dc:language>`,
    `    <meta property="dcterms:modified">${modified}</meta>`,
    '  </metadata>',
    '  <manifest>',
    ...manifestItems.map((item) => `    ${item}`),
    '  </manifest>',
    '  <spine>',
    ...spineRefs.map((item) => `    ${item}`),
    '  </spine>',
    '</package>',
    '',
  ].join('\n');
}

function navDocument(book: EpubBookInput, language: string): string {
  const links = [
    ...(book.dedication != null
      ? ['    <li><a href="text/dedication.xhtml">Dedicatoria</a></li>']
      : []),
    ...book.pages.map(
      (page) =>
        `    <li><a href="text/page-${page.pageNumber}.xhtml">Página ${page.pageNumber}</a></li>`,
    ),
  ];

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE html>',
    `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(language)}">`,
    '<head>',
    `  <title>${escapeXml(book.title)}</title>`,
    '</head>',
    '<body>',
    '  <nav epub:type="toc">',
    '    <ol>',
    ...links,
    '    </ol>',
    '  </nav>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

function paragraphs(content: string): string {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `    <p>${escapeXml(line)}</p>`)
    .join('\n');
}

function xhtmlShell(language: string, title: string, body: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE html>',
    `<html xmlns="http://www.w3.org/1999/xhtml" lang="${escapeXml(language)}">`,
    '<head>',
    `  <title>${escapeXml(title)}</title>`,
    '</head>',
    '<body>',
    body,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

function dedicationPage(book: EpubBookInput, language: string): string {
  return xhtmlShell(
    language,
    book.title,
    `  <h1>Dedicatoria</h1>\n    <p>${escapeXml(book.dedication ?? '')}</p>`,
  );
}

function storyPage(
  book: EpubBookInput,
  language: string,
  page: EpubPageInput,
): string {
  const image = page.imageFileName
    ? `\n    <img src="../images/${escapeXml(page.imageFileName)}" alt=""/>`
    : '';

  return xhtmlShell(
    language,
    `${book.title} — Página ${page.pageNumber}`,
    `  <h1>Página ${page.pageNumber}</h1>\n${paragraphs(page.content)}${image}`,
  );
}
