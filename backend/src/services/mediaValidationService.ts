import path from 'path';
import { logger } from '../config/logger.js';

export const FILE_SIZE_LIMITS = {
  IMAGE: 10 * 1024 * 1024,      // 10 MB
  VIDEO: 50 * 1024 * 1024,      // 50 MB
  DOCUMENT: 25 * 1024 * 1024,   // 25 MB
  TEXT: 10 * 1024 * 1024,       // 10 MB
  DEFAULT: 25 * 1024 * 1024,    // 25 MB
} as const;

export type SupportedFileType = 'IMAGE' | 'VIDEO' | 'FILE' | 'AUDIO';

export interface AllowedMediaRule {
  mimeType: string;
  extensions: string[];
  type: SupportedFileType;
  maxSizeBytes: number;
}

export const ALLOWED_MEDIA_RULES: AllowedMediaRule[] = [
  // Images
  { mimeType: 'image/jpeg', extensions: ['.jpg', '.jpeg'], type: 'IMAGE', maxSizeBytes: FILE_SIZE_LIMITS.IMAGE },
  { mimeType: 'image/png', extensions: ['.png'], type: 'IMAGE', maxSizeBytes: FILE_SIZE_LIMITS.IMAGE },
  { mimeType: 'image/webp', extensions: ['.webp'], type: 'IMAGE', maxSizeBytes: FILE_SIZE_LIMITS.IMAGE },

  // Videos
  { mimeType: 'video/mp4', extensions: ['.mp4'], type: 'VIDEO', maxSizeBytes: FILE_SIZE_LIMITS.VIDEO },
  { mimeType: 'video/webm', extensions: ['.webm'], type: 'VIDEO', maxSizeBytes: FILE_SIZE_LIMITS.VIDEO },

  // Documents
  { mimeType: 'application/pdf', extensions: ['.pdf'], type: 'FILE', maxSizeBytes: FILE_SIZE_LIMITS.DOCUMENT },
  {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensions: ['.docx'],
    type: 'FILE',
    maxSizeBytes: FILE_SIZE_LIMITS.DOCUMENT,
  },
  {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extensions: ['.xlsx'],
    type: 'FILE',
    maxSizeBytes: FILE_SIZE_LIMITS.DOCUMENT,
  },
  { mimeType: 'text/plain', extensions: ['.txt'], type: 'FILE', maxSizeBytes: FILE_SIZE_LIMITS.TEXT },
];

export const FORBIDDEN_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.bash', '.ps1', '.vbs', '.js', '.mjs', '.msi',
  '.com', '.scr', '.jar', '.pif', '.dll', '.bin', '.app', '.dmg', '.iso', '.php',
  '.py', '.pl', '.cgi', '.asp', '.aspx', '.jsp', '.htm', '.html', '.xhtml',
]);

/**
 * Sanitize untrusted filenames to prevent directory traversal and injection.
 */
export function sanitizeFilename(rawName: string): string {
  if (!rawName || !rawName.trim()) return 'unnamed_file';

  // Strip null bytes and control chars
  let cleaned = rawName.replace(/[\x00-\x1f\x7f]/g, '');

  // Extract base name, removing directory separators
  cleaned = path.basename(cleaned);

  // Remove path traversal tokens
  cleaned = cleaned.replace(/\.\.+/g, '.');

  // Replace spaces and special characters except safe alphanumeric, dots, hyphens, and underscores
  cleaned = cleaned.replace(/[^a-zA-Z0-9.\-_]/g, '_');

  // Ensure it doesn't start with a dot (hidden files)
  cleaned = cleaned.replace(/^\.+/, '');

  if (!cleaned || cleaned.replace(/[_.]/g, '').trim() === '') {
    return 'unnamed_file';
  }

  // Limit filename length to 100 characters while preserving extension
  const ext = path.extname(cleaned);
  const nameWithoutExt = path.basename(cleaned, ext);
  if (nameWithoutExt.length > 80) {
    cleaned = `${nameWithoutExt.slice(0, 80)}${ext}`;
  }

  return cleaned;
}

/**
 * Validate metadata for a proposed upload before issuing presigned URLs or accepting files.
 */
