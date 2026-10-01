export const BOOK_STORAGE = Symbol('BOOK_STORAGE');

export interface BookStorage {
  upload(path: string, data: Buffer, mimeType: string): Promise<void>;
  signedUrl(path: string, ttlSeconds: number): Promise<string>;
}
