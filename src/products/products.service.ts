import { Injectable, NotFoundException, Inject, forwardRef, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial, In } from 'typeorm';
import { Product } from './product.entity';
import { BOM } from '../bom/bom.entity';
import { ProductComponent } from './product-component.entity';
import { ProductRouting } from './product-routing.entity';
import { ProductLogistics } from './product-logistics.entity';
import { ProductPattern } from './product-pattern.entity';
import { ProductWebsiteConfig } from './entities/product-website-config.entity';
import { Supplier } from '../suppliers/supplier.entity';
import { SupplierMaterial } from '../suppliers/supplier-material.entity';
import { CategoriesService } from '../categories/categories.service';
import { CreateVariantDto } from './dto/create-variant.dto';

@Injectable()
export class ProductsService {
    constructor(
        @InjectRepository(Product) private productRepo: Repository<Product>,
        @InjectRepository(BOM) private bomRepo: Repository<BOM>,
        @InjectRepository(ProductComponent) private componentRepo: Repository<ProductComponent>,
        @InjectRepository(ProductRouting) private routingRepo: Repository<ProductRouting>,
        @InjectRepository(ProductLogistics) private logisticRepo: Repository<ProductLogistics>,
        @InjectRepository(ProductPattern) private patternRepo: Repository<ProductPattern>,
        @InjectRepository(Supplier) private supplierRepo: Repository<Supplier>,
        @InjectRepository(SupplierMaterial) private priceRepo: Repository<SupplierMaterial>,
        @InjectRepository(ProductWebsiteConfig) private websiteConfigRepo: Repository<ProductWebsiteConfig>,
        @Inject(forwardRef(() => CategoriesService)) private categoriesService: CategoriesService,
    ) { }


    async findAll() {
        const products = await this.productRepo.find({
            select: ['id', 'sku', 'name', 'category_id', 'product_type', 'attributes', 'cost_price', 'base_price', 'quantity_in_stock', 'booking_stock', 'approved_booking_stock', 'profit_margin', 'is_active', 'is_flagged', 'unit', 'customer_description', 'processing_description', 'vat_description', 'image_url', 'show_on_website', 'contact_for_price', 'website_price', 'website_sale_price', 'website_order', 'website_display_name', 'tags'],
            order: { id: 'DESC' },
            relations: ['category_link']
        });

        // For COMBO products, fetch and attach component info
        // For COMBO products, fetch and attach component info
        await this.populateComboDescriptions(products);
        return products;
    }

    async populateComboDescriptions(products: any[]) {
        const comboProducts = products.filter(p => p.product_type === 'COMBO' || (p.product && p.product.product_type === 'COMBO'));

        for (const item of comboProducts) {
            // Handle both structure: Product entity directly OR OrderItem with .product relation
            const product = item.product || item;

            if (!product.id) continue;

            const components = await this.componentRepo.find({
                where: { parent_product: { id: product.id } },
                relations: ['child_product'],
                order: { sort_order: 'ASC' }
            });

            if (!product.customer_description && components.length > 0) {
                product.customer_description = components
                    .map(c => c.child_product?.customer_description || c.child_product?.name || '')
                    .filter(Boolean)
                    .join('\n\n');
            }

            // AUTO-CALCULATE COMBO STOCK
            if (product.product_type === 'COMBO') {
                product.combo_components = components.map(c => ({
                    child_id: c.child_product?.id,
                    quantity: c.quantity
                }));
                
                if (components.length === 0) {
                    product.quantity_in_stock = 0;
                    product.booking_stock = 0;
                    product.approved_booking_stock = 0;
                } else {
                    let minStock = Infinity;
                    let minBooking = Infinity;
                    let minApproved = Infinity;
                    for (const c of components) {
                        const childStock = Number(c.child_product?.quantity_in_stock) || 0;
                        const childBooking = Number(c.child_product?.booking_stock) || 0;
                        const childApproved = Number(c.child_product?.approved_booking_stock) || 0;
                        const reqQty = Number(c.quantity) || 1;

                        const possibleStock = Math.floor(childStock / reqQty);
                        const possibleBooking = Math.floor(childBooking / reqQty);
                        const possibleApproved = Math.floor(childApproved / reqQty);

                        if (possibleStock < minStock) minStock = possibleStock;
                        if (possibleBooking < minBooking) minBooking = possibleBooking;
                        if (possibleApproved < minApproved) minApproved = possibleApproved;
                    }
                    product.quantity_in_stock = minStock === Infinity ? 0 : minStock;
                    product.booking_stock = minBooking === Infinity ? 0 : minBooking;
                    product.approved_booking_stock = minApproved === Infinity ? 0 : minApproved;
                }
            }
        }
    }



