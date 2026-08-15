import React, { useEffect, useState } from 'react';
import useMobile from '../hooks/useMobile';
import usePermission from '../hooks/usePermission';
import {
    Card, Row, Col, Statistic, Table, Button, Tabs, Modal, Form,
    Input, Select, DatePicker, Tag, message, Popconfirm,
    Radio, InputNumber, Space, Segmented, Divider, Tooltip, Typography, Descriptions, Badge, Collapse
} from 'antd';
import { Pie, Column } from '@ant-design/plots';
import {
    WalletOutlined, ArrowUpOutlined, ArrowDownOutlined,
    PlusOutlined, DeleteOutlined, BankOutlined,
    FileTextOutlined, PieChartOutlined, ReloadOutlined, EditOutlined, CloseOutlined, SearchOutlined,
    LineChartOutlined, EyeOutlined, DollarOutlined, SwapOutlined,
    CheckCircleOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../utils/api';
import CashFlowDashboard from '../components/finance/CashFlowDashboard';

const { Option } = Select;

// Helper function to check permissions
const hasPerm = (moduleCode: string) => {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    if (user?.username === 'admin') return true;
    const permissions = user?.permissions || [];
    const p = permissions.find((perm: any) => perm.module_code === moduleCode);
    return !!(p && (p.can_view === true || p.can_view === 1));
};

const FinancePage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const isMobile = useMobile();
    const { canCreate, canUpdate, canDelete } = usePermission('FINANCE');
    const [transactions, setTransactions] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]); // <--- New State
    const [suppliers, setSuppliers] = useState<any[]>([]); // <--- New State
    const [projects, setProjects] = useState<any[]>([]); 
    const [salesOrders, setSalesOrders] = useState<any[]>([]); 
    const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });

    // UI State
    const [isTransModalOpen, setIsTransModalOpen] = useState(false);
    // isCatModalOpen không còn dùng vì Form nằm trên trang, ta dùng editingCategory để control
    const [editingCategory, setEditingCategory] = useState<any>(null); // <--- MỚI: Lưu danh mục đang sửa
    const [editingTransaction, setEditingTransaction] = useState<any>(null); // <--- State for editing transaction

    const [activeTab, setActiveTab] = useState('1');
    const [filterMonth, setFilterMonth] = useState(dayjs());
    const [pageSize, setPageSize] = useState<number>(10); // <--- State for Page Size

    const [formTrans] = Form.useForm();
    const [formCat] = Form.useForm();

    const currentTransType = Form.useWatch('type', formTrans);
    const isRetail = Form.useWatch('is_retail', formTrans); // <--- Watch checkbox Income
    const isOtherExpense = Form.useWatch('is_other_expense', formTrans); // <--- Watch checkbox Expense
    const selectedProjectId = Form.useWatch('project_id', formTrans);

    // --- REPORT STATE ---
    const [reportData, setReportData] = useState<any>({ transactions: [], summary: { income: 0, expense: 0, profit: 0 } });
    const [reportType, setReportType] = useState<'MONTH' | 'YEAR'>('MONTH');
    const [reportFilter, setReportFilter] = useState(dayjs());
    const [isAccountingModalOpen, setIsAccountingModalOpen] = useState(false);
    const [accountingTrans, setAccountingTrans] = useState<any>(null);
    const [formAccounting] = Form.useForm();
    const [soProfitData, setSoProfitData] = useState<any[]>([]);
    const [selectedTransaction, setSelectedTransaction] = useState<any>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const monthStr = filterMonth.format('YYYY-MM');
            const [resTrans, resCat, resSum, resCust, resSup, resProj, resSO] = await Promise.all([
                api.get(`/finance/transactions?month=${monthStr}`),
                api.get(`/finance/categories`),
                api.get(`/finance/summary`),
                api.get(`/customers`), // <--- Fetch Customers
                api.get(`/suppliers`),  // <--- Fetch Suppliers
                api.get(`/projects`),
                api.get(`/sales`)
            ]);
            setTransactions(Array.isArray(resTrans.data) ? resTrans.data : []);
            setCategories(Array.isArray(resCat.data) ? resCat.data : []);
            setSummary(resSum.data || { income: 0, expense: 0, balance: 0 });
            setCustomers(Array.isArray(resCust.data) ? resCust.data : []);
            setSuppliers(Array.isArray(resSup.data) ? resSup.data : []);
            setProjects(Array.isArray(resProj.data) ? resProj.data : []);
            setSalesOrders(Array.isArray(resSO.data) ? resSO.data : []);
        } catch (e) { message.error('Lỗi tải dữ liệu'); }
        setLoading(false);
    };

    const fetchReport = async () => {
        try {
            let query = '';
            if (reportType === 'MONTH') query = `month=${reportFilter.format('YYYY-MM')}`;
            if (reportType === 'YEAR') query = `year=${reportFilter.format('YYYY')}`;

            const res = await api.get(`/finance/report?${query}`);
            setReportData(res.data || { transactions: [], summary: { income: 0, expense: 0, profit: 0 } });
        } catch (e) { message.error('Lỗi tải báo cáo'); }
    }

    const fetchSOProfit = async () => {
        setLoading(true);
        try {
            const monthStr = filterMonth ? filterMonth.format('YYYY-MM') : '';
            const res = await api.get(`/finance/so-profit?month=${monthStr}`);
            setSoProfitData(Array.isArray(res.data) ? res.data : []);
        } catch(e) { message.error('Lỗi tải lợi nhuận SO'); }
        setLoading(false);
    }

    useEffect(() => { fetchData(); }, [filterMonth]);
    useEffect(() => { if (activeTab === 'REPORT') fetchReport(); }, [activeTab, reportType, reportFilter]);
    useEffect(() => { if (activeTab === 'SO_PROFIT') fetchSOProfit(); }, [activeTab, filterMonth]);

    // --- ACTIONS ---
    const handleSaveTrans = async (values: any) => {
        try {
            // Logic xử lý tên đối tác
            let finalPartnerName = values.partner_name;

            // Nếu là Thu + Chọn khách hàng (không phải khách lẻ)
            if (values.type === 'INCOME' && !values.is_retail && values.customer_id) {
                const cust = customers.find(c => c.id === values.customer_id);
                if (cust) finalPartnerName = cust.name;
            }

            // Nếu là Chi + Chọn NCC (không phải chi khác)
            if (values.type === 'EXPENSE' && !values.is_other_expense && values.supplier_id) {
                const sup = suppliers.find(s => s.id === values.supplier_id);
                if (sup) finalPartnerName = sup.name;
            }

            // Clean Payload: Remove UI-only fields and customer_id (not in entity)
            const { is_retail, is_other_expense, customer_id, ...restValues } = values;

            const payload = {
                ...restValues,
                reference_code: Array.isArray(values.reference_code) ? values.reference_code.join(', ') : values.reference_code,
                date: values.date.format('YYYY-MM-DD'),
                type: values.type,
                partner_name: finalPartnerName, // Override partner_name
                // customer_id removed
            };

            if (editingTransaction) {
                await api.put(`/finance/transactions/${editingTransaction.id}`, payload);
                message.success('Cập nhật thành công');
            } else {
                await api.post(`/finance/transactions`, payload);
                message.success('Đã lưu giao dịch');
            }

            setIsTransModalOpen(false);
            setEditingTransaction(null);
            formTrans.resetFields();
            fetchData();
        } catch (e) { message.error('Lỗi lưu'); }
    };

    const handleEditTransaction = (record: any) => {
        setEditingTransaction(record);

        // Try to find customer by name if no ID (Entity lacks customer_id)
        let custId = record.customer_id || record.customer?.id;
        if (!custId && record.type === 'INCOME' && record.partner_name) {
            const found = customers.find(c => c.name === record.partner_name);
            if (found) custId = found.id;
        }

        const supId = record.supplier_id || record.supplier?.id;
        const catId = record.category_id || record.category?.id;

        formTrans.setFieldsValue({
            ...record,
            date: dayjs(record.date),
            category_id: catId,
            customer_id: custId,
            supplier_id: supId,
            is_retail: !custId && record.type === 'INCOME',
            is_other_expense: !supId && record.type === 'EXPENSE'
        });
        setIsTransModalOpen(true);
    };

    // --- MỚI: LOGIC LƯU DANH MỤC (TẠO MỚI HOẶC CẬP NHẬT) ---
    const handleSaveCat = async (values: any) => {
        try {
            if (editingCategory) {
                // Update
                await api.put(`/finance/categories/${editingCategory.id}`, values);
                message.success('Cập nhật danh mục thành công');
                setEditingCategory(null); // Reset mode
            } else {
                // Create
                await api.post(`/finance/categories`, values);
                message.success('Đã thêm danh mục mới');
            }
            formCat.resetFields();
            fetchData();
        } catch (e) { message.error('Lỗi lưu danh mục'); }
    };

    const handleEditCat = (record: any) => {
        setEditingCategory(record);
        formCat.setFieldsValue(record); // Điền dữ liệu vào form bên phải
    };

    const handleCancelEdit = () => {
        setEditingCategory(null);
        formCat.resetFields();
    };

    const handleOpenAccounting = (record: any) => {
        setAccountingTrans(record);
        formAccounting.setFieldsValue({
            is_accounting: record.is_accounting || true, // Default checked
            accounting_invoice_code: record.accounting_invoice_code,
            accounting_note: record.accounting_note
        });
        setIsAccountingModalOpen(true);
    };

    const handleSaveAccounting = async (values: any) => {
        try {
            await api.put(`/finance/transactions/${accountingTrans.id}`, values);
            message.success('Đã hạch toán');
            setIsAccountingModalOpen(false);
            fetchData(); // Refresh list
        } catch (e) { message.error('Lỗi hạch toán'); }
    };
    // -------------------------------------------------------

    const handleDelete = async (endpoint: string, id: number) => {
        try { await api.delete(`/finance/${endpoint}/${id}`); message.success('Đã xóa'); fetchData(); }
        catch (e) { message.error('Không thể xóa (có thể đang có dữ liệu liên quan)'); }
    };

    // --- COMPONENTS ---
    const columnsTrans = (type: 'INCOME' | 'EXPENSE') => [
        { title: 'Ngày', dataIndex: 'date', render: (t: any) => dayjs(t).format('DD/MM/YYYY') },
        {
            title: 'Danh mục', dataIndex: 'category',
            render: (c: any) => c ? <Tag color={c.color || 'default'}>{c.name}</Tag> : <span style={{ color: '#999' }}>Khác</span>
        },
        { title: 'Diễn giải', dataIndex: 'description' },
        { title: 'Khách hàng / NCC', dataIndex: 'partner_name', render: (t: any) => t ? <b>{t}</b> : '-' },
        { title: 'Mã tham chiếu', dataIndex: 'reference_code', render: (t: any) => t ? <Tag color="blue">{t}</Tag> : '-' },
        {
            title: 'Số tiền', dataIndex: 'amount', align: 'right' as const,
            render: (v: any, r: any) => <b style={{ color: r.type === 'INCOME' ? 'green' : 'red' }}>{r.type === 'INCOME' ? '+' : '-'}{Number(v).toLocaleString()}</b>
        },
        {
            title: 'Hạch Toán', align: 'center' as const,
            render: (_: any, r: any) => r.is_accounting
                ? <Tag color="blue" icon={<FileTextOutlined />}>Đã HT</Tag>
                : <Button size="small" icon={<FileTextOutlined />} onClick={() => handleOpenAccounting(r)}>Hạch toán</Button>
        },
        {
            title: '', key: 'act', width: 50,
            render: (_: any, r: any) => (
                <Space>
                    {canUpdate && <Button size="small" icon={<EditOutlined style={{ color: 'orange' }} />} onClick={() => handleEditTransaction(r)} />}
                    {canUpdate && <Button size="small" icon={<FileTextOutlined />} onClick={() => handleOpenAccounting(r)} />}
                    {canDelete && <Popconfirm title="Xóa?" onConfirm={() => handleDelete('transactions', r.id)}><Button size="small" danger icon={<DeleteOutlined />} type="text" /></Popconfirm>}
                </Space>
            )
        }
    ];

    const columnsReport = [
        { title: 'Ngày', dataIndex: 'date', render: (t: any) => dayjs(t).format('DD/MM/YYYY') },
        { title: 'Loại', dataIndex: 'type', render: (t: string) => t === 'INCOME' ? <Tag color="green">Thu</Tag> : <Tag color="red">Chi</Tag> },
        { title: 'Số Hóa Đơn', dataIndex: 'accounting_invoice_code', render: (t: any) => t ? <b>{t}</b> : '-' },
        { title: 'Diễn giải', dataIndex: 'description' },
        { title: 'Ghi chú', dataIndex: 'accounting_note' },
        { title: 'Số tiền', dataIndex: 'amount', align: 'right' as const, render: (v: any) => <b>{Number(v).toLocaleString()}</b> },
    ];

    const soStatusMap: any = {
        SO_PENDING: { color: 'blue', label: 'Chờ xác nhận' },
        SAMPLE_APPROVED: { color: 'cyan', label: 'Duyệt mẫu' },
        DEPOSITED: { color: 'gold', label: 'Đã cọc' },
        IN_PRODUCTION: { color: 'orange', label: 'Đang SX' },
        PLANNED: { color: 'purple', label: 'Đã lên KH' },
        PARTIAL_DELIVERY: { color: 'geekblue', label: 'Giao 1 phần' },
        DELIVERED: { color: 'lime', label: 'Đã giao' },
        COMPLETED: { color: 'green', label: 'Hoàn thành' },
    };

    const columnsSOProfit = [
        { title: 'Mã SO', dataIndex: 'order_code', width: 130,
            render: (t: any, r: any) => <a href={`/orders?order=${r.id}`} style={{ fontWeight: 700 }}>{t}</a>
        },
        { title: 'Khách hàng', dataIndex: 'customer_name', width: 220, ellipsis: true,
            render: (t: any) => t ? <span style={{ fontWeight: 500 }}>{t}</span> : <span style={{ color: '#bbb', fontStyle: 'italic' }}>Chưa có</span>
        },
        { title: 'Trạng thái', dataIndex: 'status', width: 120,
            render: (t: any) => { const s = soStatusMap[t] || { color: 'default', label: t }; return <Tag color={s.color}>{s.label}</Tag>; }
        },
        { title: 'Giá trị ĐH', dataIndex: 'total_amount', align: 'right' as const, width: 130,
            render: (v: any) => <span style={{ fontWeight: 600 }}>{Number(v).toLocaleString()}</span>
        },
        { title: <span style={{ color: '#389e0d' }}>Thực thu</span>, dataIndex: 'real_income', align: 'right' as const, width: 130,
            render: (v: any) => <b style={{ color: '#389e0d' }}>{Number(v).toLocaleString()}</b>
        },
        { title: <span style={{ color: '#fa8c16' }}>Tổng Chi Dự Kiến</span>, dataIndex: 'expected_cost', align: 'right' as const, width: 140,
            render: (_: any, r: any) => {
                const total = Number(r.expected_bom_cost||0) + Number(r.expected_stock_cost||0) + Number(r.expected_routing_cost||0) + Number(r.expected_logistic_cost||0);
                return (
                    <Tooltip color="#fff" title={
                        <div style={{ color: '#333', fontSize: 13, minWidth: 150 }}>
                            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Chi tiết dự kiến:</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#888' }}>- NPL:</span> <b style={{ color: '#fa8c16' }}>{Number(r.expected_bom_cost || 0).toLocaleString()}</b></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#888' }}>- Hàng có sẵn:</span> <b style={{ color: '#fa8c16' }}>{Number(r.expected_stock_cost || 0).toLocaleString()}</b></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#888' }}>- Gia công:</span> <b style={{ color: '#fa8c16' }}>{Number(r.expected_routing_cost || 0).toLocaleString()}</b></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#888' }}>- Logistics:</span> <b style={{ color: '#fa8c16' }}>{Number(r.expected_logistic_cost || 0).toLocaleString()}</b></div>
                        </div>
                    }>
                        <b style={{ color: '#fa8c16', cursor: 'help' }}>{total.toLocaleString()}</b>
                    </Tooltip>
                );
            }
        },
        { title: <span style={{ color: '#cf1322' }}>Thực chi</span>, dataIndex: 'real_expense', align: 'right' as const, width: 130,
            render: (v: any) => <b style={{ color: '#cf1322' }}>{Number(v).toLocaleString()}</b>
        },
        { title: 'LN Dự kiến', dataIndex: 'expected_profit', align: 'right' as const, width: 120,
            render: (v: any) => <b style={{ color: Number(v) >= 0 ? '#389e0d' : '#cf1322', fontSize: 14 }}>{Number(v).toLocaleString()}</b>
        },
        { title: 'LN Thực tế', dataIndex: 'profit', align: 'right' as const, width: 120,
            render: (v: any) => <b style={{ color: Number(v) >= 0 ? '#389e0d' : '#cf1322', fontSize: 14 }}>{Number(v).toLocaleString()}</b>
        },
        { title: <Tooltip title="Biên LN = Lợi nhuận / Thực thu × 100">Biên LN (%)</Tooltip>, dataIndex: 'margin', align: 'right' as const, width: 100,
            render: (v: any, r: any) => {
                const val = Number(v);
                if (Number(r.real_income) === 0) return <span style={{ color: '#bbb' }}>N/A</span>;
                return <b style={{ color: val >= 20 ? '#389e0d' : val >= 0 ? '#d48806' : '#cf1322' }}>{val.toFixed(1)}%</b>;
            }
        },
    ];

    // Columns cho bảng chi tiết Thu/Chi trong expandable row
    const columnsTransDetail = [
        { title: 'Ngày', dataIndex: 'date', width: 100, render: (t: any) => dayjs(t).format('DD/MM/YYYY') },
        { title: 'Mã GD', dataIndex: 'id', width: 70, render: (v: any) => <span style={{ color: '#888' }}>#{v}</span> },
        { title: 'Diễn giải', dataIndex: 'description', ellipsis: true, render: (t: any) => t || <span style={{ color: '#bbb' }}>—</span> },
        { title: 'Danh mục', dataIndex: 'category_name', width: 120,
            render: (t: any, r: any) => t ? <Tag color={r.category_color || 'default'}>{t}</Tag> : <span style={{ color: '#bbb' }}>—</span>
        },
        { title: 'Đối tác', dataIndex: 'partner_name', width: 140, ellipsis: true },
        { title: 'Tổng phiếu', dataIndex: 'amount', align: 'right' as const, width: 120,
            render: (v: any) => <span style={{ color: '#888' }}>{Number(v).toLocaleString()}</span>
        },
        { title: 'Phân bổ SO', dataIndex: 'allocated_amount', align: 'right' as const, width: 120,
            render: (v: any, r: any) => <b style={{ color: r.type === 'INCOME' ? '#389e0d' : '#cf1322' }}>{Number(v).toLocaleString()}</b>
        },
        { title: '', key: 'action', width: 50, align: 'center' as const,
            render: (_: any, r: any) => (
                <Tooltip title="Xem chi tiết phiếu">
                    <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setSelectedTransaction(r)} />
                </Tooltip>
            )
        },
    ];

    const columnsCat = [
        { title: 'Tên danh mục', dataIndex: 'name', render: (t: any, r: any) => <Tag color={r.color}>{t}</Tag> },
        { title: 'Loại', dataIndex: 'type', render: (t: string) => t === 'INCOME' ? <Tag color="green">Khoản Thu</Tag> : <Tag color="red">Khoản Chi</Tag> },
        { title: 'Mô tả', dataIndex: 'description' },
        {
            title: '', key: 'act', align: 'right' as const,
            render: (_: any, r: any) => (
                <Space>
                    {/* Nút Edit */}
                    {canUpdate && <Button size="small" icon={<EditOutlined />} onClick={() => handleEditCat(r)} />}
                    {/* Nút Delete */}
                    {canDelete && <Popconfirm title="Xóa?" onConfirm={() => handleDelete('categories', r.id)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>}
                </Space>
            )
        }
    ];

    // --- FILTER ---
    const [searchText, setSearchText] = useState('');

    const filteredTransactions = transactions.filter(t => {
        if (!searchText) return true;
        const s = searchText.toLowerCase();
        return (
            t.description?.toLowerCase().includes(s) ||
            t.partner_name?.toLowerCase().includes(s) ||
            t.reference_code?.toLowerCase().includes(s) ||
            t.category?.name?.toLowerCase().includes(s)
        );
    });

    const filteredSOProfitData = soProfitData.filter(so => {
        if (!searchText) return true;
        const s = searchText.toLowerCase();
        return (
            so.order_code?.toLowerCase().includes(s) ||
            so.customer_name?.toLowerCase().includes(s)
        );
    });

    return (
        <div style={{ paddingBottom: 20 }}>
            {/* TOP CARDS - HORIZONTAL SCROLL ON MOBILE */}
            <div style={{ overflowX: isMobile ? 'auto' : 'visible', marginBottom: 16 }}>
                <Row gutter={[isMobile ? 8 : 16, 8]} wrap={!isMobile} style={{ flexWrap: isMobile ? 'nowrap' : 'wrap', minWidth: isMobile ? 500 : 'auto' }}>
                    <Col flex={isMobile ? '160px' : 1}>
                        <Card bordered={false} bodyStyle={{ padding: isMobile ? 10 : 20 }} style={{ background: 'linear-gradient(135deg, #3f8600 0%, #52c41a 100%)' }}>
                            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.8)', fontSize: isMobile ? 12 : 14 }}>Tổng Thu</span>} value={summary.income} precision={0} valueStyle={{ color: '#fff', fontWeight: 'bold', fontSize: isMobile ? 16 : 24 }} prefix={<ArrowUpOutlined />} />
                        </Card>
                    </Col>
                    <Col flex={isMobile ? '160px' : 1}>
                        <Card bordered={false} bodyStyle={{ padding: isMobile ? 10 : 20 }} style={{ background: 'linear-gradient(135deg, #cf1322 0%, #ff4d4f 100%)' }}>
                            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.8)', fontSize: isMobile ? 12 : 14 }}>Tổng Chi</span>} value={summary.expense} precision={0} valueStyle={{ color: '#fff', fontWeight: 'bold', fontSize: isMobile ? 16 : 24 }} prefix={<ArrowDownOutlined />} />
                        </Card>
                    </Col>
                    <Col flex={isMobile ? '160px' : 1}>
                        <Card bordered={false} bodyStyle={{ padding: isMobile ? 10 : 20 }} style={{ background: 'linear-gradient(135deg, #096dd9 0%, #1890ff 100%)' }}>
                            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.8)', fontSize: isMobile ? 12 : 14 }}>Quỹ TM</span>} value={summary.balance} precision={0} valueStyle={{ color: '#fff', fontWeight: 'bold', fontSize: isMobile ? 16 : 24 }} prefix={<BankOutlined />} />
                        </Card>
                    </Col>
                </Row>
            </div>

            <Card
                bodyStyle={{ padding: isMobile ? '8px 12px' : undefined }}
                title={<span style={{ fontSize: isMobile ? 14 : 16 }}><WalletOutlined /> Tài Chính</span>}
                extra={
                    isMobile ? (
                        <Space size={4}>
                            <DatePicker picker="month" value={filterMonth} onChange={v => v && setFilterMonth(v)} allowClear={false} style={{ width: 100 }} />
                            <Button icon={<ReloadOutlined />} onClick={fetchData} />
                        </Space>
                    ) : (
                        <div style={{ display: 'flex', gap: 10 }}>
                            {activeTab !== 'REPORT' && (
                                <>
                                    <Input prefix={<SearchOutlined />} placeholder="Tìm kiếm..." value={searchText} onChange={e => setSearchText(e.target.value)} style={{ width: 200 }} allowClear />
                                    <DatePicker picker="month" value={filterMonth} onChange={v => v && setFilterMonth(v)} allowClear={false} />
                                </>
                            )}
                            <Select
                                value={pageSize}
                                style={{ width: 110 }}
                                onChange={(v) => setPageSize(v)}
                                options={[
                                    { value: 10, label: '10 dòng' },
                                    { value: 20, label: '20 dòng' },
                                    { value: 50, label: '50 dòng' },
                                    { value: 100, label: '100 dòng' },
                                    { value: 999999, label: 'Tất cả' },
                                ]}
                            />
                            <Button icon={<ReloadOutlined />} onClick={fetchData} />
                        </div>
                    )
                }
            >
                <Tabs activeKey={activeTab} onChange={setActiveTab} type="card" items={[
                    {
                        key: 'INCOME',
                        label: <span><ArrowUpOutlined /> Thu</span>,
                        children: (
                            <>
                                <div style={{ marginBottom: 16, textAlign: 'right' }}>
                                    {canCreate && <Button type="primary" icon={<PlusOutlined />} onClick={() => { formTrans.resetFields(); formTrans.setFieldsValue({ type: 'INCOME' }); setIsTransModalOpen(true) }}>Tạo Phiếu Thu</Button>}
                                </div>
                                <Table
                                    dataSource={filteredTransactions.filter(t => t.type === 'INCOME')}
                                    columns={columnsTrans('INCOME')}
                                    rowKey="id" loading={loading}
                                    pagination={pageSize >= 999999 ? false : { pageSize: pageSize, showSizeChanger: false }}
                                />
                            </>
                        )
                    },
                    {
                        key: 'EXPENSE',
                        label: <span><ArrowDownOutlined /> Chi</span>,
                        children: (
                            <>
                                <div style={{ marginBottom: 16, textAlign: 'right' }}>
                                    {canCreate && <Button type="primary" danger icon={<PlusOutlined />} onClick={() => { formTrans.resetFields(); formTrans.setFieldsValue({ type: 'EXPENSE' }); setIsTransModalOpen(true) }}>Tạo Phiếu Chi</Button>}
                                </div>
                                <Table
                                    dataSource={filteredTransactions.filter(t => t.type === 'EXPENSE')}
                                    columns={columnsTrans('EXPENSE')}
                                    rowKey="id" loading={loading}
                                    pagination={pageSize >= 999999 ? false : { pageSize: pageSize, showSizeChanger: false }}
                                />
                            </>
                        )
                    },
                    {
                        key: 'REPORT',
                        label: <span><PieChartOutlined /> Báo Cáo & Thống Kê</span>,
                        children: (
                            <div style={{ padding: 10 }}>
                                {/* TOOLBAR */}
                                <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '12px 20px', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                                    <Space size="large">
                                        <div>
                                            <span style={{ marginRight: 8, fontWeight: 500 }}>Xem theo:</span>
                                            <Segmented options={[{ label: 'Tháng', value: 'MONTH' }, { label: 'Năm', value: 'YEAR' }]} value={reportType} onChange={(v: any) => setReportType(v)} />
                                        </div>
                                        <DatePicker
                                            picker={reportType === 'MONTH' ? 'month' : 'year'}
                                            value={reportFilter}
                                            onChange={v => v && setReportFilter(v)}
                                            allowClear={false}
                                            style={{ minWidth: 120 }}
                                        />
                                        <Button type="primary" onClick={fetchReport} icon={<ReloadOutlined />}>Tải dữ liệu</Button>
                                    </Space>
                                    <Button disabled>Xuất Excel</Button>
                                </div>

                                {/* SUMMARY CARDS */}
                                <Row gutter={24} style={{ marginBottom: 24 }}>
                                    <Col span={8}>
                                        <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(63, 134, 0, 0.1)' }}>
                                            <Statistic
                                                title={<span style={{ fontWeight: 600, color: '#555' }}>Tổng Thu (Hạch toán)</span>}
                                                value={reportData.summary.income}
                                                precision={0}
                                                valueStyle={{ color: '#3f8600', fontWeight: 'bold', fontSize: 24 }}
                                                prefix={<ArrowUpOutlined />}
                                            />
                                        </Card>
                                    </Col>
                                    <Col span={8}>
                                        <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(207, 19, 34, 0.1)' }}>
                                            <Statistic
                                                title={<span style={{ fontWeight: 600, color: '#555' }}>Tổng Chi (Hạch toán)</span>}
                                                value={reportData.summary.expense}
                                                precision={0}
                                                valueStyle={{ color: '#cf1322', fontWeight: 'bold', fontSize: 24 }}
                                                prefix={<ArrowDownOutlined />}
                                            />
                                        </Card>
                                    </Col>
                                    <Col span={8}>
                                        <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(24, 144, 255, 0.1)' }}>
                                            <Statistic
                                                title={<span style={{ fontWeight: 600, color: '#555' }}>Lợi Nhuận Thuần</span>}
                                                value={reportData.summary.profit}
                                                precision={0}
                                                valueStyle={{ color: reportData.summary.profit >= 0 ? '#3f8600' : '#cf1322', fontWeight: 'bold', fontSize: 24 }}
                                                prefix={<WalletOutlined />}
                                            />
                                        </Card>
                                    </Col>
                                </Row>

                                {/* CHARTS SECTION */}
                                <Row gutter={24} style={{ marginBottom: 24 }}>
                                    {reportType === 'MONTH' ? (
                                        <>
                                            <Col span={12}>
                                                <Card title="Cơ cấu Khoản Thu (Theo Danh mục)" bordered={false} style={{ borderRadius: 12 }}>
                                                    <Pie
                                                        data={reportData.transactions.filter((t: any) => t.type === 'INCOME').reduce((acc: any[], t: any) => {
                                                            const cat = t.category?.name || 'Khác';
                                                            const existing = acc.find(i => i.type === cat);
                                                            if (existing) existing.value += Number(t.amount);
                                                            else acc.push({ type: cat, value: Number(t.amount) });
                                                            return acc;
                                                        }, [])}
                                                        angleField="value"
                                                        colorField="type"
                                                        radius={0.8}
                                                        innerRadius={0.6}
                                                        label={{ text: 'value', style: { fontWeight: 'bold' } }}
                                                        legend={{ position: 'bottom' }}
                                                        height={300}
                                                    />
                                                </Card>
                                            </Col>
                                            <Col span={12}>
                                                <Card title="Cơ cấu Khoản Chi (Theo Danh mục)" bordered={false} style={{ borderRadius: 12 }}>
                                                    <Pie
                                                        data={reportData.transactions.filter((t: any) => t.type === 'EXPENSE').reduce((acc: any[], t: any) => {
                                                            const cat = t.category?.name || 'Khác';
                                                            const existing = acc.find(i => i.type === cat);
                                                            if (existing) existing.value += Number(t.amount);
                                                            else acc.push({ type: cat, value: Number(t.amount) });
                                                            return acc;
                                                        }, [])}
                                                        angleField="value"
                                                        colorField="type"
                                                        radius={0.8}
                                                        innerRadius={0.6}
                                                        label={{ text: 'value', style: { fontWeight: 'bold' } }}
                                                        legend={{ position: 'bottom' }}
                                                        height={300}
                                                    />
                                                </Card>
                                            </Col>
                                        </>
                                    ) : (
                                        <Col span={24}>
                                            <Card title="Biểu đồ Thu / Chi theo Tháng" bordered={false} style={{ borderRadius: 12 }}>
                                                <Column
                                                    data={reportData.transactions.reduce((acc: any[], t: any) => {
                                                        const month = dayjs(t.date).format('MM/YYYY');
                                                        const type = t.type === 'INCOME' ? 'Thu' : 'Chi';

                                                        // Chart expects array of objects
                                                        // We need robust aggregations here.
                                                        // But wait, reportData.transactions contains ALL transactions for the selected YEAR.

                                                        const existing = acc.find(i => i.month === month && i.type === type);
                                                        if (existing) existing.value += Number(t.amount);
                                                        else acc.push({ month, type, value: Number(t.amount) });
                                                        return acc;
                                                    }, []).sort((a: any, b: any) => {
                                                        // Sort by month
                                                        const [m1] = a.month.split('/');
                                                        const [m2] = b.month.split('/');
                                                        return Number(m1) - Number(m2);
                                                    })}
                                                    xField="month"
                                                    yField="value"
                                                    colorField="type"
                                                    group={true}
                                                    columnWidthRatio={0.6}
                                                    color={({ type }: any) => type === 'Thu' ? '#52c41a' : '#f5222d'}
                                                    height={350}
                                                />
                                            </Card>
                                        </Col>
                                    )}
                                </Row>

                                <Divider orientation="left">Chi tiết Giao dịch</Divider>

                                <Table
                                    dataSource={reportData.transactions}
                                    columns={columnsReport}
                                    rowKey="id"
                                    pagination={pageSize >= 999999 ? false : { pageSize: pageSize, showSizeChanger: false }}
                                    summary={() => (
                                        <Table.Summary fixed>
                                            <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 'bold' }}>
                                                <Table.Summary.Cell index={0} colSpan={5}>Tổng Cộng (Lợi nhuận HT)</Table.Summary.Cell>
                                                <Table.Summary.Cell index={1} align="right">
                                                    <span style={{ color: reportData.summary.profit >= 0 ? 'green' : 'red', fontSize: 16 }}>
                                                        {Number(reportData.summary.profit).toLocaleString()}
                                                    </span>
                                                </Table.Summary.Cell>
                                            </Table.Summary.Row>
                                        </Table.Summary>
                                    )}
                                />
                            </div>
                        )
                    },
                    {
                        key: 'CATEGORIES',
                        label: <span><FileTextOutlined /> Danh Mục</span>,
                        children: (
                            <Row gutter={24}>
                                <Col span={16}>
                                    <Table dataSource={categories} columns={columnsCat} rowKey="id" pagination={false} size="small" />
                                </Col>
                                <Col span={8}>
                                    <Card
                                        title={editingCategory ? "Cập nhật Danh mục" : "Thêm Danh mục mới"}
                                        size="small"
                                        style={{ background: editingCategory ? '#fffbe6' : '#f9f9f9', borderColor: editingCategory ? '#ffe58f' : '#f0f0f0' }}
                                        extra={editingCategory && <Button size="small" type="text" danger icon={<CloseOutlined />} onClick={handleCancelEdit}>Hủy</Button>}
                                    >
                                        <Form form={formCat} layout="vertical" onFinish={handleSaveCat}>
                                            <Form.Item name="name" label="Tên danh mục" rules={[{ required: true }]}><Input placeholder="Vd: Tiền điện, Tiếp khách..." /></Form.Item>
                                            <Form.Item name="type" label="Loại" initialValue="EXPENSE"><Radio.Group options={[{ label: 'Thu', value: 'INCOME' }, { label: 'Chi', value: 'EXPENSE' }]} optionType="button" buttonStyle="solid" /></Form.Item>
                                            <Form.Item name="color" label="Màu nhãn"><Input type="color" style={{ width: 50, padding: 0, border: 'none' }} /></Form.Item>
                                            <Form.Item name="description" label="Mô tả"><Input.TextArea rows={2} /></Form.Item>
                                            <Button type="primary" htmlType="submit" block icon={editingCategory ? <EditOutlined /> : <PlusOutlined />}>
                                                {editingCategory ? "Lưu thay đổi" : "Thêm Danh mục"}
                                            </Button>
                                        </Form>
                                    </Card>
                                </Col>
                            </Row>
                        )
                    },
                    {
                        key: 'SO_PROFIT',
                        label: <span><LineChartOutlined /> Lợi Nhuận SO</span>,
                        children: (
                            <div style={{ padding: 10 }}>
                                {/* Summary Cards */}
                                <Row gutter={16} style={{ marginBottom: 16 }}>
                                    <Col span={6}>
                                        <Card size="small" bordered={false} style={{ background: 'linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%)', borderRadius: 10 }}>
                                            <Statistic title={<span style={{ color: '#389e0d', fontWeight: 600, fontSize: 12 }}>Tổng Thực Thu</span>}
                                                value={filteredSOProfitData.reduce((s, r) => s + Number(r.real_income || 0), 0)}
                                                precision={0} valueStyle={{ color: '#389e0d', fontWeight: 'bold', fontSize: 20 }}
                                                prefix={<ArrowUpOutlined />} />
                                        </Card>
                                    </Col>
                                    <Col span={6}>
                                        <Card size="small" bordered={false} style={{ background: 'linear-gradient(135deg, #fff1f0 0%, #ffa39e 100%)', borderRadius: 10 }}>
                                            <Statistic title={<span style={{ color: '#cf1322', fontWeight: 600, fontSize: 12 }}>Tổng Thực Chi</span>}
                                                value={filteredSOProfitData.reduce((s, r) => s + Number(r.real_expense || 0), 0)}
                                                precision={0} valueStyle={{ color: '#cf1322', fontWeight: 'bold', fontSize: 20 }}
                                                prefix={<ArrowDownOutlined />} />
                                        </Card>
                                    </Col>
                                    <Col span={6}>
                                        {(() => { const totalProfit = filteredSOProfitData.reduce((s, r) => s + Number(r.profit || 0), 0); return (
                                        <Card size="small" bordered={false} style={{ background: totalProfit >= 0 ? 'linear-gradient(135deg, #e6f7ff 0%, #91d5ff 100%)' : 'linear-gradient(135deg, #fff2e8 0%, #ffbb96 100%)', borderRadius: 10 }}>
                                            <Statistic title={<span style={{ color: '#1890ff', fontWeight: 600, fontSize: 12 }}>Tổng Lợi Nhuận</span>}
                                                value={totalProfit}
                                                precision={0} valueStyle={{ color: totalProfit >= 0 ? '#1890ff' : '#cf1322', fontWeight: 'bold', fontSize: 20 }}
                                                prefix={<WalletOutlined />} />
                                        </Card>); })()}
                                    </Col>
                                    <Col span={6}>
                                        <Card size="small" bordered={false} style={{ background: 'linear-gradient(135deg, #f9f0ff 0%, #d3adf7 100%)', borderRadius: 10 }}>
                                            <Statistic title={<span style={{ color: '#722ed1', fontWeight: 600, fontSize: 12 }}>Số đơn hàng</span>}
                                                value={filteredSOProfitData.length}
                                                valueStyle={{ color: '#722ed1', fontWeight: 'bold', fontSize: 20 }}
                                                suffix={<span style={{ fontSize: 14 }}>đơn</span>} />
                                        </Card>
                                    </Col>
                                </Row>

                                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
                                    <Button type="primary" onClick={fetchSOProfit} icon={<ReloadOutlined />} loading={loading}>Tải lại dữ liệu</Button>
                                </div>

                                <Table 
                                    dataSource={filteredSOProfitData} 
                                    columns={columnsSOProfit} 
                                    rowKey="id" 
                                    loading={loading}
                                    pagination={pageSize >= 999999 ? false : { pageSize: pageSize, showSizeChanger: false }}
                                    rowClassName={(r: any) => Number(r.profit) < 0 ? 'so-profit-loss-row' : ''}
                                    expandable={{
                                        expandedRowRender: (record: any) => {
                                            const incomes = record.income_transactions || [];
                                            const expenses = record.expense_transactions || [];
                                            return (
                                                <div style={{ padding: '8px 0' }}>
                                                    {/* KHOẢN THU */}
                                                    <div style={{ marginBottom: 16 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                            <Badge status="success" />
                                                            <span style={{ fontWeight: 700, color: '#389e0d', fontSize: 14 }}>KHOẢN THU</span>
                                                            <Tag color="green">{incomes.length} phiếu</Tag>
                                                            <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#389e0d', fontSize: 15 }}>
                                                                ∑ {Number(record.real_income).toLocaleString()} ₫
                                                            </span>
                                                        </div>
                                                        {incomes.length > 0 ? (
                                                            <Table
                                                                dataSource={incomes}
                                                                columns={columnsTransDetail}
                                                                rowKey="id"
                                                                size="small"
                                                                pagination={false}
                                                                style={{ background: '#f6ffed', borderRadius: 8 }}
                                                            />
                                                        ) : (
                                                            <div style={{ padding: '12px 16px', background: '#fafafa', borderRadius: 8, color: '#bbb', fontStyle: 'italic' }}>Chưa có khoản thu nào</div>
                                                        )}
                                                    </div>

                                                    {/* KHOẢN CHI (PHÂN TÍCH CHI PHÍ) */}
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                            <Badge status="error" />
                                                            <span style={{ fontWeight: 700, color: '#cf1322', fontSize: 14 }}>PHÂN TÍCH CHI PHÍ</span>
                                                            <Tag color="red">{expenses.length} phiếu</Tag>
                                                            <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#cf1322', fontSize: 15 }}>
                                                                Thực chi: {Number(record.real_expense).toLocaleString()} ₫
                                                            </span>
                                                        </div>

                                                        <Collapse defaultActiveKey={['1', '2', '3', '4', '5']} bordered={false} style={{ background: '#fff1f0', borderRadius: 8 }}>
                                                            <Collapse.Panel header={
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', paddingRight: 16 }}>
                                                                    <b style={{ color: '#cf1322' }}>1. CP Mua Nguyên Vật Liệu (NPL)</b>
                                                                    <span style={{ color: '#cf1322', fontSize: 13 }}>Dự kiến: <b style={{ color: '#fa8c16' }}>{Number(record.expected_bom_cost).toLocaleString()}</b></span>
                                                                </div>
                                                            } key="1" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                                                {expenses.filter((e:any) => e.expense_group === 'NPL').length > 0 ? (
                                                                    <Table dataSource={expenses.filter((e:any) => e.expense_group === 'NPL')} columns={columnsTransDetail} rowKey="id" size="small" pagination={false} />
                                                                ) : <div style={{ color: '#bbb', fontStyle: 'italic', paddingLeft: 16 }}>Chưa có phiếu chi NPL</div>}
                                                            </Collapse.Panel>

                                                            <Collapse.Panel header={
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', paddingRight: 16 }}>
                                                                    <b style={{ color: '#cf1322' }}>2. CP Hàng Có Sẵn</b>
                                                                    <span style={{ color: '#cf1322', fontSize: 13 }}>Dự kiến: <b style={{ color: '#fa8c16' }}>{Number(record.expected_stock_cost).toLocaleString()}</b></span>
                                                                </div>
                                                            } key="2" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                                                <div style={{ color: '#888', fontStyle: 'italic', padding: '0 16px' }}>Chi phí này tính từ hàng có sẵn trong kho, không phát sinh phiếu chi mới.</div>
                                                            </Collapse.Panel>

                                                            <Collapse.Panel header={
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', paddingRight: 16 }}>
                                                                    <b style={{ color: '#cf1322' }}>3. CP Gia Công</b>
                                                                    <span style={{ color: '#cf1322', fontSize: 13 }}>Dự kiến: <b style={{ color: '#fa8c16' }}>{Number(record.expected_routing_cost).toLocaleString()}</b></span>
                                                                </div>
                                                            } key="3" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                                                {expenses.filter((e:any) => e.expense_group === 'ROUTING').length > 0 ? (
                                                                    <Table dataSource={expenses.filter((e:any) => e.expense_group === 'ROUTING')} columns={columnsTransDetail} rowKey="id" size="small" pagination={false} />
                                                                ) : <div style={{ color: '#bbb', fontStyle: 'italic', paddingLeft: 16 }}>Chưa có phiếu chi Gia công</div>}
                                                            </Collapse.Panel>

                                                            <Collapse.Panel header={
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', paddingRight: 16 }}>
                                                                    <b style={{ color: '#cf1322' }}>4. CP Logistics</b>
                                                                    <span style={{ color: '#cf1322', fontSize: 13 }}>Dự kiến: <b style={{ color: '#fa8c16' }}>{Number(record.expected_logistic_cost).toLocaleString()}</b></span>
                                                                </div>
                                                            } key="4" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                                                {expenses.filter((e:any) => e.expense_group === 'LOGISTIC').length > 0 ? (
                                                                    <Table dataSource={expenses.filter((e:any) => e.expense_group === 'LOGISTIC')} columns={columnsTransDetail} rowKey="id" size="small" pagination={false} />
                                                                ) : <div style={{ color: '#bbb', fontStyle: 'italic', paddingLeft: 16 }}>Chưa có phiếu chi Vận chuyển</div>}
                                                            </Collapse.Panel>

                                                            <Collapse.Panel header={<b style={{ color: '#cf1322' }}>5. CP Khác</b>} key="5">
                                                                {expenses.filter((e:any) => e.expense_group === 'OTHER').length > 0 ? (
                                                                    <Table dataSource={expenses.filter((e:any) => e.expense_group === 'OTHER')} columns={columnsTransDetail} rowKey="id" size="small" pagination={false} />
                                                                ) : <div style={{ color: '#bbb', fontStyle: 'italic', paddingLeft: 16 }}>Chưa có phiếu chi Khác</div>}
                                                            </Collapse.Panel>
                                                        </Collapse>
                                                    </div>
                                                </div>
                                            );
                                        },
                                        rowExpandable: (record: any) => {
                                            const inc = record.income_transactions?.length || 0;
                                            const exp = record.expense_transactions?.length || 0;
                                            return (inc + exp) > 0;
                                        },
                                    }}
                                    summary={() => {
                                        const totalIncome = filteredSOProfitData.reduce((s, r) => s + Number(r.real_income || 0), 0);
                                        const totalExpense = filteredSOProfitData.reduce((s, r) => s + Number(r.real_expense || 0), 0);
                                        const totalBomCost = filteredSOProfitData.reduce((s, r) => s + Number(r.expected_bom_cost || 0), 0);
                                        const totalStockCost = filteredSOProfitData.reduce((s, r) => s + Number(r.expected_stock_cost || 0), 0);
                                        const totalRoutingCost = filteredSOProfitData.reduce((s, r) => s + Number(r.expected_routing_cost || 0), 0);
                                        const totalLogisticCost = filteredSOProfitData.reduce((s, r) => s + Number(r.expected_logistic_cost || 0), 0);
                                        const totalExpected = totalBomCost + totalStockCost + totalRoutingCost + totalLogisticCost;
                                        
                                        const totalExpectedProfit = filteredSOProfitData.reduce((s, r) => s + Number(r.expected_profit || 0), 0);
                                        const totalProfit = totalIncome - totalExpense;
                                        const totalMargin = totalIncome > 0 ? (totalProfit / totalIncome) * 100 : 0;
                                        return (
                                            <Table.Summary fixed>
                                                <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 'bold' }}>
                                                    <Table.Summary.Cell index={0} colSpan={4}>
                                                        <span style={{ fontSize: 14, fontWeight: 700 }}>TỔNG CỘNG ({filteredSOProfitData.length} đơn)</span>
                                                    </Table.Summary.Cell>
                                                    <Table.Summary.Cell index={1} align="right">
                                                        <b style={{ color: '#389e0d', fontSize: 14 }}>{totalIncome.toLocaleString()}</b>
                                                    </Table.Summary.Cell>
                                                    <Table.Summary.Cell index={2} align="right">
                                                        <Tooltip color="#fff" title={
                                                            <div style={{ color: '#333', fontSize: 12 }}>
                                                                <div style={{ color: '#888' }}>- NPL: <b style={{ color: '#fa8c16' }}>{totalBomCost.toLocaleString()}</b></div>
                                                                <div style={{ color: '#888' }}>- Hàng có sẵn: <b style={{ color: '#fa8c16' }}>{totalStockCost.toLocaleString()}</b></div>
                                                                <div style={{ color: '#888' }}>- Gia công: <b style={{ color: '#fa8c16' }}>{totalRoutingCost.toLocaleString()}</b></div>
                                                                <div style={{ color: '#888' }}>- Vận chuyển: <b style={{ color: '#fa8c16' }}>{totalLogisticCost.toLocaleString()}</b></div>
                                                            </div>
                                                        }>
                                                            <b style={{ color: '#fa8c16', fontSize: 14 }}>{totalExpected.toLocaleString()}</b>
                                                        </Tooltip>
                                                    </Table.Summary.Cell>
                                                    <Table.Summary.Cell index={3} align="right">
                                                        <b style={{ color: '#cf1322', fontSize: 14 }}>{totalExpense.toLocaleString()}</b>
                                                    </Table.Summary.Cell>
                                                    <Table.Summary.Cell index={4} align="right">
                                                        <b style={{ color: totalExpectedProfit >= 0 ? '#389e0d' : '#cf1322', fontSize: 14 }}>{totalExpectedProfit.toLocaleString()}</b>
                                                    </Table.Summary.Cell>
                                                    <Table.Summary.Cell index={5} align="right">
                                                        <b style={{ color: totalProfit >= 0 ? '#389e0d' : '#cf1322', fontSize: 15 }}>{totalProfit.toLocaleString()}</b>
                                                    </Table.Summary.Cell>
                                                    <Table.Summary.Cell index={6} align="right">
                                                        <b style={{ color: totalMargin >= 20 ? '#389e0d' : totalMargin >= 0 ? '#d48806' : '#cf1322' }}>{totalMargin.toFixed(1)}%</b>
                                                    </Table.Summary.Cell>
                                                </Table.Summary.Row>
                                            </Table.Summary>
                                        );
                                    }}
                                />

                                {/* STYLE cho dòng lỗ */}
                                <style>{`
                                    .so-profit-loss-row { background: #fff2f0 !important; }
                                    .so-profit-loss-row:hover > td { background: #ffedeb !important; }
                                `}</style>
                            </div>
                        )
                    },
                    // --- TAB DÒNG TIỀN (với phân quyền CASHFLOW) ---
                    ...(hasPerm('CASHFLOW') ? [{
                        key: 'CASHFLOW',
                        label: <span><LineChartOutlined /> Dòng tiền</span>,
                        children: <CashFlowDashboard />
                    }] : [])
                ]} />
            </Card>

            <Modal title="Hạch Toán Giao Dịch" open={isAccountingModalOpen} onCancel={() => setIsAccountingModalOpen(false)} footer={null}>
                <Form form={formAccounting} layout="vertical" onFinish={handleSaveAccounting}>
                    <Form.Item name="is_accounting" valuePropName="checked" wrapperCol={{ span: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, border: '1px solid #d9d9d9', borderRadius: 4, background: '#f6ffed' }}>
                            <input type="checkbox" id="acc_chk" defaultChecked style={{ width: 20, height: 20 }} onChange={e => formAccounting.setFieldValue('is_accounting', e.target.checked)} />
                            <label htmlFor="acc_chk" style={{ fontWeight: 600, fontSize: 16 }}>Xác nhận Hạch toán vào BCTC</label>
                        </div>
                    </Form.Item>
                    <Form.Item name="accounting_invoice_code" label="Số Hóa Đơn VAT / Chứng Từ" rules={[{ required: true, message: 'Nhập số hóa đơn' }]}><Input placeholder="VD: 0012345" /></Form.Item>
                    <Form.Item name="accounting_note" label="Ghi chú hạch toán"><Input.TextArea rows={3} /></Form.Item>
                    <Button type="primary" htmlType="submit" block size="large">Lưu Hạch Toán</Button>
                </Form>
            </Modal>

            {/* ... (Keep existing Modal) ... */}
            <Modal title={editingTransaction ? "Cập nhật Giao Dịch" : "Lập Phiếu Thu / Chi"} open={isTransModalOpen} onCancel={() => { setIsTransModalOpen(false); setEditingTransaction(null); formTrans.resetFields(); }} footer={null}>
                <Form form={formTrans} layout="vertical" onFinish={handleSaveTrans} initialValues={{ date: dayjs(), type: activeTab === 'EXPENSE' ? 'EXPENSE' : 'INCOME' }}>

                    <Form.Item name="type" label="Loại phiếu" rules={[{ required: true }]}>
                        <Radio.Group
                            buttonStyle="solid"
                            onChange={() => formTrans.setFieldsValue({ category_id: undefined })}
                        >
                            <Radio.Button value="INCOME" style={{ color: 'green' }}>PHIẾU THU (+)</Radio.Button>
                            <Radio.Button value="EXPENSE" style={{ color: 'red' }}>PHIẾU CHI (-)</Radio.Button>
                        </Radio.Group>
                    </Form.Item>

                    {/* SELECT CUSTOMER/SUPPLIER Logic */}
                    <div style={{ background: '#f0f2f5', padding: 12, borderRadius: 6, marginBottom: 16 }}>
                        {currentTransType === 'INCOME' && (
                            <>
                                <Form.Item name="is_retail" valuePropName="checked" style={{ marginBottom: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <input type="checkbox" id="retail" style={{ width: 16, height: 16 }} onChange={e => formTrans.setFieldValue('is_retail', e.target.checked)} />
                                        <label htmlFor="retail" style={{ fontWeight: 500 }}>Khách lẻ / Vãng lai</label>
                                    </div>
                                </Form.Item>
                                {isRetail ? (
                                    <Form.Item name="partner_name" label="Tên khách hàng" rules={[{ required: true, message: 'Nhập tên khách' }]}>
                                        <Input placeholder="Nhập tên khách..." />
                                    </Form.Item>
                                ) : (
                                    <Form.Item name="customer_id" label="Chọn khách hàng từ hệ thống" rules={[{ required: true, message: 'Chọn khách hàng' }]}>
                                        <Select placeholder="Tìm kiếm khách hàng" showSearch optionFilterProp="children">
                                            {customers.map(c => (
                                                <Option key={c.id} value={c.id}>{c.name} ({c.phone})</Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                )}
                            </>
                        )}

                        {currentTransType === 'EXPENSE' && (
                            <>
                                <Form.Item name="is_other_expense" valuePropName="checked" style={{ marginBottom: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <input type="checkbox" id="other_exp" style={{ width: 16, height: 16 }} onChange={e => formTrans.setFieldValue('is_other_expense', e.target.checked)} />
                                        <label htmlFor="other_exp" style={{ fontWeight: 500 }}>Chi khác / Nội bộ (Không có NCC)</label>
                                    </div>
                                </Form.Item>
                                {isOtherExpense ? (
                                    <Form.Item name="partner_name" label="Tên đơn vị / Người nhận" rules={[{ required: true, message: 'Nhập tên người nhận' }]}>
                                        <Input placeholder="Vd: Điện lực, Tiền nước, Lương..." />
                                    </Form.Item>
                                ) : (
                                    <Form.Item name="supplier_id" label="Chọn Nhà Cung Cấp / NGC" rules={[{ required: true, message: 'Chọn nhà cung cấp' }]}>
                                        <Select placeholder="Tìm kiếm NCC" showSearch optionFilterProp="children">
                                            {suppliers.map(s => (
                                                <Option key={s.id} value={s.id}>
                                                    {s.name} - <Tag>{s.type}</Tag>
                                                </Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                )}
                            </>
                        )}
                    </div>

                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="date" label="Ngày giao dịch" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
                        <Col span={12}>
                            <Form.Item name="amount" label="Số tiền" rules={[{ required: true }]}>
                                <InputNumber
                                    style={{ width: '100%' }}
                                    formatter={(v: any) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                    addonAfter="₫"
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* --- PROJECT & TASK LINKING --- */}
                    <div style={{ background: '#e6f7ff', padding: 12, borderRadius: 6, marginBottom: 16 }}>
                        <div style={{ fontWeight: 600, marginBottom: 8, color: '#1890ff' }}>Gán chi phí / doanh thu (Tùy chọn)</div>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item name="project_id" label="Thuộc Dự án">
                                    <Select allowClear placeholder="Chọn dự án..." showSearch optionFilterProp="children" onChange={() => formTrans.setFieldsValue({ task_id: undefined })}>
                                        {projects.map(p => <Option key={p.id} value={p.id}>{p.title}</Option>)}
                                    </Select>
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="task_id" label="Công việc (Task)">
                                    <Select allowClear placeholder="Chọn công việc..." disabled={!selectedProjectId}>
                                        {selectedProjectId && projects.find(p => p.id === selectedProjectId)?.tasks?.map((t: any) =>
                                            <Option key={t.id} value={t.id}>{t.title}</Option>
                                        )}
                                    </Select>
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={16}>
                            <Col span={24}>
                                <Form.Item name="reference_code" label="Mã tham chiếu (PO, Hợp đồng...)">
                                    <Input placeholder="Vd: PO-2311-0001" />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>

                    <Form.Item
                        name="category_id"
                        label="Chọn Danh mục (Lọc theo Loại phiếu)"
                        rules={[{ required: true, message: 'Vui lòng chọn danh mục' }]}
                    >
                        <Select placeholder="Chọn danh mục...">
                            {categories
                                .filter(c => c.type === currentTransType)
                                .map(c => (
                                    <Option key={c.id} value={c.id}>
                                        <Tag color={c.color || (c.type === 'INCOME' ? 'green' : 'red')}>{c.name}</Tag>
                                    </Option>
                                ))
                            }
                        </Select>
                    </Form.Item>

                    <Form.Item name="description" label="Diễn giải / Lý do"><Input.TextArea rows={3} /></Form.Item>
                    
                    <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, marginBottom: 16 }}>
                        <Form.Item name="reference_code" label="Mã tham chiếu SO / Hợp đồng">
                            <Select
                                mode="tags"
                                style={{ width: '100%' }}
                                placeholder="Chọn hoặc nhập mã SO..."
                                options={salesOrders.map(so => ({ value: so.order_code, label: `${so.order_code} - ${so.customer_name} (${Number(so.total_amount).toLocaleString()})` }))}
                                onChange={(val: string[]) => {
                                    // Tự động chia đều allocations nếu đã nhập số tiền
                                    const amount = formTrans.getFieldValue('amount') || 0;
                                    if (val && val.length > 0 && amount > 0) {
                                        const totalSOValue = val.reduce((sum, code) => {
                                            const so = salesOrders.find(s => s.order_code === code);
                                            return sum + (so ? Number(so.total_amount) : 0);
                                        }, 0);
                                        
                                        const allocs = val.map(code => {
                                            const so = salesOrders.find(s => s.order_code === code);
                                            let allocAmt = amount / val.length; // Default chia đều
                                            if (totalSOValue > 0 && so) {
                                                allocAmt = (Number(so.total_amount) / totalSOValue) * amount; // Chia theo tỷ lệ
                                            }
                                            return { refCode: code, amount: allocAmt };
                                        });
                                        formTrans.setFieldsValue({ allocations: allocs });
                                    } else {
                                        formTrans.setFieldsValue({ allocations: [] });
                                    }
                                }}
                            />
                        </Form.Item>
                        
                        <Form.List name="allocations">
                            {(fields, { add, remove }) => (
                                <>
                                    {fields.length > 0 && (
                                        <div style={{ marginBottom: 16 }}>
                                            <div style={{ fontWeight: 500, marginBottom: 8 }}>Phân bổ số tiền (Nhập tay nếu cần chỉnh sửa)</div>
                                            {fields.map(({ key, name, ...restField }) => (
                                                <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                                    <Form.Item
                                                        {...restField}
                                                        name={[name, 'refCode']}
                                                        rules={[{ required: true, message: 'Thiếu mã' }]}
                                                    >
                                                        <Input placeholder="Mã SO" readOnly />
                                                    </Form.Item>
                                                    <Form.Item
                                                        {...restField}
                                                        name={[name, 'amount']}
                                                        rules={[{ required: true, message: 'Thiếu số tiền' }]}
                                                    >
                                                        <InputNumber
                                                            placeholder="Số tiền"
                                                            formatter={(v: any) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                                            style={{ width: 150 }}
                                                        />
                                                    </Form.Item>
                                                </Space>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </Form.List>
                    </div>

                    <Button type="primary" htmlType="submit" block size="large">Lưu Phiếu</Button>
                </Form>
            </Modal>

            {/* MODAL CHI TIẾT TRANSACTION (DEEPLINK) */}
            <Modal
                title={<span><FileTextOutlined style={{ marginRight: 8 }} />Chi tiết Phiếu {selectedTransaction?.type === 'INCOME' ? 'Thu' : 'Chi'} #{selectedTransaction?.id}</span>}
                open={!!selectedTransaction}
                onCancel={() => setSelectedTransaction(null)}
                footer={[
                    <Button key="close" onClick={() => setSelectedTransaction(null)}>Đóng</Button>,
                ]}
                width={640}
            >
                {selectedTransaction && (
                    <div>
                        <div style={{ textAlign: 'center', marginBottom: 16, padding: '16px 0', background: selectedTransaction.type === 'INCOME' ? '#f6ffed' : '#fff1f0', borderRadius: 8 }}>
                            <Tag color={selectedTransaction.type === 'INCOME' ? 'green' : 'red'} style={{ fontSize: 14, padding: '4px 16px' }}>
                                {selectedTransaction.type === 'INCOME' ? '📥 PHIẾU THU' : '📤 PHIẾU CHI'}
                            </Tag>
                            <div style={{ fontSize: 28, fontWeight: 800, color: selectedTransaction.type === 'INCOME' ? '#389e0d' : '#cf1322', marginTop: 8 }}>
                                {Number(selectedTransaction.amount).toLocaleString()} ₫
                            </div>
                            {selectedTransaction.amount !== selectedTransaction.allocated_amount && (
                                <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
                                    Phân bổ cho SO này: <b style={{ color: selectedTransaction.type === 'INCOME' ? '#389e0d' : '#cf1322' }}>{Number(selectedTransaction.allocated_amount).toLocaleString()} ₫</b>
                                </div>
                            )}
                        </div>
                        <Descriptions bordered size="small" column={2} labelStyle={{ fontWeight: 600, background: '#fafafa', width: 140 }}>
                            <Descriptions.Item label="Mã giao dịch" span={1}>#{selectedTransaction.id}</Descriptions.Item>
                            <Descriptions.Item label="Ngày" span={1}>{dayjs(selectedTransaction.date).format('DD/MM/YYYY')}</Descriptions.Item>
                            <Descriptions.Item label="Đối tác" span={2}>{selectedTransaction.partner_name || <span style={{ color: '#bbb' }}>—</span>}</Descriptions.Item>
                            <Descriptions.Item label="Diễn giải" span={2}>{selectedTransaction.description || <span style={{ color: '#bbb' }}>—</span>}</Descriptions.Item>
                            <Descriptions.Item label="Danh mục" span={1}>
                                {selectedTransaction.category_name ? <Tag color={selectedTransaction.category_color || 'default'}>{selectedTransaction.category_name}</Tag> : '—'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Mã tham chiếu" span={1}>{selectedTransaction.reference_code || '—'}</Descriptions.Item>
                            <Descriptions.Item label="Mã HĐ VAT" span={1}>
                                {selectedTransaction.vat_invoice_code ? <b>{selectedTransaction.vat_invoice_code}</b> : <span style={{ color: '#bbb' }}>Chưa có</span>}
                            </Descriptions.Item>
                            <Descriptions.Item label="Hạch toán" span={1}>
                                {selectedTransaction.is_accounting
                                    ? <Tag icon={<CheckCircleOutlined />} color="success">Đã hạch toán</Tag>
                                    : <Tag icon={<InfoCircleOutlined />} color="default">Chưa HT</Tag>}
                            </Descriptions.Item>
                            {selectedTransaction.accounting_note && (
                                <Descriptions.Item label="Ghi chú HT" span={2}>{selectedTransaction.accounting_note}</Descriptions.Item>
                            )}
                            {selectedTransaction.vat_invoice_url && (
                                <Descriptions.Item label="File HĐ VAT" span={2}>
                                    <a href={selectedTransaction.vat_invoice_url} target="_blank" rel="noreferrer">Xem file đính kèm</a>
                                </Descriptions.Item>
                            )}
                        </Descriptions>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default FinancePage;