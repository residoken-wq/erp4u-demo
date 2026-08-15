import React from 'react';
import { Gantt, Task, ViewMode } from 'gantt-task-react';
import "gantt-task-react/dist/index.css";
import dayjs from 'dayjs';
import api from '../utils/api';
import { message } from 'antd';

interface ProjectGanttProps {
    tasks: any[];
    milestones: any[];
    onUpdate?: () => void;
}

const ProjectGantt: React.FC<ProjectGanttProps> = ({ tasks, milestones, onUpdate }) => {
    // Transform data
    let ganttTasks: Task[] = [];
    // Group tasks by milestone
    const tasksByMilestone: Record<string, any[]> = {};
    const unassignedTasks: any[] = [];

    tasks.forEach(t => {
        if (t.milestone_id) {
            if (!tasksByMilestone[t.milestone_id]) tasksByMilestone[t.milestone_id] = [];
            tasksByMilestone[t.milestone_id].push(t);
        } else {
            unassignedTasks.push(t);
        }
    });

    // 1. Milestones and their tasks
    milestones.forEach(m => {
        const start = m.start_date ? new Date(m.start_date) : (m.due_date ? dayjs(m.due_date).subtract(1, 'day').toDate() : new Date());
        const end = m.due_date ? new Date(m.due_date) : dayjs(start).add(1, 'day').toDate();

        ganttTasks.push({
            start,
            end,
            name: m.title,
            id: `m-${m.id}`, // Prefix to avoid collision
            type: 'project',
            progress: m.status === 'COMPLETED' ? 100 : (m.status === 'ACTIVE' ? 50 : 0), // Progress based on Project status
            hideChildren: false,
            isDisabled: false,
            styles: { progressColor: '#1890ff', progressSelectedColor: '#096dd9' }
        });

        // 2. Tasks under this milestone
        const mTasks = tasksByMilestone[m.id] || [];
        mTasks.forEach(t => {
            const tStart = t.start_date ? new Date(t.start_date) : (t.created_at ? new Date(t.created_at) : new Date());
            const tEnd = t.due_date ? new Date(t.due_date) : dayjs(tStart).add(1, 'hour').toDate();
            const finalEnd = tEnd < tStart ? dayjs(tStart).add(1, 'day').toDate() : tEnd;

            ganttTasks.push({
                start: tStart,
                end: finalEnd,
                name: t.title,
                id: `t-${t.id}`,
                type: 'task',
                project: `m-${m.id}`,
                progress: t.status === 'DONE' ? 100 : (t.status === 'IN_PROGRESS' ? 50 : 0),
                isDisabled: false,
                styles: { progressColor: '#52c41a', progressSelectedColor: '#389e0d' }
            });
        });
    });

    // 3. Unassigned tasks (No milestone)
    unassignedTasks.forEach(t => {
        const start = t.start_date ? new Date(t.start_date) : (t.created_at ? new Date(t.created_at) : new Date());
        const end = t.due_date ? new Date(t.due_date) : dayjs(start).add(1, 'hour').toDate();
        const finalEnd = end < start ? dayjs(start).add(1, 'day').toDate() : end;

        ganttTasks.push({
            start,
            end: finalEnd,
            name: t.title,
            id: `t-${t.id}`,
            type: 'task',
            progress: t.status === 'DONE' ? 100 : (t.status === 'IN_PROGRESS' ? 50 : 0),
            isDisabled: false,
            styles: { progressColor: '#52c41a', progressSelectedColor: '#389e0d' }
        });
    });

    // Fallback if no data
    if (ganttTasks.length === 0) {
        return <div style={{ padding: 20, textAlign: 'center' }}>No timeline data available. Add milestones or tasks to see the chart.</div>;
    }

    const handleDateChange = async (task: Task) => {
        try {
            const isMilestone = task.id.startsWith('m-');
            const id = parseInt(task.id.split('-')[1]);
            const payload = {
                start_date: task.start,
                due_date: task.end
            };

            if (isMilestone) {
                await api.put(`/projects/milestones/${id}`, payload);
            } else {
                await api.put(`/tasks/${id}`, payload); // Need to ensure PUT /tasks/:id supports start_date
            }
            message.success('Timeline updated');
            if (onUpdate) onUpdate();
        } catch (e) {
            message.error('Failed to update timeline');
        }
    };

    return (
        <div style={{ overflowX: 'auto', paddingBottom: 20 }}>
            <Gantt
                tasks={ganttTasks}
                viewMode={ViewMode.Day} // Could specificy Month/Year using buttons if needed
                onDateChange={handleDateChange}
                listCellWidth="155px"
                columnWidth={60}
            />
        </div>
    );
};

export default ProjectGantt;