    async searchProducts(keyword: string) {
        return this.productRepo.createQueryBuilder('p')
            .where('p.name ILIKE :keyword OR p.sku ILIKE :keyword', { keyword: `%${keyword}%` })
            .leftJoinAndSelect('p.category_link', 'cat')
            .limit(5)
            .getMany();
    }

    async findOne(id: number) {
        const product = await this.productRepo.findOne({ where: { id }, relations: ['category_link'] });
        if (product) {
            await this.populateComboDescriptions([product]);
            try {
                const config = await this.websiteConfigRepo.findOne({ where: { product_id: product.id } });
                if (config) (product as any).customization_config = config.customization_config;
            } catch {
                // Table might not exist yet, ignore
            }
        }
        return product;
    }

    async findOneBySku(sku: string) {
        const product = await this.productRepo.findOne({ where: { sku }, relations: ['category_link'] });
        if (product) {
            await this.populateComboDescriptions([product]);
            try {
                const config = await this.websiteConfigRepo.findOne({ where: { product_id: product.id } });
                if (config) (product as any).customization_config = config.customization_config;
            } catch {
                // Table might not exist yet, ignore
            }
        }
        return product;
    }

    private cleanData(data: any) {
        const { boms, routings, logistics, components, patterns, front_color, back_color, size, logo, design, customer_description, processing_description, vat_description, tags, ...clean } = data;

        clean.customer_description = customer_description;
        clean.processing_description = processing_description;
        clean.vat_description = vat_description;

        if (tags !== undefined) {
            clean.tags = tags;
        }

        if (data.website_display_name !== undefined) {
            clean.website_display_name = data.website_display_name;
        }

        if (data.contact_for_price !== undefined) {
            clean.contact_for_price = data.contact_for_price;
        }

        if (!clean.attributes && (front_color || back_color || size || logo || design)) {
            clean.attributes = { front_color, back_color, size, logo, design };
        }

        // Explicitly ensure image_url is preserved (though ...clean should cover it, being explicit helps debugging)
        if (data.image_url !== undefined) {
            clean.image_url = data.image_url;
        }

        return clean;
    }

    async create(data: Partial<Product>) {
        try {
            return await this.productRepo.save(this.cleanData(data));
        } catch (error: any) {
            if (error.code === '23505') {
                throw new ConflictException(`Mã SKU "${data.sku}" đã tồn tại trên hệ thống.`);
            }
            throw error;
        }
    }

    async update(id: number, data: Partial<Product>) {
        try {
            await this.productRepo.update(id, this.cleanData(data));
            return this.productRepo.findOne({ where: { id } });
        } catch (error: any) {
            if (error.code === '23505') {
                throw new ConflictException(`Mã SKU "${data.sku}" đã tồn tại trên hệ thống.`);
            }
            throw error;
        }
    }

    async remove(id: number) { return this.productRepo.delete(id); }

