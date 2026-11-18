import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('shipping_carriers')
export class ShippingCarrier {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    code: string; // VD: GHTK, GHN, VNPOST, VIETTEL_POST

    @Column()
    name: string; // VD: Giao Hàng Tiết Kiệm, Giao Hàng Nhanh

    @Column({ nullable: true })
    phone: string;

    @Column({ nullable: true })
    website: string;

    @Column({ nullable: true })
    tracking_url: string; // URL template để tra cứu vận đơn, VD: https://ghtk.vn/tracking?code={code}

    @Column({ default: true })
    is_active: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
