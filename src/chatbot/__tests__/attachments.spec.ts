import { ChatAttachmentService, detectMagicBytes, sanitizeFilename } from '../attachments/chat-attachment.service';
import * as crypto from 'crypto';
const sharp = require('sharp');

describe('Chat Attachments (CB0-18)', () => {
  let service: ChatAttachmentService;
  let savedEntity: any = null;

  const mockRepo = {
    create: jest.fn().mockImplementation((dto) => {
      savedEntity = { ...dto, id: 'att_test_1' };
      return savedEntity;
    }),
    save: jest.fn().mockImplementation(async (entity) => {
      savedEntity = entity;
      return entity;
    }),
    findOne: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockResolvedValue({
      retention_days: { attachment: 365 },
    }),
  };

  beforeEach(() => {
    savedEntity = null;
    jest.clearAllMocks();
    service = new ChatAttachmentService(mockRepo as any, mockConfigService as any);
  });

  describe('Magic bytes & filename helper functions', () => {
    it('correctly detects PNG magic bytes', () => {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
      expect(detectMagicBytes(pngHeader)).toBe('image/png');
    });

    it('correctly detects JPEG magic bytes', () => {
      const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
      expect(detectMagicBytes(jpegHeader)).toBe('image/jpeg');
    });

    it('correctly detects PDF magic bytes', () => {
      const pdfHeader = Buffer.from('%PDF-1.7 header content');
      expect(detectMagicBytes(pdfHeader)).toBe('application/pdf');
    });

    it('rejects HTML disguised as PNG', () => {
      const fakeHtml = Buffer.from('<html><body>Not an image</body></html>');
      expect(detectMagicBytes(fakeHtml)).toBeNull();
    });

    it('rejects SVG file', () => {
      const svgContent = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>');
      expect(detectMagicBytes(svgContent)).toBeNull();
    });

    it('sanitizes filename and strips path traversal', () => {
      const malicious = '../../../etc/passwd';
      expect(sanitizeFilename(malicious)).toBe('passwd');

      const longName = 'a'.repeat(300) + '.png';
      const sanitized = sanitizeFilename(longName);
      expect(sanitized.length).toBeLessThanOrEqual(200);
    });
  });

  describe('store() method validation and processing', () => {
    it('rejects file larger than 10MB with ATTACHMENT_TOO_LARGE', async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
      await expect(
        service.store({
          conversationId: 'conv_1',
          originalName: 'large.pdf',
          buffer: largeBuffer,
        }),
      ).rejects.toThrow('ATTACHMENT_TOO_LARGE');
    });

    it('rejects file with invalid magic bytes with ATTACHMENT_TYPE_NOT_ALLOWED', async () => {
      const htmlBuffer = Buffer.from('<html><body>evil</body></html>');
      await expect(
        service.store({
          conversationId: 'conv_1',
          originalName: 'evil.png',
          buffer: htmlBuffer,
        }),
      ).rejects.toThrow('ATTACHMENT_TYPE_NOT_ALLOWED');
    });

    it('rejects extension mismatch (JPEG body named .png) with ATTACHMENT_TYPE_MISMATCH', async () => {
      const jpegBuffer = await sharp({
        create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 0, b: 0 } },
      })
        .jpeg()
        .toBuffer();

      await expect(
        service.store({
          conversationId: 'conv_1',
          originalName: 'photo.png',
          buffer: jpegBuffer,
        }),
      ).rejects.toThrow('ATTACHMENT_TYPE_MISMATCH');
    });

    it('stores valid PNG and processes through sharp correctly', async () => {
      const pngBuffer = await sharp({
        create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 128, b: 255, alpha: 1 } },
      })
        .png()
        .toBuffer();

      const res = await service.store({
        conversationId: 'conv_1',
        originalName: 'valid.png',
        buffer: pngBuffer,
      });

      expect(res).toBeDefined();
      expect(savedEntity.detected_mime).toBe('image/png');
      expect(savedEntity.size_bytes).toBe(savedEntity.content.length);
      expect(savedEntity.sha256).toBe(
        crypto.createHash('sha256').update(savedEntity.content).digest('hex'),
      );
    });

    it('resizes image larger than 2560px down to <= 2560px', async () => {
      // Create image with 3000px width
      const hugeBuffer = await sharp({
        create: { width: 3000, height: 1500, channels: 3, background: { r: 100, g: 100, b: 100 } },
      })
        .png()
        .toBuffer();

      await service.store({
        conversationId: 'conv_1',
        originalName: 'huge.png',
        buffer: hugeBuffer,
      });

      const meta = await sharp(savedEntity.content).metadata();
      expect(meta.width).toBeLessThanOrEqual(2560);
      expect(meta.height).toBeLessThanOrEqual(2560);
    });

    it('strips EXIF / GPS metadata from JPEG', async () => {
      // Create a JPEG buffer
      const rawJpeg = await sharp({
        create: { width: 50, height: 50, channels: 3, background: { r: 200, g: 50, b: 50 } },
      })
        .jpeg()
        .toBuffer();

      // Store through service
      await service.store({
        conversationId: 'conv_1',
        originalName: 'photo.jpg',
        buffer: rawJpeg,
      });

      const outputMeta = await sharp(savedEntity.content).metadata();
      // EXIF metadata must be stripped
      expect(outputMeta.exif).toBeUndefined();
    });

    it('stores valid PDF without alteration and with identical sha256', async () => {
      const samplePdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Test) >>\nendobj\ntrailer\n<<>>\n%%EOF');
      const expectedSha = crypto.createHash('sha256').update(samplePdf).digest('hex');

      await service.store({
        conversationId: 'conv_1',
        originalName: 'document.pdf',
        buffer: samplePdf,
      });

      expect(savedEntity.detected_mime).toBe('application/pdf');
      expect(savedEntity.sha256).toBe(expectedSha);
      expect(savedEntity.content.equals(samplePdf)).toBe(true);
    });
  });
});
