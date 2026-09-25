import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';

/** Result of persisting bytes into private storage. */
export type StoredObject = {
  storageKey: string;
  sizeBytes: number;
  checksum: string;
  mimeType: string;
};

export interface StorageAdapter {
  readonly name: string;
  put(storageKey: string, data: Buffer, mimeType: string): Promise<StoredObject>;
  get(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
  exists(storageKey: string): Promise<boolean>;
}

/**
 * Canonical document upload policy: the MIME types the platform accepts and the
 * only file extensions that may be attached to them.
 *
 * This is the single source of truth for upload types. `document-service` uses
 * it for MIME/extension matching and adds magic-byte checks, and
 * `generateStorageKey` uses it to decide which extension is safe to persist.
 */
export const DOCUMENT_UPLOAD_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};

const DOCUMENT_UPLOAD_EXTENSIONS = Object.values(DOCUMENT_UPLOAD_TYPES).flat();

/**
 * Builds a non-guessable, path-traversal-safe storage key.
 * Keys are never derived from user supplied file names beyond the extension.
 */
export function generateStorageKey(scope: string, originalName: string): string {
  const extension = path.extname(originalName).toLowerCase();
  const safeExtension = DOCUMENT_UPLOAD_EXTENSIONS.includes(extension) ? extension : '.bin';
  const now = new Date();
  const prefix = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return `${scope}/${prefix}/${randomUUID()}${safeExtension}`;
}

export function checksumOf(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/** Rejects path traversal attempts in storage keys. */
export function assertSafeStorageKey(storageKey: string): void {
  if (
    storageKey.includes('..') ||
    storageKey.startsWith('/') ||
    storageKey.startsWith('\\') ||
    storageKey.includes('\\') ||
    /^[a-zA-Z]:/.test(storageKey) ||
    storageKey.trim() !== storageKey ||
    storageKey.length === 0
  ) {
    throw new Error('Unsafe storage key');
  }
}

export class StorageNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageNotConfiguredError';
  }
}
