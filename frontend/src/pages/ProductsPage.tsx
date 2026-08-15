import React, { useEffect, useState, useMemo } from 'react';
import { Table, Button, message, Card, Modal, Form, Input, Select, Tag, Popconfirm, Row, Col, Divider, Tabs, InputNumber, Tooltip, Space, Badge, Checkbox, DatePicker, Dropdown, Slider, Popover, Alert } from 'antd';
import type { MenuProps } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, DollarOutlined, ExperimentOutlined, AppstoreOutlined, BuildOutlined, SettingOutlined, SyncOutlined, LinkOutlined, TagOutlined, FileTextOutlined, SendOutlined, ForkOutlined, ScissorOutlined, FolderOpenOutlined, EyeOutlined, PrinterOutlined, StarOutlined, StarFilled, BranchesOutlined, WarningOutlined, CloseCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import api from '../utils/api';
import useMobile from '../hooks/useMobile';
import usePermission from '../hooks/usePermission';
import {
    findDuplicateProductGroups,
    findSimilarProducts,
    calculateNameSimilarity
} from '../utils/stringSimilarity';

// --- IMPORTS CÁC COMPONENT ĐÃ TÁCH ---
import ProductBOMTab from '../components/products/ProductBOMTab';
import ProductRoutingTab from '../components/products/ProductRoutingTab';
import ProductVariantsTab from '../components/products/ProductVariantsTab';
import ProductPatternTab from '../components/products/ProductPatternTab';
import ProductLogisticsTab from '../components/products/ProductLogisticsTab';
import ProductSemiFinishedTab from '../components/products/ProductSemiFinishedTab'; // <--- MỚI
// -------------------------------------

const { TextArea } = Input;
const { Option } = Select;