    async createVariant(createVariantDto: CreateVariantDto): Promise<Product> {
        const { baseSku, newSku, newName, attributes } = createVariantDto;

        const baseProduct = await this.productRepo.findOne({ where: { sku: baseSku } });
        if (!baseProduct) throw new NotFoundException(`Sản phẩm gốc với SKU "${baseSku}" không tồn tại.`);

        const existingProduct = await this.productRepo.findOne({ where: { sku: newSku } });
        if (existingProduct) throw new ConflictException(`SKU biến thể "${newSku}" đã tồn tại.`);

        const { routings, logistics, components, ...baseProductClone } = baseProduct as any;

        const newVariant = this.productRepo.create({
            ...baseProductClone,
            id: undefined,
            sku: newSku,
            name: newName || baseProduct.name,
            attributes: attributes,
            quantity_in_stock: 0,
            cost_price: 0,
            category_link: baseProduct.category_link
        });

        const savedVariant = await this.productRepo.save(newVariant) as unknown as Product;

        // Sao chép BOM
        const baseBoms = await this.bomRepo.find({ where: { product_id: baseProduct.id } });
        if (baseBoms.length > 0) {
            const newBoms = baseBoms.map(b => this.bomRepo.create({ ...b, id: undefined, product_id: savedVariant.id }));
            await this.bomRepo.save(newBoms as any);
        }

        // Sao chép Routing
        const baseRoutings = await this.routingRepo.find({ where: { product_id: baseProduct.id } });
        if (baseRoutings.length > 0) {
            const newRoutings = baseRoutings.map(r => this.routingRepo.create({ ...r, id: undefined, product_id: savedVariant.id }));
            await this.routingRepo.save(newRoutings as any);
        }

        // Sao chép Logistics
        const baseLogistics = await this.logisticRepo.find({ where: { product_id: baseProduct.id } });
        if (baseLogistics.length > 0) {
            const newLogistics = baseLogistics.map(l => this.logisticRepo.create({ ...l, id: undefined, product_id: savedVariant.id }));
            await this.logisticRepo.save(newLogistics as any);
        }

        // Sao chép Pattern
        const basePattern = await this.patternRepo.findOne({ where: { product_id: baseProduct.id } });
        if (basePattern) {
            const newPattern = this.patternRepo.create({ ...basePattern, id: undefined, product_id: savedVariant.id } as DeepPartial<ProductPattern>);
            await this.patternRepo.save(newPattern);
        }

        await this.calculateCostPrice(savedVariant.sku);
        return savedVariant;
    }

    async getPattern(productId: number) {
        return this.patternRepo.findOne({ where: { product_id: productId } });
    }

    // --- FIX LỖI Ở ĐÂY ---
    async savePattern(productId: number, data: any) {
        let pattern = await this.patternRepo.findOne({ where: { product_id: productId } });

        if (!pattern) {
            // Ép kiểu DeepPartial<ProductPattern> để tránh lỗi nhận diện Array
            pattern = this.patternRepo.create({
                product_id: productId,
                ...data
            } as DeepPartial<ProductPattern>);
        } else {
            // Update fields
            pattern.image_url = data.image_url;
            pattern.fabric_width = data.fabric_width;
            pattern.fabric_yield = data.fabric_yield;
            pattern.details = data.details;
            pattern.note = data.note;
        }
        return this.patternRepo.save(pattern);
    }
    // --------------------

    async getWebsiteConfig(productId: number) {
        return this.websiteConfigRepo.findOne({ where: { product_id: productId } });
    }

    async saveWebsiteConfig(productId: number, config: any) {
        try {
            let entry = await this.websiteConfigRepo.findOne({ where: { product_id: productId } });
            if (!entry) {
                entry = this.websiteConfigRepo.create({
                    product_id: productId,
                    customization_config: config
                });
            } else {
                entry.customization_config = config;
            }
            return await this.websiteConfigRepo.save(entry);
        } catch (error) {
            console.error('Error in saveWebsiteConfig:', error);
            throw error;
        }
    }

    async getProductBOM(sku: string): Promise<BOM[]> {
        const product = await this.productRepo.findOne({ where: { sku } });
        if (!product) return [];

        return this.bomRepo.find({
            where: { product: { id: product.id } },
            relations: ['material']
        });
    }

    async getBomByProductSku(sku: string): Promise<BOM[]> {
        return this.getProductBOM(sku);
    }