export function validateFileMetadata(filename: string, mimeType: string, fileSize: number) {
  const sanitized = sanitizeFilename(filename);
  const ext = path.extname(sanitized).toLowerCase();

  // 1. Check dangerous extensions
  if (FORBIDDEN_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Files with extension '${ext}' are prohibited for security reasons. Executable scripts and binaries cannot be uploaded.`,
    };
  }

  // 2. Match against allowed media rules
  const rule = ALLOWED_MEDIA_RULES.find(
    (r) => r.mimeType.toLowerCase() === mimeType.toLowerCase() && r.extensions.includes(ext)
  );

  if (!rule) {
    return {
      valid: false,
      error: `Unsupported file format. Supported formats: JPG, PNG, WEBP, MP4, WEBM, PDF, DOCX, XLSX, TXT. (Received: '${ext}', MIME: '${mimeType}')`,
    };
  }

  // 3. Check file size limits
  if (fileSize <= 0) {
    return {
      valid: false,
      error: 'File size must be greater than zero bytes.',
    };
  }

  if (fileSize > rule.maxSizeBytes) {
    const limitMB = Math.round(rule.maxSizeBytes / (1024 * 1024));
    return {
      valid: false,
      error: `File size exceeds the limit for this file type (${limitMB} MB maximum).`,
    };
  }

  return {
    valid: true,
    sanitizedFilename: sanitized,
    fileType: rule.type,
    mimeType: rule.mimeType,
    extension: ext,
  };
}

/**
 * Validate file signature (magic bytes) to prevent MIME-type spoofing attacks.
 */
export function validateFileSignature(buffer: Buffer, expectedMimeType: string): { valid: boolean; error?: string } {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'File buffer is empty.' };
  }

  // Look up matching rule
  const rule = ALLOWED_MEDIA_RULES.find((r) => r.mimeType.toLowerCase() === expectedMimeType.toLowerCase());
  if (!rule) {
    return { valid: false, error: `Unrecognized MIME type: ${expectedMimeType}` };
  }

  // Check magic bytes per format
  switch (rule.mimeType) {
    case 'image/jpeg': {
      // JPEG starts with FF D8 FF
      if (buffer.length < 3 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
        return { valid: false, error: 'File content does not match standard JPEG signature (FF D8 FF).' };
      }
      return { valid: true };
    }

    case 'image/png': {
      // PNG starts with 89 50 4E 47 0D 0A 1A 0A
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      if (buffer.length < 8 || !buffer.subarray(0, 8).equals(pngHeader)) {
        return { valid: false, error: 'File content does not match standard PNG signature.' };
      }
      return { valid: true };
    }

    case 'image/webp': {
      // RIFF at 0..3 and WEBP at 8..11
      if (
        buffer.length < 12 ||
        buffer.toString('ascii', 0, 4) !== 'RIFF' ||
        buffer.toString('ascii', 8, 12) !== 'WEBP'
      ) {
        return { valid: false, error: 'File content does not match standard WEBP signature (RIFF....WEBP).' };
      }
      return { valid: true };
    }

    case 'application/pdf': {
      // Starts with %PDF- (25 50 44 46 2D)
      if (buffer.length < 5 || buffer.toString('ascii', 0, 5) !== '%PDF-') {
        return { valid: false, error: 'File content does not match standard PDF signature (%PDF-).' };
      }
      return { valid: true };
    }

    case 'video/mp4': {
      // Contains 'ftyp' at offset 4
      if (buffer.length < 12 || buffer.toString('ascii', 4, 8) !== 'ftyp') {
        return { valid: false, error: 'File content does not match standard MP4 container signature (ftyp).' };
      }
      return { valid: true };
    }

    case 'video/webm': {
      // EBML header 1A 45 DF A3
      if (
        buffer.length < 4 ||
        buffer[0] !== 0x1a ||
        buffer[1] !== 0x45 ||
        buffer[2] !== 0xdf ||
        buffer[3] !== 0xa3
      ) {
        return { valid: false, error: 'File content does not match standard WebM EBML signature.' };
      }
      return { valid: true };
    }

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
      // DOCX / XLSX are PKZIP archives (50 4B 03 04)
      if (
        buffer.length < 4 ||
        buffer[0] !== 0x50 ||
        buffer[1] !== 0x4b ||
        buffer[2] !== 0x03 ||
        buffer[3] !== 0x04
      ) {
        return { valid: false, error: 'File content does not match valid OpenXML PKZIP document header.' };
      }
      return { valid: true };
    }

    case 'text/plain': {
      // Must not contain null bytes or common binary/executable signatures (e.g. MZ header)
      if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
        return { valid: false, error: 'Suspicious Windows executable signature (MZ) detected in text file.' };
      }
      // Check for null bytes (0x00) which indicate binary files
      for (let i = 0; i < Math.min(buffer.length, 1024); i++) {
        if (buffer[i] === 0x00) {
          return { valid: false, error: 'Binary null bytes detected; file is not valid UTF-8 plain text.' };
        }
      }
      return { valid: true };
    }

    default:
      return { valid: true };
  }
}

/**
 * Antivirus and malware inspection hook.
 * Prepares integration point for scanning service (e.g. ClamAV, AWS GuardDuty, VirusTotal).
 */
export async function scanFileBuffer(buffer: Buffer, filename: string): Promise<{ clean: boolean; threat?: string }> {
  // Safe heuristic inspection: reject embedded PE executables and script injections
  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return { clean: false, threat: 'Embedded PE executable header detected (MZ)' };
  }

  // Scan text-based content for script tags
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('utf8');
  if (sample.includes('<script') && !filename.endsWith('.txt')) {
    return { clean: false, threat: 'Suspicious executable HTML/JS script injection detected' };
  }

  logger.debug(`File '${filename}' passed safe static inspection.`);
  return { clean: true };
}
