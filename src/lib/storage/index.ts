import { env } from '@/lib/env';
import { LocalFileStorage } from './local-storage';
import { S3Storage } from './s3-storage';
import type { StorageAdapter } from './types';

export * from './types';
export { LocalFileStorage } from './local-storage';
export { S3Storage, resolveS3Settings, type S3Settings } from './s3-storage';
export { signS3Request } from './s3-signing';

/**
 * Storage driver selection.
 *
 * `local` writes to a private directory on the application host and is intended
 * for development and single-instance deployments with a persistent volume.
 * `s3` uses private S3-compatible object storage and is the supported option for
 * horizontally scaled production deployments.
 */
let instance: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (!instance) {
    instance = env.STORAGE_DRIVER === 's3' ? new S3Storage() : new LocalFileStorage();
  }
  return instance;
}

/** Test helper. */
export function setStorage(adapter: StorageAdapter | null): void {
  instance = adapter;
}
