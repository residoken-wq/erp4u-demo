import { Injectable, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { MaterialsService } from '../materials/materials.service';
import { ProductsService } from '../products/products.service';
import { SalesService } from '../sales/sales.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/product.entity';
import { Material } from '../materials/material.entity';
import { BOM } from '../bom/bom.entity';
import { ProductComponent } from '../products/product-component.entity';
import { Customer, CustomerType } from '../customers/customer.entity';
import { Supplier, SupplierType } from '../suppliers/supplier.entity';
import { SystemConfig } from '../system/system-config.entity';

@Injectable()
export class UploadService {
  constructor(
    private materialsService: MaterialsService,
    private productsService: ProductsService,
    private salesService: SalesService,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(BOM) private bomRepo: Repository<BOM>,
    @InjectRepository(ProductComponent) private componentRepo: Repository<ProductComponent>,
    @InjectRepository(Customer) private customerRepo: Repository<Customer>,
    @InjectRepository(Supplier) private supplierRepo: Repository<Supplier>,
    @InjectRepository(SystemConfig) private configRepo: Repository<SystemConfig>,
  ) { }

  private removeDiacritics(str: string): string {
    return (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  private normalizeRow(row: any): Record<string, any> {
    const newRow: Record<string, any> = {};
    if (!row || typeof row !== 'object') return newRow;
    Object.keys(row).forEach(key => {
      if (key) {
        const rawKey = key.toString().trim();
        // Lowercase trim
        newRow[rawKey.toLowerCase()] = row[key];
        // Cleaned key: remove diacritics, spaces, punctuation
        const cleanKey = this.removeDiacritics(rawKey)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');
        newRow[cleanKey] = row[key];
      }
    });
    return newRow;
  }

  private parseNumber(val: any, defaultVal = 0): number {
    if (val === undefined || val === null || val === '') return defaultVal;
    if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
    let str = val.toString().trim();
    // Handle Vietnamese format: 1.000.000 or 1,000,000 or 1.5
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(str)) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(str)) {
      str = str.replace(/,/g, '');
    } else if (str.includes(',') && !str.includes('.')) {
      str = str.replace(',', '.');
    }
    const num = Number(str);
    return isNaN(num) ? defaultVal : num;
  }

  private parseDate(val: any): Date {
    if (!val) return new Date();
    if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
    if (typeof val === 'number') {
      // Excel serial date to JS Date
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      return isNaN(date.getTime()) ? new Date() : date;
    }
    const str = val.toString().trim();
    const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
      const d = parseInt(dmyMatch[1], 10);
      const m = parseInt(dmyMatch[2], 10) - 1;
      const y = parseInt(dmyMatch[3], 10);
      const parsed = new Date(y, m, d);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    const parsed = new Date(str);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  // 0. UPLOAD IMAGE
  async uploadImage(file: Express.Multer.File, source?: string) {
    const prefix = source === 'erp' ? 'erp' : 'img';
    return this.saveFile(file, prefix, true); // compress images
  }

  async uploadFile(file: Express.Multer.File, source?: string) {
    const prefix = source === 'erp' ? 'erp' : 'file';
    return this.saveFile(file, prefix, true); // compress if image
  }

  private async saveFile(file: Express.Multer.File, prefix: string, compressImages = true) {
    const fs = require('fs');
    const path = require('path');

    // Use project root 'uploads' directory for reliability
    const uploadDir = path.join(process.cwd(), 'uploads');

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Check if file is an image
    const ext = path.extname(file.originalname).toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
    const isWatermarkable = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext); // Exclude GIF

    let buffer = file.buffer;
    let finalExt = ext;

    // Compress image if applicable
    if (isImage && compressImages && buffer.length > 50 * 1024) { // Only compress if > 50KB
      try {
        const sharp = require('sharp');

        const sharpInstance = sharp(buffer).withMetadata().resize(1920, 1920, {
          fit: 'inside',
          withoutEnlargement: true
        });

        if (ext === '.png') {
          sharpInstance.png({ compressionLevel: 9 });
        } else if (ext === '.webp') {
          sharpInstance.webp({ quality: 80 });
        } else if (ext === '.gif') {
          sharpInstance.gif();
        } else {
          sharpInstance.jpeg({ quality: 80 });
          finalExt = '.jpg';
        }

        const compressed = await sharpInstance.toBuffer();

        // Use compressed only if smaller
        if (compressed.length < buffer.length) {
          buffer = compressed;
          console.log(`Image compressed: ${file.originalname} ${file.buffer.length} -> ${buffer.length} bytes (${Math.round((1 - buffer.length / file.buffer.length) * 100)}% saved)`);
        } else {
          finalExt = ext; // Revert extension if compression didn't help
        }
      } catch (err) {
        console.warn('Image compression failed, using original:', err.message);
        // Keep original buffer if compression fails
      }
    }

    // Preserve original filename (sanitize special chars, keep readable)
    const originalName = path.basename(file.originalname, ext);
    let safeName = originalName
      .normalize('NFC')                           // normalize unicode
      .replace(/[<>:"\/\\|?*]/g, '')              // remove filesystem-unsafe chars
      .replace(/\s+/g, '_')                      // spaces -> underscores
      .substring(0, 100);                        // limit length

    // Add prefix for ERP uploads
    if (prefix === 'erp') {
      safeName = `erp_${safeName}`;
    }

    let filename = `${safeName}${finalExt}`;
    let filePath = path.join(uploadDir, filename);

    // If file already exists, append timestamp to avoid overwrite
    if (fs.existsSync(filePath)) {
      filename = `${safeName}_${Date.now()}${finalExt}`;
      filePath = path.join(uploadDir, filename);
    }

    // Save original to _originals/ directory (for watermark regeneration)
    if (isWatermarkable) {
      const originalsDir = path.join(uploadDir, '_originals');
      if (!fs.existsSync(originalsDir)) {
        fs.mkdirSync(originalsDir, { recursive: true });
      }
      fs.writeFileSync(path.join(originalsDir, filename), buffer);
    }

    // Apply watermark if enabled and image qualifies
    if (isWatermarkable) {
      // 1. General watermark
      let generalBuffer = buffer;
      try {
        generalBuffer = await this.applyWatermark(buffer, 'watermark_config');
      } catch (err) {
        console.warn('General watermark failed, using original:', err.message);
      }
      fs.writeFileSync(filePath, generalBuffer);

      // 2. B2B watermark
      let b2bBuffer = buffer;
      try {
        b2bBuffer = await this.applyWatermark(buffer, 'watermark_b2b_config');
      } catch (err) {
        console.warn('B2B watermark failed, using original:', err.message);
      }
      const b2bDir = path.join(uploadDir, '_b2b');
      if (!fs.existsSync(b2bDir)) {
        fs.mkdirSync(b2bDir, { recursive: true });
      }
      fs.writeFileSync(path.join(b2bDir, filename), b2bBuffer);
    } else {
      fs.writeFileSync(filePath, buffer);
    }

    // Return backend API URL for serving
    return { url: `/uploads/${filename}` };
  }

  // Helper to serve file
  async serveFile(filename: string, res: any) {
    const fs = require('fs');
    const path = require('path');

    // Security: Prevent path traversal
    const safeName = path.basename(filename);

    // Check 'uploads' at project root
    const filePath = path.join(process.cwd(), 'uploads', safeName);

    console.log(`Serving file: ${safeName} from ${filePath}`); // Debug log

    if (fs.existsSync(filePath)) {
      // Get file stats for Content-Length
      const stat = fs.statSync(filePath);

      // Explicitly set Content-Type based on extension
      const ext = path.extname(safeName).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };

      const contentType = mimeTypes[ext] || 'application/octet-stream';
      const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext);

      res.set('Content-Type', contentType);
      res.set('Content-Length', stat.size);
      res.set('Content-Disposition', isImage ? 'inline' : `attachment; filename="${safeName}"`);
      res.set('Cache-Control', 'public, max-age=86400'); // Cache 1 day
      res.set('Access-Control-Allow-Origin', '*'); // CORS - allow all origins
      res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.set('Access-Control-Allow-Headers', '*');
      res.set('X-Content-Type-Options', 'nosniff'); // Security header

      // Use stream for better proxy compatibility
      const stream = fs.createReadStream(filePath);
      return stream.pipe(res);
    }

    // Fallback: Check 'frontend/public/uploads' (legacy/dev)
    const fallbackPath = path.join(process.cwd(), 'frontend', 'public', 'uploads', safeName);
    if (fs.existsSync(fallbackPath)) {
      const stat = fs.statSync(fallbackPath);
      const ext = path.extname(safeName).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.set('Content-Type', contentType);
      res.set('Content-Length', stat.size);
      res.set('Access-Control-Allow-Origin', '*');
      res.set('X-Content-Type-Options', 'nosniff');
      const stream = fs.createReadStream(fallbackPath);
      return stream.pipe(res);
    }

    console.error(`File not found: ${filePath}`);
    return res.status(404).send('File not found');
  }

  // Helper to delete file physically
  async deleteFile(filename: string) {
    const fs = require('fs');
    const path = require('path');

    // Security: Prevent path traversal
    const safeName = path.basename(filename);

    // Check 'uploads' at project root
    const filePath = path.join(process.cwd(), 'uploads', safeName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return { success: true, message: 'File deleted' };
    }

    // Fallback: Check 'frontend/public/uploads' (legacy/dev)
    const fallbackPath = path.join(process.cwd(), 'frontend', 'public', 'uploads', safeName);
    if (fs.existsSync(fallbackPath)) {
      fs.unlinkSync(fallbackPath);
      return { success: true, message: 'File deleted (legacy path)' };
    }

    // File not found - still return success (idempotent delete)
    return { success: true, message: 'File not found, already deleted' };
  }

  // ============================================
  // WATERMARK METHODS
  // ============================================

  async getWatermarkConfig(configKey: string = 'watermark_config'): Promise<{ enabled: boolean; position: string; opacity: number; sizeRatio: number; imageFile: string }> {
    try {
      const config = await this.configRepo.findOne({ where: { key: configKey } });
      if (config && config.value) {
        return JSON.parse(config.value);
      }
    } catch (e) {
      console.warn(`Failed to load ${configKey}:`, e.message);
    }
    return { enabled: false, position: 'southeast', opacity: 0.4, sizeRatio: 0.25, imageFile: '' };
  }

  async saveWatermarkConfig(cfg: any, configKey: string = 'watermark_config'): Promise<{ success: boolean }> {
    const value = JSON.stringify(cfg);
    const existing = await this.configRepo.findOne({ where: { key: configKey } });
    if (existing) {
      existing.value = value;
      await this.configRepo.save(existing);
    } else {
      await this.configRepo.save({ key: configKey, value, description: `${configKey} configuration` });
    }
    return { success: true };
  }

  async setWatermarkImage(file: Express.Multer.File, configKey: string = 'watermark_config'): Promise<{ url: string }> {
    const fs = require('fs');
    const path = require('path');
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const filename = configKey === 'watermark_b2b_config' ? '_watermark_b2b.png' : '_watermark.png';
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, file.buffer);

    // Update config with filename
    const config = await this.getWatermarkConfig(configKey);
    config.imageFile = filename;
    config.enabled = true;
    await this.saveWatermarkConfig(config, configKey);

    return { url: `/uploads/${filename}` };
  }

  private async applyWatermark(imageBuffer: Buffer, configKey: string = 'watermark_config'): Promise<Buffer> {
    const sharp = require('sharp');
    const fs = require('fs');
    const path = require('path');

    const config = await this.getWatermarkConfig(configKey);
    if (!config.enabled || !config.imageFile) return imageBuffer;

    const watermarkPath = path.join(process.cwd(), 'uploads', config.imageFile);
    if (!fs.existsSync(watermarkPath)) return imageBuffer;

    // Get image dimensions — skip small images
    const metadata = await sharp(imageBuffer).metadata();
    const imgWidth = metadata.width || 0;
    const imgHeight = metadata.height || 0;
    if (imgWidth < 150 || imgHeight < 150) return imageBuffer; // Skip small images

    // Resize watermark proportionally
    const wmWidth = Math.max(80, Math.round(imgWidth * (config.sizeRatio || 0.25)));
    const opacity = Math.max(0.05, Math.min(1, config.opacity || 0.4));

    // Create semi-transparent watermark
    const watermarkResized = await sharp(watermarkPath)
      .resize(wmWidth, null, { fit: 'inside', withoutEnlargement: true })
      .toBuffer();

    // Apply opacity using a transparent overlay
    const wmMeta = await sharp(watermarkResized).metadata();
    const opacityOverlay = Buffer.from(
      `<svg width="${wmMeta.width}" height="${wmMeta.height}"><rect width="100%" height="100%" fill-opacity="${opacity}" fill="white"/></svg>`
    );
    const watermarkWithOpacity = await sharp(watermarkResized)
      .composite([{ input: opacityOverlay, blend: 'dest-in' }])
      .png()
      .toBuffer();

    // Map position string to sharp gravity
    const gravityMap: Record<string, string> = {
      'northwest': 'northwest', 'north': 'north', 'northeast': 'northeast',
      'west': 'west', 'center': 'centre', 'east': 'east',
      'southwest': 'southwest', 'south': 'south', 'southeast': 'southeast',
    };
    const gravity = gravityMap[config.position] || 'southeast';

    // Composite onto original image
    const result = await sharp(imageBuffer)
      .withMetadata()
      .composite([{
        input: watermarkWithOpacity,
        gravity: gravity as any,
      }])
      .toBuffer();

    console.log(`Watermark applied: ${imgWidth}x${imgHeight}, wm=${wmWidth}px, opacity=${opacity}, pos=${gravity}`);
    return result;
  }

  async serveOriginalFile(filename: string, res: any) {
    const fs = require('fs');
    const path = require('path');
    const safeName = path.basename(filename);
    const originalPath = path.join(process.cwd(), 'uploads', '_originals', safeName);

    if (fs.existsSync(originalPath)) {
      const stat = fs.statSync(originalPath);
      const ext = path.extname(safeName).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
        '.gif': 'image/gif', '.webp': 'image/webp',
      };
      res.set('Content-Type', mimeTypes[ext] || 'application/octet-stream');
      res.set('Content-Length', stat.size);
      res.set('Cache-Control', 'public, max-age=86400');
      res.set('Access-Control-Allow-Origin', '*');
      const stream = fs.createReadStream(originalPath);
      return stream.pipe(res);
    }

    // Fallback to regular file if no original
    return this.serveFile(filename, res);
  }

  async serveB2BFile(filename: string, res: any) {
    const fs = require('fs');
    const path = require('path');
    const safeName = path.basename(filename);
    const b2bPath = path.join(process.cwd(), 'uploads', '_b2b', safeName);

    if (fs.existsSync(b2bPath)) {
      const stat = fs.statSync(b2bPath);
      const ext = path.extname(safeName).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
        '.gif': 'image/gif', '.webp': 'image/webp',
      };
      res.set('Content-Type', mimeTypes[ext] || 'application/octet-stream');
      res.set('Content-Length', stat.size);
      res.set('Cache-Control', 'public, max-age=86400');
      res.set('Access-Control-Allow-Origin', '*');
      const stream = fs.createReadStream(b2bPath);
      return stream.pipe(res);
    }

    // Fallback to regular file if no B2B specific version exists
    return this.serveFile(filename, res);
  }

  async regenerateAllWatermarks(): Promise<{ processed: number; skipped: number; errors: string[] }> {
    const fs = require('fs');
    const path = require('path');
    const sharp = require('sharp');

    const originalsDir = path.join(process.cwd(), 'uploads', '_originals');
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const errors: string[] = [];
    let processed = 0;
    let skipped = 0;

    // If no originals dir, copy current files to originals first
    if (!fs.existsSync(originalsDir)) {
      fs.mkdirSync(originalsDir, { recursive: true });
      // Copy existing images to originals
      const files = fs.readdirSync(uploadsDir).filter((f: string) =>
        /\.(jpg|jpeg|png|webp)$/i.test(f) && !f.startsWith('_')
      );
      for (const f of files) {
        try {
          fs.copyFileSync(path.join(uploadsDir, f), path.join(originalsDir, f));
        } catch (e) {
          errors.push(`Copy failed: ${f} - ${e.message}`);
        }
      }
    }

    // Process each original
    const originals = fs.readdirSync(originalsDir).filter((f: string) =>
      /\.(jpg|jpeg|png|webp)$/i.test(f)
    );

    for (const filename of originals) {
      try {
        const originalBuffer = fs.readFileSync(path.join(originalsDir, filename));

        // Check dimensions — skip small images
        const meta = await sharp(originalBuffer).metadata();
        if ((meta.width || 0) < 150 || (meta.height || 0) < 150) {
          skipped++;
          continue;
        }

        const generalWatermarked = await this.applyWatermark(originalBuffer, 'watermark_config');
        fs.writeFileSync(path.join(uploadsDir, filename), generalWatermarked);

        const b2bWatermarked = await this.applyWatermark(originalBuffer, 'watermark_b2b_config');
        const b2bDir = path.join(uploadsDir, '_b2b');
        if (!fs.existsSync(b2bDir)) fs.mkdirSync(b2bDir, { recursive: true });
        fs.writeFileSync(path.join(b2bDir, filename), b2bWatermarked);
        processed++;
      } catch (e) {
        errors.push(`${filename}: ${e.message}`);
      }
    }

    return { processed, skipped, errors };
  }

  // 1. IMPORT NGUYEN LIEU
  async importMaterials(buffer: Buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    let count = 0;
    const errors: any[] = [];
    let rowIdx = 1;

    for (const rawRow of data) {
      rowIdx++;
      const row = this.normalizeRow(rawRow);
      try {
        const code = row['code'] || row['ma'] || row['manl'] || row['manguyenlieu'] || row['materialcode'];
        if (!code) continue;

        const unit = (row['unit'] || row['dvt'] || row['dvttieuhao'] || row['donvitinh'] || 'pcs').toString().trim();
        const purchaseUnit = (row['purchaseunit'] || row['purchase_unit'] || row['dvtmua'] || row['dvtmuahang'] || unit).toString().trim();
        const conversionFactor = this.parseNumber(row['conversionfactor'] || row['conversion_factor'] || row['heso'] || row['hesoquydoi'] || row['quydoi'], 1);
        const costPerUnit = this.parseNumber(row['costperunit'] || row['cost_per_unit'] || row['price'] || row['gia'] || row['dongia'] || row['giamua'], 0);
        const costPrice = this.parseNumber(row['costprice'] || row['cost_price'] || row['giavon'] || row['gia_von'], costPerUnit);
        const qtyInStock = this.parseNumber(row['quantityinstock'] || row['qty'] || row['ton'] || row['tonkho'] || row['soluong'], 0);
        const supplierName = (row['supplier'] || row['suppliername'] || row['supplier_name'] || row['ncc'] || row['nhacungcap'] || '').toString().trim() || null;

        const matData: Partial<Material> = {
          code: code.toString().trim(),
          name: (row['name'] || row['ten'] || row['tennguyenlieu'] || 'No Name').toString().trim(),
          category: (row['category'] || row['nhom'] || row['nhomnguyenlieu'] || 'General').toString().trim(),
          material_type: (row['materialtype'] || row['material_type'] || row['type'] || row['loai'] || row['loainguyenlieu'] || 'General').toString().trim(),
          unit: unit,
          purchase_unit: purchaseUnit,
          conversion_factor: conversionFactor,
          cost_per_unit: costPerUnit,
          cost_price: costPrice,
          quantity_in_stock: qtyInStock,
          supplier_name: supplierName
        };

        const existing = await this.materialsService.findOneByCode(matData.code);
        if (existing) {
          await this.materialsService.materialRepo.update(existing.id, matData);
        } else {
          await this.materialsService.materialRepo.save(matData);
        }
        count++;
      } catch (e: any) {
        errors.push({ row: rowIdx, code: rawRow['Code'] || rawRow['Mã'] || rawRow['code'], error: e.message });
      }
    }
    return { message: `Imported ${count} nguyên liệu`, count, errors };
  }

  // 2. IMPORT SAN PHAM
  async importProducts(buffer: Buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    let count = 0;
    const errors: any[] = [];
    let rowIdx = 1;

    for (const rawRow of data) {
      rowIdx++;
      const row = this.normalizeRow(rawRow);
      try {
        const sku = row['sku'] || row['ma'] || row['masp'] || row['masanpham'] || row['productsku'];
        if (!sku) continue;

        const attributes = {
          color: (row['color'] || row['mau'] || row['mausac'] || '').toString().trim(),
          size: (row['size'] || row['kichthuoc'] || row['quycachsize'] || '').toString().trim(),
          fabric: (row['fabric'] || row['chatlieu'] || row['vai'] || '').toString().trim()
        };

        const rawTags = row['tags'] || row['tag'] || row['the'];
        let tags: string[] = [];
        if (Array.isArray(rawTags)) {
          tags = rawTags;
        } else if (typeof rawTags === 'string') {
          tags = rawTags.split(',').map(t => t.trim()).filter(Boolean);
        }

        const basePrice = this.parseNumber(row['baseprice'] || row['base_price'] || row['price'] || row['gia'] || row['giaban'] || row['dongia'], 0);
        const costPrice = this.parseNumber(row['costprice'] || row['cost_price'] || row['giavon'] || row['gia_von'], 0);
        const profitMargin = this.parseNumber(row['profitmargin'] || row['profit_margin'] || row['loinhuan'] || row['margin'], 0);
        const qtyInStock = this.parseNumber(row['quantityinstock'] || row['qty'] || row['ton'] || row['tonkho'] || row['soluong'], 0);

        const customerDesc = (row['customerdescription'] || row['customer_description'] || row['motakhachhang'] || row['motabaogia'] || row['mota'] || '').toString().trim() || null;
        const processingDesc = (row['processingdescription'] || row['processing_description'] || row['motagiacong'] || row['quycachgiacong'] || '').toString().trim() || null;
        const vatDesc = (row['vatdescription'] || row['vat_description'] || row['motavat'] || row['tenvat'] || '').toString().trim() || null;
        const imageUrl = (row['imageurl'] || row['image_url'] || row['image'] || row['hinhanh'] || row['anh'] || '').toString().trim() || null;
        const websiteDisplayName = (row['websitedisplayname'] || row['website_display_name'] || row['tenwebsite'] || '').toString().trim() || null;

        const productData: any = {
          sku: sku.toString().trim(),
          name: (row['name'] || row['ten'] || row['tensp'] || row['tensanpham'] || 'No Name').toString().trim(),
          category: (row['category'] || row['nhom'] || row['nhomsp'] || 'General').toString().trim(),
          product_type: (row['producttype'] || row['product_type'] || row['type'] || row['loai'] || row['loaisp'] || 'Finished').toString().trim(),
          unit: (row['unit'] || row['dvt'] || row['donvitinh'] || 'cai').toString().trim(),
          base_price: basePrice,
          cost_price: costPrice,
          profit_margin: profitMargin > 0 ? profitMargin : null,
          quantity_in_stock: qtyInStock,
          customer_description: customerDesc,
          processing_description: processingDesc,
          vat_description: vatDesc,
          image_url: imageUrl,
          tags: tags,
          attributes: attributes,
          is_active: true
        };

        if (websiteDisplayName) productData.website_display_name = websiteDisplayName;

        const existing = await this.productsService.findOneBySku(productData.sku);
        if (existing) {
          await this.productRepo.update(existing.id, productData);
        } else {
          await this.productRepo.save(productData);
        }
        count++;
      } catch (e: any) {
        errors.push({ row: rowIdx, sku: rawRow['SKU'] || rawRow['Mã'] || rawRow['sku'], error: e.message });
      }
    }
    return { message: `Imported ${count} sản phẩm`, count, errors };
  }

  // 3. IMPORT BOM
  async importBoms(buffer: Buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    let count = 0;
    const errors: any[] = [];
    let rowIdx = 1;

    for (const rawRow of data) {
      rowIdx++;
      const row = this.normalizeRow(rawRow);
      try {
        const sku = (row['productsku'] || row['masp'] || row['sku'] || row['masanpham'] || '').toString().trim();
        const matCode = (row['materialcode'] || row['manl'] || row['code'] || row['manguyenlieu'] || '').toString().trim();
        const qty = this.parseNumber(row['quantity'] || row['sl'] || row['dinhmuc'] || row['soluong'], 0);
        const waste = this.parseNumber(row['waste'] || row['haohut'] || row['wastepercent'] || row['waste_percent'] || row['tylehaohut'], 0);
        const note = (row['note'] || row['ghichu'] || row['diengiai'] || '').toString().trim() || null;

        if (!sku || !matCode) {
          errors.push({ row: rowIdx, error: 'Thiếu Mã SP (ProductSKU) hoặc Mã NL (MaterialCode)' });
          continue;
        }

        const product = await this.productsService.findOneBySku(sku);
        if (!product) {
          errors.push({ row: rowIdx, error: `Không tìm thấy sản phẩm với SKU: ${sku}` });
          continue;
        }

        const material = await this.materialsService.findOneByCode(matCode);
        if (!material) {
          errors.push({ row: rowIdx, error: `Không tìm thấy nguyên liệu với Mã: ${matCode}` });
          continue;
        }

        const existingBom = await this.bomRepo.findOne({ where: { product_id: product.id, material_id: material.id } });
        if (existingBom) {
          existingBom.quantity = qty;
          existingBom.waste_percent = waste;
          if (note !== null) existingBom.note = note;
          await this.bomRepo.save(existingBom);
        } else {
          const newBom = new BOM();
          newBom.product = product;
          newBom.product_id = product.id;
          newBom.material = material;
          newBom.material_id = material.id;
          newBom.quantity = qty;
          newBom.waste_percent = waste;
          newBom.note = note;
          await this.bomRepo.save(newBom);
        }
        count++;
      } catch (e: any) {
        errors.push({ row: rowIdx, error: e.message });
      }
    }
    return { message: `Imported ${count} dòng định mức BOM`, count, errors };
  }

  // 4. IMPORT COMBOS
  async importCombos(buffer: Buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    let count = 0;
    const errors: any[] = [];
    let rowIdx = 1;

    for (const rawRow of data) {
      rowIdx++;
      const row = this.normalizeRow(rawRow);
      try {
        const parentSku = (row['parentsku'] || row['mabosp'] || row['maspcha'] || row['mame'] || row['mabocombo'] || '').toString().trim();
        const childSku = (row['childsku'] || row['maspcon'] || row['macon'] || row['mathanhphan'] || '').toString().trim();
        const qty = this.parseNumber(row['quantity'] || row['sl'] || row['soluong'], 1);
        const sortOrder = this.parseNumber(row['sortorder'] || row['sort_order'] || row['thutu'] || row['order'], 0);

        if (!parentSku || !childSku) {
          errors.push({ row: rowIdx, error: 'Thiếu Mã Combo (ParentSKU) hoặc Mã SP con (ChildSKU)' });
          continue;
        }

        const parent = await this.productsService.findOneBySku(parentSku);
        if (!parent) {
          errors.push({ row: rowIdx, error: `Không tìm thấy SP cha/bộ với SKU: ${parentSku}` });
          continue;
        }

        const child = await this.productsService.findOneBySku(childSku);
        if (!child) {
          errors.push({ row: rowIdx, error: `Không tìm thấy SP con với SKU: ${childSku}` });
          continue;
        }

        const existing = await this.componentRepo.findOne({
          where: { parent_product: { id: parent.id }, child_product: { id: child.id } }
        });

        if (existing) {
          existing.quantity = qty;
          existing.sort_order = sortOrder;
          await this.componentRepo.save(existing);
        } else {
          const newComp = new ProductComponent();
          newComp.parent_product = parent;
          newComp.child_product = child;
          newComp.quantity = qty;
          newComp.sort_order = sortOrder;
          await this.componentRepo.save(newComp);
        }
        count++;
      } catch (e: any) {
        errors.push({ row: rowIdx, error: e.message });
      }
    }
    return { message: `Imported ${count} thành phần Combo`, count, errors };
  }

  // 5. IMPORT CUSTOMERS (CRM)
  async importCustomers(buffer: Buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    let count = 0;
    const errors: any[] = [];
    let rowIdx = 1;

    for (const rawRow of data) {
      rowIdx++;
      const row = this.normalizeRow(rawRow);
      try {
        const code = (row['code'] || row['ma'] || row['makh'] || row['makhachhang'] || '').toString().trim();
        if (!code) continue;

        // Chuẩn hóa Type: LEAD hoặc CUSTOMER
        let type = CustomerType.LEAD;
        const rawType = (row['type'] || row['loai'] || '').toString().toUpperCase();
        if (rawType.includes('CUST') || rawType.includes('KHACH') || rawType.includes('KH')) {
          type = CustomerType.CUSTOMER;
        }

        const customerData: Partial<Customer> = {
          code: code,
          name: (row['name'] || row['ten'] || row['tenkh'] || row['tenkhachhang'] || 'No Name').toString().trim(),
          type: type,
          lead_status: (row['leadstatus'] || row['lead_status'] || row['trangthai'] || '').toString().trim() || null,
          lead_source: (row['leadsource'] || row['lead_source'] || row['nguon'] || '').toString().trim() || null,
          phone: (row['phone'] || row['sdt'] || row['dienthoai'] || '').toString().trim() || null,
          email: (row['email'] || '').toString().trim() || null,
          address: (row['address'] || row['diachi'] || '').toString().trim() || null,
          province: (row['province'] || row['tinh'] || row['thanhpho'] || row['tinhthanh'] || '').toString().trim() || null,
          district: (row['district'] || row['huyen'] || row['quanhuyen'] || row['quan'] || '').toString().trim() || null,
          tax_code: (row['taxcode'] || row['tax_code'] || row['tax'] || row['mst'] || row['masothue'] || '').toString().trim() || null,
          legal_name: (row['legalname'] || row['legal_name'] || row['tenphapnhan'] || row['tencongty'] || '').toString().trim() || null,
          legal_address: (row['legaladdress'] || row['legal_address'] || row['diachiphapnhan'] || row['diachixuathd'] || '').toString().trim() || null,
          legal_representative: (row['legalrepresentative'] || row['legal_representative'] || row['nguoidaidien'] || '').toString().trim() || null,
          einvoice_email: (row['einvoiceemail'] || row['einvoice_email'] || row['emailhoadon'] || row['emailhd'] || '').toString().trim() || null,
          credit_limit: this.parseNumber(row['creditlimit'] || row['credit_limit'] || row['limit'] || row['hanmuc'] || row['hanmucno'], 0),
          facebook: (row['facebook'] || row['fb'] || '').toString().trim() || null,
          website: (row['website'] || row['web'] || '').toString().trim() || null,
        };

        const existing = await this.customerRepo.findOne({ where: { code: customerData.code } });
        if (existing) {
          await this.customerRepo.update(existing.id, customerData);
        } else {
          customerData.current_debt = 0;
          await this.customerRepo.save(customerData);
        }
        count++;
      } catch (e: any) {
        errors.push({ row: rowIdx, code: rawRow['Code'] || rawRow['Mã'] || rawRow['code'], error: e.message });
      }
    }
    return { message: `Imported ${count} khách hàng`, count, errors };
  }

  // 6. IMPORT SUPPLIERS
  async importSuppliers(buffer: Buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    let count = 0;
    const errors: any[] = [];
    let rowIdx = 1;

    for (const rawRow of data) {
      rowIdx++;
      const row = this.normalizeRow(rawRow);
      try {
        const code = (row['code'] || row['ma'] || row['mancc'] || row['manhacungcap'] || '').toString().trim();
        if (!code) continue;

        let type = SupplierType.MATERIAL;
        const rawType = (row['type'] || row['loai'] || '').toString().toUpperCase();
        if (rawType.includes('PROCESS') || rawType.includes('GIA CONG') || rawType.includes('GIACONG')) type = SupplierType.PROCESSING;
        else if (rawType.includes('LOGISTIC') || rawType.includes('VAN CHUYEN')) type = SupplierType.LOGISTICS;
        else if (rawType.includes('SERVICE') || rawType.includes('DICH VU')) type = SupplierType.SERVICE;
        else if (rawType.includes('MIX')) type = SupplierType.MIX;
        else if (rawType.includes('OTHER') || rawType.includes('KHAC')) type = SupplierType.OTHER;

        const supplierData: Partial<Supplier> = {
          code: code,
          name: (row['name'] || row['ten'] || row['tenncc'] || row['tennhacungcap'] || 'No Name').toString().trim(),
          type: type,
          phone: (row['phone'] || row['sdt'] || row['dienthoai'] || '').toString().trim() || null,
          email: (row['email'] || '').toString().trim() || null,
          address: (row['address'] || row['diachi'] || '').toString().trim() || null,
          tax_code: (row['taxcode'] || row['tax_code'] || row['tax'] || row['mst'] || row['masothue'] || '').toString().trim() || null,
          legal_name: (row['legalname'] || row['legal_name'] || row['tenphapnhan'] || row['tencongty'] || '').toString().trim() || null,
          vat_address: (row['vataddress'] || row['vat_address'] || row['diachivat'] || row['diachixuathd'] || '').toString().trim() || null,
          note: (row['note'] || row['ghichu'] || row['ghi_chu'] || '').toString().trim() || null,
          debt: this.parseNumber(row['debt'] || row['congno'] || row['du_no'], 0)
        };

        const existing = await this.supplierRepo.findOne({ where: { code: supplierData.code } });
        if (existing) {
          await this.supplierRepo.update(existing.id, supplierData);
        } else {
          await this.supplierRepo.save(supplierData);
        }
        count++;
      } catch (e: any) {
        errors.push({ row: rowIdx, code: rawRow['Code'] || rawRow['Mã'] || rawRow['code'], error: e.message });
      }
    }
    return { message: `Imported ${count} nhà cung cấp`, count, errors };
  }

  // 7. IMPORT SALES ORDERS
  async importSalesOrders(buffer: Buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    const ordersMap = new Map();
    const errors: any[] = [];
    let count = 0;
    let rowIdx = 1;

    // Group rows by CustomerCode + OrderDate + ShippingAddress to create single order with multiple items
    for (const rawRow of data) {
      rowIdx++;
      const row = this.normalizeRow(rawRow);
      try {
        const customerCode = (row['customercode'] || row['makh'] || row['makhachhang'] || '').toString().trim();
        if (!customerCode) continue;

        const orderDate = this.parseDate(row['orderdate'] || row['ngaydat'] || row['ngay_dat'] || row['ngay']);
        const deliveryDateVal = row['deliverydate'] || row['ngaygiao'] || row['ngay_giao'] || row['ngayhengiao'];
        const deliveryDate = deliveryDateVal ? this.parseDate(deliveryDateVal) : null;

        const sku = (row['productsku'] || row['masp'] || row['sku'] || row['masanpham'] || '').toString().trim();
        const qty = this.parseNumber(row['quantity'] || row['sl'] || row['soluong'], 0);
        const price = this.parseNumber(row['unitprice'] || row['dongia'] || row['gia'] || row['price'], 0);

        if (!sku || qty <= 0) {
          errors.push({ row: rowIdx, error: `Dòng ${rowIdx}: SKU (${sku}) hoặc Số lượng (${qty}) không hợp lệ` });
          continue;
        }

        const receiverName = (row['receivername'] || row['nguoinhan'] || row['tennguoinhan'] || '').toString().trim() || null;
        const receiverPhone = (row['receiverphone'] || row['sdtnhan'] || row['dienthoainhan'] || '').toString().trim() || null;
        const shippingAddress = (row['shippingaddress'] || row['diachigiao'] || row['diachi_giao'] || '').toString().trim() || null;
        const discountRate = this.parseNumber(row['discountrate'] || row['discount'] || row['chietkhau'] || row['ck'], 0);
        const vatRate = this.parseNumber(row['vatrate'] || row['vat'] || row['thuevat'] || row['thue'], 0);
        const orderNotes = (row['ordernote'] || row['notes'] || row['ghichu'] || row['ghichudon'] || '').toString().trim();

        const variantColor = (row['variantcolor'] || row['color'] || row['mau'] || row['mausac'] || '').toString().trim() || null;
        const itemNote = (row['itemnote'] || row['ghichusp'] || row['customernote'] || '').toString().trim() || null;
        const vatContent = (row['vatcontent'] || row['noidungvat'] || '').toString().trim() || null;

        const key = `${customerCode}_${orderDate.toISOString().slice(0, 10)}_${shippingAddress || ''}_${orderNotes}`;

        if (!ordersMap.has(key)) {
          ordersMap.set(key, {
            customerCode,
            orderDate,
            deliveryDate,
            receiverName,
            receiverPhone,
            shippingAddress,
            discountRate,
            vatRate,
            notes: orderNotes,
            items: []
          });
        }

        ordersMap.get(key).items.push({
          sku,
          quantity: qty,
          unit_price: price,
          price: price,
          variant_color: variantColor,
          customer_note: itemNote,
          vat_content: vatContent
        });
      } catch (e: any) {
        errors.push({ row: rowIdx, error: e.message });
      }
    }

    // Process each grouped order
    for (const [key, orderData] of ordersMap.entries()) {
      try {
        const customer = await this.customerRepo.findOne({ where: { code: orderData.customerCode } });
        if (!customer) {
          errors.push({ key, error: `Không tìm thấy khách hàng với mã: ${orderData.customerCode}` });
          continue;
        }

        // Create Order via SalesService
        const newOrder = await this.salesService.createOrder({
          customer_id: customer.id,
          customer_name: customer.name,
          order_date: orderData.orderDate,
          delivery_date: orderData.deliveryDate,
          receiver_name: orderData.receiverName || customer.name,
          receiver_phone: orderData.receiverPhone || customer.phone,
          shipping_address: orderData.shippingAddress || customer.address,
          discount_rate: orderData.discountRate,
          vat_rate: orderData.vatRate,
          note: orderData.notes,
          items: orderData.items
        });

        if (newOrder) count++;
      } catch (e: any) {
        errors.push({ key, error: e.message });
      }
    }

    return { message: `Đã tạo thành công ${count} đơn hàng`, count, errors };
  }

  // 8. TEMPLATES
  getTemplate(type: string): Buffer {
    let headers: string[] = [];
    let sampleData: any[] = [];

    if (type === 'materials') {
      headers = ['Code', 'Name', 'Category', 'Type', 'Unit', 'PurchaseUnit', 'ConversionFactor', 'CostPerUnit', 'CostPrice', 'Qty', 'Supplier'];
      sampleData = [
        {
          Code: 'VAI_COTTON_TRANG',
          Name: 'Vải Cotton Trắng Cao Cấp',
          Category: 'Vải chính',
          Type: 'Cotton 100%',
          Unit: 'm',
          PurchaseUnit: 'Cuộn',
          ConversionFactor: 100,
          CostPerUnit: 35000,
          CostPrice: 35000,
          Qty: 500,
          Supplier: 'Công ty Dệt May Việt Thắng'
        },
        {
          Code: 'GON_TAM_2P',
          Name: 'Gòn Tấm 2cm',
          Category: 'Gòn',
          Type: 'Gòn tấm',
          Unit: 'm',
          PurchaseUnit: 'Cuộn',
          ConversionFactor: 50,
          CostPerUnit: 25000,
          CostPrice: 25000,
          Qty: 200,
          Supplier: 'NCC Gòn Hoàng Gia'
        }
      ];
    } else if (type === 'products') {
      headers = ['SKU', 'Name', 'Category', 'Type', 'Unit', 'BasePrice', 'CostPrice', 'Qty', 'Color', 'Size', 'Fabric', 'CustomerDescription', 'ProcessingDescription', 'VatDescription', 'Tags', 'ImageUrl'];
      sampleData = [
        {
          SKU: 'NMN_XANH_120X60',
          Name: 'Nệm Mầm Non Xanh 120x60',
          Category: 'Nệm Mầm Non',
          Type: 'Finished',
          Unit: 'cai',
          BasePrice: 180000,
          CostPrice: 115000,
          Qty: 50,
          Color: 'Xanh dương',
          Size: '120x60x5cm',
          Fabric: 'Vải Cara',
          CustomerDescription: 'Nệm mầm non chần gòn êm ái, bọc vải Cara chống thấm, thoáng mát.',
          ProcessingDescription: 'May viền 4 cạnh bo góc, chần gòn ô vuông 10x10cm, khóa kéo giọt nước ẩn mặt đáy.',
          VatDescription: 'Nệm nằm trẻ em kích thước 120x60cm',
          Tags: 'Mầm non, Nệm, Cara',
          ImageUrl: 'https://drive.google.com/uc?id=example_file_id'
        },
        {
          SKU: 'GOI_NAM_MN',
          Name: 'Gối Nằm Mầm Non 30x40',
          Category: 'Gối Trẻ Em',
          Type: 'Finished',
          Unit: 'cai',
          BasePrice: 45000,
          CostPrice: 28000,
          Qty: 100,
          Color: 'Xanh dương',
          Size: '30x40cm',
          Fabric: 'Cotton Cara',
          CustomerDescription: 'Gối nằm êm ái, ruột gòn bi trắng kháng khuẩn.',
          ProcessingDescription: 'May lồng ruột gối, có khóa kéo giọt nước.',
          VatDescription: 'Gối nằm trẻ em kích thước 30x40cm',
          Tags: 'Mầm non, Gối',
          ImageUrl: ''
        }
      ];
    } else if (type === 'boms') {
      headers = ['ProductSKU', 'MaterialCode', 'Quantity', 'Waste', 'Note'];
      sampleData = [
        {
          ProductSKU: 'NMN_XANH_120X60',
          MaterialCode: 'VAI_COTTON_TRANG',
          Quantity: 1.5,
          Waste: 2,
          Note: 'Vải chính may 2 mặt nệm'
        },
        {
          ProductSKU: 'NMN_XANH_120X60',
          MaterialCode: 'GON_TAM_2P',
          Quantity: 1.2,
          Waste: 3,
          Note: 'Ruột gòn tấm chần trong'
        }
      ];
    } else if (type === 'combos') {
      headers = ['ParentSKU', 'ChildSKU', 'Quantity', 'SortOrder'];
      sampleData = [
        {
          ParentSKU: 'BO_NEM_GOI_MN',
          ChildSKU: 'NMN_XANH_120X60',
          Quantity: 1,
          SortOrder: 1
        },
        {
          ParentSKU: 'BO_NEM_GOI_MN',
          ChildSKU: 'GOI_NAM_MN',
          Quantity: 1,
          SortOrder: 2
        }
      ];
    } else if (type === 'customers') {
      headers = ['Code', 'Name', 'Type', 'LeadStatus', 'LeadSource', 'Phone', 'Email', 'Address', 'Province', 'District', 'TaxCode', 'LegalName', 'LegalAddress', 'LegalRepresentative', 'EinvoiceEmail', 'CreditLimit', 'Facebook', 'Website'];
      sampleData = [
        {
          Code: 'KH001',
          Name: 'Trường Mầm Non Hướng Dương',
          Type: 'CUSTOMER',
          LeadStatus: 'WON',
          LeadSource: 'REFERRAL',
          Phone: '0909123456',
          Email: 'huongduong.school@gmail.com',
          Address: '123 Nguyễn Văn Cừ, Phường 4',
          Province: 'TP. Hồ Chí Minh',
          District: 'Quận 5',
          TaxCode: '0301234567',
          LegalName: 'Công Ty Cổ Phần Giáo Dục Hướng Dương',
          LegalAddress: '123 Nguyễn Văn Cừ, Phường 4, Quận 5, TP. Hồ Chí Minh',
          LegalRepresentative: 'Nguyễn Văn A',
          EinvoiceEmail: 'ketoan@huongduong.edu.vn',
          CreditLimit: 50000000,
          Facebook: 'fb.com/mamnonhuongduong',
          Website: 'mamnonhuongduong.edu.vn'
        },
        {
          Code: 'LEAD001',
          Name: 'Trường Mầm Non Sao Mai',
          Type: 'LEAD',
          LeadStatus: 'QUALIFIED',
          LeadSource: 'FACEBOOK',
          Phone: '0988776655',
          Email: 'saomai.preschool@gmail.com',
          Address: '45 Lê Lợi',
          Province: 'Bình Dương',
          District: 'Thủ Dầu Một',
          TaxCode: '',
          LegalName: '',
          LegalAddress: '',
          LegalRepresentative: '',
          EinvoiceEmail: '',
          CreditLimit: 0,
          Facebook: 'fb.com/saomaipreschool',
          Website: ''
        }
      ];
    } else if (type === 'suppliers') {
      headers = ['Code', 'Name', 'Type', 'Phone', 'Email', 'Address', 'TaxCode', 'LegalName', 'VatAddress', 'Debt', 'Note'];
      sampleData = [
        {
          Code: 'NCC001',
          Name: 'Công ty Dệt May Việt Thắng',
          Type: 'MATERIAL',
          Phone: '0283899999',
          Email: 'sales@vietthangtextile.vn',
          Address: 'Khu phố 1, Linh Trung, TP. Thủ Đức',
          TaxCode: '0300123456',
          LegalName: 'Tổng Công Ty Cổ Phần Dệt May Thắng Lợi',
          VatAddress: 'Khu phố 1, Linh Trung, TP. Thủ Đức, TP. Hồ Chí Minh',
          Debt: 0,
          Note: 'Cung cấp vải Cotton, Cara, TC định lượng cao'
        },
        {
          Code: 'NCC002',
          Name: 'Xưởng Thêu Vi Tính Minh Phát',
          Type: 'PROCESSING',
          Phone: '0912345678',
          Email: 'theuminhphat@gmail.com',
          Address: 'Tân Bình, TP. Hồ Chí Minh',
          TaxCode: '0312987654',
          LegalName: 'Hộ Kinh Doanh Xưởng Thêu Minh Phát',
          VatAddress: 'Tân Bình, TP. Hồ Chí Minh',
          Debt: 0,
          Note: 'Chuyên thêu logo đồng phục, nệm trường học'
        }
      ];
    } else if (type === 'sales') {
      headers = ['CustomerCode', 'OrderDate', 'DeliveryDate', 'ProductSKU', 'Quantity', 'UnitPrice', 'VariantColor', 'ReceiverName', 'ReceiverPhone', 'ShippingAddress', 'DiscountRate', 'VatRate', 'ItemNote', 'OrderNote'];
      sampleData = [
        {
          CustomerCode: 'KH001',
          OrderDate: '2026-08-25',
          DeliveryDate: '2026-09-01',
          ProductSKU: 'NMN_XANH_120X60',
          Quantity: 30,
          UnitPrice: 180000,
          VariantColor: 'Xanh dương',
          ReceiverName: 'Cô Mai (Hiệu Trưởng)',
          ReceiverPhone: '0909123456',
          ShippingAddress: '123 Nguyễn Văn Cừ, P.4, Q.5, TP.HCM',
          DiscountRate: 5,
          VatRate: 8,
          ItemNote: 'Thêu logo trường ở góc trên bên phải',
          OrderNote: 'Giao trong giờ hành chính trước ngày khai giảng'
        },
        {
          CustomerCode: 'KH001',
          OrderDate: '2026-08-25',
          DeliveryDate: '2026-09-01',
          ProductSKU: 'GOI_NAM_MN',
          Quantity: 30,
          UnitPrice: 45000,
          VariantColor: 'Xanh dương',
          ReceiverName: 'Cô Mai (Hiệu Trưởng)',
          ReceiverPhone: '0909123456',
          ShippingAddress: '123 Nguyễn Văn Cừ, P.4, Q.5, TP.HCM',
          DiscountRate: 5,
          VatRate: 8,
          ItemNote: 'Kèm bao gối',
          OrderNote: 'Giao trong giờ hành chính trước ngày khai giảng'
        }
      ];
    } else {
      throw new BadRequestException('Loại template không hợp lệ: ' + type);
    }

    const ws = XLSX.utils.json_to_sheet(sampleData, { header: headers });
    return XLSX.write({ Sheets: { Sheet1: ws }, SheetNames: ['Sheet1'] }, { type: 'buffer', bookType: 'xlsx' });
  }
}