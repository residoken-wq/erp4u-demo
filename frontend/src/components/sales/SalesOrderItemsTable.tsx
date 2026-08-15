import React from 'react';
import { Table, Select, Input, InputNumber, Tag, Popover, Button, Space, Tooltip } from 'antd';
import { MenuOutlined, DeleteOutlined, GiftOutlined, TagsOutlined } from '@ant-design/icons';
import { DndContext, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { getGoogleDriveImageUrl } from '../../utils/googleDrive';
import ImageLinkCell from './ImageLinkCell';

interface RowProps extends React.HTMLAttributes<HTMLTableRowElement> {
    'data-row-key': string;
}

const DraggableRow = ({ children, ...props }: RowProps) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: props['data-row-key'],
    });

    const style: React.CSSProperties = {
        ...props.style,
        transform: CSS.Transform.toString(transform && { ...transform, scaleY: 1 }),
        transition,
        cursor: 'move',
        ...(isDragging ? { position: 'relative', zIndex: 9999 } : {}),
    };

    return (
        <tr {...props} ref={setNodeRef} style={style} {...attributes}>
            {React.Children.map(children, (child) => {
                if ((child as React.ReactElement).key === 'sort') {
                    return React.cloneElement(child as React.ReactElement, {
                        children: (
                            <div {...listeners} style={{ touchAction: 'none', cursor: 'grab' }}>
                                <MenuOutlined style={{ color: '#999' }} />
                            </div>
                        ),
                    });
                }
                return child;
            })}
        </tr>
    );
};

interface OrderItem {
    key: string;
    sku?: string;
    unit_price?: number;
    quantity?: number;
    total_price?: number;
    vat_content?: string;
    image_url?: string;
    product?: { image_url?: string };
    _description?: string;
    _type?: string;
    booking_status?: string;
    booked_quantity?: number;
    price_ranges?: { quantity: number; unit_price: number }[];
}

const PriceRangesEditor = ({ ranges, onChange }: { ranges?: { quantity: number; unit_price: number }[], onChange: (r: any[]) => void }) => {
    const [list, setList] = React.useState<any[]>(ranges || []);
    const [qty, setQty] = React.useState<number | null>(null);
    const [price, setPrice] = React.useState<number | null>(null);

    const handleAdd = () => {
        if (qty && qty > 0 && price !== null && price >= 0) {
            const newList = [...list, { quantity: qty, unit_price: price }].sort((a, b) => a.quantity - b.quantity);
            setList(newList);
            onChange(newList);
            setQty(null);
            setPrice(null);
        }
    };

    const handleRemove = (idx: number) => {
        const newList = list.filter((_, i) => i !== idx);
        setList(newList);
        onChange(newList);
    };

    return (
        <div style={{ width: 250 }}>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>Tùy chọn giá theo số lượng</div>
            {list.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center', fontSize: 13 }}>
                    <span>{r.quantity} cái - {r.unit_price.toLocaleString()}đ/cái</span>
                    <DeleteOutlined style={{ color: 'red', cursor: 'pointer' }} onClick={() => handleRemove(i)} />
                </div>
            ))}
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                <InputNumber placeholder="SL" min={1} style={{ width: '40%' }} value={qty} onChange={(v) => setQty(Number(v))} />
                <InputNumber placeholder="Giá" min={0} style={{ width: '60%' }} value={price} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={(v) => v!.replace(/\$\s?|(,*)/g, '') as any} onChange={(v) => setPrice(Number(v))} />
            </div>
            <Button type="dashed" block size="small" style={{ marginTop: 8 }} onClick={handleAdd}>Thêm mốc giá</Button>
        </div>
    );
};

interface Product {
    value: string;
    label: string;
    price: number;
    description?: string;
    type?: string;
    unit?: string;
    image_url?: string;
}

interface Props {
    items: OrderItem[];
    products: Product[];
    isMobile: boolean;
    onItemChange: (index: number, field: string, value: any) => void;
    onRemoveItem: (index: number) => void;
    onReorder: (items: OrderItem[]) => void;
}

