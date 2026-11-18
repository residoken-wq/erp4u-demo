import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as path from 'path';
const sharp = require('sharp');
import { ChatbotAttachment } from '../entities/chatbot-attachment.entity';
import { ChatbotConfigService } from '../config/chatbot-config.service';

export interface StoreAttachmentParams {
  conversationId: string;
  originalName: string;
  buffer: Buffer;
  requestId?: string;
  ticketId?: string;
}

export type DetectedMime = 'image/png' | 'image/jpeg' | 'application/pdf';

export function detectMagicBytes(buffer: Buffer): DetectedMime | null {
  if (!buffer || buffer.length < 8) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PDF: 25 50 44 46 2D ('%PDF-')
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return 'application/pdf';
  }

  return null;
}

export function sanitizeFilename(filename: string): string {
  if (!filename) return 'unnamed_file';
  // Remove paths and null bytes
  const base = path.basename(filename).replace(/[\0\r\n]/g, '').trim();
  return base.slice(0, 200) || 'unnamed_file';
}

@Injectable()
export class ChatAttachmentService {
  constructor(
    @InjectRepository(ChatbotAttachment)
    private readonly attachmentRepo: Repository<ChatbotAttachment>,
    private readonly configService: ChatbotConfigService,
  ) {}

  async store(params: StoreAttachmentParams): Promise<ChatbotAttachment> {
    const { conversationId, originalName, buffer, requestId, ticketId } = params;

    // 1. Check size limit: max 10MB
    const MAX_SIZE = 10 * 1024 * 1024;
    if (!buffer || buffer.length > MAX_SIZE) {
      throw new BadRequestException('ATTACHMENT_TOO_LARGE');
    }

    // 2. Magic bytes check
    const detectedMime = detectMagicBytes(buffer);
    if (!detectedMime) {
      throw new BadRequestException('ATTACHMENT_TYPE_NOT_ALLOWED');
    }

    // Extension check
    const ext = path.extname(originalName || '').toLowerCase();
    if (detectedMime === 'image/png' && ext !== '.png') {
      throw new BadRequestException('ATTACHMENT_TYPE_MISMATCH');
    }
    if (detectedMime === 'image/jpeg' && ext !== '.jpg' && ext !== '.jpeg') {
      throw new BadRequestException('ATTACHMENT_TYPE_MISMATCH');
    }
    if (detectedMime === 'application/pdf' && ext !== '.pdf') {
      throw new BadRequestException('ATTACHMENT_TYPE_MISMATCH');
    }

    // 3. Process buffer: strip EXIF/GPS, resize if image
    let finalBuffer: Buffer;
    if (detectedMime === 'image/png' || detectedMime === 'image/jpeg') {
      let transformer = sharp(buffer)
        .rotate()
        .resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true });

      if (detectedMime === 'image/png') {
        transformer = transformer.png();
      } else {
        transformer = transformer.jpeg();
      }
      finalBuffer = await transformer.toBuffer();
    } else {
      // PDF saved as-is
      finalBuffer = buffer;
    }

    // 4. Compute properties
    const sha256 = crypto.createHash('sha256').update(finalBuffer).digest('hex');
    const safeName = sanitizeFilename(originalName);

    const config = await this.configService.get();
    const retentionDays = config.retention_days?.attachment || 365;
    const purgeAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

    const attachment = this.attachmentRepo.create({
      conversation_id: conversationId,
      request_id: requestId || null,
      ticket_id: ticketId || null,
      original_name: safeName,
      detected_mime: detectedMime,
      size_bytes: finalBuffer.length,
      sha256,
      content: finalBuffer,
      status: 'stored',
      purge_at: purgeAt,
    });

    return await this.attachmentRepo.save(attachment);
  }

  async read(
    id: string,
  ): Promise<{ buffer: Buffer; mime: string; name: string } | null> {
    const attachment = await this.attachmentRepo.findOne({ where: { id } });
    if (!attachment) {
      return null;
    }
    return {
      buffer: attachment.content,
      mime: attachment.detected_mime,
      name: attachment.original_name,
    };
  }
}
