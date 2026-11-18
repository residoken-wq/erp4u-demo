import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MenuOutlined } from '@ant-design/icons';

interface DraggableRowProps {
    id: string;
    children: React.ReactNode | ((listeners: any) => React.ReactNode);
}

const DraggableRow: React.FC<DraggableRowProps> = ({ id, children }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: id,
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform && { ...transform, scaleY: 1 }),
        transition,
        ...(isDragging ? { position: 'relative', zIndex: 9999, background: '#e6f7ff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' } : {}),
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes}>
            {typeof children === 'function' ? children(listeners) : children}
        </div>
    );
};

export default DraggableRow;
