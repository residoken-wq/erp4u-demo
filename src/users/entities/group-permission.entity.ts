import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { UserGroup } from './user-group.entity';

@Entity('group_permissions')
export class GroupPermission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  module_code: string; // VD: 'SALES', 'PRODUCT', 'CUSTOMER', 'INVENTORY'

  // Các cờ phân quyền CRUD
  @Column({ default: false }) can_view: boolean;
  @Column({ default: false }) can_create: boolean;
  @Column({ default: false }) can_update: boolean;
  @Column({ default: false }) can_delete: boolean;
  @Column({ default: false }) view_cost_price: boolean; // Quyền xem giá vốn

  @ManyToOne(() => UserGroup, (group) => group.permissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group: UserGroup;

  @Column()
  group_id: number;
}