    async saveBoms(productId: number, items: any[]) {
        if (!items || !Array.isArray(items)) return [];
        const pId = Number(productId);
        await this.bomRepo.delete({ product_id: pId });
        const newItems = items.filter(i => i.material_id).map(i => this.bomRepo.create({
            product_id: pId,
            material_id: Number(i.material_id),
            quantity: Number(i.quantity) || 0,
            waste_percent: Number(i.waste_percent) || 0
        }));
        await this.bomRepo.save(newItems as any);
        const product = await this.productRepo.findOne({ where: { id: pId } });
        if (product) await this.calculateCostPrice(product.sku);
        return { message: 'Saved' };
    }

    async getRoutings(productId: number) {
        return this.routingRepo.find({
            where: { product_id: productId },
            relations: ['supplier', 'process']
        });
    }

    async saveRoutings(productId: number, items: any[]) {
        if (!items || !Array.isArray(items)) return [];
        const pId = Number(productId);
        await this.routingRepo.delete({ product_id: pId });

        const newItems: DeepPartial<ProductRouting>[] = [];

        for (const item of items) {
            let cost = Number(item.cost) || 0;

            if (cost === 0 && item.supplier_id && item.process_id) {
                const prices = await this.priceRepo.find({
                    where: { supplier_id: item.supplier_id, process_id: item.process_id }
                });
                const productPrice = prices.find(p => p.product_id === pId);
                const generalPrice = prices.find(p => p.product_id === null);
                if (productPrice) cost = Number(productPrice.price);
                else if (generalPrice) cost = Number(generalPrice.price);
            }

            newItems.push({
                product_id: pId,
                process_id: item.process_id || null,
                supplier_id: item.supplier_id || null,
                step_name: item.step_name,
                cost: cost,
                is_required: Boolean(item.is_required)
            } as DeepPartial<ProductRouting>);
        }

        const saved = await this.routingRepo.save(newItems as ProductRouting[]);
        const product = await this.productRepo.findOne({ where: { id: pId } });
        if (product) await this.calculateCostPrice(product.sku);
        return saved;
    }

    async getLogistics(productId: number) { return this.logisticRepo.find({ where: { product_id: productId } }); }

    async saveLogistics(productId: number, items: any[]) {
        if (!items || !Array.isArray(items)) return [];
        const pId = Number(productId);

        // 1. Xóa cũ
        await this.logisticRepo.delete({ product_id: pId });

        // 2. Tạo mới (LOẠI BỎ ID ĐỂ TRÁNH LỖI DUPLICATE KEY)
        const newItems = items.map(i => {
            const { id, ...rest } = i; // Tách ID ra khỏi object
            return this.logisticRepo.create({
                ...rest, // name, note
                product_id: pId,
                cost: Number(i.cost) || 0
            });
        });

        // 3. Lưu lại
        await this.logisticRepo.save(newItems as any);

        // 4. Tính lại giá vốn
        const product = await this.productRepo.findOne({ where: { id: pId } });
        if (product) await this.calculateCostPrice(product.sku);

        return { message: 'Saved' };
    }

    async syncToVariants(sourceProductId: number) {
        const source = await this.productRepo.findOne({ where: { id: sourceProductId } });
        if (!source) throw new NotFoundException('SP Goc khong ton tai');
        const variants = await this.productRepo.find({ where: { name: source.name, category: source.category } });
        const targets = variants.filter(v => v.id !== sourceProductId);

        const sourceBoms = await this.bomRepo.find({ where: { product_id: sourceProductId } });
        const sourceRoutings = await this.routingRepo.find({ where: { product_id: sourceProductId } });
        const sourceLogistics = await this.logisticRepo.find({ where: { product_id: sourceProductId } });
        const sourcePattern = await this.patternRepo.findOne({ where: { product_id: sourceProductId } });

        for (const target of targets) {
            await this.bomRepo.delete({ product_id: target.id });
            if (sourceBoms.length) await this.bomRepo.save(sourceBoms.map(b => this.bomRepo.create({ ...b, id: undefined, product_id: target.id })) as any);

            await this.routingRepo.delete({ product_id: target.id });
            if (sourceRoutings.length) {
                const newRoutings = sourceRoutings.map(r => this.routingRepo.create({ ...r, id: undefined, product_id: target.id }));
                await this.routingRepo.save(newRoutings as any);
            }

            await this.logisticRepo.delete({ product_id: target.id });
            if (sourceLogistics.length) await this.logisticRepo.save(sourceLogistics.map(l => this.logisticRepo.create({ ...l, id: undefined, product_id: target.id })) as any);

            if (sourcePattern) {
                const existingPattern = await this.patternRepo.findOne({ where: { product_id: target.id } });
                if (existingPattern) {
                    await this.patternRepo.update(existingPattern.id, {
                        image_url: sourcePattern.image_url,
                        fabric_width: sourcePattern.fabric_width,
                        fabric_yield: sourcePattern.fabric_yield,
                        details: sourcePattern.details,
                        note: sourcePattern.note
                    });
                } else {
                    await this.patternRepo.save(this.patternRepo.create({ ...sourcePattern, id: undefined, product_id: target.id } as DeepPartial<ProductPattern>));
                }
            }

            await this.calculateCostPrice(target.sku);
        }
        return { message: 'Synced' };
    }

