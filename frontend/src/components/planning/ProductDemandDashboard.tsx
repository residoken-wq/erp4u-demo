import React, { useEffect, useState, useMemo } from 'react';
import { Table, Button, Tag, message, Input, Select, Space, Card, Row, Col, Statistic, Tooltip } from 'antd';
import { ReloadOutlined, SearchOutlined, AppstoreOutlined, TagsOutlined, ShoppingCartOutlined, ExclamationCircleOutlined, DollarOutlined } from '@ant-design/icons';
import axios from 'axios';
import { API_URL } from '../../config';

interface Props {
    isMobile?: boolean;
}

const ProductDemandDashboard: React.FC<Props> = ({ isMobile }) => {
    const [data, setData] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | number>('ALL');
    const [selectedType, setSelectedType] = useState<string>('ALL');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [demandRes, catRes] = await Promise.allSettled([
                axios.get(`${API_URL}/planning/demand/gc`),
                axios.get(`${API_URL}/categories`)
            ]);

            if (demandRes.status === 'fulfilled') {
                setData(demandRes.value.data || []);
            } else {
                message.error('Lỗi tải dữ liệu nhu cầu Gia Công');
            }

            if (catRes.status === 'fulfilled') {
                setCategories(catRes.value.data || []);
            }
        } catch (e) {
            message.error('Lỗi kết nối máy chủ');
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Extract dynamic category options from data and API
    const categoryOptions = useMemo(() => {
        const catMap = new Map<string | number, string>();
        categories.forEach(c => {
            if (c.id) catMap.set(c.id, c.name);
        });
        // Also capture any category names in data that might not be in categories table
        data.forEach(item => {
            if (item.category_id && !catMap.has(item.category_id)) {
                catMap.set(item.category_id, item.category_name || `Danh mục #${item.category_id}`);
            } else if (item.category_name && !item.category_id) {
                catMap.set(item.category_name, item.category_name);
            }
        });

        const list = Array.from(catMap.entries()).map(([value, label]) => ({
            value,
            label
        }));

        return [
            { value: 'ALL', label: 'Tất cả loại SP / Danh mục' },
            ...list
        ];
    }, [categories, data]);

    const filteredData = useMemo(() => {
        return data.filter(item => {
            // 1. Filter theo Loại sản phẩm / Danh mục
            if (selectedCategory && selectedCategory !== 'ALL') {
                const matchesId = item.category_id === selectedCategory || String(item.category_id) === String(selectedCategory);
                const matchesName = item.category_name === selectedCategory;
                if (!matchesId && !matchesName) return false;
            }

            // 2. Filter theo Phân loại kỹ thuật (STANDARD / SEMI_FINISHED / COMBO)
            if (selectedType && selectedType !== 'ALL') {
                const pType = item.product_type ? item.product_type.toUpperCase() : 'STANDARD';
                if (pType !== selectedType) return false;
            }

            // 3. Filter theo từ khóa tìm kiếm
            if (searchText) {
                const lower = searchText.toLowerCase().trim();
                const matchSku = item.product_sku && item.product_sku.toLowerCase().includes(lower);
                const matchName = item.product_name && item.product_name.toLowerCase().includes(lower);
                const matchCat = item.category_name && item.category_name.toLowerCase().includes(lower);
                const matchCustomer = item.details && item.details.some((d: any) => d.customer_name && d.customer_name.toLowerCase().includes(lower));
                const matchPfo = item.details && item.details.some((d: any) => d.pfo_code && d.pfo_code.toLowerCase().includes(lower));
                const matchSo = item.details && item.details.some((d: any) => d.sales_order_code && d.sales_order_code.toLowerCase().includes(lower));

                if (!matchSku && !matchName && !matchCat && !matchCustomer && !matchPfo && !matchSo) {
                    return false;
                }
            }

            return true;
        });
    }, [data, selectedCategory, selectedType, searchText]);

    const totalAmountSum = useMemo(() => filteredData.reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0), [filteredData]);
    const totalPlannedSum = useMemo(() => filteredData.reduce((acc, curr) => acc + (Number(curr.total_planned) || 0), 0), [filteredData]);
    const totalShortageSum = useMemo(() => filteredData.reduce((acc, curr) => {
        const shortage = Math.max(0, (Number(curr.total_planned) || 0) - (Number(curr.inventory_used) || 0) - (Number(curr.po_draft) || 0));
        return acc + shortage;
    }, 0), [filteredData]);

    const columns = [
        {
            title: 'Mã SP / BTP',
            dataIndex: 'product_sku',
            key: 'product_sku',
            width: 140,
            render: (text: string, record: any) => {
                const isSemi = record.product_type === 'SEMI_FINISHED';
                const isCombo = record.product_type === 'COMBO';
                return (
                    <Space orientation="vertical" size={2}>
                        <Tag color="geekblue" style={{ fontWeight: 600 }}>{text || 'N/A'}</Tag>
                        {isSemi && <Tag color="orange" style={{ fontSize: 10, lineHeight: '14px' }}>BTP</Tag>}
                        {isCombo && <Tag color="purple" style={{ fontSize: 10, lineHeight: '14px' }}>Combo</Tag>}
                    </Space>
                );
            },
        },
        {
            title: 'Tên Sản Phẩm Gia Công',
            dataIndex: 'product_name',
            key: 'product_name',
            render: (text: string, record: any) => (
                <div>
                    <div style={{ fontWeight: 500 }}>{text}</div>
                    {record.details && record.details.length > 0 && (
                        <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                            {record.details.length} Lệnh SX đang yêu cầu
                        </div>
                    )}
                </div>
            )
        },
        {
            title: 'Loại SP (Danh Mục)',
            dataIndex: 'category_name',
            key: 'category_name',
            width: 140,
            render: (cat: string) => {
                return (
                    <Tag color="blue" icon={<TagsOutlined />}>
                        {cat || 'Khác'}
                    </Tag>
                );
            }
        },
        {
            title: 'ĐVT',
            dataIndex: 'product_unit',
            key: 'product_unit',
            width: 70,
            align: 'center' as const,
        },
        {
            title: (
                <div>
                    Tổng Cần Đặt<br/>
                    <span style={{ color: '#1677ff', fontSize: 12 }}>Tổng: {totalPlannedSum.toLocaleString()}</span>
                </div>
            ),
            dataIndex: 'total_planned',
            key: 'total_planned',
            width: 110,
            align: 'right' as const,
            render: (val: number) => <b style={{ color: '#1677ff' }}>{val?.toLocaleString()}</b>,
        },
        {
            title: (
                <div>
                    Thành Tiền<br/>
                    <span style={{ color: '#cf1322', fontSize: 12 }}>Tổng: {totalAmountSum.toLocaleString(undefined, { style: 'currency', currency: 'VND' })}</span>
                </div>
            ),
            dataIndex: 'total_amount',
            key: 'total_amount',
            width: 140,
            align: 'right' as const,
            render: (val: number) => <b>{val ? val.toLocaleString(undefined, { style: 'currency', currency: 'VND' }) : 0}</b>,
        },
        {
            title: 'Đã Dùng Kho',
            dataIndex: 'inventory_used',
            key: 'inventory_used',
            width: 100,
            align: 'center' as const,
            render: (val: number) => <Tag color={val > 0 ? "cyan" : "default"}>{val?.toLocaleString() || 0}</Tag>,
        },
        {
            title: 'PO Nháp',
            dataIndex: 'po_draft',
            key: 'po_draft',
            width: 90,
            align: 'center' as const,
            render: (val: number) => <Tag color={val > 0 ? "orange" : "default"}>{val?.toLocaleString() || 0}</Tag>,
        },
        {
            title: 'Còn Thiếu',
            key: 'shortage',
            width: 100,
            align: 'center' as const,
            render: (_: any, record: any) => {
                const shortage = Math.max(0, (record.total_planned || 0) - (record.inventory_used || 0) - (record.po_draft || 0));
                return <Tag color={shortage > 0 ? "red" : "green"} style={{ fontWeight: shortage > 0 ? 600 : 400 }}>{shortage.toLocaleString()}</Tag>;
            }
        },
        {
            title: 'Đã Giao NGC',
            dataIndex: 'ngc_delivered',
            key: 'ngc_delivered',
            width: 100,
            align: 'center' as const,
            render: (val: number) => <Tag color={val > 0 ? "purple" : "default"}>{val?.toLocaleString() || 0}</Tag>,
        }
    ];

    const expandedRowRender = (record: any) => {
        const expandedColumns = [
            {
                title: 'Lệnh SX (PFO)',
                dataIndex: 'pfo_code',
                key: 'pfo_code',
                render: (val: string) => <Tag color="blue">{val}</Tag>
            },
            {
                title: 'Đơn Hàng (SO)',
                dataIndex: 'sales_order_code',
                key: 'sales_order_code',
                render: (val: string) => <Tag color="geekblue">{val}</Tag>
            },
            {
                title: 'Khách Hàng',
                dataIndex: 'customer_name',
                key: 'customer_name',
                render: (val: string) => <span style={{ fontWeight: 500 }}>{val || 'N/A'}</span>
            },
            {
                title: 'Nhu Cầu',
                dataIndex: 'planned_quantity',
                key: 'planned_quantity',
                align: 'right' as const,
                render: (val: number) => <b>{val?.toLocaleString()}</b>
            },
            {
                title: 'Đơn Giá',
                dataIndex: 'unit_price',
                key: 'unit_price',
                align: 'right' as const,
                render: (val: number) => val ? val.toLocaleString(undefined, { style: 'currency', currency: 'VND' }) : 0
            },
            {
                title: 'Thành Tiền',
                dataIndex: 'total_amount',
                key: 'total_amount',
                align: 'right' as const,
                render: (val: number) => <b style={{ color: '#cf1322' }}>{val ? val.toLocaleString(undefined, { style: 'currency', currency: 'VND' }) : 0}</b>
            },
        ];
        return (
            <div style={{ margin: '4px 0', padding: '8px 12px', background: '#fafafa', borderRadius: 6, border: '1px solid #f0f0f0' }}>
                <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 13, color: '#1677ff' }}>
                    Chi tiết yêu cầu gia công theo từng Lệnh Sản Xuất (PFO):
                </div>
                <Table
                    columns={expandedColumns}
                    dataSource={record.details}
                    pagination={false}
                    rowKey={(r, idx) => `${r.pfo_id || ''}_${idx}`}
                    size="small"
                />
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* KPI Summary Cards */}
            <Row gutter={[12, 12]}>
                <Col xs={12} sm={6}>
                    <Card size="small" bordered style={{ borderRadius: 8, background: '#f0f5ff', borderColor: '#adc6ff' }}>
                        <Statistic
                            title={<span style={{ color: '#2f54eb', fontSize: 13, fontWeight: 500 }}>Mặt Hàng Gia Công</span>}
                            value={filteredData.length}
                            suffix="mặt hàng"
                            prefix={<AppstoreOutlined style={{ color: '#2f54eb' }} />}
                            valueStyle={{ color: '#2f54eb', fontWeight: 600, fontSize: 20 }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card size="small" bordered style={{ borderRadius: 8, background: '#e6f4ff', borderColor: '#91caff' }}>
                        <Statistic
                            title={<span style={{ color: '#0958d9', fontSize: 13, fontWeight: 500 }}>Tổng Nhu Cầu Cần Đặt</span>}
                            value={totalPlannedSum}
                            prefix={<ShoppingCartOutlined style={{ color: '#0958d9' }} />}
                            valueStyle={{ color: '#0958d9', fontWeight: 600, fontSize: 20 }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card size="small" bordered style={{ borderRadius: 8, background: '#fff2f0', borderColor: '#ffccc7' }}>
                        <Statistic
                            title={<span style={{ color: '#cf1322', fontSize: 13, fontWeight: 500 }}>Tổng Thành Tiền GC</span>}
                            value={totalAmountSum}
                            prefix={<DollarOutlined style={{ color: '#cf1322' }} />}
                            formatter={(val) => Number(val).toLocaleString(undefined, { style: 'currency', currency: 'VND' })}
                            valueStyle={{ color: '#cf1322', fontWeight: 600, fontSize: 18 }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card size="small" bordered style={{ borderRadius: 8, background: '#fff1f0', borderColor: '#ffa39e' }}>
                        <Statistic
                            title={<span style={{ color: '#f5222d', fontSize: 13, fontWeight: 500 }}>Số Lượng Còn Thiếu</span>}
                            value={totalShortageSum}
                            prefix={<ExclamationCircleOutlined style={{ color: '#f5222d' }} />}
                            valueStyle={{ color: '#f5222d', fontWeight: 600, fontSize: 20 }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Filter Toolbar */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#fafafa',
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #f0f0f0'
            }}>
                <Space wrap size={10} style={{ flex: 1 }}>
                    {/* Filter theo Loại sản phẩm / Danh mục */}
                    <Select
                        style={{ width: isMobile ? '100%' : 220 }}
                        placeholder="Lọc theo Loại SP / Danh mục"
                        value={selectedCategory}
                        onChange={setSelectedCategory}
                        options={categoryOptions}
                        showSearch
                        optionFilterProp="label"
                    />

                    {/* Filter theo Phân loại kỹ thuật */}
                    <Select
                        style={{ width: isMobile ? '100%' : 180 }}
                        value={selectedType}
                        onChange={setSelectedType}
                        options={[
                            { value: 'ALL', label: 'Tất cả phân loại' },
                            { value: 'STANDARD', label: 'Sản phẩm thường' },
                            { value: 'SEMI_FINISHED', label: 'Bán thành phẩm (BTP)' },
                            { value: 'COMBO', label: 'Sản phẩm Combo' },
                        ]}
                    />

                    {/* Ô tìm kiếm */}
                    <Input
                        placeholder="Tìm theo mã SP, tên, KH, PFO, SO..."
                        prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        allowClear
                        style={{ width: isMobile ? '100%' : 280 }}
                    />
                </Space>

                <Space size={8}>
                    {(selectedCategory !== 'ALL' || selectedType !== 'ALL' || searchText) && (
                        <Button
                            onClick={() => {
                                setSelectedCategory('ALL');
                                setSelectedType('ALL');
                                setSearchText('');
                            }}
                        >
                            Xóa bộ lọc
                        </Button>
                    )}
                    <Button
                        type="primary"
                        icon={<ReloadOutlined />}
                        onClick={fetchData}
                        loading={loading}
                    >
                        Làm mới
                    </Button>
                </Space>
            </div>

            {/* Main Table */}
            <Table
                columns={columns}
                dataSource={filteredData}
                rowKey="product_id"
                loading={loading}
                expandable={{ expandedRowRender }}
                scroll={{ x: isMobile ? 900 : undefined }}
                size="middle"
                pagination={{
                    pageSize: 15,
                    showSizeChanger: true,
                    pageSizeOptions: ['10', '15', '30', '50', '100'],
                    showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} sản phẩm`
                }}
            />
        </div>
    );
};

export default ProductDemandDashboard;
