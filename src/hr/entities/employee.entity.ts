import { EncryptionTransformer } from '../../common/encryption/encryption.transformer';
import { Entity, Column, PrimaryGeneratedColumn, OneToOne, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { WorkShift } from './work-shift.entity';

export enum Gender {
    MALE = 'MALE',
    FEMALE = 'FEMALE',
    OTHER = 'OTHER'
}

@Entity('employees')
export class Employee {
    @PrimaryGeneratedColumn()
    id: number;

    @OneToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({ nullable: true })
    user_id: number;

    @Column()
    full_name: string;

    @Column({ type: 'enum', enum: Gender, default: Gender.OTHER })
    gender: Gender;

    @Column({ type: 'date', nullable: true })
    date_of_birth: Date;

    @Column({ type: 'text', nullable: true, transformer: new EncryptionTransformer() }) phone: string;

    @Column({ type: 'text', nullable: true, transformer: new EncryptionTransformer() }) address: string;

    @Column({ nullable: true })
    department: string;

    @Column({ nullable: true })
    position: string;

    @Column({ type: 'date', nullable: true })
    hire_date: Date;

    @Column({ type: 'decimal', precision: 15, scale: 0, default: 0 })
    base_salary: number;

    // Ca làm việc
    @ManyToOne(() => WorkShift, { nullable: true })
    @JoinColumn({ name: 'work_shift_id' })
    work_shift: WorkShift;

    @Column({ nullable: true })
    work_shift_id: number;

    @Column({ type: 'text', nullable: true })
    note: string;

    @Column({ default: true })
    is_active: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}

