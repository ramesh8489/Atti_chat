import { describe, it, expect } from 'vitest';
import {
  sanitizeFilename,
  validateFileMetadata,
  validateFileSignature,
  scanFileBuffer,
} from '../src/services/mediaValidationService.js';

describe('Media Validation & Security Service', () => {
  describe('sanitizeFilename', () => {
    it('strips path traversal sequences and dangerous characters', () => {
      expect(sanitizeFilename('../../../etc/passwd')).toBe('passwd');
      expect(sanitizeFilename('..\\..\\windows\\system32\\cmd.exe')).toBe('cmd.exe');
      expect(sanitizeFilename('my image file (1).png')).toBe('my_image_file__1_.png');
      expect(sanitizeFilename('.hidden_file.jpg')).toBe('hidden_file.jpg');
    });

    it('returns default name for empty or whitespace string', () => {
      expect(sanitizeFilename('')).toBe('unnamed_file');
      expect(sanitizeFilename('   ')).toBe('unnamed_file');
    });
  });

  describe('validateFileMetadata', () => {
    it('accepts valid supported image, video, and document formats', () => {
      const jpg = validateFileMetadata('photo.jpg', 'image/jpeg', 2 * 1024 * 1024);
      expect(jpg.valid).toBe(true);
      expect(jpg.fileType).toBe('IMAGE');

      const png = validateFileMetadata('screenshot.png', 'image/png', 5 * 1024 * 1024);
      expect(png.valid).toBe(true);
      expect(png.fileType).toBe('IMAGE');

      const mp4 = validateFileMetadata('demo.mp4', 'video/mp4', 30 * 1024 * 1024);
      expect(mp4.valid).toBe(true);
      expect(mp4.fileType).toBe('VIDEO');

      const pdf = validateFileMetadata('contract.pdf', 'application/pdf', 15 * 1024 * 1024);
      expect(pdf.valid).toBe(true);
      expect(pdf.fileType).toBe('FILE');

      const docx = validateFileMetadata(
        'document.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        10 * 1024 * 1024
      );
      expect(docx.valid).toBe(true);
      expect(docx.fileType).toBe('FILE');
    });

    it('rejects forbidden dangerous executable files', () => {
      const exe = validateFileMetadata('setup.exe', 'application/octet-stream', 1024);
      expect(exe.valid).toBe(false);
      expect(exe.error).toContain('prohibited');

      const sh = validateFileMetadata('script.sh', 'text/x-shellscript', 1024);
      expect(sh.valid).toBe(false);
      expect(sh.error).toContain('prohibited');

      const bat = validateFileMetadata('launch.bat', 'application/x-bat', 1024);
      expect(bat.valid).toBe(false);
      expect(bat.error).toContain('prohibited');

      const js = validateFileMetadata('payload.js', 'application/javascript', 1024);
      expect(js.valid).toBe(false);
      expect(js.error).toContain('prohibited');
    });

    it('rejects unsupported extensions even if MIME type is faked', () => {
      const fake = validateFileMetadata('malicious.php', 'image/png', 1024);
      expect(fake.valid).toBe(false);
    });

    it('rejects oversized files based on category limit', () => {
      // Images max 10MB
      const bigImg = validateFileMetadata('huge.jpg', 'image/jpeg', 12 * 1024 * 1024);
      expect(bigImg.valid).toBe(false);
      expect(bigImg.error).toContain('exceeds the limit');

      // Documents max 25MB
      const bigPdf = validateFileMetadata('huge.pdf', 'application/pdf', 30 * 1024 * 1024);
      expect(bigPdf.valid).toBe(false);
      expect(bigPdf.error).toContain('exceeds the limit');

      // Videos max 50MB
      const bigVideo = validateFileMetadata('huge.mp4', 'video/mp4', 60 * 1024 * 1024);
      expect(bigVideo.valid).toBe(false);
      expect(bigVideo.error).toContain('exceeds the limit');
    });

    it('rejects zero or negative byte files', () => {
      const zero = validateFileMetadata('empty.png', 'image/png', 0);
      expect(zero.valid).toBe(false);
      expect(zero.error).toContain('greater than zero');
    });
  });

  describe('validateFileSignature (Magic Bytes)', () => {
    it('accepts valid PNG signature and rejects spoofed PNG', () => {
      const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
      expect(validateFileSignature(validPng, 'image/png').valid).toBe(true);

      const fakePng = Buffer.from('Not a real PNG file header');
      expect(validateFileSignature(fakePng, 'image/png').valid).toBe(false);
    });

    it('accepts valid JPEG signature and rejects spoofed JPEG', () => {
      const validJpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      expect(validateFileSignature(validJpg, 'image/jpeg').valid).toBe(true);

      const fakeJpg = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      expect(validateFileSignature(fakeJpg, 'image/jpeg').valid).toBe(false);
    });

    it('accepts valid PDF signature and rejects spoofed PDF', () => {
      const validPdf = Buffer.from('%PDF-1.7 header content');
      expect(validateFileSignature(validPdf, 'application/pdf').valid).toBe(true);

      const fakePdf = Buffer.from('Random binary without PDF header');
      expect(validateFileSignature(fakePdf, 'application/pdf').valid).toBe(false);
    });

    it('accepts valid MP4 signature and rejects spoofed MP4', () => {
      // MP4 has 'ftyp' at offset 4
      const validMp4 = Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
      expect(validateFileSignature(validMp4, 'video/mp4').valid).toBe(true);

      const fakeMp4 = Buffer.from([0x00, 0x00, 0x00, 0x20, 0x6e, 0x6f, 0x70, 0x65]);
      expect(validateFileSignature(fakeMp4, 'video/mp4').valid).toBe(false);
    });

    it('detects binary null bytes or PE headers in spoofed text files', () => {
      const validTxt = Buffer.from('Hello world! This is a clean text document.');
      expect(validateFileSignature(validTxt, 'text/plain').valid).toBe(true);

      // Embedded null byte
      const fakeTxt = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x00, 0x6f]);
      expect(validateFileSignature(fakeTxt, 'text/plain').valid).toBe(false);

      // MZ Windows executable header in text
      const exeAsTxt = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
      expect(validateFileSignature(exeAsTxt, 'text/plain').valid).toBe(false);
    });
  });

  describe('scanFileBuffer', () => {
    it('flags files containing Windows MZ executable headers', async () => {
      const buffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]);
      const result = await scanFileBuffer(buffer, 'malware.bin');
      expect(result.clean).toBe(false);
      expect(result.threat).toContain('PE executable');
    });

    it('flags script injection attempts in non-text files', async () => {
      const buffer = Buffer.from('GIF89a<script>alert(1)</script>');
      const result = await scanFileBuffer(buffer, 'test.gif');
      expect(result.clean).toBe(false);
      expect(result.threat).toContain('script');
    });
  });
});
