import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '@/lib/env';
import {
  assertSafeStorageKey,
  checksumOf,
  type StorageAdapter,
  type StoredObject,
} from './types';

/**
 * Local private file storage.
 *
 * Files are written OUTSIDE the web root (default ./storage/private, gitignored
 * and never served by Next.js). Downloads always go through an authorised API
 * route that streams the bytes, so a leaked path alone grants nothing.
 */
export class LocalFileStorage implements StorageAdapter {
  readonly name = 'local';

  private readonly rootDir: string;

  constructor(rootDir: string = env.STORAGE_LOCAL_DIR) {
    this.rootDir = path.isAbsolute(rootDir)
      ? rootDir
      : path.join(/* turbopackIgnore: true */ process.cwd(), rootDir);
  }

  /** Resolves a key to an absolute path and guarantees it stays inside root. */
  private resolve(storageKey: string): string {
    assertSafeStorageKey(storageKey);
    const absolute = path.resolve(this.rootDir, storageKey);
    const rootWithSep = this.rootDir.endsWith(path.sep)
      ? this.rootDir
      : `${this.rootDir}${path.sep}`;
    if (!absolute.startsWith(rootWithSep)) {
      throw new Error('Storage key escapes the storage root');
    }
    return absolute;
  }

  async put(storageKey: string, data: Buffer, mimeType: string): Promise<StoredObject> {
    const absolute = this.resolve(storageKey);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, data, { mode: 0o600 });
    return {
      storageKey,
      sizeBytes: data.byteLength,
      checksum: checksumOf(data),
      mimeType,
    };
  }

  async get(storageKey: string): Promise<Buffer> {
    return readFile(this.resolve(storageKey));
  }

  async delete(storageKey: string): Promise<void> {
    await rm(this.resolve(storageKey), { force: true });
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      await stat(this.resolve(storageKey));
      return true;
    } catch {
      return false;
    }
  }
}
