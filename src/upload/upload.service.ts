import { Injectable, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { MaterialsService } from '../materials/materials.service';
import { ProductsService } from '../products/products.service';
import { SalesService } from '../sales/sales.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/product.entity';
import { BOM } from '../bom/bom.entity';
import { ProductComponent } from '../products/product-component.entity';
import { Customer, CustomerType } from '../customers/customer.entity';
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
    @InjectRepository(SystemConfig) private configRepo: Repository<SystemConfig>,
  ) { }

  private normalizeRow(row: any) {
    const newRow = {};
    Object.keys(row).forEach(key => { newRow[key.toLowerCase().trim()] = row[key]; });
    return newRow;
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
    let count = 0; const errors = [];
    for (const rawRow of data) {
      const row = this.normalizeRow(rawRow);
      try {
        const code = row['code'] || row['ma'];
        if (!code) continue;
        const mat = {
          code: code.toString().trim(),
          name: row['name'] || row['ten'] || 'No Name',
          category: row['category'] || row['nhom'] || 'General',
          material_type: row['type'] || row['loai'] || 'General',
          unit: row['unit'] || row['dvt'] || 'pcs',
          cost_per_unit: row['price'] || row['gia'] || 0,
          quantity_in_stock: row['qty'] || row['ton'] || 0,
          supplier_name: 'Import Excel'
        };
        const existing = await this.materialsService.findOneByCode(mat.code);
        if (existing) { await this.materialsService.materialRepo.update(existing.id, mat); }
        else { await this.materialsService.materialRepo.save(mat); }
        count++;
      } catch (e) { errors.push({ row, error: e.message }); }
    }
    return { message: 'Done', count, errors };
  }

  // 2. IMPORT SAN PHAM
  async importProducts(buffer: Buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    let count = 0; const errors = [];

    for (const rawRow of data) {
      const row = this.normalizeRow(rawRow);
      try {
        const sku = row['sku'] || row['ma'];
        if (!sku) continue;

        const attributes = {
          color: row['color'] || row['mau'] || '',
          size: row['size'] || row['kichthuoc'] || '',
          fabric: row['fabric'] || row['chatlieu'] || ''
        };

        const productData = {
          sku: sku.toString().trim(),
          name: row['name'] || row['ten'] || 'No Name',
          category: row['category'] || row['nhom'] || 'General',
          product_type: row['type'] || row['loai'] || 'General',
          unit: row['unit'] || row['dvt'] || 'cai',
          base_price: row['price'] || row['gia'] || 0,
          attributes: attributes,
          is_active: true
        };

        const existing = await this.productsService.findOneBySku(productData.sku);
        if (existing) { await this.productRepo.update(existing.id, productData); }
        else { await this.productRepo.save(productData); }
        count++;
      } catch (e) { errors.push({ sku: row['sku'], error: e.message }); }
    }
    return { message: 'Done', count, errors };
  }

  // 3. IMPORT BOM
  async importBoms(buffer: Buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    let count = 0; const errors = [];
    for (const rawRow of data) {
      const row = this.normalizeRow(rawRow);
      try {
        const sku = row['productsku'] || row['masp'];
        const matCode = row['materialcode'] || row['manl'];
        const qty = row['quantity'] || row['sl'];
        if (!sku || !matCode) continue;
        const product = await this.productsService.findOneBySku(sku);
        const material = await this.materialsService.findOneByCode(matCode);
        if (!product || !material) continue;
        const existingBom = await this.bomRepo.findOne({ where: { product_id: product.id, material_id: material.id } });
        if (existingBom) {
          existingBom.quantity = qty; existingBom.waste_percent = row['waste'] || 0;
          await this.bomRepo.save(existingBom);
        } else {
          const newBom = new BOM(); newBom.product = product; newBom.material = material;
          newBom.quantity = qty; newBom.waste_percent = row['waste'] || 0;
          await this.bomRepo.save(newBom);
        }
        count++;
      } catch (e) { errors.push({ row, error: e.message }); }
    }
    return { message: 'Done', count, errors };
  }

  // 4. IMPORT COMBOS
  async importCombos(buffer: Buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    let count = 0; const errors = [];
    for (const rawRow of data) {
      const row = this.normalizeRow(rawRow);
      try {
        const parentSku = row['parentsku'] || row['mabosp'];
        const childSku = row['childsku'] || row['maspcon'];
        const qty = row['quantity'] || row['sl'];
        if (!parentSku || !childSku) continue;
        const parent = await this.productsService.findOneBySku(parentSku);
        const child = await this.productsService.findOneBySku(childSku);
        if (!parent || !child) continue;
        const existing = await this.componentRepo.findOne({ where: { parent_product: { id: parent.id }, child_product: { id: child.id } } });
        if (existing) { existing.quantity = qty; await this.componentRepo.save(existing); }
        else { const newComp = new ProductComponent(); newComp.parent_product = parent; newComp.child_product = child; newComp.quantity = qty; await this.componentRepo.save(newComp); }
        count++;
      } catch (e) { errors.push({ row, error: e.message }); }
    }
    return { message: 'Done', count, errors };
  }

  // 5. IMPORT CUSTOMERS (CRM)
  async importCustomers(buffer: Buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    let count = 0; const errors = [];

    for (const rawRow of data) {
      const row = this.normalizeRow(rawRow);
      try {
        const code = row['code'] || row['ma'];
        if (!code) continue;

        // Chuan hoa Type: LEAD hoac CUSTOMER
        let type = CustomerType.LEAD;
        const rawType = (row['type'] || row['loai'] || '').toString().toUpperCase();
        if (rawType.includes('CUST') || rawType.includes('KHACH')) type = CustomerType.CUSTOMER;

        const customerData = {
          code: code.toString().trim(),
          name: row['name'] || row['ten'],
          phone: row['phone'] || row['sdt'],
          email: row['email'] || '',
          address: row['address'] || row['diachi'],
          tax_code: row['tax'] || row['mst'],
          credit_limit: Number(row['limit'] || row['hanmuc']) || 0,
          type: type,
          current_debt: 0
        };

        const existing = await this.customerRepo.findOne({ where: { code: customerData.code } });
        if (existing) { await this.customerRepo.update(existing.id, customerData); }
        else { await this.customerRepo.save(customerData); }
        count++;
      } catch (e) { errors.push({ code: row['code'], error: e.message }); }
    }
    return { message: 'Import Khách hàng thành công', count, errors };
  }

  // 6. TEMPLATE (UPDATE)
  getTemplate(type: string): Buffer {
    let headers = [];
    let sampleData = [];

    if (type === 'materials') {
      headers = ['Category', 'Type', 'Code', 'Name', 'Unit', 'Price', 'Qty'];
      sampleData = [{ Category: 'Vải', Type: 'Cotton', Code: 'VAI_THUN', Name: 'Vải Thun Lạnh', Unit: 'm', Price: 35000, Qty: 1000 }];
    } else if (type === 'products') {
      headers = ['Category', 'Type', 'SKU', 'Name', 'Color', 'Size', 'Fabric', 'Unit', 'Price'];
      sampleData = [{ Category: 'Nệm', Type: 'Mầm Non', SKU: 'NMN_XANH', Name: 'Nệm MN Xanh', Color: 'Xanh', Size: '120x60', Fabric: 'Cara', Unit: 'cai', Price: 180000 }];
    } else if (type === 'boms') {
      headers = ['ProductSKU', 'MaterialCode', 'Quantity', 'Waste'];
      sampleData = [{ ProductSKU: 'NMN_XANH', MaterialCode: 'VAI_CARA_XANH', Quantity: 1.6, Waste: 2 }];
    } else if (type === 'combos') {
      headers = ['ParentSKU', 'ChildSKU', 'Quantity'];
      sampleData = [{ ParentSKU: 'BO_NEM_GOI', ChildSKU: 'NMN_XANH', Quantity: 1 }];
    } else if (type === 'customers') {
      // --- TEMPLATE KHACH HANG ---
      headers = ['Code', 'Name', 'Type', 'Phone', 'Email', 'Address', 'Tax', 'Limit'];
      sampleData = [
        { Code: 'KH001', Name: 'Công ty ABC', Type: 'CUSTOMER', Phone: '0909123456', Email: 'abc@gmail.com', Address: 'HCM', Tax: '030123456', Limit: 50000000 },
        { Code: 'LEAD01', Name: 'Chị Lan', Type: 'LEAD', Phone: '0918...', Email: '', Address: '', Tax: '', Limit: 0 }
      ];
    } else if (type === 'sales') {
      // --- TEMPLATE DON HANG ---
      headers = ['CustomerCode', 'OrderDate', 'ProductSKU', 'Quantity', 'UnitPrice', 'Notes'];
      sampleData = [
        { CustomerCode: 'KH001', OrderDate: '2026-01-01', ProductSKU: 'PRD-001', Quantity: 10, UnitPrice: 50000, Notes: 'Giao gấp' },
        { CustomerCode: 'KH001', OrderDate: '2026-01-01', ProductSKU: 'PRD-002', Quantity: 5, UnitPrice: 75000, Notes: '' }
      ];
    } else {
      throw new BadRequestException('Loai template khong hop le');
    }

    const ws = XLSX.utils.json_to_sheet(sampleData, { header: headers });
    return XLSX.write({ Sheets: { Sheet1: ws }, SheetNames: ['Sheet1'] }, { type: 'buffer', bookType: 'xlsx' });
  }

  // 7. IMPORT SALES ORDERS NEW
  async importSalesOrders(buffer: Buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    const ordersMap = new Map();
    const errors = [];
    let count = 0;

    // Group rows by CustomerCode + OrderDate to create single order with multiple items
    for (const rawRow of data) {
      const row = this.normalizeRow(rawRow);
      try {
        const customerCode = row['customercode'] || row['makh'];
        if (!customerCode) continue;

        const orderDateStr = row['orderdate'] || row['ngaydat'];
        const notes = row['notes'] || row['ghichu'] || '';

        const sku = row['productsku'] || row['masp'];
        const qty = Number(row['quantity'] || row['sl']) || 0;
        const price = Number(row['unitprice'] || row['dongia']) || 0;

        if (!sku || qty <= 0) {
          errors.push({ row, error: 'SKU or Quantity invalid' });
          continue;
        }

        const key = `${customerCode}_${orderDateStr || 'today'}_${notes}`;

        if (!ordersMap.has(key)) {
          ordersMap.set(key, {
            customerCode,
            orderDate: orderDateStr ? new Date(orderDateStr) : new Date(),
            notes,
            items: []
          });
        }

        ordersMap.get(key).items.push({ sku, qty, price });
      } catch (e) {
        errors.push({ row, error: e.message });
      }
    }

    // Process each grouped order
    for (const [key, orderData] of ordersMap.entries()) {
      try {
        const customer = await this.customerRepo.findOne({ where: { code: orderData.customerCode } });
        if (!customer) {
          errors.push({ key, error: `Customer ${orderData.customerCode} not found` });
          continue;
        }

        // Create Order
        const newOrder = await this.salesService.createOrder({
          customer_id: customer.id,
          order_date: orderData.orderDate,
          note: orderData.notes, // Map 'notes' to 'note' as per SalesService
          items: orderData.items.map(i => ({
            sku: i.sku, // SalesService expects 'sku'
            quantity: i.qty,
            price: i.price
          }))
        });

        if (newOrder) count++;

      } catch (e) {
        errors.push({ key, error: e.message });
      }
    }

    return { message: `Imported ${count} orders`, count, errors };
  }
}