    async copyBom(sourceSku: string, targetSku: string) {
        const source = await this.productRepo.findOne({ where: { sku: sourceSku } });
        const target = await this.productRepo.findOne({ where: { sku: targetSku } });

        if (!source || !target) throw new NotFoundException('Không tìm thấy sản phẩm nguồn hoặc đích.');

        // 1. Lấy BOM nguồn
        const sourceBoms = await this.bomRepo.find({ where: { product_id: source.id } });
        if (!sourceBoms.length) throw new BadRequestException(`Sản phẩm nguồn ${sourceSku} chưa có BOM.`);

        // 2. Xóa BOM cũ của đích
        await this.bomRepo.delete({ product_id: target.id });

        // 3. Sao chép sang đích
        const newBoms = sourceBoms.map(b => this.bomRepo.create({
            product_id: target.id,
            material_id: b.material_id,
            quantity: b.quantity,
            waste_percent: b.waste_percent
        }));

        await this.bomRepo.save(newBoms as any);

        // 4. Tính lại giá vốn
        await this.calculateCostPrice(target.sku);

        return { message: `Đã sao chép ${newBoms.length} dòng BOM từ ${sourceSku} sang ${targetSku}` };
    }

    async copyRoutings(sourceSku: string, targetSku: string) {
        const source = await this.productRepo.findOne({ where: { sku: sourceSku } });
        const target = await this.productRepo.findOne({ where: { sku: targetSku } });

        if (!source || !target) throw new NotFoundException('Không tìm thấy sản phẩm nguồn hoặc đích.');

        const sourceRoutings = await this.routingRepo.find({ where: { product_id: source.id } });
        if (!sourceRoutings.length) throw new BadRequestException(`Sản phẩm nguồn ${sourceSku} chưa có Quy trình gia công.`);

        await this.routingRepo.delete({ product_id: target.id });

        const newItems = sourceRoutings.map(r => this.routingRepo.create({
            product_id: target.id,
            process_id: r.process_id,
            supplier_id: r.supplier_id,
            step_name: r.step_name,
            cost: r.cost,
            is_required: r.is_required
        }));

        await this.routingRepo.save(newItems as any);
        await this.calculateCostPrice(target.sku);

        return { message: `Đã sao chép ${newItems.length} bước gia công từ ${sourceSku} sang ${targetSku}` };
    }

    async copyLogistics(sourceSku: string, targetSku: string) {
        const source = await this.productRepo.findOne({ where: { sku: sourceSku } });
        const target = await this.productRepo.findOne({ where: { sku: targetSku } });

        if (!source || !target) throw new NotFoundException('Không tìm thấy sản phẩm nguồn hoặc đích.');

        const sourceLogistics = await this.logisticRepo.find({ where: { product_id: source.id } });
        if (!sourceLogistics.length) throw new BadRequestException(`Sản phẩm nguồn ${sourceSku} chưa có thông tin Logistics.`);

        await this.logisticRepo.delete({ product_id: target.id });

        const newItems = sourceLogistics.map(l => this.logisticRepo.create({
            product_id: target.id,
            name: l.name,
            cost: l.cost,
            note: l.note
        }));

        await this.logisticRepo.save(newItems as any);
        await this.calculateCostPrice(target.sku);

        return { message: `Đã sao chép ${newItems.length} mục Logistics từ ${sourceSku} sang ${targetSku}` };
    }

