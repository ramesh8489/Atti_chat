import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { sanitizeFilename } from './mediaValidationService.js';

export interface StorageConfig {
  endpoint?: string;
  bucket: string;
  region: string;
  isS3Configured: boolean;
}

const UPLOAD_ROOT_DIR = path.resolve(process.cwd(), 'uploads');

// Ensure local uploads directory exists
if (!fs.existsSync(UPLOAD_ROOT_DIR)) {
  fs.mkdirSync(UPLOAD_ROOT_DIR, { recursive: true });
}

function isPlaceholder(val?: string): boolean {
  if (!val) return true;
  return (
    val.includes('placeholder') ||
    val.includes('PLACEHOLDER') ||
    val.includes('your-') ||
    val.trim() === ''
  );
}

export function getStorageConfiguration(): StorageConfig {
  const isS3Configured = Boolean(
    env.S3_ACCESS_KEY_ID &&
    !isPlaceholder(env.S3_ACCESS_KEY_ID) &&
    env.S3_SECRET_ACCESS_KEY &&
    !isPlaceholder(env.S3_SECRET_ACCESS_KEY) &&
    env.S3_BUCKET &&
    !isPlaceholder(env.S3_BUCKET)
  );

  return {
    endpoint: env.S3_ENDPOINT || undefined,
    bucket: env.S3_BUCKET || 'atti-media',
    region: env.S3_REGION || 'us-east-1',
    isS3Configured,
  };
}

let s3ClientInstance: S3Client | null = null;

export function getS3Client(): S3Client | null {
  const config = getStorageConfiguration();
  if (!config.isS3Configured) {
    return null;
  }

  if (s3ClientInstance) {
    return s3ClientInstance;
  }

  s3ClientInstance = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: Boolean(config.endpoint), // Necessary for MinIO and local S3 emulators
  });

  logger.info(`S3 client initialized for bucket '${config.bucket}' (${config.region}).`);
  return s3ClientInstance;
}

/**
 * Backward compatible alias for Phase 1 key generation.
 */
export function generateMediaStorageKey(userId: string, filename: string): string {
  const dateStr = new Date().toISOString().split('T')[0];
  const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `uploads/${dateStr}/${userId}/${Date.now()}-${safeName}`;
}

/**
 * Generate a cryptographically random, non-guessable storage object key.
 * Format: conversations/{conversationId}/{uuid}-{sanitizedFilename}
 */
export function generateAttachmentKey(conversationId: string, filename: string): string {
  const safeName = sanitizeFilename(filename);
  const uniqueId = crypto.randomUUID();
  return `conversations/${conversationId}/${uniqueId}-${safeName}`;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  fileKey: string;
  storageMode: 'S3' | 'LOCAL';
  expiresAt: Date;
  uploadHeaders?: Record<string, string>;
}

/**
 * Issue a secure presigned upload URL (or local development upload destination).
 */
export async function createPresignedUploadUrl(
  conversationId: string,
  filename: string,
  mimeType: string,
  _fileSize?: number
): Promise<PresignedUploadResult> {
  const key = generateAttachmentKey(conversationId, filename);
  const s3 = getS3Client();
  const config = getStorageConfiguration();
  const expiresSeconds = 900; // 15 minutes TTL
  const expiresAt = new Date(Date.now() + expiresSeconds * 1000);

  if (s3 && config.isS3Configured) {
    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: expiresSeconds });
    logger.debug(`Generated S3 presigned PUT URL for key: ${key}`);

    return {
      uploadUrl,
      fileKey: key,
      storageMode: 'S3',
      expiresAt,
      uploadHeaders: {
        'Content-Type': mimeType,
      },
    };
  }

  // Local development storage fallback
  const localUploadUrl = `/api/conversations/${conversationId}/attachments/local-upload`;
  logger.debug(`Generated local development upload endpoint for key: ${key}`);

  return {
    uploadUrl: localUploadUrl,
    fileKey: key,
    storageMode: 'LOCAL',
    expiresAt,
  };
}

