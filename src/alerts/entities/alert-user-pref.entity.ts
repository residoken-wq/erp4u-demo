import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('alert_user_prefs')
export class AlertUserPref {
  @PrimaryColumn({ type: 'int' })
  user_id: number;

  @PrimaryColumn({ type: 'varchar', length: 50 })
  type: string;

  @Column({ type: 'boolean', default: true })
  in_app: boolean;

  @Column({ type: 'boolean', default: false })
  email_digest: boolean;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