    async copySemiFinished(sourceSku: string, targetSku: string) {
        const source = await this.productRepo.findOne({ where: { sku: sourceSku } });
        const target = await this.productRepo.findOne({ where: { sku: targetSku } });

        if (!source || !target) throw new NotFoundException('Không tìm thấy sản phẩm nguồn hoặc đích.');

        const sourceComponents = await this.componentRepo.find({
            where: { parent_product: { id: source.id } },
            relations: ['child_product']
        });
        const sourceBtps = sourceComponents.filter(c => c.child_product?.product_type === 'SEMI_FINISHED');

        if (!sourceBtps.length) throw new BadRequestException(`Sản phẩm nguồn ${sourceSku} chưa có Bán thành phẩm.`);

        const targetComponents = await this.componentRepo.find({
            where: { parent_product: { id: target.id } },
            relations: ['child_product']
        });
        const targetBtpIds = targetComponents.filter(c => c.child_product?.product_type === 'SEMI_FINISHED').map(c => c.id);

        if (targetBtpIds.length > 0) {
            await this.componentRepo.delete(targetBtpIds);
        }

        let copiedCount = 0;
        for (const sourceBtpComp of sourceBtps) {
            const childProd = sourceBtpComp.child_product;
            if (!childProd) continue;

            let suffix = childProd.sku.replace(sourceSku + '_', '');
            if (suffix === childProd.sku) {
                 suffix = `BTP_${Date.now()}`;
            }

            const newPhantomSku = `${targetSku}_${suffix}_${Math.floor(Math.random() * 1000)}`;
            const newPhantomName = childProd.name.replace(source.name, target.name);

            const newPhantom = this.productRepo.create({
                sku: newPhantomSku,
                name: newPhantomName,
                unit: childProd.unit,
                product_type: 'SEMI_FINISHED',
                is_active: true,
                base_price: 0,
                cost_price: childProd.cost_price
            });

            const savedPhantom = await this.productRepo.save(newPhantom);

            const sourceBom = await this.bomRepo.find({ where: { product_id: childProd.id } });
            if (sourceBom.length > 0) {
                const newBoms = sourceBom.map(b => this.bomRepo.create({
                    product_id: savedPhantom.id,
                    material_id: b.material_id,
                    quantity: b.quantity,
                    waste_percent: b.waste_percent
                }));
                await this.bomRepo.save(newBoms as any);
            }

            await this.componentRepo.save(this.componentRepo.create({
                parent_product: target,
                child_product: savedPhantom,
                quantity: sourceBtpComp.quantity,
                sort_order: sourceBtpComp.sort_order
            }));
            
            copiedCount++;
        }

        await this.calculateCostPrice(target.sku);

        return { message: `Đã sao chép ${copiedCount} Bán thành phẩm từ ${sourceSku} sang ${targetSku}` };
    }

    // --- BULK UPDATE PRICE ---
    async calculateAllCosts() {
        const products = await this.productRepo.find();
        let count = 0;

        // 1. Prioritize Standard Products first (Components)
        const standards = products.filter(p => p.product_type !== 'COMBO');
        for (const p of standards) {
            await this.calculateCostPrice(p.sku);
            count++;
        }

        // 2. Update Combos (depend on Standard Products)
        const combos = products.filter(p => p.product_type === 'COMBO');
        for (const c of combos) {
            await this.calculateCostPrice(c.sku);
            count++;
        }

        return { message: `Updated ${count} products`, count };
    }
    // -------------------------

    private calculateSellingPrice(cost: number, marginPercent: number): number {
        if (marginPercent >= 100 || marginPercent < 0) return cost;
        const marginDecimal = marginPercent / 100;
        const price = cost / (1 - marginDecimal);
        return Math.ceil(price / 1000) * 1000;
    }

