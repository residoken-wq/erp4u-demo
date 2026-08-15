import { Entity, Column, PrimaryColumn, UpdateDateColumn, CreateDateColumn } from 'typeorm';

export interface WizardBaseImage {
    id: string;
    url: string;
    label?: string;            // "Mặt trước", "Mặt sau", "Logo frame"...
    sort_order: number;        // z-index layer order
    x: number;                 // vị trí X (px)
    y: number;                 // vị trí Y (px)
    width: number;             // chiều rộng (px)
    height: number;            // chiều cao (px)
}

export interface WizardCategoryL1 {
    id: string;                    // 'BEDDING' | 'BAGS' | 'APPAREL'
    name: string;                  // 'Bộ Nệm & Phụ Kiện Giấc Ngủ'
    icon_url?: string;             // URL ảnh icon đại diện
    image_url?: string;            // URL ảnh thumbnail
    sort_order: number;
    subcategories: WizardCategoryL2[];
}

export interface WizardCategoryL2 {
    id: string;                    // 'SLEEPING_BAG' | 'MATTRESS_SET' | ...
    name: string;                  // 'Bộ Túi Ngủ'
    description?: string;          // Mô tả sản phẩm L2
    sort_order: number;
    base_image?: string;           // Ảnh mặc định cho visualization (backward compat)
    base_images?: WizardBaseImage[]; // Mảng frames base image (max 5, có vị trí & kích thước)
    customization_steps: WizardCustomizationStep[];
    price_tiers: WizardPriceTier[];
}

export interface WizardCustomizationStep {
    id: string;                    // 'B1' | 'B2' | ... | 'B6'
    label: string;                 // 'Chọn size túi ngủ'
    type: 'toggle' | 'dropdown' | 'color_swatch' | 'branding';
    options: WizardOption[];
    default_option_id?: string;
    is_skippable?: boolean;        // Cho phép khách hàng bỏ qua bước này
    required_frame_id?: string;    // Liên kết step với frame base image
}

export interface WizardOption {
    id: string;                    // 'SIZE_S' | 'SIZE_M'
    name: string;                  // 'S'
    description?: string;          // 'Phù hợp với trẻ mầm non | 130x70 cm'
    price_modifier: number;        // Số tiền cộng/trừ so với giá base (VD: +20000)
    image_url?: string;            // Ảnh sản phẩm khi chọn option này
    visualization_overlay?: string; // Ảnh overlay cho visualization panel (hoặc texture/màu tinting)
    color_code?: string;           // Mã màu hex cho color_swatch tinting
    sub_options?: WizardOption[];   // VD: màu sắc phụ thuộc loại vải
}

export interface WizardPriceTier {
    min_quantity: number;          // 50
    max_quantity?: number;         // 99 (null = unlimited)
    base_price: number;            // Giá nền cho tier này
}

export interface WizardConfigData {
    hero_title: string;
    hero_subtitle?: string;
    categories: WizardCategoryL1[];
    trust_section?: {
        process_steps: Array<{ icon: string; title: string; description: string }>;
        quality_badges: Array<{ icon: string; text: string }>;
        partner_logos: string[];  // URLs
    };
}

@Entity('wizard_config')
export class WizardConfig {
    @PrimaryColumn()
    key: string; // 'wizard_products'

    @Column('jsonb', { default: {} })
    value: WizardConfigData;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