// Sub-component cảnh báo tên sản phẩm trùng lặp trong Form
const SimilarNameWarning: React.FC<{
    form: any;
    editingItem: any;
    data: any[];
}> = ({ form, editingItem, data }) => {
    const productName = Form.useWatch('name', form);

    const similarList = useMemo(() => {
        if (!productName || typeof productName !== 'string' || productName.trim().length < 3) return [];
        return findSimilarProducts(
            { id: editingItem?.id, sku: editingItem?.sku, name: productName },
            data,
            { threshold: 0.5 }
        ).slice(0, 5);
    }, [productName, editingItem, data]);

    if (similarList.length === 0) return null;

    return (
        <div style={{ marginTop: 6, marginBottom: 8, padding: '8px 12px', background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6, fontSize: 12 }}>
            <div style={{ color: '#d46b08', fontWeight: 'bold', marginBottom: 4 }}>
                <WarningOutlined style={{ marginRight: 6 }} />
                Phát hiện {similarList.length} sản phẩm đã có tên gần giống (≥50%):
            </div>
            <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                {similarList.map((m: any) => (
                    <div key={m.product.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: '1px dashed #fff1b8' }}>
                        <span style={{ color: '#262626' }}>
                            • <b>{m.product.sku}</b>: {m.product.name}
                        </span>
                        <Tag color={m.similarity >= 0.8 ? 'red' : m.similarity >= 0.6 ? 'orange' : 'blue'} style={{ fontSize: 10, margin: 0 }}>
                            {(m.similarity * 100).toFixed(0)}%
                        </Tag>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ProductsPage: React.FC = () => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const isMobile = useMobile();

    // Advanced Filters
    const [filterCategory, setFilterCategory] = useState<number | null>(null);
    const [filterType, setFilterType] = useState<string>('ALL'); // 'ALL', 'STANDARD', 'COMBO'
    const [filterMonth, setFilterMonth] = useState<string | null>(null); // YYYY-MM
    const [bookingStats, setBookingStats] = useState<any>({});
    const [statsLoading, setStatsLoading] = useState(false);

    // Duplicate Filter State
    const [duplicateFilterActive, setDuplicateFilterActive] = useState<boolean>(false);
    const [duplicateThreshold, setDuplicateThreshold] = useState<number>(50); // % (30 -> 100)
    const [duplicateSameCategoryOnly, setDuplicateSameCategoryOnly] = useState<boolean>(false);
    const [similarModalTarget, setSimilarModalTarget] = useState<any | null>(null);
    const [similarModalThreshold, setSimilarModalThreshold] = useState<number>(50);

    // UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [activeTab, setActiveTab] = useState('1');

    // Variant State
    const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
    const [baseProductForVariant, setBaseProductForVariant] = useState<any>(null);

    // Master Data
    const [categories, setCategories] = useState<any[]>([]);
    const [materials, setMaterials] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [processes, setProcesses] = useState<any[]>([]);

    // Sub-data State 
    const [boms, setBoms] = useState<any[]>([]);
    const [routings, setRoutings] = useState<any[]>([]);
    const [logistics, setLogistics] = useState<any[]>([]); // State cho Logistics
    const [components, setComponents] = useState<any[]>([]);

    // Permission State
    const { canCreate, canUpdate, canDelete, canViewCost } = usePermission('PRODUCT');

    // Booking Detail State
    const [bookingDetailModalOpen, setBookingDetailModalOpen] = useState(false);
    const [bookingDetailSku, setBookingDetailSku] = useState<string>('');
    const [bookingDetailData, setBookingDetailData] = useState<any[]>([]);
    const [bookingDetailLoading, setBookingDetailLoading] = useState(false);
    const [bookingDetailFilter, setBookingDetailFilter] = useState<'ALL' | 'CONFIRMED'>('ALL');

    const fetchBookingsBySku = async (sku: string, filter: 'ALL' | 'CONFIRMED' = 'ALL') => {
        setBookingDetailLoading(true);
        setBookingDetailFilter(filter);
        try {
            const res = await api.get(`/planning/bookings/${encodeURIComponent(sku)}`);
            const all = Array.isArray(res.data) ? res.data : [];
            setBookingDetailData(filter === 'CONFIRMED' ? all.filter((d: any) => d.booking_status === 'CONFIRMED') : all);
        } catch (e) {
            message.error('Lỗi tải danh sách booking');
        }
        setBookingDetailLoading(false);
    };

    const [form] = Form.useForm();
    const [variantForm] = Form.useForm();

    const getCategoryName = (id: number) => {
        return categories.find(c => c.id === id)?.name || 'N/A';
    }

    // 1. Fetch Master Data
    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/products`);
            setData(Array.isArray(res.data) ? res.data : []);

            const resCat = await api.get(`/categories`);
            const sortedCategories = Array.isArray(resCat.data)
                ? resCat.data.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''))
                : [];
            setCategories(sortedCategories);

            const resMat = await api.get(`/materials`);
            const normalizedMaterials = Array.isArray(resMat.data)
                ? resMat.data.map(m => ({
                    value: m.id,
                    label: `${m.sku || m.code} - ${m.name}`
                }))
                : [];
            setMaterials(normalizedMaterials);

            const resSup = await api.get(`/suppliers`);
            setSuppliers(Array.isArray(resSup.data) ? resSup.data : []);

            const resProc = await api.get(`/processes`);
            setProcesses(Array.isArray(resProc.data) ? resProc.data : []);

        } catch (e) { message.error('Lỗi tải dữ liệu'); }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    useEffect(() => {
        // Luôn fetch booking stats để cập nhật số liệu chính xác nhất
        fetchBookingStats(filterMonth);
    }, [filterMonth]);

    const fetchBookingStats = async (monthStr: string) => {
        setStatsLoading(true);
        try {
            let url = `/planning/booking-stats`;
            if (monthStr) {
                const [year, month] = monthStr.split('-');
                url += `?month=${month}&year=${year}`;
            }
            const res = await api.get(url);
            setBookingStats(res.data || {});
        } catch (e) {
            message.error('Lỗi tải thống kê booking');
        }
        setStatsLoading(false);
    };

    // 2. Detail Data Fetcher
    const fetchDetailData = async (id: number) => {
        if (!id) return;
        try {
            const res = await api.get(`/products/${id}`);
            const product = res.data;

            // Cập nhật lại form với đầy đủ dữ liệu (vì danh sách chỉ load vắn tắt)
            if (editingItem && editingItem.id === id) {
                setEditingItem(product);
                form.setFieldsValue(product);
            }

            const resBOM = await api.get(`/products/${encodeURIComponent(product.sku)}/boms`);
            setBoms(resBOM.data || []);

            const resRouting = await api.get(`/products/${id}/routings`);
            setRoutings(resRouting.data || []);

            // Fetch Logistics
            const resLogistics = await api.get(`/products/${id}/logistics`);
            setLogistics(resLogistics.data || []);

            const resComp = await api.get(`/products/combo/${encodeURIComponent(product.sku)}`);
            setComponents(resComp.data || []);

        } catch (e) { message.error('Lỗi tải chi tiết'); }
    };

    // 3. Main CRUD
    const handleSave = async (values: any) => {
        try {
            const payload = { ...values };
            let savedProduct: any;

            if (editingItem) {
                await api.put(`/products/${editingItem.id}`, payload);
                message.success('Đã lưu thành công');
                setIsModalOpen(false);
                fetchData();
            } else {
                const res = await api.post(`/products`, payload);
                savedProduct = res.data;
                message.success('Đã tạo sản phẩm mới thành công. Vui lòng thiết lập BOM/Quy trình.');
                setEditingItem(savedProduct);
                form.setFieldsValue(savedProduct);
                setActiveTab('2');
                // Gọi fetchDetailData để load các tab khác (dù mới tạo chưa có gì nhưng để đồng bộ logic)
                fetchDetailData(savedProduct.id);
                fetchData();
            }
        } catch (e) { message.error('Lỗi lưu'); }
    };

    const handleDelete = async (id: number) => {
        try { await api.delete(`/products/${id}`); message.success('Đã xóa'); fetchData(); }
        catch (e) { message.error('Lỗi xóa'); }
    };

    const handleToggleFlag = async (record: any) => {
        try {
            await api.put(`/products/${record.id}`, { is_flagged: !record.is_flagged });
            message.success(record.is_flagged ? 'Đã bỏ đánh dấu ưu tiên' : 'Đã đánh dấu ưu tiên');
            fetchData();
        } catch (e) {
            message.error('Lỗi cập nhật trạng thái');
        }
    };

    const openEdit = (item: any) => {
        form.resetFields();
        setEditingItem(item);

        let initialProfitMargin = 30;
        if (item.category_id) {
            const category = categories.find(c => c.id === item.category_id);
            if (category && category.profit_margin !== undefined) {
                initialProfitMargin = category.profit_margin;
            }
        }

        const initialValues = {
            ...item,
            profit_margin: item.profit_margin !== undefined ? item.profit_margin : initialProfitMargin,
        };

        form.setFieldsValue(initialValues);
        setActiveTab('1');
        setIsModalOpen(true);
        fetchDetailData(item.id);
    };

    const openCreateVariant = (item: any) => {
        setBaseProductForVariant(item);
        variantForm.resetFields();
        variantForm.setFieldsValue({
            base_sku: item.sku,
            base_name: item.name,
        });
        setIsVariantModalOpen(true);
    }

    const handleCreateVariant = async (values: any) => {
        const { base_sku, variant_sku_suffix, variant_name_suffix, front_color, back_color, size, logo, design, ...otherValues } = values;

        const newSku = `${base_sku}_${variant_sku_suffix}`;
        const newName = `${baseProductForVariant.name} ${variant_name_suffix}`;

        const payload = {
            baseSku: base_sku,
            newSku: newSku,
            newName: newName,
            attributes: { front_color, back_color, size, logo, design }
        };

        try {
            await api.post(`/products/create-variant`, payload);
            message.success(`Đã tạo biến thể mới: ${newSku}`);
            setIsVariantModalOpen(false);
            fetchData();
        } catch (e) {
            let errorMessage = "Đã xảy ra lỗi không xác định.";
            if (axios.isAxiosError(e)) {
                errorMessage = e.response?.data?.message || e.message;
            } else if (e instanceof Error) {
                errorMessage = e.message;
            }
            message.error(`Lỗi tạo biến thể: ${errorMessage}`);
        }
    }

    const handleCalculateCost = async (sku: string) => {
        try {
            const res = await api.get(`/products/calculate-cost/${encodeURIComponent(sku)}`);
            message.success(`Giá vốn mới: ${Number(res.data.new_cost_price).toLocaleString()} ₫`);
            fetchData();
            if (editingItem) {
                const updatedItem = await api.get(`/products/${editingItem.id}`);
                setEditingItem(updatedItem.data);
                form.setFieldsValue(updatedItem.data);
            }
        } catch (e) { message.error('Lỗi tính giá vốn'); }
    };

    // --- FILTER VARIANT VS BASE ---
    const [viewMode, setViewMode] = useState('MAIN'); // 'MAIN' | 'SEMI' | 'FLAGGED'

    // Kết quả phát hiện sản phẩm trùng lặp
    const duplicateDetectionResult = useMemo(() => {
        if (!duplicateFilterActive) {
            return { duplicateProducts: [], totalDuplicates: 0, totalGroups: 0 };
        }
        
        let candidates = data;
        if (viewMode === 'MAIN') {
            candidates = candidates.filter(d => d.product_type !== 'SEMI_FINISHED');
        } else if (viewMode === 'SEMI') {
            candidates = candidates.filter(d => d.product_type === 'SEMI_FINISHED');
        } else if (viewMode === 'FLAGGED') {
            candidates = candidates.filter(d => d.is_flagged === true);
        }

        return findDuplicateProductGroups(candidates, {
            threshold: duplicateThreshold / 100,
            sameCategoryOnly: duplicateSameCategoryOnly
        });
    }, [data, viewMode, duplicateThreshold, duplicateSameCategoryOnly, duplicateFilterActive]);

    // Map tra cứu nhanh thông tin trùng cho từng sản phẩm
    const duplicateInfoMap = useMemo(() => {
        const map = new Map<number, any>();
        duplicateDetectionResult.duplicateProducts.forEach(p => {
            map.set(p.id, p);
        });
        return map;
    }, [duplicateDetectionResult]);

    const filteredData = useMemo(() => {
        let list = data;

        // 1. Filter by Mode
        if (viewMode === 'MAIN') {
            list = list.filter(d => d.product_type !== 'SEMI_FINISHED');
        } else if (viewMode === 'SEMI') {
            list = list.filter(d => d.product_type === 'SEMI_FINISHED');
        } else if (viewMode === 'FLAGGED') {
            list = list.filter(d => d.is_flagged === true);
        }

        // 2. Filter by Duplicate Detection Mode
        if (duplicateFilterActive) {
            list = duplicateDetectionResult.duplicateProducts;
        } else {
            // Gắn thông tin trùng lặp nếu có để hiển thị hover popover
            list = list.map(item => {
                const dup = duplicateInfoMap.get(item.id);
                if (dup) {
                    return {
                        ...item,
                        duplicateGroupId: dup.duplicateGroupId,
                        duplicateGroupLabel: dup.duplicateGroupLabel,
                        duplicateGroupColor: dup.duplicateGroupColor,
                        duplicateMatches: dup.duplicateMatches,
                        maxSimilarity: dup.maxSimilarity
                    };
                }
                return item;
            });
        }

        // 3. Filter by Category
        if (filterCategory) {
            list = list.filter(d => d.category_id === filterCategory);
        }

        // 4. Filter by Type
        if (filterType === 'STANDARD') {
            list = list.filter(d => d.product_type !== 'COMBO');
        } else if (filterType === 'COMBO') {
            list = list.filter(d => d.product_type === 'COMBO');
        }

        // 5. Filter by Search
        if (searchText) {
            const lower = searchText.toLowerCase();
            list = list.filter(d =>
                (d.name && d.name.toLowerCase().includes(lower)) ||
                (d.sku && d.sku.toLowerCase().includes(lower))
            );
        }

        // Map Booking Stats if available
        if (Object.keys(bookingStats).length > 0) {
            list = list.map(d => ({
                ...d,
                display_booking_stock: bookingStats[d.sku]?.booking_stock || 0,
                display_approved_booking_stock: bookingStats[d.sku]?.approved_booking_stock || 0
            }));
        } else {
            list = list.map(d => ({
                ...d,
                display_booking_stock: d.booking_stock || 0,
                display_approved_booking_stock: d.approved_booking_stock || 0
            }));
        }

        return list;
    }, [data, searchText, viewMode, filterCategory, filterType, filterMonth, bookingStats, duplicateFilterActive, duplicateDetectionResult, duplicateInfoMap]);


    // Helper to extract ID from Drive Link and return thumbnail URL
    const getGoogleDriveImageUrl = (link: string) => {
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
                // Use lh3.googleusercontent.com for high-res thumbnail that doesn't require auth for public links usually
                // or drive.google.com/thumbnail?id=ID
                return `https://drive.google.com/thumbnail?id=${id}&sz=w200`;
            }
        } catch (e) {
            return null; // Invalid URL
        }
        return link; // Return original if not a drive link (maybe direct url)
    };


    const columns = [
        {
            title: 'Ảnh', dataIndex: 'image_url', width: 80, align: 'center' as const,
            render: (link: string) => {
                const src = getGoogleDriveImageUrl(link);
                return src ? <img src={src} alt="product" style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 4 }} /> : <div style={{ width: 50, height: 50, background: '#f0f0f0', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}><FileTextOutlined /></div>;
            }
        },
        {
            title: 'Mã (SKU)', dataIndex: 'sku', width: 160, render: (t: any, r: any) => (
                <Space>
                    <Tooltip title={r.is_flagged ? "Bỏ ưu tiên" : "Đánh dấu ưu tiên hiển thị tồn kho"}>
                        {r.is_flagged ? 
                            <StarFilled style={{ color: '#faad14', cursor: 'pointer', fontSize: 16 }} onClick={(e) => { e.stopPropagation(); handleToggleFlag(r); }} /> : 
                            <StarOutlined style={{ color: '#d9d9d9', cursor: 'pointer', fontSize: 16 }} onClick={(e) => { e.stopPropagation(); handleToggleFlag(r); }} />}
                    </Tooltip>
                    <b>{t}</b>
                </Space>
            ),
            sorter: (a: any, b: any) => (a.sku || '').localeCompare(b.sku || '')
        },
        {
            title: 'Tên Sản Phẩm', dataIndex: 'name',
            render: (t: any, r: any) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <Space size={4}>
                        <TagOutlined /> <b>{t}</b>
                    </Space>
                    {r.duplicateMatches && r.duplicateMatches.length > 0 && (
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', marginTop: 2 }}>
                            {r.duplicateGroupLabel && (
                                <Tag color={r.duplicateGroupColor || 'blue'} style={{ fontSize: 11, padding: '0 4px', margin: 0 }}>
                                    {r.duplicateGroupLabel}
                                </Tag>
                            )}
                            <Popover
                                placement="right"
                                title={<span style={{ fontWeight: 'bold' }}>Sản phẩm tương tự với &quot;{r.sku}&quot; (≥{duplicateThreshold}%)</span>}
                                content={
                                    <div style={{ maxWidth: 440, maxHeight: 260, overflowY: 'auto' }}>
                                        <Table
                                            size="small"
                                            pagination={false}
                                            dataSource={r.duplicateMatches}
                                            rowKey={(m: any) => m.product?.id || m.product?.sku}
                                            columns={[
                                                { title: 'SKU', dataIndex: ['product', 'sku'], width: 100, render: (sku: string) => <b>{sku}</b> },
                                                { title: 'Tên sản phẩm', dataIndex: ['product', 'name'] },
                                                {
                                                    title: 'Độ giống', dataIndex: 'similarity', width: 85, align: 'right' as const,
                                                    render: (sim: number) => (
                                                        <Tag color={sim >= 0.8 ? 'red' : sim >= 0.6 ? 'orange' : 'blue'}>
                                                            {(sim * 100).toFixed(0)}%
                                                        </Tag>
                                                    )
                                                },
                                                {
                                                    title: '', key: 'act', width: 55, align: 'center' as const,
                                                    render: (_: any, m: any) => (
                                                        <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEdit(m.product)}>Sửa</Button>
                                                    )
                                                }
                                            ]}
                                        />
                                    </div>
                                }
                                trigger="hover"
                            >
                                <Tag 
                                    color={r.maxSimilarity >= 0.8 ? 'red' : r.maxSimilarity >= 0.6 ? 'orange' : 'cyan'} 
                                    style={{ cursor: 'pointer', fontSize: 11, padding: '0 4px', margin: 0 }}
                                >
                                    Trùng {(r.maxSimilarity * 100).toFixed(0)}% ({r.duplicateMatches.length} SP)
                                </Tag>
                            </Popover>
                        </div>
                    )}
                </div>
            ),
            sorter: (a: any, b: any) => (a.name || '').localeCompare(b.name || '')
        },
        {
            title: 'Phân loại', dataIndex: 'category_id', width: 150,
            render: (id: number) => <Tag color="blue">{getCategoryName(id)}</Tag>,
            filters: categories.map(c => ({ text: c.name, value: c.id })),
            onFilter: (value: any, record: any) => record.category_id === value,
        },
        {
            title: 'Giá vốn', dataIndex: 'cost_price', width: 100, align: 'right' as const,
            render: (v: number) => <span style={{ fontWeight: 'bold', color: 'red' }}>{Number(v).toLocaleString()}</span>,
            sorter: (a: any, b: any) => Number(a.cost_price) - Number(b.cost_price),
            hidden: !canViewCost // Ẩn cột nếu không có quyền
        },
        {
            title: 'Giá bán', dataIndex: 'base_price', width: 100, align: 'right' as const,
            render: (v: number) => <span style={{ fontWeight: 'bold', color: 'green' }}>{Number(v).toLocaleString()}</span>,
            sorter: (a: any, b: any) => Number(a.base_price) - Number(b.base_price)
        },
        {
            title: 'Tồn kho thật', dataIndex: 'quantity_in_stock', width: 90, align: 'right' as const,
            render: (v: number) => <span style={{ color: '#595959' }}>{Number(v || 0).toLocaleString()}</span>,
            sorter: (a: any, b: any) => Number(a.quantity_in_stock || 0) - Number(b.quantity_in_stock || 0)
        },
        {
            title: 'Giá trị tồn', key: 'inventory_value', width: 100, align: 'right' as const,
            render: (r: any) => {
                const val = Number(r.quantity_in_stock || 0) * Number(r.cost_price || r.base_price || 0);
                return <span style={{ color: '#1890ff' }}>{val.toLocaleString()}</span>;
            },
            sorter: (a: any, b: any) => (Number(a.quantity_in_stock || 0) * Number(a.cost_price || a.base_price || 0)) - (Number(b.quantity_in_stock || 0) * Number(b.cost_price || b.base_price || 0)),
            hidden: !canViewCost
        },
        {
            title: filterMonth ? `Đã Book (${filterMonth})` : 'Đã Booking', dataIndex: 'display_booking_stock', width: 100, align: 'right' as const,
            render: (v: number, record: any) => {
                const val = Number(v || 0);
                return (
                    <span style={{ color: val > 0 ? '#fa8c16' : '#d9d9d9' }}>
                        {val.toLocaleString()}
                        {val > 0 && !filterMonth && (
                            <Tooltip title="Xem danh sách đơn hàng đã book">
                                <EyeOutlined
                                    style={{ marginLeft: 6, cursor: 'pointer', color: '#1890ff' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setBookingDetailSku(record.sku);
                                        setBookingDetailModalOpen(true);
                                        fetchBookingsBySku(record.sku);
                                    }}
                                />
                            </Tooltip>
                        )}
                    </span>
                );
            },
            sorter: (a: any, b: any) => Number(a.display_booking_stock || 0) - Number(b.display_booking_stock || 0)
        },
        {
            title: filterMonth ? `Approved (${filterMonth})` : 'Approved', dataIndex: 'display_approved_booking_stock', width: 100, align: 'right' as const,
            render: (v: number, record: any) => {
                const val = Number(v || 0);
                return (
                    <span style={{ color: val > 0 ? '#52c41a' : '#d9d9d9', fontWeight: val > 0 ? 'bold' : 'normal' }}>
                        {val.toLocaleString()}
                        {val > 0 && !filterMonth && (
                            <Tooltip title="Xem danh sách đơn hàng đã duyệt">
                                <EyeOutlined
                                    style={{ marginLeft: 6, cursor: 'pointer', color: '#52c41a' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setBookingDetailSku(record.sku);
                                        setBookingDetailModalOpen(true);
                                        fetchBookingsBySku(record.sku, 'CONFIRMED');
                                    }}
                                />
                            </Tooltip>
                        )}
                    </span>
                );
            },
            sorter: (a: any, b: any) => Number(a.display_approved_booking_stock || 0) - Number(b.display_approved_booking_stock || 0)
        },
        {
            title: 'Khả dụng', key: 'available_stock', width: 90, align: 'right' as const,
            render: (r: any) => {
                const available = Number(r.quantity_in_stock || 0) - Number(r.display_approved_booking_stock || 0);
                return <Badge count={available} showZero overflowCount={999} style={{ backgroundColor: available > 0 ? '#52c41a' : '#faad14' }} />
            },
            sorter: (a: any, b: any) => (Number(a.quantity_in_stock || 0) - Number(a.display_approved_booking_stock || 0)) - (Number(b.quantity_in_stock || 0) - Number(b.display_approved_booking_stock || 0))
        },
        {
            title: '', key: 'action', width: 210, fixed: 'right' as const, align: 'center' as const,
            render: (_: any, r: any) => (
                <Space size="small">
                    <Tooltip title="Tìm sản phẩm có tên tương tự">
                        <Button 
                            icon={<BranchesOutlined />} 
                            size="small" 
                            style={{ color: '#fa8c16' }}
                            onClick={() => { setSimilarModalTarget(r); setSimilarModalThreshold(50); }} 
                        />
                    </Tooltip>
                    {canCreate && (
                        <Tooltip title="Tạo Biến thể mới từ Sản phẩm này">
                            <Button icon={<ForkOutlined />} size="small" type="default" onClick={() => openCreateVariant(r)} />
                        </Tooltip>
                    )}
                    {canViewCost && (
                        <Tooltip title="Tính Giá Vốn"><Button icon={<DollarOutlined />} size="small" onClick={() => handleCalculateCost(r.sku)} type="primary" ghost /></Tooltip>
                    )}
                    {canUpdate && <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(r)} />}
                    {canDelete && <Popconfirm title="Xóa?" onConfirm={() => handleDelete(r.id)}><Button icon={<DeleteOutlined />} size="small" danger /></Popconfirm>}
                </Space>
            )
        }
    ];

    const handleRefreshComboDescription = () => {
        if (!components || components.length === 0) {
            message.warning('Sản phẩm này chưa có thành phần con nào');
            return;
        }

        const newDescription = components
            .filter(c => c.child_product)
            .map(c => {
                const p = c.child_product;
                let desc = `- ${p.name} (x${c.quantity})`;
                if (p.customer_description) {
                    desc += `\n${p.customer_description}`;
                }
                return desc;
            })
            .join('\n\n');

        form.setFieldsValue({ customer_description: newDescription });
        message.success('Đã làm mới mô tả từ các sản phẩm con');
    };

    const handleFormValuesChange = (changedValues: any) => {
        if (changedValues.category_id !== undefined) {
            const newCategoryId = changedValues.category_id;
            const category = categories.find(c => c.id === newCategoryId);

            if (category && category.profit_margin !== undefined) {
                if (form.getFieldValue('profit_margin') !== category.profit_margin) {
                    form.setFieldsValue({ profit_margin: category.profit_margin });
                }
            } else {
                form.setFieldsValue({ profit_margin: 30 });
            }
        }
    };

    const handleCalculateAllCosts = () => {
        Modal.confirm({
            title: 'Cập nhật giá toàn bộ sản phẩm?',
            content: 'Hệ thống sẽ tính toán lại giá vốn cho TẤT CẢ sản phẩm (bao gồm cả Combo). Quá trình này có thể mất vài phút.',
            okText: 'Đồng ý cập nhật',
            cancelText: 'Hủy',
            onOk: async () => {
                const hide = message.loading('Đang tính toán lại toàn bộ giá...', 0);
                try {
                    const res = await api.post(`/products/calculate-all-costs`);
                    hide();
                    message.success(`Cập nhật thành công! Đã xử lý ${res.data.count} sản phẩm.`);
                    fetchData();
                } catch (e) {
                    hide();
                    message.error('Lỗi khi cập nhật giá hàng loạt.');
                }
            }
        });
    };

    const handleSyncBookingStocks = () => {
        Modal.confirm({
            title: 'Đồng bộ toàn bộ tồn kho booking?',
            content: 'Hệ thống sẽ tính toán lại tồn kho Đã Book và Approved cho tất cả sản phẩm dựa trên các đơn đặt hàng hiện tại. Bạn có chắc chắn muốn chạy?',
            okText: 'Đồng ý đồng bộ',
            cancelText: 'Hủy',
            onOk: async () => {
                const hide = message.loading('Đang đồng bộ số liệu...', 0);
                try {
                    const res = await api.post(`/planning/sync-booking-stock`);
                    hide();
                    message.success(res.data?.message || 'Đồng bộ thành công!');
                    fetchBookingStats(filterMonth);
                    fetchData();
                } catch (e) {
                    hide();
                    message.error('Lỗi khi đồng bộ booking stock.');
                }
            }
        });
    };

    const handlePrint = (option: 1 | 2) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            message.error('Trình duyệt đã chặn popup. Vui lòng cho phép popup để in.');
            return;
        }

        const tableHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>In Danh Sách Sản Phẩm</title>
                <style>
                    @page { size: landscape; margin: 10mm; }
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #333; }
                    h2 { text-align: center; margin-bottom: 20px; text-transform: uppercase; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; vertical-align: middle; }
                    th { background-color: #f0f0f0; font-weight: bold; text-align: center; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    .product-img { width: 40px; height: 40px; object-fit: cover; border-radius: 4px; }
                    .empty-note { min-width: 130px; }
                </style>
            </head>
            <body>
                <h2>Danh Sách Sản Phẩm</h2>
                <table>
                    <thead>
                        <tr>
                            <th>STT</th>
                            <th>Ảnh</th>
                            <th>Mã (SKU)</th>
                            <th>Tên Sản Phẩm</th>
                            ${option === 1 && canViewCost ? '<th>Giá vốn</th>' : ''}
                            ${option === 1 ? '<th>Giá bán</th>' : ''}
                            <th>Tồn kho thật</th>
                            ${option === 1 && canViewCost ? '<th>Giá trị tồn</th>' : ''}
                            <th>Đã Booking</th>
                            <th>Approved</th>
                            <th>Khả dụng</th>
                            <th class="empty-note">Ghi chú</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredData.map((item, index) => {
                            const available = Number(item.quantity_in_stock || 0) - Number(item.display_approved_booking_stock || 0);
                            const inventoryValue = Number(item.quantity_in_stock || 0) * Number(item.cost_price || item.base_price || 0);
                            const src = getGoogleDriveImageUrl(item.image_url);
                            const imgHtml = src ? `<img src="${src}" class="product-img" />` : '';
                            
                            return `
                            <tr>
                                <td class="text-center">${index + 1}</td>
                                <td class="text-center">${imgHtml}</td>
                                <td><b>${item.sku || ''}</b></td>
                                <td>${item.name || ''}</td>
                                ${option === 1 && canViewCost ? `<td class="text-right">${Number(item.cost_price || 0).toLocaleString()}</td>` : ''}
                                ${option === 1 ? `<td class="text-right">${Number(item.base_price || 0).toLocaleString()}</td>` : ''}
                                <td class="text-right">${Number(item.quantity_in_stock || 0).toLocaleString()}</td>
                                ${option === 1 && canViewCost ? `<td class="text-right">${inventoryValue.toLocaleString()}</td>` : ''}
                                <td class="text-right">${Number(item.display_booking_stock || 0).toLocaleString()}</td>
                                <td class="text-right">${Number(item.display_approved_booking_stock || 0).toLocaleString()}</td>
                                <td class="text-right">${available.toLocaleString()}</td>
                                <td></td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `;

        printWindow.document.write(tableHTML);
        printWindow.document.close();
        printWindow.focus();
        
        setTimeout(() => {
            printWindow.print();
        }, 1000);
    };

    const printMenuProps: MenuProps = {
        items: [
            { key: '1', label: 'In tất cả các cột', onClick: () => handlePrint(1) },
            { key: '2', label: 'In ẩn giá vốn/giá bán', onClick: () => handlePrint(2) },
        ],
    };

    return (
        <Card
            bodyStyle={{ padding: isMobile ? '8px 12px' : undefined }}
            title={<span style={{ fontSize: isMobile ? 14 : 16 }}>Sản Phẩm</span>}
            extra={
                isMobile ? (
                    <Space size={4}>
                        <Input placeholder="Tìm..." prefix={<SearchOutlined />} value={searchText} onChange={e => setSearchText(e.target.value)} style={{ width: 120 }} allowClear />
                        <Tooltip title={duplicateFilterActive ? "Tắt lọc trùng" : "Lọc trùng tên SP"}>
                            <Button 
                                type={duplicateFilterActive ? 'primary' : 'default'} 
                                danger={duplicateFilterActive} 
                                icon={<BranchesOutlined />} 
                                onClick={() => setDuplicateFilterActive(!duplicateFilterActive)} 
                            />
                        </Tooltip>
                        <Dropdown menu={printMenuProps} placement="bottomRight" trigger={['click']}>
                            <Button icon={<PrinterOutlined />} />
                        </Dropdown>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingItem(null); form.resetFields(); setIsModalOpen(true); setActiveTab('1') }} />
                    </Space>
                ) : (
                    <Space wrap style={{ rowGap: 10 }}>
                        <Button
                            type={duplicateFilterActive ? 'primary' : 'default'}
                            danger={duplicateFilterActive}
                            icon={<BranchesOutlined />}
                            onClick={() => setDuplicateFilterActive(!duplicateFilterActive)}
                            style={{ fontWeight: duplicateFilterActive ? 'bold' : 'normal' }}
                        >
                            {duplicateFilterActive ? 'Đang lọc trùng' : 'Lọc trùng tên SP'}
                            {duplicateDetectionResult.totalDuplicates > 0 && (
                                <Badge
                                    count={duplicateDetectionResult.totalDuplicates}
                                    overflowCount={999}
                                    style={{
                                        backgroundColor: duplicateFilterActive ? '#fff' : '#f5222d',
                                        color: duplicateFilterActive ? '#ff4d4f' : '#fff',
                                        marginLeft: 6,
                                        boxShadow: 'none'
                                    }}
                                />
                            )}
                        </Button>
                        <Select
                            placeholder="Danh mục"
                            allowClear
                            value={filterCategory}
                            onChange={setFilterCategory}
                            style={{ width: 250 }}
                            options={categories.map(c => ({ label: c.name, value: c.id }))}
                            showSearch
                            optionFilterProp="label"
                        />
                        <Select
                            value={filterType}
                            onChange={setFilterType}
                            style={{ width: 150 }}
                            options={[
                                { label: 'Tất cả loại SP', value: 'ALL' },
                                { label: 'Sản phẩm thường', value: 'STANDARD' },
                                { label: 'Combo', value: 'COMBO' },
                            ]}
                        />
                        <DatePicker
                            picker="month"
                            placeholder="Lọc Booking (Tháng/Năm)"
                            onChange={(date, dateString) => setFilterMonth(Array.isArray(dateString) ? dateString[0] : dateString)}
                            allowClear
                            style={{ width: 220 }}
                        />
                        <Input placeholder="Tìm kiếm SKU/Tên..." prefix={<SearchOutlined />} value={searchText} onChange={e => setSearchText(e.target.value)} style={{ width: 250 }} allowClear />
                        {canViewCost && (
                            <>
                                <Button icon={<SyncOutlined />} onClick={handleCalculateAllCosts}>Cập nhật tất cả giá</Button>
                                <Button icon={<SyncOutlined />} onClick={handleSyncBookingStocks}>Đồng bộ Booking Stock</Button>
                            </>
                        )}
                        <Dropdown menu={printMenuProps} placement="bottomRight">
                            <Button icon={<PrinterOutlined />}>In DS</Button>
                        </Dropdown>
                        {canCreate && <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingItem(null); form.resetFields(); setIsModalOpen(true); setActiveTab('1') }}>Thêm Mới</Button>}
                    </Space>
                )
            }
        >
            {duplicateFilterActive && (
                <Card 
                    size="small" 
                    style={{ 
                        marginBottom: 16, 
                        background: '#fffbe6', 
                        borderColor: '#ffe58f',
                        borderRadius: 8,
                        boxShadow: '0 2px 8px rgba(250, 140, 22, 0.15)'
                    }}
                >
                    <Row gutter={[16, 12]} align="middle">
                        <Col xs={24} md={10}>
                            <Space align="center" style={{ width: '100%', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                    <BranchesOutlined style={{ color: '#fa8c16', marginRight: 4 }} />
                                    Ngưỡng tương đồng:
                                </span>
                                <Slider
                                    min={30}
                                    max={100}
                                    step={5}
                                    value={duplicateThreshold}
                                    onChange={setDuplicateThreshold}
                                    style={{ width: 140, display: 'inline-block', margin: '0 8px' }}
                                />
                                <InputNumber
                                    min={30}
                                    max={100}
                                    step={5}
                                    value={duplicateThreshold}
                                    onChange={v => setDuplicateThreshold(v || 50)}
                                    formatter={v => `${v}%`}
                                    parser={v => Number(v?.replace('%', '') || 50)}
                                    style={{ width: 75 }}
                                    size="small"
                                />
                            </Space>
                        </Col>
                        <Col xs={24} md={8}>
                            <Space size={4} wrap>
                                <span style={{ fontSize: 12, color: '#8c8c8c', marginRight: 4 }}>Chọn nhanh:</span>
                                {[50, 60, 70, 80, 90, 100].map(val => (
                                    <Tag.CheckableTag
                                        key={val}
                                        checked={duplicateThreshold === val}
                                        onChange={() => setDuplicateThreshold(val)}
                                        style={{ 
                                            border: duplicateThreshold === val ? '1px solid #fa8c16' : '1px solid #d9d9d9',
                                            background: duplicateThreshold === val ? '#fa8c16' : '#fff',
                                            color: duplicateThreshold === val ? '#fff' : '#595959',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {val === 100 ? '100% (Tuyệt đối)' : `${val}%`}
                                    </Tag.CheckableTag>
                                ))}
                            </Space>
                        </Col>
                        <Col xs={24} md={6} style={{ textAlign: isMobile ? 'left' : 'right' }}>
                            <Space>
                                <Checkbox
                                    checked={duplicateSameCategoryOnly}
                                    onChange={e => setDuplicateSameCategoryOnly(e.target.checked)}
                                >
                                    Cùng danh mục
                                </Checkbox>
                                <Button 
                                    size="small" 
                                    icon={<CloseCircleOutlined />} 
                                    onClick={() => setDuplicateFilterActive(false)}
                                >
                                    Tắt lọc
                                </Button>
                            </Space>
                        </Col>
                        <Col span={24}>
                            <Alert
                                type={duplicateDetectionResult.totalDuplicates > 0 ? "warning" : "info"}
                                showIcon
                                message={
                                    <span>
                                        Phát hiện <b>{duplicateDetectionResult.totalDuplicates}</b> sản phẩm thuộc <b>{duplicateDetectionResult.totalGroups}</b> nhóm có tên tương tự nhau (Độ tương đồng ≥ <b>{duplicateThreshold}%</b>).
                                        {duplicateDetectionResult.totalDuplicates > 0 && " Các sản phẩm cùng nhóm được tự động gom cạnh nhau để tiện đối chiếu."}
                                    </span>
                                }
                                style={{ padding: '6px 12px' }}
                            />
                        </Col>
                    </Row>
                </Card>
            )}

            <Tabs
                activeKey={viewMode}
                onChange={setViewMode}
                size={isMobile ? 'small' : 'middle'}
                items={[
                    { key: 'MAIN', label: <span><AppstoreOutlined /> {isMobile ? 'SP' : 'Danh Sách Sản Phẩm'}</span> },
                    { key: 'FLAGGED', label: <span><StarFilled style={{ color: '#faad14' }} /> {isMobile ? 'Ưu tiên' : 'Sản Phẩm Ưu Tiên'}</span> },
                    { key: 'SEMI', label: <span><BuildOutlined /> {isMobile ? 'BOM' : 'Bán Thành Phẩm (BOM)'}</span> }
                ]}
                style={{ marginBottom: 16 }}
            />
            <Table 
                dataSource={filteredData} 
                columns={columns.filter(c => !c.hidden)} 
                rowKey="id" 
                loading={loading || statsLoading} 
                size="middle" 
                bordered
                scroll={{ x: 'max-content', y: 'calc(100vh - 300px)' }} 
                pagination={{
                    showSizeChanger: true,
                    pageSizeOptions: ['20', '50', '100'],
                    defaultPageSize: 20,
                    showTotal: (total) => `Tổng số ${total} sản phẩm`
                }}
            />

            <Modal title={editingItem ? `Cập nhật: ${editingItem.sku}` : "Thêm Sản Phẩm Mới"}
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                onOk={() => {
                    if (activeTab === '1') { form.submit(); } else { setIsModalOpen(false); }
                }}
                width={1400}
                okText={editingItem ? "Lưu Thông Tin Chung" : "Tạo Sản Phẩm & Tiếp tục"}
            >
                <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
                    {
                        key: '1', label: <span><BuildOutlined /> Thông Tin Chung</span>,
                        children: (
                            <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ is_active: true }} onValuesChange={handleFormValuesChange}>
                                <Row gutter={16}>
                                    <Col span={8}>
                                        <Form.Item name="sku" label="Mã Sản Phẩm (SKU)" rules={[{ required: true }]}><Input /></Form.Item>
                                        <Form.Item name="name" label="Tên Sản Phẩm" rules={[{ required: true }]}><Input /></Form.Item>
                                        <SimilarNameWarning form={form} editingItem={editingItem} data={data} />
                                        <Row gutter={16}>
                                            <Col span={12}><Form.Item name="unit" label="ĐVT"><Input /></Form.Item></Col>
                                            <Col span={12}><Form.Item name="is_active" label="Trạng thái"><Select><Option value={true}>Hoạt động</Option><Option value={false}>Ngừng bán</Option></Select></Form.Item></Col>
                                        </Row>
                                        <Form.Item name="category_id" label="Phân loại"><Select showSearch optionFilterProp="label" options={categories.map(c => ({ label: c.name, value: c.id }))} /></Form.Item>
                                    </Col>

                                    <Col span={8}>
                                        <Divider orientation="left">Thông tin Giá & Tồn</Divider>
                                        <Form.Item label="Link hình ảnh (Google Drive)" tooltip="Paste link chia sẻ (Public) từ Google Drive. Hệ thống sẽ tự tạo thumbnail.">
                                            <Space.Compact style={{ width: '100%' }}>
                                                <Form.Item name="image_url" noStyle>
                                                    <Input prefix={<LinkOutlined />} placeholder="https://drive.google.com/..." allowClear />
                                                </Form.Item>
                                                <Button icon={<FolderOpenOutlined />} onClick={async () => {
                                                    try {
                                                        const res = await api.get(`/system/config/SALES_SHARED_DRIVE_LINK`);
                                                        const link = res.data?.value || 'https://drive.google.com/drive/u/0/';
                                                        window.open(link, '_blank');
                                                    } catch {
                                                        message.error('Không tìm thấy link cấu hình!');
                                                        window.open('https://drive.google.com/drive/u/0/', '_blank');
                                                    }
                                                }}>Mở Kho Ảnh</Button>
                                            </Space.Compact>
                                        </Form.Item>

                                        <Form.Item shouldUpdate={(prev, curr) => prev.image_url !== curr.image_url}>
                                            {({ getFieldValue }) => {
                                                const url = getFieldValue('image_url');
                                                const src = getGoogleDriveImageUrl(url);
                                                return src ? (
                                                    <div style={{ textAlign: 'center', marginBottom: 20 }}>
                                                        <img src={src} alt="Preview" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, border: '1px solid #d9d9d9' }} />
                                                    </div>
                                                ) : null;
                                            }}
                                        </Form.Item>

                                        <Form.Item name="base_price" label="Giá bán (Chưa KM)"><InputNumber style={{ width: '100%' }} addonAfter="₫" formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} /></Form.Item>

                                        {canViewCost && (
                                            <Form.Item name="cost_price" label="Giá vốn (Hệ thống tính)" tooltip="Hệ thống tính tự động (BOM + Gia công). Click refresh để tính lại.">
                                                <InputNumber style={{ width: '100%' }} addonAfter={<Tooltip title="Tính lại Giá vốn (BOM + Gia công)"><SyncOutlined onClick={() => handleCalculateCost(form.getFieldValue('sku'))} style={{ cursor: 'pointer' }} /></Tooltip>} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} disabled />
                                            </Form.Item>
                                        )}
                                        <Form.Item name="profit_margin" label="Lợi nhuận mong muốn (%)" tooltip="Lấy từ Danh mục nếu tạo mới, có thể override tại đây"><InputNumber style={{ width: '100%' }} addonAfter="%" min={0} max={99} /></Form.Item>
                                        <Form.Item name="quantity_in_stock" label="Tồn kho"><InputNumber style={{ width: '100%' }} disabled /></Form.Item>
                                    </Col>

                                    <Col span={8}>
                                        <Divider orientation="left"><FileTextOutlined /> Mô tả & Thông tin chi tiết</Divider>
                                        <Form.Item 
                                            name="customer_description" 
                                            label={
                                                <Space>
                                                    Mô tả Khách hàng/Bán hàng
                                                    {editingItem?.product_type === 'COMBO' && (
                                                        <Tooltip title="Làm mới mô tả từ sản phẩm con">
                                                            <SyncOutlined 
                                                                onClick={handleRefreshComboDescription} 
                                                                style={{ color: '#1890ff', cursor: 'pointer' }} 
                                                            />
                                                        </Tooltip>
                                                    )}
                                                </Space>
                                            }
                                            tooltip="Hiển thị trên Báo giá, SO, Phiếu giao hàng"
                                        >
                                            <TextArea rows={3} placeholder="Mô tả thương mại, chất liệu cơ bản, v.v." />
                                        </Form.Item>
                                        <Form.Item name="processing_description" label="Mô tả Gia công/Sản xuất" tooltip="Hiển thị trên PO Gia công, Lệnh sản xuất"><TextArea rows={3} placeholder="Yêu cầu kỹ thuật, chi tiết may/cắt, v.v." /></Form.Item>
                                        <Form.Item name="vat_description" label="Mô tả VAT" tooltip="Hiển thị trên đơn hàng để xuất hóa đơn"><TextArea rows={2} placeholder="Mô tả xuất hóa đơn..." /></Form.Item>

                                        {/* BIẾN THỂ: Luôn hiển thị để cho phép thêm/sửa thuộc tính */}
                                        <>
                                            <Divider orientation="left"><ForkOutlined /> Thuộc tính Biến thể</Divider>
                                            <Row gutter={10}>
                                                <Col span={12}><Form.Item name={['attributes', 'front_color']} label="Màu sắc (Mặt trước)"><Input /></Form.Item></Col>
                                                <Col span={12}><Form.Item name={['attributes', 'back_color']} label="Màu sắc (Mặt sau)"><Input /></Form.Item></Col>
                                                <Col span={12}><Form.Item name={['attributes', 'size']} label="Kích thước"><Input /></Form.Item></Col>
                                                <Col span={12}><Form.Item name={['attributes', 'logo']} label="Logo (Hình in/Thêu)"><Input /></Form.Item></Col>
                                                <Col span={12}><Form.Item name={['attributes', 'design']} label="Design (Thiết kế)"><Input /></Form.Item></Col>
                                            </Row>
                                        </>
                                    </Col>
                                </Row>
                            </Form>
                        )
                    },
                    {
                        key: '2', label: <span><AppstoreOutlined /> BOM (Nguyên liệu)</span>,
                        disabled: !editingItem,
                        children: (
                            <ProductBOMTab
                                editingItem={editingItem}
                                boms={boms}
                                materials={materials}
                                fetchDetailData={fetchDetailData}
                                setBoms={setBoms}
                            />
                        )
                    },
                    {
                        key: '3', label: <span><ExperimentOutlined /> Quy Trình Gia Công</span>,
                        disabled: !editingItem,
                        children: (
                            <ProductRoutingTab
                                editingItem={editingItem}
                                routings={routings}
                                suppliers={suppliers}
                                processes={processes}
                                fetchDetailData={fetchDetailData}
                                setRoutings={setRoutings}
                            />
                        )
                    },
                    {
                        key: '7', label: <span><ScissorOutlined /> Sơ đồ & Định mức</span>,
                        disabled: !editingItem,
                        children: (
                            <ProductPatternTab editingItem={editingItem} />
                        )
                    },
                    // --- MỚI: TAB LOGISTICS ---
                    {
                        key: '4', label: <span><SendOutlined /> Logistics & Khác</span>,
                        disabled: !editingItem,
                        children: (
                            <ProductLogisticsTab
                                editingItem={editingItem}
                                logistics={logistics}
                                fetchDetailData={fetchDetailData}
                                setLogistics={setLogistics}
                            />
                        )
                    },
                    // --- MỚI: TAB BÁN THÀNH PHẨM ---
                    {
                        key: '8', label: <span><AppstoreOutlined /> Bán Thành Phẩm</span>,
                        disabled: !editingItem,
                        children: (
                            <ProductSemiFinishedTab
                                editingItem={editingItem}
                                materials={materials}
                                fetchDetailData={fetchDetailData}
                                components={components}
                                boms={boms}
                            />
                        )
                    },
                    // --------------------------
                    // --------------------------
                    {
                        key: '5', label: <span><LinkOutlined /> Combo/Thành phần</span>,
                        disabled: !editingItem,
                        children: (
                            <div >Combo Tab (Cần tạo component riêng)</div>
                        )
                    },
                    {
                        key: '6',
                        label: <span><SyncOutlined /> Quản lý Biến thể</span>,
                        disabled: !editingItem,
                        children: (
                            <ProductVariantsTab
                                editingItem={editingItem}
                                data={data}
                                fetchData={fetchData}
                                fetchDetailData={fetchDetailData}
                            />
                        )
                    }
                ]} />
            </Modal>

            <Modal
                title={`Tạo Biến thể mới từ ${baseProductForVariant?.sku}`}
                open={isVariantModalOpen}
                onCancel={() => setIsVariantModalOpen(false)}
                okText="Tạo & Sao chép BOM"
                onOk={() => variantForm.submit()}
                destroyOnClose={true}
                width={800}
            >
                <Form form={variantForm} layout="vertical" onFinish={handleCreateVariant} initialValues={{ base_sku: baseProductForVariant?.sku }}>
                    <Form.Item name="base_sku" label="SKU Gốc" ><Input disabled /></Form.Item>
                    <Divider />
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="variant_sku_suffix" label="Hậu tố SKU Biến thể" rules={[{ required: true, message: 'Nhập hậu tố SKU (VD: RED)' }]}>
                                <Input addonBefore={baseProductForVariant?.sku} addonAfter='_' placeholder="VD: RED, L" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="variant_name_suffix" label="Hậu tố Tên Biến thể">
                                <Input addonBefore={baseProductForVariant?.name + ' '} placeholder="VD: Đỏ, Size L" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Divider orientation="left">Thuộc tính Biến thể</Divider>
                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="front_color" label="Màu sắc (Mặt trước)"><Input placeholder="VD: Đỏ, Xanh Navy" /></Form.Item></Col>
                        <Col span={12}><Form.Item name="back_color" label="Màu sắc (Mặt sau)"><Input placeholder="VD: Đen, Trắng" /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="size" label="Kích thước (Size)"><Input placeholder="VD: L, 40x60cm" /></Form.Item></Col>
                        <Col span={12}><Form.Item name="logo" label="Logo (Hình in/Thêu)"><Input placeholder="VD: Logo ngực trái, In Pet" /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="design" label="Design (Thiết kế)"><Input placeholder="VD: Mẫu A, Hình in rồng" /></Form.Item></Col>
                    </Row>
                </Form>
            </Modal>

            {/* Booking Detail Modal */}
            <Modal
                title={`Danh sách đơn hàng ${bookingDetailFilter === 'CONFIRMED' ? 'đã duyệt (Approved)' : 'đã book'} - ${bookingDetailSku}`}
                open={bookingDetailModalOpen}
                onCancel={() => setBookingDetailModalOpen(false)}
                footer={null}
                width={800}
            >
                <Table
                    dataSource={bookingDetailData}
                    loading={bookingDetailLoading}
                    rowKey="id"
                    size="small"
                    pagination={false}
                    scroll={{ y: 350 }}
                    columns={[
                        { title: 'Mã SO', dataIndex: 'order_code', render: (t: string) => <b>{t}</b> },
                        { title: 'Khách hàng', dataIndex: 'customer_name' },
                        { title: 'SL Book', dataIndex: 'booked_quantity', align: 'center' as const, render: (v: number) => Number(v || 0).toLocaleString() },
                        {
                            title: 'Trạng thái', dataIndex: 'booking_status', align: 'center' as const,
                            render: (s: string) => {
                                if (s === 'CONFIRMED') return <Tag color="green">Đã duyệt</Tag>;
                                if (s === 'TEMPORARY') return <Tag color="orange">Chờ duyệt</Tag>;
                                return <Tag>{s}</Tag>;
                            }
                        },
                        { title: 'Mã KH SX', dataIndex: 'plan_code' },
                        { title: 'NV Sale', dataIndex: 'assigned_to_name' },
                    ]}
                />
            </Modal>

            {/* Modal Tìm kiếm Sản phẩm có tên tương tự */}
            <Modal
                title={
                    <Space>
                        <BranchesOutlined style={{ color: '#fa8c16' }} />
                        <span>Sản phẩm có tên tương tự với: <b>[{similarModalTarget?.sku}] {similarModalTarget?.name}</b></span>
                    </Space>
                }
                open={!!similarModalTarget}
                onCancel={() => setSimilarModalTarget(null)}
                footer={[
                    <Button key="close" type="primary" onClick={() => setSimilarModalTarget(null)}>
                        Đóng
                    </Button>
                ]}
                width={950}
            >
                {similarModalTarget && (
                    <div>
                        <Row gutter={[16, 12]} align="middle" style={{ marginBottom: 16, background: '#f5f5f5', padding: '10px 14px', borderRadius: 6 }}>
                            <Col xs={24} md={12}>
                                <Space align="center" style={{ width: '100%', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 'bold' }}>Ngưỡng tương đồng:</span>
                                    <Slider
                                        min={30}
                                        max={100}
                                        step={5}
                                        value={similarModalThreshold}
                                        onChange={setSimilarModalThreshold}
                                        style={{ width: 140, display: 'inline-block', margin: '0 8px' }}
                                    />
                                    <Tag color="blue">{similarModalThreshold}%</Tag>
                                </Space>
                            </Col>
                            <Col xs={24} md={12} style={{ textAlign: isMobile ? 'left' : 'right' }}>
                                <Space size={4} wrap>
                                    {[50, 60, 70, 80, 90, 100].map(val => (
                                        <Tag.CheckableTag
                                            key={val}
                                            checked={similarModalThreshold === val}
                                            onChange={() => setSimilarModalThreshold(val)}
                                        >
                                            {val === 100 ? '100%' : `${val}%`}
                                        </Tag.CheckableTag>
                                    ))}
                                </Space>
                            </Col>
                        </Row>

                        {(() => {
                            const matches = findSimilarProducts(
                                similarModalTarget,
                                data,
                                { threshold: similarModalThreshold / 100 }
                            );

                            return (
                                <>
                                    <div style={{ marginBottom: 8, color: '#595959', fontSize: 13 }}>
                                        Tìm thấy <b>{matches.length}</b> sản phẩm có tên tương đồng (≥ {similarModalThreshold}%):
                                    </div>
                                    <Table
                                        dataSource={matches}
                                        rowKey={(m: any) => m.product?.id || m.product?.sku}
                                        size="small"
                                        pagination={{ pageSize: 10 }}
                                        columns={[
                                            {
                                                title: 'Ảnh', dataIndex: ['product', 'image_url'], width: 60, align: 'center' as const,
                                                render: (link: string) => {
                                                    const src = getGoogleDriveImageUrl(link);
                                                    return src ? <img src={src} alt="sp" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4 }} /> : <FileTextOutlined style={{ color: '#ccc' }} />;
                                                }
                                            },
                                            {
                                                title: 'Mã (SKU)', dataIndex: ['product', 'sku'], width: 130,
                                                render: (sku: string) => <b>{sku}</b>
                                            },
                                            {
                                                title: 'Tên Sản Phẩm', dataIndex: ['product', 'name']
                                            },
                                            {
                                                title: 'Phân loại', dataIndex: ['product', 'category_id'], width: 140,
                                                render: (catId: number) => <Tag color="blue">{getCategoryName(catId)}</Tag>
                                            },
                                            {
                                                title: 'Giá bán', dataIndex: ['product', 'base_price'], width: 105, align: 'right' as const,
                                                render: (v: number) => <span style={{ color: 'green', fontWeight: 'bold' }}>{Number(v || 0).toLocaleString()} ₫</span>
                                            },
                                            {
                                                title: 'Tồn kho', dataIndex: ['product', 'quantity_in_stock'], width: 85, align: 'right' as const,
                                                render: (v: number) => Number(v || 0).toLocaleString()
                                            },
                                            {
                                                title: 'Độ giống', dataIndex: 'similarity', width: 95, align: 'center' as const,
                                                render: (sim: number) => (
                                                    <Tag color={sim >= 0.8 ? 'red' : sim >= 0.6 ? 'orange' : 'cyan'} style={{ fontWeight: 'bold' }}>
                                                        {(sim * 100).toFixed(0)}%
                                                    </Tag>
                                                )
                                            },
                                            {
                                                title: 'Thao tác', key: 'action', width: 85, align: 'center' as const,
                                                render: (_: any, m: any) => (
                                                    <Button
                                                        size="small"
                                                        icon={<EditOutlined />}
                                                        onClick={() => {
                                                            setSimilarModalTarget(null);
                                                            openEdit(m.product);
                                                        }}
                                                    >
                                                        Sửa
                                                    </Button>
                                                )
                                            }
                                        ]}
                                    />
                                </>
                            );
                        })()}
                    </div>
                )}
            </Modal>
        </Card>
    );
};
export default ProductsPage;