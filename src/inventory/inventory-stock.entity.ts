import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('inventory_stocks')
@Index(['item_type', 'item_id', 'warehouse_code'], { unique: true }) // Đảm bảo mỗi món hàng chỉ có 1 dòng cho mỗi kho
export class InventoryStock {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  item_type: 'PRODUCT' | 'MATERIAL';

  @Column()
  item_id: number;

  @Column()
  warehouse_code: string; // KHO_TP, KHO_BTP, KHO_NPL, KHO_LOI

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  quantity: number;
}