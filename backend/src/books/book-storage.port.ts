export const BOOK_STORAGE = Symbol('BOOK_STORAGE');

export interface BookStorage {
  upload(path: string, data: Buffer, mimeType: string): Promise<void>;
  signedUrl(path: string, ttlSeconds: number): Promise<string>;
  /**
   * SPEC-031: raw bytes for server-side export (EPUB embedding). The
   * service-role client bypasses RLS; rejects when storage is unavailable.
   */
  download(path: string): Promise<Buffer>;
}
