import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('system_configs')
export class SystemConfig {
    @PrimaryColumn()
    key: string;

    @Column('text', { nullable: true })
    value: string;

    @Column('text', { nullable: true })
    description: string;
}
