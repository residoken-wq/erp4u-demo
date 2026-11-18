import React, { useMemo, useState } from 'react';
import { Gantt, Task, ViewMode } from 'gantt-task-react';
import "gantt-task-react/dist/index.css";
import { Card, Select, Typography, Empty } from 'antd';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;

interface PfoGanttChartProps {
    selectedPfo: any;
    pfoDetails: any;
}

const PfoGanttChart: React.FC<PfoGanttChartProps> = ({ selectedPfo, pfoDetails }) => {
    const [view, setView] = useState<ViewMode>(ViewMode.Day);

    const tasks = useMemo(() => {
        const ganttTasks: Task[] = [];
        
        // 1. Sales Order timeline
        if (pfoDetails?.sales_order) {
            const soStart = pfoDetails.sales_order.created_at ? new Date(pfoDetails.sales_order.created_at) : new Date();
            const soEnd = selectedPfo?.committed_finish_date ? new Date(selectedPfo.committed_finish_date) : dayjs().add(7, 'day').toDate();
            
            ganttTasks.push({
                start: soStart,
                end: soEnd,
                name: `SO: ${pfoDetails.sales_order.order_code}`,
                id: `so-${pfoDetails.sales_order.id}`,
                type: 'project',
                progress: selectedPfo?.progress || 0,
                isDisabled: true,
                styles: { progressColor: '#1890ff', progressSelectedColor: '#096dd9' },
            });
        }

        // 2. PO NPL timelines
        if (pfoDetails?.pos?.pos_npl && pfoDetails.pos.pos_npl.length > 0) {
            pfoDetails.pos.pos_npl.forEach((po: any) => {
                if (po.status === 'CANCELLED') return;
                const poStart = po.order_date ? new Date(po.order_date) : new Date(po.created_at || Date.now());
                const poEnd = po.expected_delivery_date ? new Date(po.expected_delivery_date) : dayjs(poStart).add(3, 'day').toDate();
                
                ganttTasks.push({
                    start: poStart,
                    end: poEnd,
                    name: `PO_NPL: ${po.po_code} (${po.supplier?.name || 'NCC'})`,
                    id: `po-npl-${po.id}`,
                    type: 'task',
                    progress: po.status === 'COMPLETED' ? 100 : (po.status === 'CONFIRMED' ? 50 : 10),
                    dependencies: pfoDetails?.sales_order ? [`so-${pfoDetails.sales_order.id}`] : [],
                    isDisabled: true,
                    styles: { progressColor: '#52c41a', progressSelectedColor: '#389e0d' },
                });
            });
        }

        // 3. PO GC timelines
        if (pfoDetails?.pos?.pos_gc && pfoDetails.pos.pos_gc.length > 0) {
            pfoDetails.pos.pos_gc.forEach((po: any) => {
                if (po.status === 'CANCELLED') return;
                const poStart = po.order_date ? new Date(po.order_date) : new Date(po.created_at || Date.now());
                const poEnd = po.expected_delivery_date ? new Date(po.expected_delivery_date) : dayjs(poStart).add(5, 'day').toDate();
                
                ganttTasks.push({
                    start: poStart,
                    end: poEnd,
                    name: `PO_GC: ${po.po_code} (${po.supplier?.name || 'Gia công'})`,
                    id: `po-gc-${po.id}`,
                    type: 'task',
                    progress: po.status === 'COMPLETED' ? 100 : (po.status === 'CONFIRMED' ? 50 : 10),
                    isDisabled: true,
                    styles: { progressColor: '#722ed1', progressSelectedColor: '#531dab' },
                });
            });
        }

        return ganttTasks;
    }, [pfoDetails, selectedPfo]);

    if (tasks.length === 0) {
        return <Empty description="Chưa có dữ liệu timeline" style={{ padding: 40 }} />;
    }

    return (
        <Card size="small" bordered={false}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <Title level={5} style={{ margin: 0, color: '#1f1f1f' }}>Biểu đồ Gantt Tiến độ</Title>
                <Select value={view} onChange={(val) => setView(val)} style={{ width: 120 }}>
                    <Option value={ViewMode.QuarterDay}>Quarter Day</Option>
                    <Option value={ViewMode.HalfDay}>Half Day</Option>
                    <Option value={ViewMode.Day}>Day</Option>
                    <Option value={ViewMode.Week}>Week</Option>
                    <Option value={ViewMode.Month}>Month</Option>
                </Select>
            </div>
            
            <div style={{ overflowX: 'auto', backgroundColor: '#fafafa', borderRadius: 8, padding: 8 }}>
                <Gantt
                    tasks={tasks}
                    viewMode={view}
                    listCellWidth="155px"
                    columnWidth={60}
                    locale="vi"
                />
            </div>
        </Card>
    );
};

export default PfoGanttChart;
