import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { GroupPermission } from './group-permission.entity';

@Entity('user_groups')
export class UserGroup {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string; // VD: "Admin", "Nhân viên kinh doanh"

  @Column({ nullable: true })
  description: string;

  @OneToMany(() => User, (user) => user.group)
  users: User[];

  @OneToMany(() => GroupPermission, (perm) => perm.group, { cascade: true })
  permissions: GroupPermission[];
}