    async calculateCostPrice(sku: string): Promise<any> {
        const product = await this.productRepo.findOne({ where: { sku }, relations: ['category_link'] });
        if (!product) throw new NotFoundException('SP khong ton tai');

        let totalCost = 0;

        // Check Combo
        // 1. Cost from Components (Semi-Finished / Combo Items)
        const components = await this.componentRepo.find({
            where: { parent_product: { id: product.id } },
            relations: ['child_product']
        });

        if (components.length > 0) {
            for (const comp of components) {
                totalCost += Number(comp.child_product?.cost_price ?? 0) * Number(comp.quantity);
            }
        }

        // 2. Cost from BOM (Direct Materials)
        // Now we calculate BOM cost regardless of components existence (Hybrid support)
        const boms = await this.bomRepo.find({ where: { product_id: product.id }, relations: ['material'] });
        for (const item of boms) {
            if (item.material) {
                const waste = Number(item.waste_percent) / 100;
                const materialCost = Number(item.material.cost_price || item.material.cost_per_unit);
                totalCost += materialCost * Number(item.quantity) * (1 + waste);
            }
        }

        // 3. Routing Cost
        const routings = await this.routingRepo.find({ where: { product_id: product.id } });
        routings.forEach(r => {
            if (r.is_required) totalCost += Number(r.cost);
        });

        // 4. Logistics Cost
        const logistics = await this.logisticRepo.find({ where: { product_id: product.id } });
        logistics.forEach(l => { totalCost += Number(l.cost); });

        totalCost = Math.round(totalCost);

        let margin = Number(product.profit_margin);
        if (!margin && product.category_link) {
            margin = Number(product.category_link.profit_margin);
        }
        if (!margin) margin = 30;

        const sellingPrice = this.calculateSellingPrice(totalCost, margin);

        product.cost_price = totalCost;
        product.base_price = sellingPrice;
        await this.productRepo.save(product);

        return { sku, new_cost_price: totalCost, new_base_price: sellingPrice, margin_used: margin };
    }

    async getCostBreakdowns(productIds: number[]): Promise<Record<number, { boms: number, routings: number, logistics: number, components: number }>> {
        if (!productIds || productIds.length === 0) return {};
        
        const result: Record<number, { boms: number, routings: number, logistics: number, components: number }> = {};
        for (const id of productIds) {
            result[id] = { boms: 0, routings: 0, logistics: 0, components: 0 };
        }

        // 1. BOM (Direct Materials)
        const boms = await this.bomRepo.find({ where: { product_id: In(productIds) }, relations: ['material'] });
        for (const item of boms) {
            if (item.material) {
                const waste = Number(item.waste_percent || 0) / 100;
                const materialCost = Number(item.material.cost_price || item.material.cost_per_unit || 0);
                result[item.product_id].boms += materialCost * Number(item.quantity || 0) * (1 + waste);
            }
        }

        // 2. Routings
        const routings = await this.routingRepo.find({ where: { product_id: In(productIds), is_required: true } });
        for (const r of routings) {
            result[r.product_id].routings += Number(r.cost || 0);
        }

        // 3. Logistics
        const logistics = await this.logisticRepo.find({ where: { product_id: In(productIds) } });
        for (const l of logistics) {
            result[l.product_id].logistics += Number(l.cost || 0);
        }

        // 4. Components (Combo)
        const components = await this.componentRepo.find({
            where: { parent_product: { id: In(productIds) } },
            relations: ['child_product', 'parent_product']
        });
        for (const c of components) {
             const parentId = c.parent_product?.id;
             if (parentId && c.child_product) {
                 result[parentId].components += Number(c.child_product.cost_price || 0) * Number(c.quantity || 0);
             }
        }

        return result;
    }

