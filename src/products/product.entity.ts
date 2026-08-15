import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { Category } from '../categories/category.entity';
import { ProductRouting } from './product-routing.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  sku: string;

  @Index() // <--- Optimize Search by Name
  @Column()
  name: string;

  @ManyToOne(() => Category, (cat) => cat.products, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category_link: Category;

  @Index() // <--- Optimize Filter by Category
  @Column({ nullable: true })
  category_id: number;

  @Column({ nullable: true })
  category: string;

  @Column({ nullable: true })
  product_type: string;

  @Column('jsonb', { nullable: true })
  attributes: any;

  @Column({ nullable: true })
  unit: string;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  base_price: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  cost_price: number;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  profit_margin: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  quantity_in_stock: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  booking_stock: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  approved_booking_stock: number;

  @Column({ default: true })
  is_active: boolean;

  // --- MỚI: FIELD ĐÁNH DẤU SẢN PHẨM ƯU TIÊN ---
  @Column({ default: false })
  is_flagged: boolean;

  // --- MỚI: FIELD MÔ TẢ KHÁCH HÀNG ---
  @Column('text', { nullable: true })
  customer_description: string;

  // --- MỚI: FIELD MÔ TẢ GIA CÔNG ---
  @Column('text', { nullable: true })
  processing_description: string;

  // --- MỚI: FIELD MÔ TẢ VAT ---
  @Column('text', { nullable: true })
  vat_description: string;

  @Column('jsonb', { nullable: true, default: [] })
  tags: string[];

  @Column('text', { nullable: true })
  image_url: string; // Google Drive Link or Direct URL

  // --- WEBSITE FIELDS ---
  @Column({ default: false })
  show_on_website: boolean;  // Hiển thị trên website

  @Column({ default: false })
  contact_for_price: boolean;  // Liên hệ tư vấn (ẩn giá)

  @Column('decimal', { precision: 15, scale: 2, nullable: true })
  website_price: number;  // Giá bán trên website (nếu khác base_price)

  @Column('decimal', { precision: 15, scale: 2, nullable: true })
  website_sale_price: number;  // Giá khuyến mãi trên website

  @Column({ default: 0 })
  website_order: number;  // Thứ tự hiển thị trên website

  @Column('text', { nullable: true })
  website_display_name: string;  // Tên sản phẩm hiển thị trên website (nếu khác name)

  // RankMath-like SEO Fields
  @Column('jsonb', { nullable: true })
  seo_meta: {
    title?: string;
    description?: string;
    canonicalUrl?: string;
    schemaType?: 'Product';
    ogImage?: string;
    robots?: string[]; // index, noindex, follow, nofollow
  };

  @OneToMany(() => ProductRouting, (routing) => routing.product)
  routings: ProductRouting[];

  // --- MỚI: Relation với ProductComponent (BOM) ---
  @OneToMany('ProductComponent', (pc: any) => pc.parent_product)
  components: any[];

  // --- MỚI: Relation với ProductLogistics ---
  @OneToMany('ProductLogistics', (pl: any) => pl.product)
  logistics: any[];

  // --- MỚI: Relation với BOM (Material) ---
  @OneToMany('BOM', (bom: any) => bom.product)
  boms: any[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}