const SalesOrderItemsTable: React.FC<Props> = ({
    items,
    products,
    isMobile,
    onItemChange,
    onRemoveItem,
    onReorder,
}) => {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 1 } })
    );

    const onDragEnd = ({ active, over }: DragEndEvent) => {
        if (active.id !== over?.id) {
            const activeIndex = items.findIndex((i) => i.key === active.id);
            const overIndex = items.findIndex((i) => i.key === over?.id);
            const newItems = arrayMove(items, activeIndex, overIndex);
            onReorder(newItems);
        }
    };

    const itemColumns = [
        {
            key: 'sort',
            width: 30,
            render: () => <MenuOutlined style={{ cursor: 'grab', color: '#999' }} />,
        },
        {
            title: '#',
            dataIndex: 'position',
            width: 50,
            render: (_: any, __: any, index: number) => index + 1,
        },
        {
            title: 'Sản phẩm', width: 350,
            render: (_: any, record: any, index: number) => {
                const prodInfo = products.find(p => p.value === record.sku);
                const link = record.image_url;
                const finalLink = link || (record.product ? record.product.image_url : null) || (prodInfo ? prodInfo.image_url : null);
                const src = getGoogleDriveImageUrl(finalLink || '');

                return (
                    <div>
                        <Select
                            showSearch
                            placeholder="Chọn SP (Tìm tên hoặc mã SKU)"
                            filterOption={(input, option) => {
                                const labelStr = (option?.label ?? '').toString().toLowerCase();
                                const valueStr = (option?.value ?? '').toString().toLowerCase();
                                const searchStr = input.toLowerCase();
                                return labelStr.includes(searchStr) || valueStr.includes(searchStr);
                            }}
                            style={{ width: '100%' }}
                            value={record.sku}
                            onChange={(val) => onItemChange(index, 'sku', val)}
                            options={products}
                        />
                        {prodInfo && (
                            <div style={{ marginTop: 4, lineHeight: '1.4' }}>
                                {prodInfo.type === 'COMBO' && <Tag color="purple" style={{ fontSize: 10, marginRight: 4 }}><GiftOutlined /> Combo</Tag>}
                                <div style={{
                                    fontSize: 11,
                                    color: '#666',
                                    fontStyle: 'italic',
                                    whiteSpace: 'pre-wrap',  // Support newlines in description
                                    marginTop: prodInfo.type === 'COMBO' ? 4 : 0
                                }}>
                                    {prodInfo.description || 'Chưa có mô tả'}
                                </div>
                            </div>
                        )}
                        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                            {finalLink && (
                                <div style={{ position: 'relative' }}>
                                    <img
                                        src={src || ''}
                                        alt="img"
                                        style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, cursor: 'pointer', border: '1px solid #ddd' }}
                                        onClick={() => window.open(finalLink, '_blank')}
                                    />
                                </div>
                            )}
                            <ImageLinkCell
                                value={finalLink || ''}
                                onChange={(newVal) => onItemChange(index, 'image_url', newVal)}
                            />
                        </div>
                    </div>
                );
            }
        },
        {
            title: 'Mô tả VAT',
            dataIndex: 'vat_content',
            width: 200,
            render: (text: any, _: any, index: number) => (
                <Input.TextArea
                    rows={2}
                    placeholder="Mô tả HĐ..."
                    value={text}
                    onChange={(e) => onItemChange(index, 'vat_content', e.target.value)}
                />
            )
        },
        {
            title: 'Đơn giá', dataIndex: 'unit_price', width: 140,
            render: (text: any, record: any, index: number) => {
                const prod = products.find(p => p.value === record.sku);
                const basePrice = prod ? prod.price : 0;
                return (
                    <div>
                        {prod && (
                            <div style={{ fontSize: 10, color: '#999', marginBottom: 2, textAlign: 'right' }}>
                                Gốc: {basePrice.toLocaleString()}
                            </div>
                        )}
                        <InputNumber
                            min={0}
                            style={{ width: '100%' }}
                            value={text}
                            formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={(displayVal) => displayVal!.replace(/\$\s?|(,*)/g, '') as any}
                            onChange={(val) => onItemChange(index, 'unit_price', val)}
                        />
                        <div style={{ marginTop: 4, textAlign: 'right' }}>
                            <Popover 
                                content={<PriceRangesEditor ranges={record.price_ranges} onChange={(r) => onItemChange(index, 'price_ranges', r)} />} 
                                title="Báo giá sỉ" 
                                trigger="click"
                                placement="bottomRight"
                            >
                                <Button size="small" type="dashed" style={{ fontSize: 10, padding: '0 4px', height: 20, borderColor: record.price_ranges && record.price_ranges.length > 0 ? '#1890ff' : '#d9d9d9', color: record.price_ranges && record.price_ranges.length > 0 ? '#1890ff' : '#666' }}>
                                    <TagsOutlined /> {record.price_ranges && record.price_ranges.length > 0 ? `${record.price_ranges.length} mốc giá` : 'Mốc giá'}
                                </Button>
                            </Popover>
                        </div>
                    </div>
                );
            }
        },
        {
            title: 'SL', dataIndex: 'quantity', width: 80,
            render: (text: any, _: any, index: number) => (
                <InputNumber min={1} value={text} onChange={(val) => onItemChange(index, 'quantity', val)} style={{ width: '100%' }} />
            )
        },
        {
            title: 'Booking', width: 100, align: 'center' as const,
            render: (_: any, record: any) => {
                const status = record.booking_status;
                const qty = record.booked_quantity || 0;
                if (!status || status === 'NONE') return <span style={{ color: '#ccc', fontSize: 11 }}>Chưa book</span>;
                if (status === 'TEMPORARY') return <div><Tag color="orange" style={{ margin: 0, fontSize: 10 }}>Giữ chỗ</Tag><div style={{ fontSize: 11, marginTop: 2 }}>{qty} SP</div></div>;
                if (status === 'CONFIRMED') return <div><Tag color="green" style={{ margin: 0, fontSize: 10 }}>Đã duyệt</Tag><div style={{ fontSize: 11, marginTop: 2, color: 'green' }}>{qty} SP</div></div>;
                if (status === 'EXPIRED') return <div><Tag color="red" style={{ margin: 0, fontSize: 10 }}>Hết hạn</Tag></div>;
                return <Tag>{status}</Tag>;
            }
        },
        {
            title: 'Tiền', dataIndex: 'total_price', align: 'right' as const, width: 140,
            render: (val: any) => <b>{Number(val).toLocaleString()}</b>
        },
        {
            title: '', width: 50, align: 'center' as const,
            render: (_: any, __: any, index: number) => <DeleteOutlined onClick={() => onRemoveItem(index)} style={{ color: 'red', cursor: 'pointer' }} />
        }
    ];

    if (isMobile) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {items.map((record, index) => {
                    const prodInfo = products.find(p => p.value === record.sku);
                    const finalLink = record.image_url || (record.product ? record.product.image_url : null) || (prodInfo ? prodInfo.image_url : null);
                    const src = getGoogleDriveImageUrl(finalLink || '');
                    const basePrice = prodInfo ? prodInfo.price : 0;
                    
                    return (
                        <div key={record.key} style={{ border: '1px solid #e8e8e8', borderRadius: 8, padding: 12, background: '#fff' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'flex-start' }}>
                                <div style={{ flex: 1, marginRight: 8 }}>
                                    <Select
                                        showSearch
                                        placeholder="Chọn SP (Tìm tên hoặc mã SKU)"
                                        filterOption={(input, option) => {
                                            const labelStr = (option?.label ?? '').toString().toLowerCase();
                                            const valueStr = (option?.value ?? '').toString().toLowerCase();
                                            const searchStr = input.toLowerCase();
                                            return labelStr.includes(searchStr) || valueStr.includes(searchStr);
                                        }}
                                        style={{ width: '100%' }}
                                        value={record.sku}
                                        onChange={(val) => onItemChange(index, 'sku', val)}
                                        options={products}
                                    />
                                    {prodInfo && (
                                        <div style={{ fontSize: 11, color: '#666', fontStyle: 'italic', marginTop: 4, whiteSpace: 'pre-wrap' }}>
                                            {prodInfo.description}
                                        </div>
                                    )}
                                </div>
                                <Button danger type="text" icon={<DeleteOutlined />} onClick={() => onRemoveItem(index)} />
                            </div>

                            <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                                {finalLink && (
                                    <img
                                        src={src || ''}
                                        alt="img"
                                        style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4, border: '1px solid #ddd' }}
                                        onClick={() => window.open(finalLink, '_blank')}
                                    />
                                )}
                                <div style={{ flex: 1 }}>
                                    <Input.TextArea
                                        rows={2}
                                        placeholder="Mô tả / VAT..."
                                        value={record.vat_content}
                                        onChange={(e) => onItemChange(index, 'vat_content', e.target.value)}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                                <div style={{ flex: 2 }}>
                                    <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>Đơn giá {basePrice ? `(Gốc: ${(basePrice/1000).toFixed(0)}k)` : ''}</div>
                                    <InputNumber
                                        min={0}
                                        style={{ width: '100%' }}
                                        value={record.unit_price}
                                        formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                        parser={(displayVal) => displayVal!.replace(/\$\s?|(,*)/g, '') as any}
                                        onChange={(val) => onItemChange(index, 'unit_price', val)}
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>SL</div>
                                    <InputNumber min={1} value={record.quantity} onChange={(val) => onItemChange(index, 'quantity', val)} style={{ width: '100%' }} />
                                </div>
                                <div style={{ flex: 2, textAlign: 'right' }}>
                                    <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>Thành tiền</div>
                                    <div style={{ fontWeight: 600, fontSize: 14, color: '#1890ff', lineHeight: '32px' }}>
                                        {Number(record.total_price).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Popover 
                                    content={<PriceRangesEditor ranges={record.price_ranges} onChange={(r) => onItemChange(index, 'price_ranges', r)} />} 
                                    title="Báo giá sỉ" 
                                    trigger="click"
                                >
                                    <Button size="small" type="dashed" style={{ fontSize: 11, borderColor: record.price_ranges && record.price_ranges.length > 0 ? '#1890ff' : '#d9d9d9', color: record.price_ranges && record.price_ranges.length > 0 ? '#1890ff' : '#666' }}>
                                        <TagsOutlined /> {record.price_ranges && record.price_ranges.length > 0 ? `${record.price_ranges.length} mốc giá` : 'Mốc giá'}
                                    </Button>
                                </Popover>
                                <ImageLinkCell value={finalLink || ''} onChange={(newVal) => onItemChange(index, 'image_url', newVal)} />
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <DndContext sensors={sensors} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
            <SortableContext items={items.map((i) => i.key)} strategy={verticalListSortingStrategy}>
                <div style={{ overflowX: 'visible' }}>
                    <Table
                        components={{
                            body: {
                                row: DraggableRow,
                            },
                        }}
                        dataSource={items}
                        columns={itemColumns}
                        pagination={false}
                        rowKey="key"
                        size="small"
                        bordered
                    />
                </div>
            </SortableContext>
        </DndContext>
    );
};

export default SalesOrderItemsTable;
