import React, { useState } from 'react';
import { Card, Tag, Space, Empty, Tooltip, Modal, DatePicker, Alert, message, Progress } from 'antd';
import { WarningOutlined, CheckCircleOutlined, ClockCircleOutlined, DragOutlined } from '@ant-design/icons';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import axios from 'axios';
import dayjs from 'dayjs';
import { API_URL } from '../../config';

const { RangePicker } = DatePicker;

// --- Sortable Step Bar Component ---
const SortableStepBar = ({ step, si, stepCount, totalDays, planStart, colors, onClick }: any) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.step_name + '_' + si });
    const bgColor = colors[si % colors.length];

    let left: number, width: number;
    if (step.start_date && step.end_date && totalDays > 0) {
        const sStart = dayjs(step.start_date).diff(planStart, 'day');
        const sEnd = dayjs(step.end_date).diff(planStart, 'day');
        left = Math.max(0, (sStart / totalDays) * 100);
        width = Math.max(2, ((sEnd - sStart + 1) / totalDays) * 100);
    } else {
        left = (si / stepCount) * 100;
        width = (1 / stepCount) * 100;
    }

    const style: React.CSSProperties = {
        position: 'absolute',
        left: `${left}%`,
        width: `${width}%`,
        height: '100%',
        background: isDragging ? '#40a9ff' : (step.live_status === 'COMPLETED' ? '#52c41a' : step.live_status === 'IN_PROGRESS' ? '#1890ff' : bgColor),
        opacity: isDragging ? 1 : 0.85,
        borderRight: '1px solid #fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'grab',
        transition: transition || 'opacity 0.2s',
        transform: CSS.Transform.toString(transform && { ...transform, scaleY: 1 }),
        zIndex: isDragging ? 100 : 1,
        boxShadow: isDragging ? '0 2px 8px rgba(0,0,0,0.3)' : 'none'
    };

    return (
        <Tooltip title={`${step.step_name}${step.supplier_name ? ` (NCC: ${step.supplier_name})` : ''}${step.start_date ? `\n${dayjs(step.start_date).format('DD/MM')} → ${dayjs(step.end_date).format('DD/MM')}` : ''}${step.live_status ? `\n⏱ ${step.live_status === 'COMPLETED' ? '✅ Hoàn thành' : step.live_status === 'IN_PROGRESS' ? '🔄 Đang thực hiện' : '⏳ Chờ'}` : ''}\n🖱 Click để chỉnh thời gian | ✋ Kéo để đổi thứ tự`}>
            <div
                ref={setNodeRef}
                style={style}
                {...attributes}
                {...listeners}
                onClick={(e) => { e.stopPropagation(); onClick(step, si); }}
                onMouseEnter={(e) => { if (!isDragging) e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={(e) => { if (!isDragging) e.currentTarget.style.opacity = '0.85'; }}
            >
                <span style={{ color: '#fff', fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px' }}>
                    {step.step_name}
                </span>
            </div>
        </Tooltip>
    );
};

interface GanttChartTabProps {
    ganttPlans: any[];
    setGanttPlans: (plans: any[]) => void;
}

const GanttChartTab: React.FC<GanttChartTabProps> = ({ ganttPlans, setGanttPlans }) => {
    const [editingStep, setEditingStep] = useState<any>(null);
    const [stepDateRange, setStepDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const saveConfig = async (planId: number, plans: any[]) => {
        const plan = plans.find((p: any) => p.plan_id === planId);
        const config: any = {};
        for (const pr of (plan?.products || [])) {
            config[pr.sku] = {
                step_order: pr.steps.map((_: any, idx: number) => idx),
                steps: pr.steps.map((s: any) => ({ step_name: s.step_name, start_date: s.start_date, end_date: s.end_date }))
            };
        }
        try {
            await axios.post(`${API_URL}/planning/gantt/${planId}/config`, config);
            return true;
        } catch { return false; }
    };

    if (ganttPlans.length === 0) {
        return <Empty description="Không có kế hoạch chưa hoàn thiện" />;
    }

    return (
        <div>
            {ganttPlans.map((plan: any) => {
                const planStart = dayjs(plan.start_date);
                const planEnd = dayjs(plan.end_date);
                const totalDays = Math.max(planEnd.diff(planStart, 'day'), 1);
                const statusColor = plan.status === 'CALCULATED' ? '#52c41a' : '#faad14';
                const npl = plan.npl_status || { total: 0, purchased: 0, status: 'NONE' };
                const warnings = plan.delivery_warnings || [];

                const nplColor = npl.status === 'FULL' ? '#52c41a' : npl.status === 'PARTIAL' ? '#faad14' : '#f5222d';
                const nplIcon = npl.status === 'FULL' ? <CheckCircleOutlined /> : npl.status === 'PARTIAL' ? <ClockCircleOutlined /> : <WarningOutlined />;
                const nplText = npl.status === 'FULL' ? 'Đã mua đủ NPL' : npl.status === 'PARTIAL' ? `NPL: ${npl.purchased}/${npl.total}` : 'Chưa mua NPL';

                return (
                    <div key={plan.plan_id} style={{ marginBottom: 20 }}>
                        {warnings.length > 0 && (
                            <div style={{ marginBottom: 8 }}>
                                {warnings.map((w: any, wi: number) => (
                                    <Alert
                                        key={wi}
                                        type={w.level === 'OVERDUE' ? 'error' : 'warning'}
                                        showIcon
                                        banner
                                        style={{ marginBottom: 4, borderRadius: 4 }}
                                        message={
                                            w.level === 'OVERDUE'
                                                ? <span>🔴 <b>{w.order_code}</b> — Đã quá hạn giao {Math.abs(w.days_left)} ngày!</span>
                                                : <span>🟠 <b>{w.order_code}</b> — Còn <b>{w.days_left}</b> ngày đến hạn giao ({dayjs(w.delivery_date).format('DD/MM/YYYY')})</span>
                                        }
                                    />
                                ))}
                            </div>
                        )}

                        <Card
                            size="small"
                            style={{ borderLeft: `4px solid ${statusColor}` }}
                            title={
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                                    <span><b>{plan.plan_code}</b> - {plan.plan_name}</span>
                                    <Space size={8} wrap>
                                        <Tag icon={nplIcon} color={nplColor} style={{ fontWeight: 500 }}>{nplText}</Tag>
                                        <Tag color={plan.status === 'COMPLETED' ? 'green' : plan.status === 'IN_PRODUCTION' ? 'blue' : plan.status === 'CALCULATED' ? 'cyan' : 'orange'}>{plan.status === 'COMPLETED' ? 'Hoàn thành' : plan.status === 'IN_PRODUCTION' ? 'Đang SX' : plan.status === 'CALCULATED' ? 'Đã tính MRP' : 'Mới'}</Tag>
                                        <small style={{ color: '#888' }}>{planStart.format('DD/MM/YYYY')} → {planEnd.format('DD/MM/YYYY')}</small>
                                    </Space>
                                </div>
                            }
                        >
                            <div style={{ position: 'relative', marginBottom: 8, height: 24, background: '#fafafa', borderRadius: 4, overflow: 'hidden', fontSize: 11 }}>
                                {Array.from({ length: Math.min(totalDays + 1, 31) }).map((_, i) => {
                                    const d = planStart.add(i, 'day');
                                    const left = (i / totalDays) * 100;
                                    return (
                                        <span key={i} style={{ position: 'absolute', left: `${left}%`, top: 4, color: '#999', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
                                            {d.format('DD')}
                                        </span>
                                    );
                                })}
                            </div>

                            <div style={{ fontSize: 11, color: '#999', marginBottom: 6 }}><DragOutlined /> Kéo để đổi thứ tự công đoạn | 🖱 Click để chỉnh thời gian</div>

                            {(plan.products || []).length === 0 ? (
                                <div style={{ textAlign: 'center', color: '#999', padding: 10 }}>Chưa có dữ liệu công đoạn</div>
                            ) : (
                                plan.products.map((prod: any, pi: number) => {
                                    const stepCount = Math.max((prod.steps || []).length, 1);
                                    const colors = ['#1890ff', '#13c2c2', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#eb2f96'];
                                    const stepIds = (prod.steps || []).map((s: any, i: number) => s.step_name + '_' + i);

                                    const handleDragEnd = async (event: any) => {
                                        const { active, over } = event;
                                        if (!over || active.id === over.id) return;
                                        const oldIndex = stepIds.indexOf(active.id);
                                        const newIndex = stepIds.indexOf(over.id);
                                        if (oldIndex === -1 || newIndex === -1) return;

                                        const newSteps = arrayMove([...prod.steps], oldIndex, newIndex);
                                        const updatedPlans = ganttPlans.map((p: any) => {
                                            if (p.plan_id !== plan.plan_id) return p;
                                            return { ...p, products: p.products.map((pr: any) => pr.sku === prod.sku ? { ...pr, steps: newSteps } : pr) };
                                        });
                                        setGanttPlans(updatedPlans);

                                        const ok = await saveConfig(plan.plan_id, updatedPlans);
                                        if (ok) message.success('Đã lưu thứ tự công đoạn');
                                        else message.error('Lỗi lưu cấu hình');
                                    };

                                    const handleStepClick = (step: any, si: number) => {
                                        setEditingStep({ planId: plan.plan_id, sku: prod.sku, step, stepIndex: si });
                                        setStepDateRange(
                                            step.start_date && step.end_date
                                                ? [dayjs(step.start_date), dayjs(step.end_date)]
                                                : [planStart, planStart.add(Math.ceil(totalDays / stepCount), 'day')]
                                        );
                                    };

                                    return (
                                        <div key={pi} style={{ marginBottom: 12 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                                                <Tag color="blue" style={{ margin: 0 }}>{prod.sku}</Tag>
                                                <span style={{ marginLeft: 8, fontSize: 13, color: '#333' }}>{prod.product_name}</span>
                                                {prod.progress !== undefined && prod.progress !== null && (
                                                    <Progress percent={prod.progress} size="small" style={{ width: 120, marginLeft: 12 }} strokeColor={prod.progress >= 100 ? '#52c41a' : prod.progress > 0 ? '#1890ff' : '#d9d9d9'} />
                                                )}
                                            </div>
                                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                                <SortableContext items={stepIds} strategy={horizontalListSortingStrategy}>
                                                    <div style={{ position: 'relative', height: 28, background: '#f5f5f5', borderRadius: 4, overflow: 'hidden' }}>
                                                        {(prod.steps || []).length === 0 ? (
                                                            <div style={{ lineHeight: '28px', textAlign: 'center', color: '#bbb', fontSize: 12 }}>Chưa có công đoạn</div>
                                                        ) : (
                                                            prod.steps.map((step: any, si: number) => (
                                                                <SortableStepBar
                                                                    key={step.step_name + '_' + si}
                                                                    step={step} si={si} stepCount={stepCount}
                                                                    totalDays={totalDays} planStart={planStart}
                                                                    colors={colors} onClick={handleStepClick}
                                                                />
                                                            ))
                                                        )}
                                                    </div>
                                                </SortableContext>
                                            </DndContext>
                                        </div>
                                    );
                                })
                            )}
                        </Card>
                    </div>
                );
            })}

            {/* Step Timing Edit Modal */}
            <Modal
                title={<span>⏱ Điều chỉnh thời gian: <b>{editingStep?.step?.step_name}</b></span>}
                open={!!editingStep}
                onCancel={() => setEditingStep(null)}
                onOk={async () => {
                    if (!editingStep || !stepDateRange) return;
                    const { planId, sku, stepIndex } = editingStep;
                    const updatedPlans = ganttPlans.map((p: any) => {
                        if (p.plan_id !== planId) return p;
                        return {
                            ...p,
                            products: p.products.map((pr: any) => {
                                if (pr.sku !== sku) return pr;
                                const newSteps = [...pr.steps];
                                newSteps[stepIndex] = {
                                    ...newSteps[stepIndex],
                                    start_date: stepDateRange[0].format('YYYY-MM-DD'),
                                    end_date: stepDateRange[1].format('YYYY-MM-DD')
                                };
                                return { ...pr, steps: newSteps };
                            })
                        };
                    });
                    setGanttPlans(updatedPlans);

                    const ok = await saveConfig(planId, updatedPlans);
                    if (ok) message.success('Đã lưu thời gian công đoạn');
                    else message.error('Lỗi lưu cấu hình');
                    setEditingStep(null);
                }}
                okText="Lưu"
                cancelText="Hủy"
            >
                <div style={{ marginBottom: 12 }}>
                    <div style={{ marginBottom: 8, color: '#666' }}>Chọn khoảng thời gian cho công đoạn:</div>
                    <RangePicker
                        style={{ width: '100%' }}
                        format="DD/MM/YYYY"
                        value={stepDateRange}
                        onChange={(dates) => setStepDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
                    />
                </div>
                {editingStep?.step?.supplier_name && (
                    <div style={{ color: '#888', fontSize: 12 }}>NCC: {editingStep.step.supplier_name}</div>
                )}
            </Modal>
        </div>
    );
};

export default GanttChartTab;
