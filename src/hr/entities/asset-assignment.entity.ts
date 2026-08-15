import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Employee } from './employee.entity';

export enum AssetCondition {
    NEW = 'NEW',
    GOOD = 'GOOD',
    FAIR = 'FAIR',
    DAMAGED = 'DAMAGED'
}

@Entity('asset_assignments')
export class AssetAssignment {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Employee)
    @JoinColumn({ name: 'employee_id' })
    employee: Employee;

    @Column()
    employee_id: number;

    @Column()
    asset_name: string;

    @Column({ nullable: true })
    asset_code: string;

    @Column({ nullable: true })
    serial_number: string;

    @Column({ type: 'date' })
    assigned_date: Date;

    @Column({ type: 'date', nullable: true })
    returned_date: Date;

    @Column({ type: 'enum', enum: AssetCondition, default: AssetCondition.NEW })
    condition: AssetCondition;

    @Column({ type: 'text', nullable: true })
    note: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
