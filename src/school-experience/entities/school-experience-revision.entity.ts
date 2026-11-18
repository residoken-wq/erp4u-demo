import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum SchoolExperienceStatus {
    DRAFT = 'DRAFT',
    PUBLISHED = 'PUBLISHED',
    ARCHIVED = 'ARCHIVED'
}

@Entity('school_experience_revisions')
export class SchoolExperienceRevision {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int', default: 1 })
    revision_number: number;

    @Column({
        type: 'varchar',
        length: 20,
        default: SchoolExperienceStatus.DRAFT
    })
    status: SchoolExperienceStatus;

    @Column({ type: 'varchar', length: 100, nullable: true })
    author: string;

    @Column({ type: 'text', nullable: true })
    changelog: string;

    @Column({ type: 'jsonb' })
    config_data: {
        r7RenderMode: 'illustrated_sequence' | 'scene3d';
        rooms: Record<string, {
            id: string;
            name: string;
            title: string;
            desc: string;
            thumbnail: string;
            active: boolean;
            productReference?: string;
        }>;
        productBindings: Record<string, {
            productReference: string;
            colorId: string;
            slotType: 'real_photo' | 'color_variant' | 'cubby_storage' | 'texture_3d';
            assetUrl: string;
            focalPoint?: [number, number];
            updatedAt: string;
        }>;
        r7MediaMatrix: Record<string, {
            roleId: string;
            stepCode: string;
            assetUrl: string;
            mediaDesktopUrl?: string;
            mediaMobileUrl?: string;
            mediaType: 'image' | 'video';
            status: 'available' | 'missing' | 'error';
            focalPoint?: [number, number]; // [x, y] in percentage 0-100
            actionBounds?: { x: number; y: number; width: number; height: number }; // percentage 0-100
            faceBounds?: { x: number; y: number; width: number; height: number }; // percentage 0-100
            description?: string;
        }>;
        mapConfig: {
            quickRoute: string[];
            showVisitedBadge: boolean;
            defaultZoom: number;
        };
        version: number;
    };

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    @Column({ type: 'timestamp', nullable: true })
    published_at: Date;
}
