import { Entity, Column, PrimaryColumn, OneToOne, JoinColumn } from 'typeorm';
import { Product } from '../product.entity';

@Entity('product_website_config')
export class ProductWebsiteConfig {
    @PrimaryColumn()
    product_id: number;

    @OneToOne(() => Product)
    @JoinColumn({ name: 'product_id' })
    product: Product;

    @Column('jsonb', { nullable: true })
    customization_config: {
        allow_logo: boolean;
        logo_price?: number;
        logo_position?: { x: number; y: number; width: number; height: number };
        base_image?: string; // Standard Front View (Mattress)
        mattress_back_image?: string; // Mattress Back View
        pillow_image?: string; // Standard Pillow Front
        pillow_back_image?: string; // Pillow Back View
        dimensions?: {
            mattress?: { width: number; height: number }; // cm
            pillow?: { width: number; height: number }; // cm
            logo?: { width: number; height: number }; // cm
        };
        model_3d_url?: string; // URL to .glb/.gltf 3D model file
        colors: Array<{ name: string; code: string; image_url?: string; pillow_image_url?: string }>;
        accessories: Array<{ name: string; price: number; image_url?: string }>;
    };
}
