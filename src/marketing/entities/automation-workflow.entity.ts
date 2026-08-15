import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum WorkflowStatus {
    DRAFT = 'DRAFT',
    ACTIVE = 'ACTIVE',
    PAUSED = 'PAUSED',
    ARCHIVED = 'ARCHIVED'
}

export enum TriggerType {
    NEW_CUSTOMER = 'NEW_CUSTOMER',
    ORDER_PLACED = 'ORDER_PLACED',
    ORDER_COMPLETED = 'ORDER_COMPLETED',
    CART_ABANDONED = 'CART_ABANDONED',
    CUSTOMER_BIRTHDAY = 'CUSTOMER_BIRTHDAY',
    INACTIVITY = 'INACTIVITY',
    SEGMENT_JOINED = 'SEGMENT_JOINED',
    MANUAL = 'MANUAL',
    SCHEDULED = 'SCHEDULED'
}

export enum ActionType {
    SEND_EMAIL = 'SEND_EMAIL',
    SEND_SMS = 'SEND_SMS',
    WAIT = 'WAIT',
    CONDITION = 'CONDITION',
    ADD_TAG = 'ADD_TAG',
    REMOVE_TAG = 'REMOVE_TAG',
    ADD_TO_SEGMENT = 'ADD_TO_SEGMENT',
    REMOVE_FROM_SEGMENT = 'REMOVE_FROM_SEGMENT',
    UPDATE_FIELD = 'UPDATE_FIELD',
    WEBHOOK = 'WEBHOOK'
}

@Entity('automation_workflows')
export class AutomationWorkflow {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column('text', { nullable: true })
    description: string;

    @Column({ type: 'enum', enum: WorkflowStatus, default: WorkflowStatus.DRAFT })
    status: WorkflowStatus;

    // Trigger configuration
    @Column({ type: 'enum', enum: TriggerType })
    trigger_type: TriggerType;

    @Column('jsonb', { default: {} })
    trigger_config: {
        segment_id?: number;
        inactivity_days?: number;
        schedule_cron?: string;
        conditions?: any[];
    };

    // Workflow steps (nodes)
    @Column('jsonb', { default: [] })
    steps: {
        id: string;
        type: ActionType;
        config: {
            // For SEND_EMAIL
            email_template_id?: string;
            email_subject?: string;
            // For SEND_SMS
            sms_message?: string;
            // For WAIT
            wait_hours?: number;
            wait_days?: number;
            // For CONDITION
            condition_field?: string;
            condition_operator?: string;
            condition_value?: any;
            yes_step_id?: string;
            no_step_id?: string;
            // For ADD_TAG / ADD_TO_SEGMENT
            tag_name?: string;
            segment_id?: number;
            // For WEBHOOK
            webhook_url?: string;
        };
        next_step_id?: string;
    }[];

    // Statistics
    @Column('jsonb', { default: {} })
    stats: {
        total_entered?: number;
        currently_in_workflow?: number;
        completed?: number;
        converted?: number;
    };

    @Column('int', { default: 0 })
    total_runs: number;

    @Column({ nullable: true })
    last_run_at: Date;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
