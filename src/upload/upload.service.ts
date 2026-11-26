import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type { Readable } from 'stream';
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
import { FILE_STORAGE, FileStorage } from '../common/storage/file-storage.interface';
import { DEFAULT_TENANT_CONTEXT, TenantContext } from '../common/tenancy/tenant-context';
import { resolveCoreAsset } from '../common/utils/asset-path.util';

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

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
    @Inject(FILE_STORAGE) private readonly fileStorage: FileStorage,
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

  async listFiles(source?: string) {
    const items = (await this.fileStorage.list?.()) ?? [];
    return items
      .filter((item) => {
        if (!/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(item.name)) return false;
        // CMS only sees its own files (which have no prefix) and not ERP files (which have 'erp_' prefix)
        if (source === 'cms' && item.name.startsWith('erp_')) return false;
        return true;
      })
      .map((item) => ({
        name: item.name,
        url: item.url,
        size: item.size,
        modified: item.modified,
      }))
      .sort(
        (a, b) =>
          new Date(b.modified).getTime() - new Date(a.modified).getTime(),
      );
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

    // If file already exists in current tenant storage, append timestamp to avoid overwrite
    if (this.fileStorage.exists && (await this.fileStorage.exists(filename))) {
      filename = `${safeName}_${Date.now()}${finalExt}`;
    }

    const meta = {
      contentType: file.mimetype,
      originalName: file.originalname,
    };

    // Save original to _originals/ (for watermark regeneration)
    if (isWatermarkable) {
      await this.fileStorage.put(`_originals/${filename}`, buffer, meta);
    }

    let putResult: { key: string; url: string };

    // Apply watermark if enabled and image qualifies
    if (isWatermarkable) {
      // 1. General watermark
      let generalBuffer = buffer;
      try {
        generalBuffer = await this.applyWatermark(buffer, 'watermark_config');
      } catch (err) {
        console.warn('General watermark failed, using original:', err.message);
      }
      putResult = await this.fileStorage.put(filename, generalBuffer, meta);

      // 2. B2B watermark
      let b2bBuffer = buffer;
      try {
        b2bBuffer = await this.applyWatermark(buffer, 'watermark_b2b_config');
      } catch (err) {
        console.warn('B2B watermark failed, using original:', err.message);
      }
      await this.fileStorage.put(`_b2b/${filename}`, b2bBuffer, meta);
    } else {
      putResult = await this.fileStorage.put(filename, buffer, meta);
    }

    return { url: putResult.url, key: putResult.key };
  }

  // Helper to serve file
  async serveFile(filename: string, res: any) {
    // Security: Prevent path traversal
    const safeName = path.basename(filename);

    const stored = await this.fileStorage.get(safeName);
    if (stored) {
      const ext = path.extname(safeName).toLowerCase();
      const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext);

      res.set('Content-Type', stored.contentType || 'application/octet-stream');
      if (stored.size !== undefined) {
        res.set('Content-Length', stored.size);
      }
      res.set('Content-Disposition', isImage ? 'inline' : `attachment; filename="${safeName}"`);
      res.set('Cache-Control', 'public, max-age=86400'); // Cache 1 day
      res.set('Access-Control-Allow-Origin', '*'); // CORS - allow all origins
      res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.set('Access-Control-Allow-Headers', '*');
      res.set('X-Content-Type-Options', 'nosniff'); // Security header

      return stored.stream.pipe(res);
    }

    // Legacy fallback: Check 'frontend/public/uploads' ONLY for default tenant (single-tenant/dev)
    if (TenantContext.current().tenantId === DEFAULT_TENANT_CONTEXT.tenantId) {
      const fallbackDir = resolveCoreAsset(path.join('frontend', 'public', 'uploads'), __dirname);
      const fallbackPath = path.join(fallbackDir, safeName);
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
    }

    return res.status(404).send('File not found');
  }

  // Helper to delete file physically
  async deleteFile(filename: string) {
    // Security: Prevent path traversal
    const safeName = path.basename(filename);

    const deleted = await this.fileStorage.delete(safeName);
    if (deleted) {
      return { success: true, message: 'File deleted' };
    }

    // Legacy fallback ONLY for default tenant
    if (TenantContext.current().tenantId === DEFAULT_TENANT_CONTEXT.tenantId) {
      const fallbackDir = resolveCoreAsset(path.join('frontend', 'public', 'uploads'), __dirname);
      const fallbackPath = path.join(fallbackDir, safeName);
      if (fs.existsSync(fallbackPath)) {
        fs.unlinkSync(fallbackPath);
        return { success: true, message: 'File deleted (legacy path)' };
      }
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

  async setWatermarkImage(file: Express.Multer.File, configKey: string = 'watermark_config'): Promise<{ url: string; key: string }> {
    const filename = configKey === 'watermark_b2b_config' ? '_watermark_b2b.png' : '_watermark.png';
    const putResult = await this.fileStorage.put(filename, file.buffer, {
      contentType: file.mimetype || 'image/png',
      originalName: file.originalname,
    });

    // Update config with filename
    const config = await this.getWatermarkConfig(configKey);
    config.imageFile = filename;
    config.enabled = true;
    await this.saveWatermarkConfig(config, configKey);

    return { url: putResult.url, key: putResult.key };
  }

  private async applyWatermark(imageBuffer: Buffer, configKey: string = 'watermark_config'): Promise<Buffer> {
    const sharp = require('sharp');

    const config = await this.getWatermarkConfig(configKey);
    if (!config.enabled || !config.imageFile) return imageBuffer;

    const wmStored = await this.fileStorage.get(config.imageFile);
    if (!wmStored) return imageBuffer;
    const watermarkBuffer = await streamToBuffer(wmStored.stream);

    // Get image dimensions — skip small images
    const metadata = await sharp(imageBuffer).metadata();
    const imgWidth = metadata.width || 0;
    const imgHeight = metadata.height || 0;
    if (imgWidth < 150 || imgHeight < 150) return imageBuffer; // Skip small images

    // Resize watermark proportionally
    const wmWidth = Math.max(80, Math.round(imgWidth * (config.sizeRatio || 0.25)));
    const opacity = Math.max(0.05, Math.min(1, config.opacity || 0.4));

    // Create semi-transparent watermark
    const watermarkResized = await sharp(watermarkBuffer)
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
    const safeName = path.basename(filename);
    const stored = await this.fileStorage.get(`_originals/${safeName}`);

    if (stored) {
      res.set('Content-Type', stored.contentType || 'application/octet-stream');
      if (stored.size !== undefined) {
        res.set('Content-Length', stored.size);
      }
      res.set('Cache-Control', 'public, max-age=86400');
      res.set('Access-Control-Allow-Origin', '*');
      return stored.stream.pipe(res);
    }

    // Fallback to regular file if no original
    return this.serveFile(filename, res);
  }

  async serveB2BFile(filename: string, res: any) {
    const safeName = path.basename(filename);
    const stored = await this.fileStorage.get(`_b2b/${safeName}`);

    if (stored) {
      res.set('Content-Type', stored.contentType || 'application/octet-stream');
      if (stored.size !== undefined) {
        res.set('Content-Length', stored.size);
      }
      res.set('Cache-Control', 'public, max-age=86400');
      res.set('Access-Control-Allow-Origin', '*');
      return stored.stream.pipe(res);
    }

    // Fallback to regular file if no B2B specific version exists
    return this.serveFile(filename, res);
  }

  async regenerateAllWatermarks(): Promise<{ processed: number; skipped: number; errors: string[] }> {
    const sharp = require('sharp');

    const errors: string[] = [];
    let processed = 0;
    let skipped = 0;

    let originals = ((await this.fileStorage.list?.('_originals')) ?? []).filter(
      (item) => /\.(jpg|jpeg|png|webp)$/i.test(item.name),
    );

    // If no originals exist yet, copy current images to _originals first
    if (originals.length === 0) {
      const files = ((await this.fileStorage.list?.()) ?? []).filter(
        (item) =>
          /\.(jpg|jpeg|png|webp)$/i.test(item.name) &&
          !item.name.startsWith('_'),
      );
      for (const f of files) {
        try {
          const existing = await this.fileStorage.get(f.name);
          if (existing) {
            const buf = await streamToBuffer(existing.stream);
            await this.fileStorage.put(`_originals/${f.name}`, buf, {
              contentType: existing.contentType,
            });
          }
        } catch (e: any) {
          errors.push(`Copy failed: ${f.name} - ${e.message}`);
        }
      }
      originals = ((await this.fileStorage.list?.('_originals')) ?? []).filter(
        (item) => /\.(jpg|jpeg|png|webp)$/i.test(item.name),
      );
    }

    for (const item of originals) {
      const filename = item.name;
      try {
        const origStored = await this.fileStorage.get(`_originals/${filename}`);
        if (!origStored) continue;
        const originalBuffer = await streamToBuffer(origStored.stream);

        // Check dimensions — skip small images
        const meta = await sharp(originalBuffer).metadata();
        if ((meta.width || 0) < 150 || (meta.height || 0) < 150) {
          skipped++;
          continue;
        }

        const generalWatermarked = await this.applyWatermark(originalBuffer, 'watermark_config');
        await this.fileStorage.put(filename, generalWatermarked, {
          contentType: origStored.contentType,
        });

        const b2bWatermarked = await this.applyWatermark(originalBuffer, 'watermark_b2b_config');
        await this.fileStorage.put(`_b2b/${filename}`, b2bWatermarked, {
          contentType: origStored.contentType,
        });
        processed++;
      } catch (e: any) {
        errors.push(`${filename}: ${e.message}`);
      }
    }

    return { processed, skipped, errors };
  }

  // 1. IMPORT NGUYEN LIEU
  async importMaterials(buffer: Buffer, canWriteCost = true) {
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
          quantity_in_stock: qtyInStock,
          supplier_name: supplierName
        };

        if (canWriteCost) {
          matData.cost_per_unit = costPerUnit;
          matData.cost_price = costPrice;
        }

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
  async importProducts(buffer: Buffer, canWriteCost = true) {
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
          quantity_in_stock: qtyInStock,
          customer_description: customerDesc,
          processing_description: processingDesc,
          vat_description: vatDesc,
          image_url: imageUrl,
          tags: tags,
          attributes: attributes,
          is_active: true
        };

        if (canWriteCost) {
          productData.cost_price = costPrice;
          productData.profit_margin = profitMargin > 0 ? profitMargin : null;
        }

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
  getTemplate(type: string, options?: { canViewCost?: boolean; canViewPurchaseCost?: boolean }): Buffer {
    let headers: string[] = [];
    let sampleData: any[] = [];

    if (type === 'materials') {
      const showCost = options?.canViewPurchaseCost !== false;
      headers = ['Code', 'Name', 'Category', 'Type', 'Unit', 'PurchaseUnit', 'ConversionFactor', ...(showCost ? ['CostPerUnit', 'CostPrice'] : []), 'Qty', 'Supplier'];
      sampleData = [
        {
          Code: 'VAI_COTTON_TRANG',
          Name: 'Vải Cotton Trắng Cao Cấp',
          Category: 'Vải chính',
          Type: 'Cotton 100%',
          Unit: 'm',
          PurchaseUnit: 'Cuộn',
          ConversionFactor: 100,
          ...(showCost ? { CostPerUnit: 35000, CostPrice: 35000 } : {}),
          Qty: 500,
          Supplier: 'Nhà cung cấp Mẫu 01'
        },
        {
          Code: 'GON_TAM_2P',
          Name: 'Gòn Tấm 2cm',
          Category: 'Gòn',
          Type: 'Gòn tấm',
          Unit: 'm',
          PurchaseUnit: 'Cuộn',
          ConversionFactor: 50,
          ...(showCost ? { CostPerUnit: 25000, CostPrice: 25000 } : {}),
          Qty: 200,
          Supplier: 'Nhà cung cấp Mẫu 02'
        }
      ];
    } else if (type === 'products') {
      const showCost = options?.canViewCost !== false;
      headers = ['SKU', 'Name', 'Category', 'Type', 'Unit', 'BasePrice', ...(showCost ? ['CostPrice'] : []), 'Qty', 'Color', 'Size', 'Fabric', 'CustomerDescription', 'ProcessingDescription', 'VatDescription', 'Tags', 'ImageUrl'];
      sampleData = [
        {
          SKU: 'SP_MAU_A_01',
          Name: 'Sản Phẩm Mẫu A 01 (DEMO)',
          Category: 'Sản Phẩm Mẫu',
          Type: 'Finished',
          Unit: 'cai',
          BasePrice: 250000,
          ...(showCost ? { CostPrice: 150000 } : {}),
          Qty: 50,
          Color: 'Xanh tiêu chuẩn',
          Size: 'Tiêu chuẩn',
          Fabric: 'Vải Mẫu 01',
          CustomerDescription: 'Sản phẩm mẫu A gia công chất lượng cao, bền đẹp. (DEMO)',
          ProcessingDescription: 'Gia công tiêu chuẩn, may viền bo góc, hoàn thiện đóng gói.',
          VatDescription: 'Sản phẩm mẫu quy cách tiêu chuẩn',
          Tags: 'Sản phẩm mẫu, Tiêu chuẩn',
          ImageUrl: 'https://drive.google.com/uc?id=example_file_id'
        },
        {
          SKU: 'SP_MAU_B_02',
          Name: 'Bộ Sản Phẩm Mẫu B (DEMO)',
          Category: 'Sản Phẩm Mẫu',
          Type: 'Finished',
          Unit: 'cai',
          BasePrice: 100000,
          ...(showCost ? { CostPrice: 60000 } : {}),
          Qty: 100,
          Color: 'Trắng tiêu chuẩn',
          Size: 'Tiêu chuẩn',
          Fabric: 'Vải Mẫu 02',
          CustomerDescription: 'Bộ sản phẩm mẫu B hoàn thiện. (DEMO)',
          ProcessingDescription: 'Gia công đóng gói theo bộ sản phẩm.',
          VatDescription: 'Bộ sản phẩm mẫu quy cách tiêu chuẩn',
          Tags: 'Sản phẩm mẫu, Combo',
          ImageUrl: ''
        }
      ];
    } else if (type === 'boms') {
      headers = ['ProductSKU', 'MaterialCode', 'Quantity', 'Waste', 'Note'];
      sampleData = [
        {
          ProductSKU: 'SP_MAU_A_01',
          MaterialCode: 'VL_MAU_01',
          Quantity: 1.5,
          Waste: 2,
          Note: 'Nguyên liệu chính sản xuất mẫu'
        },
        {
          ProductSKU: 'SP_MAU_A_01',
          MaterialCode: 'PK_MAU_02',
          Quantity: 1.0,
          Waste: 1,
          Note: 'Phụ kiện lắp ráp sản phẩm mẫu'
        }
      ];
    } else if (type === 'combos') {
      headers = ['ParentSKU', 'ChildSKU', 'Quantity', 'SortOrder'];
      sampleData = [
        {
          ParentSKU: 'COMBO_MAU_01',
          ChildSKU: 'SP_MAU_A_01',
          Quantity: 1,
          SortOrder: 1
        },
        {
          ParentSKU: 'COMBO_MAU_01',
          ChildSKU: 'SP_MAU_B_02',
          Quantity: 1,
          SortOrder: 2
        }
      ];
    } else if (type === 'customers') {
      headers = ['Code', 'Name', 'Type', 'LeadStatus', 'LeadSource', 'Phone', 'Email', 'Address', 'Province', 'District', 'TaxCode', 'LegalName', 'LegalAddress', 'LegalRepresentative', 'EinvoiceEmail', 'CreditLimit', 'Facebook', 'Website'];
      sampleData = [
        {
          Code: 'KH001',
          Name: 'Khách Hàng Demo 01',
          Type: 'CUSTOMER',
          LeadStatus: 'WON',
          LeadSource: 'REFERRAL',
          Phone: '0900000001',
          Email: 'khachhang01@demo.local',
          Address: '123 Đường Mẫu, Phường 1',
          Province: 'TP. Hồ Chí Minh',
          District: 'Quận 1',
          TaxCode: '0000000001',
          LegalName: 'Công Ty TNHH Khách Hàng Demo 01',
          LegalAddress: '123 Đường Mẫu, Phường 1, Quận 1, TP. Hồ Chí Minh',
          LegalRepresentative: 'Đại Diện Khách Hàng 01',
          EinvoiceEmail: 'ketoan@demo.local',
          CreditLimit: 50000000,
          Facebook: '',
          Website: 'demo.local'
        },
        {
          Code: 'LEAD001',
          Name: 'Đại Lý Mẫu A',
          Type: 'LEAD',
          LeadStatus: 'QUALIFIED',
          LeadSource: 'DIRECT',
          Phone: '0900000002',
          Email: 'daily01@demo.local',
          Address: '45 Đường Mẫu, Phường 2',
          Province: 'Bình Dương',
          District: 'Thủ Dầu Một',
          TaxCode: '',
          LegalName: '',
          LegalAddress: '',
          LegalRepresentative: '',
          EinvoiceEmail: '',
          CreditLimit: 0,
          Facebook: '',
          Website: ''
        }
      ];
    } else if (type === 'suppliers') {
      headers = ['Code', 'Name', 'Type', 'Phone', 'Email', 'Address', 'TaxCode', 'LegalName', 'VatAddress', 'Debt', 'Note'];
      sampleData = [
        {
          Code: 'NCC001',
          Name: 'Nhà Cung Cấp Mẫu 01',
          Type: 'MATERIAL',
          Phone: '0280000001',
          Email: 'ncc01@demo.local',
          Address: 'Khu công nghiệp Mẫu, TP. Hồ Chí Minh',
          TaxCode: '0000000002',
          LegalName: 'Công Ty Cổ Phần Cung Ứng Vật Tư Mẫu',
          VatAddress: 'Khu công nghiệp Mẫu, TP. Hồ Chí Minh',
          Debt: 0,
          Note: 'Cung cấp nguyên vật liệu mẫu các loại'
        },
        {
          Code: 'NCC002',
          Name: 'Xưởng Gia Công Mẫu 02',
          Type: 'PROCESSING',
          Phone: '0900000003',
          Email: 'giacong02@demo.local',
          Address: 'Quận Bình Tân, TP. Hồ Chí Minh',
          TaxCode: '0000000003',
          LegalName: 'Hộ Kinh Doanh Xưởng Gia Công Mẫu',
          VatAddress: 'Quận Bình Tân, TP. Hồ Chí Minh',
          Debt: 0,
          Note: 'Chuyên gia công và hoàn thiện sản phẩm mẫu'
        }
      ];
    } else if (type === 'sales') {
      headers = ['CustomerCode', 'OrderDate', 'DeliveryDate', 'ProductSKU', 'Quantity', 'UnitPrice', 'VariantColor', 'ReceiverName', 'ReceiverPhone', 'ShippingAddress', 'DiscountRate', 'VatRate', 'ItemNote', 'OrderNote'];
      sampleData = [
        {
          CustomerCode: 'KH001',
          OrderDate: '2026-08-25',
          DeliveryDate: '2026-09-01',
          ProductSKU: 'SP_MAU_A_01',
          Quantity: 30,
          UnitPrice: 250000,
          VariantColor: 'Xanh tiêu chuẩn',
          ReceiverName: 'Người Nhận Demo 01',
          ReceiverPhone: '0900000001',
          ShippingAddress: 'Số 1 Đường Mẫu, Quận Mẫu, TP. Mẫu',
          DiscountRate: 5,
          VatRate: 8,
          ItemNote: 'In logo thương hiệu ở góc sản phẩm',
          OrderNote: 'Giao trong giờ hành chính'
        },
        {
          CustomerCode: 'KH001',
          OrderDate: '2026-08-25',
          DeliveryDate: '2026-09-01',
          ProductSKU: 'SP_MAU_B_02',
          Quantity: 30,
          UnitPrice: 100000,
          VariantColor: 'Trắng tiêu chuẩn',
          ReceiverName: 'Người Nhận Demo 02',
          ReceiverPhone: '0900000002',
          ShippingAddress: 'Số 2 Đường Mẫu, Quận Mẫu, TP. Mẫu',
          DiscountRate: 5,
          VatRate: 8,
          ItemNote: 'Đóng gói theo quy cách tiêu chuẩn',
          OrderNote: 'Giao trong giờ hành chính'
        }
      ];
    } else {
      throw new BadRequestException('Loại template không hợp lệ: ' + type);
    }

    const ws = XLSX.utils.json_to_sheet(sampleData, { header: headers });
    return XLSX.write({ Sheets: { Sheet1: ws }, SheetNames: ['Sheet1'] }, { type: 'buffer', bookType: 'xlsx' });
  }
}