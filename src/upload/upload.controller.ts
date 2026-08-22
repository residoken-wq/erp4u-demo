import { Controller, Post, Get, Delete, Param, Res, Body, UseInterceptors, UploadedFile, BadRequestException, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { Response } from 'express';
import { Public } from '../auth/public.decorator';
import * as fs from 'fs';
import * as path from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/product.entity';
import { ProductWebsiteConfig } from '../products/entities/product-website-config.entity';
import { BlogPost } from '../blogs/blog-post.entity';
import { WebProject } from '../website-projects/entities/web-project.entity';
import { SystemConfig } from '../system/system-config.entity';



@Controller('upload')
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(ProductWebsiteConfig) private pwcRepo: Repository<ProductWebsiteConfig>,
    @InjectRepository(BlogPost) private blogRepo: Repository<BlogPost>,
    @InjectRepository(WebProject) private projectRepo: Repository<WebProject>,
    @InjectRepository(SystemConfig) private configRepo: Repository<SystemConfig>,
  ) { }

  @Get('list')
  async listFiles(@Query('source') source?: string) {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) return [];
    const files = fs.readdirSync(uploadDir)
      .filter(f => {
        if (!/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(f)) return false;
        // CMS only sees its own files (which have no prefix) and not ERP files (which have 'erp_' prefix)
        if (source === 'cms' && f.startsWith('erp_')) return false;
        return true;
      })
      .map(f => {
        const stat = fs.statSync(path.join(uploadDir, f));
        return {
          name: f,
          url: `/uploads/${f}`,
          size: stat.size,
          modified: stat.mtime,
        };
      })
      .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
    return files;
  }

  // --- IMAGE USAGE TRACKING ---
  @Get('usage')
  async getImageUsage() {
    const usageMap: Record<string, Array<{ type: string; id?: number; label: string }>> = {};

    const addUsage = (filename: string, type: string, id: number | undefined, label: string) => {
      let name = filename;
      if (name.includes('/uploads/')) name = name.split('/uploads/').pop() || name;
      else if (name.includes('/api/upload/files/')) name = name.split('/api/upload/files/').pop() || name;
      else name = name.replace(/^\/+/, ''); // remove leading slash
      
      try { name = decodeURIComponent(name); } catch(e) {}
      name = name.split('?')[0].split('#')[0]; // remove query/hash
      
      if (!name) return;
      if (!usageMap[name]) usageMap[name] = [];
      const exists = usageMap[name].some(u => u.type === type && u.id === id);
      if (!exists) usageMap[name].push({ type, id, label });
    };

    const scanText = (text: string | null | undefined, type: string, id: number | undefined, label: string) => {
      if (!text) return false;
      const regex = /(?:\/uploads\/|\/api\/upload\/files\/)([^"'\s\\><]+)/g;
      let match;
      let found = false;
      while ((match = regex.exec(text)) !== null) {
        addUsage(match[1], type, id, label);
        found = true;
      }
      return found;
    };

    try {
      // 1. Products: image_url field
      const products = await this.productRepo.find({ select: ['id', 'sku', 'name', 'image_url', 'customer_description'] });
      for (const p of products) {
        if (p.image_url) {
            const found = scanText(p.image_url, 'Sản phẩm', p.id, `${p.sku} - ${p.name}`);
            if (!found && !p.image_url.startsWith('{') && !p.image_url.startsWith('[')) {
                addUsage(p.image_url, 'Sản phẩm', p.id, `${p.sku} - ${p.name}`);
            }
        }
        scanText(p.customer_description, 'Sản phẩm (mô tả)', p.id, `${p.sku} - ${p.name}`);
      }

      // 2. Product Website Configs: customization_config (gallery_images, colors, base_image, etc.)
      const configs = await this.pwcRepo.find();
      for (const c of configs) {
        const cfg = c.customization_config;
        if (!cfg) continue;
        const product = products.find(p => p.id === c.product_id);
        const label = product ? `${product.sku} - ${product.name}` : `Product #${c.product_id}`;
        scanText(JSON.stringify(cfg), 'Sản phẩm (cấu hình)', c.product_id, label);
      }

      // 3. Blog Posts: featured_image + content + content_blocks
      const blogs = await this.blogRepo.find({ select: ['id', 'title', 'featured_image', 'content', 'content_blocks'] });
      for (const b of blogs) {
        if (b.featured_image) {
            const found = scanText(b.featured_image, 'Bài viết', b.id, b.title);
            if (!found && !b.featured_image.startsWith('{') && !b.featured_image.startsWith('[')) {
                addUsage(b.featured_image, 'Bài viết', b.id, b.title);
            }
        }
        scanText(b.content, 'Bài viết (nội dung)', b.id, b.title);
        if (b.content_blocks) scanText(JSON.stringify(b.content_blocks), 'Bài viết (blocks)', b.id, b.title);
      }

      // 4. Web Projects: image_url + content + content_blocks
      const projects = await this.projectRepo.find({ select: ['id', 'title', 'image_url', 'content', 'content_blocks'] });
      for (const p of projects) {
        if (p.image_url) {
            const found = scanText(p.image_url, 'Dự án', p.id, p.title);
            if (!found && !p.image_url.startsWith('{') && !p.image_url.startsWith('[')) {
                addUsage(p.image_url, 'Dự án', p.id, p.title);
            }
        }
        scanText(p.content, 'Dự án (nội dung)', p.id, p.title);
        if (p.content_blocks) scanText(JSON.stringify(p.content_blocks), 'Dự án (blocks)', p.id, p.title);
      }

      // 5. System Configs: value field (home config, about config, settings, etc.)
      const sysConfigs = await this.configRepo.find();
      for (const sc of sysConfigs) {
        scanText(sc.value, 'Cấu hình', undefined, sc.key);
      }
    } catch (err) {
      console.error('Error scanning image usage:', err);
    }

    return usageMap;
  }

  @Post('materials')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMaterials(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Chua chon file!');
    return this.uploadService.importMaterials(file.buffer);
  }

  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File, @Body('source') source?: string) {
    if (!file) throw new BadRequestException('Chua chon file!');
    return this.uploadService.uploadImage(file, source);
  }

  @Post('products')
  @UseInterceptors(FileInterceptor('file'))
  async uploadProducts(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Chua chon file!');
    return this.uploadService.importProducts(file.buffer);
  }

  @Post('boms')
  @UseInterceptors(FileInterceptor('file'))
  async uploadBoms(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Chua chon file!');
    return this.uploadService.importBoms(file.buffer);
  }

  @Post('combos')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCombos(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Chua chon file!');
    return this.uploadService.importCombos(file.buffer);
  }

  // --- API IMPORT CUSTOMERS (MOI) ---
  @Post('customers')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCustomers(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Chưa chọn file!');
    return this.uploadService.importCustomers(file.buffer);
  }

  // --- API IMPORT SUPPLIERS (MOI) ---
  @Post('suppliers')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSuppliers(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Chưa chọn file!');
    return this.uploadService.importSuppliers(file.buffer);
  }

  // --- API IMPORT SALES ORDERS (MOI) ---
  @Post('sales')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSales(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Chưa chọn file!');
    return this.uploadService.importSalesOrders(file.buffer);
  }
  // ----------------------------------

  @Post('file')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Body('source') source?: string) {
    if (!file) throw new BadRequestException('Chưa chọn file!');
    return this.uploadService.uploadFile(file, source);
  }

  // --- WATERMARK MANAGEMENT ---
  @Post('watermark/image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadWatermarkImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Chưa chọn file watermark!');
    return this.uploadService.setWatermarkImage(file, 'watermark_config');
  }

  @Get('watermark/config')
  async getWatermarkConfig() {
    return this.uploadService.getWatermarkConfig('watermark_config');
  }

  @Post('watermark/config')
  async saveWatermarkConfig(@Body() body: any) {
    return this.uploadService.saveWatermarkConfig(body, 'watermark_config');
  }

  // --- B2B WATERMARK MANAGEMENT ---
  @Post('watermark/b2b/image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadWatermarkB2BImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Chưa chọn file watermark B2B!');
    return this.uploadService.setWatermarkImage(file, 'watermark_b2b_config');
  }

  @Get('watermark/b2b/config')
  async getWatermarkB2BConfig() {
    return this.uploadService.getWatermarkConfig('watermark_b2b_config');
  }

  @Post('watermark/b2b/config')
  async saveWatermarkB2BConfig(@Body() body: any) {
    return this.uploadService.saveWatermarkConfig(body, 'watermark_b2b_config');
  }

  @Post('watermark/regenerate')
  async regenerateWatermarks() {
    return this.uploadService.regenerateAllWatermarks();
  }

  @Public()
  @Get('files/original/:filename')
  async serveOriginalFile(@Param('filename') filename: string, @Res() res: Response) {
    return this.uploadService.serveOriginalFile(filename, res);
  }

  @Public()
  @Get('files/b2b/:filename')
  async serveB2BFile(@Param('filename') filename: string, @Res() res: Response) {
    return this.uploadService.serveB2BFile(filename, res);
  }

  @Get('template/:type')
  async downloadTemplate(@Param('type') type: string, @Res() res: Response) {
    const buffer = this.uploadService.getTemplate(type);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=' + type + '_template.xlsx',
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  @Public()
  @Get('files/:filename')
  async serveFile(@Param('filename') filename: string, @Res() res: Response) {
    return this.uploadService.serveFile(filename, res);
  }

  @Delete('files/:filename')
  async deleteFile(@Param('filename') filename: string) {
    return this.uploadService.deleteFile(filename);
  }
}