export interface PresignedDownloadResult {
  downloadUrl: string;
  storageMode: 'S3' | 'LOCAL';
  expiresAt: Date;
}

/**
 * Issue a secure short-lived presigned download URL or authenticated local download stream URL.
 */
export async function createPresignedDownloadUrl(
  attachmentId: string,
  fileKey: string,
  fileName?: string
): Promise<PresignedDownloadResult> {
  const s3 = getS3Client();
  const config = getStorageConfiguration();
  const expiresSeconds = 900; // 15 minutes TTL
  const expiresAt = new Date(Date.now() + expiresSeconds * 1000);

  if (s3 && config.isS3Configured) {
    const safeName = fileName ? sanitizeFilename(fileName) : 'attachment';
    const command = new GetObjectCommand({
      Bucket: config.bucket,
      Key: fileKey,
      ResponseContentDisposition: `attachment; filename="${safeName}"`,
    });

    const downloadUrl = await getSignedUrl(s3, command, { expiresIn: expiresSeconds });
    return {
      downloadUrl,
      storageMode: 'S3',
      expiresAt,
    };
  }

  // Local streaming download endpoint
  return {
    downloadUrl: `/api/attachments/${attachmentId}/download`,
    storageMode: 'LOCAL',
    expiresAt,
  };
}

/**
 * Save an uploaded file buffer to the local development storage directory.
 */
export async function saveLocalFile(fileKey: string, buffer: Buffer): Promise<string> {
  // Normalize and resolve path inside UPLOAD_ROOT_DIR to strictly prevent path traversal
  const targetPath = path.resolve(UPLOAD_ROOT_DIR, fileKey);
  if (!targetPath.startsWith(UPLOAD_ROOT_DIR)) {
    throw new Error('Security violation: Attempted path traversal in file storage');
  }

  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  await fs.promises.writeFile(targetPath, buffer);
  logger.debug(`Saved local storage file to: ${targetPath}`);
  return targetPath;
}

/**
 * Get filesystem path for local file, ensuring it stays within UPLOAD_ROOT_DIR.
 */
export function getLocalFilePath(fileKey: string): string {
  const targetPath = path.resolve(UPLOAD_ROOT_DIR, fileKey);
  if (!targetPath.startsWith(UPLOAD_ROOT_DIR)) {
    throw new Error('Security violation: Attempted path traversal');
  }
  return targetPath;
}

/**
 * Delete stored file from S3 or local development storage.
 */
export async function deleteStoredFile(fileKey: string): Promise<boolean> {
  const s3 = getS3Client();
  const config = getStorageConfiguration();

  if (s3 && config.isS3Configured) {
    try {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: fileKey,
        })
      );
      logger.info(`Deleted S3 object: ${fileKey}`);
      return true;
    } catch (err: any) {
      logger.error(`Failed to delete S3 object ${fileKey}:`, { message: err?.message });
      return false;
    }
  }

  // Local file deletion
  try {
    const localPath = getLocalFilePath(fileKey);
    if (fs.existsSync(localPath)) {
      await fs.promises.unlink(localPath);
      logger.info(`Deleted local storage file: ${localPath}`);
    }
    return true;
  } catch (err: any) {
    logger.error(`Failed to delete local file ${fileKey}:`, { message: err?.message });
    return false;
  }
}

/**
 * Read stored file buffer (for inspection, verification, or local streaming).
 */
export async function readStoredFileBuffer(fileKey: string): Promise<Buffer | null> {
  const s3 = getS3Client();
  const config = getStorageConfiguration();

  if (s3 && config.isS3Configured) {
    try {
      const response = await s3.send(
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: fileKey,
        })
      );
      if (!response.Body) return null;
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (err: any) {
      logger.error(`Failed to read S3 object ${fileKey}:`, { message: err?.message });
      return null;
    }
  }

  try {
    const localPath = getLocalFilePath(fileKey);
    if (fs.existsSync(localPath)) {
      return await fs.promises.readFile(localPath);
    }
    return null;
  } catch {
    return null;
  }
}
