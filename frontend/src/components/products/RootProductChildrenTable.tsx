// frontend/src/components/products/RootProductChildrenTable.tsx

import React from 'react';
import { Table, Tag, Space, Button, Tooltip } from 'antd';
import { EditOutlined, FileTextOutlined, ForkOutlined } from '@ant-design/icons';

interface RootProductChildrenTableProps {
    rootProduct: any;
    onEditChild: (child: any) => void;
    canViewCost?: boolean;
}

const getDriveThumbnail = (link: string) => {
    if (!link) return null;
    try {
        let id = '';
        const url = new URL(link);
        if (url.hostname.includes('drive.google.com')) {
            if (url.pathname.includes('/file/d/')) {
                const parts = url.pathname.split('/');
                const idx = parts.indexOf('d');
                if (idx !== -1 && idx + 1 < parts.length) {
                    id = parts[idx + 1];
                }
            } else if (url.searchParams.has('id')) {
                id = url.searchParams.get('id') || '';
            }
        }
        if (id) {
            return `https://drive.google.com/thumbnail?id=${id}&sz=w100`;
        }
    } catch {
        return null;
    }
    return link;
};

const RootProductChildrenTable: React.FC<RootProductChildrenTableProps> = ({
    rootProduct,
    onEditChild,
    canViewCost = false
}) => {
    const childrenList = rootProduct.descendants || rootProduct.children || [];

    const columns = [
        {
            title: 'Ảnh',
            dataIndex: 'image_url',
            width: 60,
            align: 'center' as const,
            render: (link: string) => {
                const src = getDriveThumbnail(link);
                return src ? (
                    <img src={src} alt="thumb" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4 }} />
                ) : (
                    <div style={{ width: 36, height: 36, background: '#f5f5f5', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', margin: 'auto' }}>
                        <FileTextOutlined style={{ fontSize: 14 }} />
                    </div>
                );
            }
        },
        {
            title: 'Mã (SKU con)',
            dataIndex: 'sku',
            width: 240,
            render: (sku: string, record: any) => (
                <Space direction="vertical" size={1}>
                    <Space size={4}>
                        <ForkOutlined style={{ color: '#1890ff', fontSize: 12 }} />
                        <b style={{ color: '#1890ff' }}>{sku}</b>
                    </Space>
                    {record.hierarchyLevel > 1 && (
                        <Tag color="purple" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>
                            Cấp {record.hierarchyLevel}
                        </Tag>
                    )}
                </Space>
            )
        },
        {
            title: 'Tên biến thể / Sản phẩm con',
            dataIndex: 'name',
            render: (name: string) => <span style={{ fontWeight: 500 }}>{name}</span>
        },
        {
            title: 'Thuộc tính',
            dataIndex: 'attributes',
            width: 220,
            render: (attr: any) => {
                if (!attr || typeof attr !== 'object' || Object.keys(attr).length === 0) {
                    return <span style={{ color: '#bfbfbf', fontSize: 12 }}>—</span>;
                }
                return (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {Object.entries(attr).map(([k, v]) => {
                            if (!v) return null;
                            return (
                                <Tag key={k} color="cyan" style={{ fontSize: 11, margin: 0 }}>
                                    {k}: {String(v)}
                                </Tag>
                            );
                        })}
                    </div>
                );
            }
        },
        {
            title: 'Giá vốn',
            dataIndex: 'cost_price',
            width: 100,
            align: 'right' as const,
            hidden: !canViewCost,
            render: (v: number) => (
                <span style={{ color: '#cf1322', fontWeight: 500 }}>
                    {Number(v || 0).toLocaleString()} ₫
                </span>
            )
        },
        {
            title: 'Giá bán',
            dataIndex: 'base_price',
            width: 110,
            align: 'right' as const,
            render: (v: number) => (
                <span style={{ color: '#389e0d', fontWeight: 600 }}>
                    {Number(v || 0).toLocaleString()} ₫
                </span>
            )
        },
        {
            title: 'Tồn kho',
            dataIndex: 'quantity_in_stock',
            width: 90,
            align: 'right' as const,
            render: (v: number) => <span>{Number(v || 0).toLocaleString()}</span>
        },
        {
            title: '',
            key: 'action',
            width: 80,
            align: 'center' as const,
            render: (_: any, record: any) => (
                <Tooltip title="Chỉnh sửa sản phẩm con này">
                    <Button
                        size="small"
                        type="link"
                        icon={<EditOutlined />}
                        onClick={() => onEditChild(record)}
                    >
                        Sửa
                    </Button>
                </Tooltip>
            )
        }
    ].filter(c => !c.hidden);

    return (
        <div style={{ margin: '6px 0 10px 48px', padding: '12px 16px', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#262626' }}>
                    📦 Danh sách {childrenList.length} sản phẩm con / biến thể thuộc gốc <b>{rootProduct.sku}</b>:
                </span>
            </div>
            <Table
                dataSource={childrenList}
                columns={columns}
                rowKey="id"
                pagination={false}
                size="small"
                bordered
                locale={{ emptyText: 'Chưa có sản phẩm con nào' }}
            />
        </div>
    );
};

export default RootProductChildrenTable;
