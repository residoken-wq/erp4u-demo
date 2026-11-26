import { Perm, AnyPerm, AuthOnly } from '../auth/permissions.decorator';
import { Controller, Post, Get, Delete, Param, Res, Body, Req, UseInterceptors, UploadedFile, BadRequestException, Query, Inject, Optional, forwardRef } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { Response } from 'express';
import { Public } from '../auth/public.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/product.entity';
import { SystemConfig } from '../system/system-config.entity';
import { CorePackage } from '../common/packages/requires-package.decorator';
import { WEBSITE_SERVICE, WebsiteMediaUsageBridge } from '../common/extension-points';
import { PermissionCacheService } from '../auth/permission-cache.service';

@Controller('upload')
@CorePackage()
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(SystemConfig) private configRepo: Repository<SystemConfig>,
    @Inject(forwardRef(() => PermissionCacheService)) private readonly permCacheService: PermissionCacheService,
    @Optional() @Inject(WEBSITE_SERVICE) private websiteService?: WebsiteMediaUsageBridge,
  ) { }

  @Perm('CMS', 'view')
  @Get('list')
  async listFiles(@Query('source') source?: string) {
    return this.uploadService.listFiles(source);
  }

  // --- IMAGE USAGE TRACKING ---
  @Perm('CMS', 'view')
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

      // 2-4. Website sources (Product Website Configs, Blog Posts, Web Projects) via WebsiteModule export
      if (this.websiteService) {
        const { productConfigs: configs, blogs, projects } = await this.websiteService.getMediaUsageSources();

        for (const c of configs) {
          const cfg = c.customization_config;
          if (!cfg) continue;
          const product = products.find(p => p.id === c.product_id);
          const label = product ? `${product.sku} - ${product.name}` : `Product #${c.product_id}`;
          scanText(JSON.stringify(cfg), 'Sản phẩm (cấu hình)', c.product_id, label);
        }

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

  @AnyPerm(['INVENTORY', 'create'], ['PRODUCT', 'create'])
  @Post('materials')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMaterials(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) throw new BadRequestException('Chua chon file!');
    const canViewPurchaseCost = this.permCacheService
      ? await this.permCacheService.canViewPurchaseCost(req?.user, ['PURCHASE', 'INVENTORY', 'FINANCE'])
      : false;
    return this.uploadService.importMaterials(file.buffer, canViewPurchaseCost);
  }

  @AuthOnly()
  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File, @Body('source') source?: string) {
    if (!file) throw new BadRequestException('Chua chon file!');
    return this.uploadService.uploadImage(file, source);
  }

  @Perm('PRODUCT', 'create')
  @Post('products')
  @UseInterceptors(FileInterceptor('file'))
  async uploadProducts(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) throw new BadRequestException('Chua chon file!');
    const canViewCost = this.permCacheService
      ? await this.permCacheService.canViewCostPrice(req?.user, [
          'PRODUCT',
          'PURCHASE',
          'PRODUCTION',
          'SALES',
          'INVENTORY',
          'FINANCE',
        ])
      : false;
    return this.uploadService.importProducts(file.buffer, canViewCost);
  }

  @AnyPerm(['INVENTORY', 'create'], ['PRODUCT', 'create'])
  @Post('boms')
  @UseInterceptors(FileInterceptor('file'))
  async uploadBoms(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Chua chon file!');
    return this.uploadService.importBoms(file.buffer);
  }

  @Perm('PRODUCT', 'create')
  @Post('combos')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCombos(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Chua chon file!');
    return this.uploadService.importCombos(file.buffer);
  }

  // --- API IMPORT CUSTOMERS (MOI) ---
  @Perm('SALES', 'create')
  @Post('customers')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCustomers(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Chưa chọn file!');
    return this.uploadService.importCustomers(file.buffer);
  }

  // --- API IMPORT SUPPLIERS (MOI) ---
  @Perm('INVENTORY', 'create')
  @Post('suppliers')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSuppliers(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Chưa chọn file!');
    return this.uploadService.importSuppliers(file.buffer);
  }

  // --- API IMPORT SALES ORDERS (MOI) ---
  @Perm('SALES', 'create')
  @Post('sales')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSales(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Chưa chọn file!');
    return this.uploadService.importSalesOrders(file.buffer);
  }
  // ----------------------------------

  @AuthOnly()
  @Post('file')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Body('source') source?: string) {
    if (!file) throw new BadRequestException('Chưa chọn file!');
    return this.uploadService.uploadFile(file, source);
  }

  // --- WATERMARK MANAGEMENT ---
  @Perm('CMS', 'create')
  @Post('watermark/image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadWatermarkImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Chưa chọn file watermark!');
    return this.uploadService.setWatermarkImage(file, 'watermark_config');
  }

  @Perm('CMS', 'view')
  @Get('watermark/config')
  async getWatermarkConfig() {
    return this.uploadService.getWatermarkConfig('watermark_config');
  }

  @Perm('CMS', 'create')
  @Post('watermark/config')
  async saveWatermarkConfig(@Body() body: any) {
    return this.uploadService.saveWatermarkConfig(body, 'watermark_config');
  }

  // --- B2B WATERMARK MANAGEMENT ---
  @Perm('CMS', 'create')
  @Post('watermark/b2b/image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadWatermarkB2BImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Chưa chọn file watermark B2B!');
    return this.uploadService.setWatermarkImage(file, 'watermark_b2b_config');
  }

  @Public()
  @Get('watermark/b2b/config')
  async getWatermarkB2BConfig() {
    return this.uploadService.getWatermarkConfig('watermark_b2b_config');
  }

  @Perm('CMS', 'create')
  @Post('watermark/b2b/config')
  async saveWatermarkB2BConfig(@Body() body: any) {
    return this.uploadService.saveWatermarkConfig(body, 'watermark_b2b_config');
  }

  @Perm('CMS', 'create')
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

  @AuthOnly()
  @Get('template/:type')
  async downloadTemplate(@Param('type') type: string, @Res() res: Response, @Req() req: any) {
    const canViewCost = this.permCacheService
      ? await this.permCacheService.canViewCostPrice(req?.user, [
          'PRODUCT',
          'PURCHASE',
          'PRODUCTION',
          'SALES',
          'INVENTORY',
          'FINANCE',
        ])
      : false;
    const canViewPurchaseCost = this.permCacheService
      ? await this.permCacheService.canViewPurchaseCost(req?.user, ['PURCHASE', 'INVENTORY', 'FINANCE'])
      : false;
    const buffer = this.uploadService.getTemplate(type, { canViewCost, canViewPurchaseCost });

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

  @Perm('CMS', 'delete')
  @Delete('files/:filename')
  async deleteFile(@Param('filename') filename: string) {
    return this.uploadService.deleteFile(filename);
  }
}