    async updatePricesByCategory(categoryId: number, newMargin: number) {
        const products = await this.productRepo.find({ where: { category_id: categoryId } });
        for (const p of products) {
            if (!p.profit_margin) {
                const newPrice = this.calculateSellingPrice(Number(p.cost_price), newMargin);
                p.base_price = newPrice;
                await this.productRepo.save(p);
            }
        }
    }

    async updateSizesByCategory(categoryId: number, newSize: string) {
        let updatedCount = 0;
        if (!newSize) return updatedCount;
        const products = await this.productRepo.find({ where: { category_id: categoryId } });
        for (const p of products) {
            let attrs = p.attributes;
            if (typeof attrs === 'string') {
                try {
                    attrs = JSON.parse(attrs);
                } catch (e) {
                    attrs = {};
                }
            }
            if (!attrs || typeof attrs !== 'object') attrs = {};
            
            // Chỉ cập nhật nếu sản phẩm chưa có giá trị kích thước
            if (!attrs.size) {
                attrs.size = newSize;
                p.attributes = attrs;
                await this.productRepo.save(p);
                updatedCount++;
            }
        }
        return updatedCount;
    }

    async getComboComponents(sku: string) {
        const product = await this.productRepo.findOne({ where: { sku } });
        if (!product) return [];
        return this.componentRepo.find({
            where: { parent_product: { id: product.id } },
            relations: ['child_product']
        });
    }

    async addComponent(parentSku: string, childSku: string, quantity: number) {
        const parent = await this.productRepo.findOne({ where: { sku: parentSku } });
        const child = await this.productRepo.findOne({ where: { sku: childSku } });
        if (!parent || !child) throw new NotFoundException('SP khong ton tai');

        let comp = await this.componentRepo.findOne({
            where: { parent_product: { id: parent.id }, child_product: { id: child.id } }
        });

        if (comp) {
            comp.quantity = quantity;
        } else {
            comp = this.componentRepo.create({
                parent_product: parent,
                child_product: child,
                quantity: quantity
            });
        }
        const saved = await this.componentRepo.save(comp);
        await this.calculateCostPrice(parent.sku);
        return saved;
    }

    async removeComponent(id: number) {
        const comp = await this.componentRepo.findOne({ where: { id }, relations: ['parent_product'] });
        if (comp) {
            const parentSku = comp.parent_product.sku;
            await this.componentRepo.delete(id);
            await this.calculateCostPrice(parentSku);
        }
        return { message: 'Deleted' };
    }

    async saveComponents(productId: number, items: any[]) {
        if (!items || !Array.isArray(items)) return [];
        const pId = Number(productId);

        await this.componentRepo.delete({ parent_product: { id: pId } });

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const child = await this.productRepo.findOne({ where: { sku: item.sku } });
            if (child) {
                await this.componentRepo.save(this.componentRepo.create({
                    parent_product: { id: pId },
                    child_product: child,
                    quantity: Number(item.quantity),
                    sort_order: i + 1 // Save sort order (1-based)
                }));
            }
        }

        const parent = await this.productRepo.findOne({ where: { id: pId } });
        if (parent) await this.calculateCostPrice(parent.sku);

        return { message: 'Updated' };
    }

    async importFromExcel(b: Buffer) { return 0; }

    async getSalesHistory(productId: number) {
        const product = await this.productRepo.findOne({ where: { id: productId } });
        if (!product) return [];

        const sql = `
            SELECT 
                soi.id,
                soi.sku,
                soi.quantity,
                soi.unit_price,
                COALESCE(NULLIF(soi.total_price, 0), soi.subtotal, soi.quantity * soi.unit_price, 0) as total_price,
                so.id as order_id,
                so.order_code,
                so.order_date,
                COALESCE(so.customer_name, c.name, 'N/A') as customer_name,
                so.status,
                so.delivery_date
            FROM sales_order_items soi
            JOIN sales_orders so ON soi.order_id = so.id
            LEFT JOIN customers c ON so.customer_id = c.id
            WHERE soi.product_id = $1 OR soi.sku = $2
            ORDER BY so.order_date DESC NULLS LAST, so.id DESC
        `;
        return this.productRepo.manager.query(sql, [product.id, product.sku]);
    }
}