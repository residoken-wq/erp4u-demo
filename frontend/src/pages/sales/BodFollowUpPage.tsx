import React, { useEffect, useState, useMemo } from 'react';
import { Table, Tag, Tooltip, Progress, Drawer, Button, Form, Checkbox, message, Space, Card, Typography, Input, DatePicker, Select, Tabs, Statistic } from 'antd';
import { EditOutlined, SearchOutlined, CalendarOutlined, DownloadOutlined, ProfileOutlined } from '@ant-design/icons';
import api from '../../utils/api';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import RichTextEditor from '../../components/common/RichTextEditor';
import useMobile from '../../hooks/useMobile';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

dayjs.extend(isBetween);

const { Title } = Typography;
const { RangePicker } = DatePicker;

// Status cho tab đơn hàng đang rớt vào phễu sản xuất
const VALID_STATUSES = ['DEPOSITED', 'SAMPLE_APPROVED', 'IN_PRODUCTION', 'MANUFACTURING_COMPLETED', 'PLANNED', 'PARTIAL_DELIVERY'];

type FollowUpKey = 'care' | 'design' | 'npl' | 'production' | 'debt' | 'photo' | 'delivery' | 'other' | 'other2';

export default function BodFollowUpPage() {
    const isMobile = useMobile();
    const [ordersData, setOrdersData] = useState<any[]>([]);
    const [leadsData, setLeadsData] = useState<any[]>([]);
    const [pfos, setPfos] = useState<any[]>([]);

    const [loadingPfo, setLoadingPfo] = useState(false);
    const [pfoBodDetails, setPfoBodDetails] = useState<any>(null);

    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [activeTab, setActiveTab] = useState('ORDERS');

    // Date Filter State
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
    const [selectedYear, setSelectedYear] = useState(dayjs().year());
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [currentOrder, setCurrentOrder] = useState<any>(null);
    const [currentColumn, setCurrentColumn] = useState<FollowUpKey | null>(null);

    const [form] = Form.useForm();

    const years = Array.from({ length: 5 }, (_, i) => dayjs().year() - 2 + i);

    const handleMonthClick = (month: number) => {
        setSelectedMonth(month);
        const start = dayjs().year(selectedYear).month(month - 1).startOf('month');
        const end = dayjs().year(selectedYear).month(month - 1).endOf('month');
        setDateRange([start, end]);
    };

    const handleAllMonthClick = () => {
        setSelectedMonth(null);
        const start = dayjs().year(selectedYear).startOf('year');
        const end = dayjs().year(selectedYear).endOf('year');
        setDateRange([start, end]);
    };

    const handleYearChange = (val: number) => {
        setSelectedYear(val);
        if (selectedMonth !== null) {
            const start = dayjs().year(val).month(selectedMonth - 1).startOf('month');
            const end = dayjs().year(val).month(selectedMonth - 1).endOf('month');
            setDateRange([start, end]);
        } else {
            const start = dayjs().year(val).startOf('year');
            const end = dayjs().year(val).endOf('year');
            setDateRange([start, end]);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [resSales, resCust, resPfos] = await Promise.all([
                api.get('/sales').catch(() => ({ data: [] })),
                api.get('/customers').catch(() => ({ data: [] })),
                api.get('/planning').catch(() => ({ data: [] }))
            ]);

            const salesArr = Array.isArray(resSales.data) ? resSales.data : [];
            const custArr = Array.isArray(resCust.data) ? resCust.data : [];
            const pfosArr = Array.isArray(resPfos.data) ? resPfos.data : [];
            setPfos(pfosArr);

            // Orders Tab Data
            const activeOrders = salesArr.filter(o => VALID_STATUSES.includes(o.status));

            // Leads Tab Data: Sales where QUOTATION or SO_PENDING
            const quotesAndNew = salesArr.filter(o => ['QUOTATION', 'SO_PENDING'].includes(o.status));

            // Sort by Date
            const sortFn = (a: any, b: any) => new Date(b.order_date || b.created_at).getTime() - new Date(a.order_date || a.created_at).getTime();

            setOrdersData(activeOrders.sort(sortFn));
            setLeadsData(quotesAndNew.sort(sortFn));
        } catch (e) {
            message.error('Lỗi tải dữ liệu');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filterByDateAndSearch = (list: any[]) => {
        let filtered = list;

        if (searchText) {
            const lowerFilter = searchText.toLowerCase();
            filtered = filtered.filter(x =>
                x.order_code?.toLowerCase().includes(lowerFilter) ||
                x.customer?.name?.toLowerCase().includes(lowerFilter) ||
                x.customer_name?.toLowerCase().includes(lowerFilter)
            );
        }

        if (dateRange[0] && dateRange[1]) {
            filtered = filtered.filter(x => {
                const date = dayjs(x.order_date || x.created_at);
                if (!date.isValid()) return true;
                return date.isBetween(dateRange[0], dateRange[1], 'day', '[]');
            });
        }
        return filtered;
    };

    const currentData = activeTab === 'ORDERS' ? ordersData : leadsData;
    const filteredData = filterByDateAndSearch(currentData);

    const totalRevenue = filteredData.reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0);
    const totalPaid = filteredData.reduce((acc, curr) => acc + (Number(curr.paid_amount) || 0), 0);
    const totalDebt = totalRevenue - totalPaid;


    const checkPermissionForCol = (colKey: FollowUpKey) => {
        const userStr = localStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : null;

        const permissions = user?.permissions || [];
        let moduleCode = '';
        if (['care', 'delivery'].includes(colKey)) moduleCode = 'FUP_SALES';
        else if (colKey === 'npl') moduleCode = 'FUP_PURCHASE';
        else if (['design', 'production'].includes(colKey)) moduleCode = 'FUP_PRODUCTION';
        else if (colKey === 'debt') moduleCode = 'FUP_ACCOUNTING';
        else if (colKey === 'photo') moduleCode = 'FUP_MEDIA';
        else if (['other', 'other2'].includes(colKey)) moduleCode = 'FUP_OTHER';

        if (!moduleCode) return true;

        const p = permissions.find((perm: any) => perm.module_code === moduleCode);
        return p?.can_update || false;
    };

    const handleOpenEdit = (order: any, colKey: FollowUpKey) => {
        if (!checkPermissionForCol(colKey)) {
            message.warning('Bạn không có quyền cập nhật mục này!');
            return;
        }

        setCurrentOrder(order);
        setCurrentColumn(colKey);

        const fup = order.bod_follow_up || {};

        if (['npl', 'production'].includes(colKey)) {
            const relatedPfo = pfos.find((p: any) => p.sales_order_id === order.id || p.sales_order_code === order.order_code);
            if (relatedPfo) {
                setLoadingPfo(true);
                Promise.all([
                    api.get(`/planning/pfo/${relatedPfo.id}`).catch(() => ({ data: null })),
                    api.get(`/planning/pfo/${relatedPfo.id}/pos`).catch(() => ({ data: { pos_npl: [], pos_gc: [] } })),
                    api.get(`/planning/pfo/${relatedPfo.id}/pxks`).catch(() => ({ data: { pxk_npl: [], pxk_gc: [] } }))
                ]).then(([res, poRes, pxkRes]) => {
                    if (res.data) {
                        setPfoBodDetails({ ...res.data, pos: poRes.data, pxks: pxkRes.data });
                    } else {
                        setPfoBodDetails(null);
                    }
                    setLoadingPfo(false);
                });
            } else {
                setPfoBodDetails(null);
            }
        } else {
            setPfoBodDetails(null);
        }

        switch (colKey) {
            case 'design':
                form.setFieldsValue({
                    design_note: fup.design_note || '',
                    design_checkboxes: fup.design_checkboxes || []
                });
                break;
            case 'npl':
                form.setFieldsValue({
                    npl_note: fup.npl_note || '',
                    npl_checkboxes: fup.npl_checkboxes || []
                });
                break;
            case 'production':
                form.setFieldsValue({
                    prod_note: fup.prod_note || '',
                    prod_checkboxes: fup.prod_checkboxes || []
                });
                break;
            case 'debt':
                form.setFieldsValue({ debt_note: fup.debt_note || '' });
                break;
            case 'care':
                form.setFieldsValue({ care_note: fup.care_note || '' });
                break;
            case 'photo':
                form.setFieldsValue({ photo_note: fup.photo_note || '' });
                break;
            case 'delivery':
                form.setFieldsValue({ delivery_note: fup.delivery_note || '' });
                break;
            case 'other':
                form.setFieldsValue({ other_note: fup.other_note || '' });
                break;
            case 'other2':
                form.setFieldsValue({ other2_note: fup.other2_note || '' });
                break;
        }

        setDrawerOpen(true);
    };

    const handleSaveFollowUp = async (values: any) => {
        if (!currentOrder) return;
        try {
            const currentFup = currentOrder.bod_follow_up || {};
            const newFup = { ...currentFup, ...values };

            // Phân biệt lưu cho Lead (Customer) hay lưu cho Đơn hàng/Báo giá (Sales)
            if (currentOrder.is_customer_record) {
                await api.put(`/customers/${currentOrder.id}/bod-follow-up`, newFup);
            } else {
                await api.put(`/sales/${currentOrder.id}/bod-follow-up`, newFup);
            }

            message.success('Đã cập nhật tiến độ!');

            // Update local state
            if (activeTab === 'ORDERS') {
                const newData = [...ordersData];
                const idx = newData.findIndex(o => o.id === currentOrder.id);
                if (idx > -1) { newData[idx].bod_follow_up = newFup; setOrdersData(newData); }
            } else {
                const newData = [...leadsData];
                // So sánh thêm is_customer_record để tránh trùng ID giữa 2 bảng
                const idx = newData.findIndex(o => o.id === currentOrder.id && o.is_customer_record === currentOrder.is_customer_record);
                if (idx > -1) { newData[idx].bod_follow_up = newFup; setLeadsData(newData); }
            }

            setDrawerOpen(false);
        } catch (e) {
            message.error('Lỗi khi lưu');
        }
    };

    const renderCell = (order: any, key: FollowUpKey, title: string) => {
        const fup = order.bod_follow_up || {};

        let cbs: React.ReactNode = null;
        let noteStr = '';

        if (key === 'design') {
            const arr = (fup.design_checkboxes || []) as string[];
            const labels: any = { 'design': 'Design', 'approve': 'Duyệt in', 'print': 'Đặt in', 'sew': 'Đạt may' };
            if (arr.length > 0) cbs = <div style={{ marginBottom: 4 }}>{arr.map(x => <Tag key={x} color="cyan">{labels[x] || x}</Tag>)}</div>;
            noteStr = fup.design_note || '';
        } else if (key === 'npl') {
            const arr = (fup.npl_checkboxes || []) as string[];
            const labels: any = { 'fabric': 'Vải', 'quilt': 'Gòn', 'accessories': 'Phụ kiện' };
            if (arr.length > 0) cbs = <div style={{ marginBottom: 4 }}>{arr.map(x => <Tag key={x} color="purple">{labels[x] || x}</Tag>)}</div>;
            noteStr = fup.npl_note || '';
        } else if (key === 'production') {
            const arr = (fup.prod_checkboxes || []) as string[];
            const labels: any = { 'fabric': 'Lấy vải', 'quilt': 'Chần gòn', 'embroider': 'Thêu', 'process': 'Gia công' };
            if (arr.length > 0) cbs = <div style={{ marginBottom: 4 }}>{arr.map(x => <Tag key={x} color="blue">{labels[x] || x}</Tag>)}</div>;
            noteStr = fup.prod_note || '';
        } else {
            noteStr = fup[`${key}_note`] || '';
        }

        const plainText = noteStr.replace(/<[^>]*>?/gm, '').substring(0, 50) + (noteStr.length > 50 ? '...' : '');

        return (
            <div style={{ minHeight: 40, cursor: 'pointer' }} onClick={() => handleOpenEdit(order, key)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                        {cbs}
                        <div style={{ fontSize: 12, color: '#555', fontStyle: plainText ? 'normal' : 'italic' }}>
                            {plainText || 'click để thêm...'}
                        </div>
                    </div>
                    <EditOutlined style={{ color: '#d9d9d9', marginTop: 4 }} />
                </div>
            </div>
        );
    };

    const columns = [
        {
            title: 'Mã Đơn', dataIndex: 'order_code', width: 140, fixed: 'left' as const,
            render: (t: any, r: any) => {
                // Determine Deep Link Path
                let linkPath = `/orders?order=${r.id}`;
                if (r.is_customer_record) {
                    // It is a Lead Customer
                    linkPath = `/sales?customer=${r.id}`;
                }

                return <a href={linkPath} target="_blank" rel="noreferrer"><b>{t}</b></a>
            }
        },
        {
            title: 'Khách Hàng', width: 180, fixed: 'left' as const,
            render: (r: any) => <span style={{ fontWeight: 500 }}>{r.customer?.name || r.customer_name || 'Khách lẻ'}</span>
        },
        {
            title: 'Ngày Tạo / Cọc', width: 120,
            render: (r: any) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <Tooltip title="Ngày tạo đơn">
                        <span style={{ color: '#666', fontSize: 13 }}>📝 {r.order_date || r.created_at ? dayjs(r.order_date || r.created_at).format('DD/MM/YY') : '-'}</span>
                    </Tooltip>
                    {r.deposit_date && (
                        <Tooltip title="Ngày đặt cọc (Thanh toán lần đầu)">
                            <Tag color="purple" style={{ margin: 0, fontSize: 11, padding: '0 4px', alignSelf: 'flex-start' }}>Cọc: {dayjs(r.deposit_date).format('DD/MM/YY')}</Tag>
                        </Tooltip>
                    )}
                </div>
            )
        },
        {
            title: 'Ngày Giao', dataIndex: 'delivery_date', width: 110,
            render: (t: any) => t ? <span style={{ color: '#1890ff' }}>{dayjs(t).format('DD/MM/YYYY')}</span> : '-'
        },
        {
            title: 'Doanh Thu', dataIndex: 'total_amount', align: 'right' as const, width: 110,
            render: (v: any) => <b style={{ color: '#cf1322' }}>{Number(v).toLocaleString()}</b>
        },
        {
            title: 'Đã Thu', dataIndex: 'paid_amount', align: 'right' as const, width: 110,
            render: (v: any) => <span style={{ color: '#389e0d' }}>{Number(v).toLocaleString()}</span>
        },
        {
            title: 'Còn Lại', key: 'remaining', align: 'right' as const, width: 110,
            render: (r: any) => {
                const total = Number(r.total_amount) || 0;
                const paid = Number(r.paid_amount) || 0;
                const remain = total - paid;
                return <span style={{ color: remain > 0 ? '#fa541c' : '#999' }}>{remain.toLocaleString()}</span>
            }
        },
        {
            title: 'Trạng Thái', dataIndex: 'status', align: 'center' as const, width: 120,
            render: (t: any) => {
                let color = 'default';
                let label = t;
                if (t === 'LEAD') { color = 'geekblue'; label = 'Lead'; }
                if (t === 'QUOTATION') { color = 'orange'; label = 'Báo Giá'; }
                if (t === 'SO_PENDING') { color = 'processing'; label = 'Mới/Chưa cọc'; }
                if (t === 'SAMPLE_APPROVED') { color = 'cyan'; label = 'Đã Duyệt'; }
                if (t === 'DEPOSITED') { color = 'purple'; label = 'Đã Cọc'; }
                if (t === 'IN_PRODUCTION') { color = 'blue'; label = 'Đang SX'; }
                if (t === 'MANUFACTURING_COMPLETED') { color = 'gold'; label = 'Xong SX'; }
                if (t === 'DELIVERED') { color = 'geekblue'; label = 'Đã Giao'; }
                return <Tag color={color}>{label}</Tag>
            }
        },
        {
            title: 'Thanh Toán', dataIndex: 'payment_status', width: 100,
            render: (t: any, r: any) => {
                const total = Number(r.total_amount) || 0;
                const paid = Number(r.paid_amount) || 0;
                const pct = total > 0 ? Math.min(Math.round((paid / total) * 100), 100) : 0;
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: 12, color: pct >= 100 ? 'green' : '#666', fontWeight: 'bold' }}>{pct}%</span>
                    </div>
                )
            }
        },
        {
            title: 'Công Nợ', key: 'col_debt', width: 200,
            render: (r: any) => renderCell(r, 'debt', 'Công Nợ')
        },
        {
            title: 'Chăm sóc', key: 'col_care', width: 200,
            render: (r: any) => renderCell(r, 'care', 'Chăm sóc')
        },
        {
            title: 'THIẾT KẾ (Làm túi)', key: 'col_design', width: 250,
            render: (r: any) => renderCell(r, 'design', 'Thiết kế & Túi')
        },
        {
            title: 'NGUYÊN PHỤ LIỆU', key: 'col_npl', width: 250,
            render: (r: any) => renderCell(r, 'npl', 'Nguyên Phụ Liệu')
        },
        {
            title: 'SẢN XUẤT', key: 'col_prod', width: 250,
            render: (r: any) => renderCell(r, 'production', 'Sản xuất')
        },
        {
            title: 'Chụp mẫu', key: 'col_photo', width: 200,
            render: (r: any) => renderCell(r, 'photo', 'Chụp mẫu')
        },
        {
            title: 'Giao hàng', key: 'col_deliv', width: 200,
            render: (r: any) => renderCell(r, 'delivery', 'Giao hàng')
        },
        {
            title: 'Khác', key: 'col_other', width: 200,
            render: (r: any) => renderCell(r, 'other', 'Ghi chú Khác')
        },
        {
            title: 'Khác 2', key: 'col_other2', width: 200,
            render: (r: any) => renderCell(r, 'other2', 'Ghi chú Khác 2')
        }
    ];

    const handleExportExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('BOD_FollowUp');

        // Định dạng cột (Header + Độ rộng)
        sheet.columns = [
            { header: 'Mã Đơn', key: 'order_code', width: 15 },
            { header: 'Khách Hàng', key: 'customer', width: 25 },
            { header: 'Ngày Tạo', key: 'created_date', width: 15 },
            { header: 'Ngày Cọc', key: 'deposit_date', width: 15 },
            { header: 'Ngày Giao', key: 'delivery_date', width: 15 },
            { header: 'Doanh Thu', key: 'revenue', width: 15 },
            { header: 'Đã Thu', key: 'paid', width: 15 },
            { header: 'Còn Lại', key: 'remain', width: 15 },
            { header: 'Trạng Thái', key: 'status', width: 15 },
            { header: 'Thanh Toán (%)', key: 'payment_pct', width: 15 },
            { header: 'Công Nợ', key: 'debt', width: 30 },
            { header: 'Chăm sóc', key: 'care', width: 30 },
            { header: 'THIẾT KẾ (Làm túi)', key: 'design', width: 35 },
            { header: 'NGUYÊN PHỤ LIỆU', key: 'npl', width: 35 },
            { header: 'SẢN XUẤT', key: 'production', width: 35 },
            { header: 'Chụp mẫu', key: 'photo', width: 30 },
            { header: 'Giao hàng', key: 'delivery', width: 30 },
            { header: 'Khác', key: 'other', width: 30 },
            { header: 'Khác 2', key: 'other2', width: 30 },
        ];

        // Format header row
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1890FF' } };
        sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        const getStatusLabel = (t: string) => {
            if (t === 'LEAD') return 'Lead';
            if (t === 'QUOTATION') return 'Báo Giá';
            if (t === 'SO_PENDING') return 'Mới/Chưa cọc';
            if (t === 'SAMPLE_APPROVED') return 'Đã Duyệt';
            if (t === 'DEPOSITED') return 'Đã Cọc';
            if (t === 'IN_PRODUCTION') return 'Đang SX';
            if (t === 'MANUFACTURING_COMPLETED') return 'Xong SX';
            if (t === 'DELIVERED') return 'Đã Giao';
            return t || '';
        };

        const getPlainText = (htmlStr: string) => htmlStr ? htmlStr.replace(/<[^>]*>?/gm, '') : '';

        // Đổ dữ liệu
        filteredData.forEach(r => {
            const fup = r.bod_follow_up || {};
            const total = Number(r.total_amount) || 0;
            const paid = Number(r.paid_amount) || 0;
            const remain = total - paid;
            const pct = total > 0 ? Math.min(Math.round((paid / total) * 100), 100) : 0;

            const designCbs = (fup.design_checkboxes || []) as string[];
            const designLabels: any = { 'design': 'Design', 'approve': 'Duyệt in', 'print': 'Đặt in', 'sew': 'Đạt may' };
            const designStr = (designCbs.length > 0 ? `[${designCbs.map(x => designLabels[x] || x).join(', ')}] ` : '') + getPlainText(fup.design_note);

            const nplCbs = (fup.npl_checkboxes || []) as string[];
            const nplLabels: any = { 'fabric': 'Vải', 'quilt': 'Gòn', 'accessories': 'Phụ kiện' };
            const nplStr = (nplCbs.length > 0 ? `[${nplCbs.map(x => nplLabels[x] || x).join(', ')}] ` : '') + getPlainText(fup.npl_note);

            const prodCbs = (fup.prod_checkboxes || []) as string[];
            const prodLabels: any = { 'fabric': 'Lấy vải', 'quilt': 'Chần gòn', 'embroider': 'Thêu', 'process': 'Gia công' };
            const prodStr = (prodCbs.length > 0 ? `[${prodCbs.map(x => prodLabels[x] || x).join(', ')}] ` : '') + getPlainText(fup.prod_note);

            const row = sheet.addRow({
                order_code: r.order_code,
                customer: r.customer?.name || r.customer_name || 'Khách lẻ',
                created_date: r.order_date || r.created_at ? dayjs(r.order_date || r.created_at).format('DD/MM/YYYY') : '',
                deposit_date: r.deposit_date ? dayjs(r.deposit_date).format('DD/MM/YYYY') : '',
                delivery_date: r.delivery_date ? dayjs(r.delivery_date).format('DD/MM/YYYY') : '',
                revenue: total,
                paid: paid,
                remain: remain,
                status: getStatusLabel(r.status),
                payment_pct: `${pct}%`,
                debt: getPlainText(fup.debt_note),
                care: getPlainText(fup.care_note),
                design: designStr,
                npl: nplStr,
                production: prodStr,
                photo: getPlainText(fup.photo_note),
                delivery: getPlainText(fup.delivery_note),
                other: getPlainText(fup.other_note),
                other2: getPlainText(fup.other2_note),
            });

            // Format cell text wrap and alignments
            row.alignment = { vertical: 'middle', wrapText: true };
            row.getCell('revenue').numFmt = '#,##0';
            row.getCell('paid').numFmt = '#,##0';
            row.getCell('remain').numFmt = '#,##0';
        });

        // Add border for all cells
        sheet.eachRow((row) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `BOD_FollowUp_${dayjs().format('YYYYMMDD_HHmm')}.xlsx`);
    };

    const drawerTitleMap: Record<string, string> = {
        'care': 'Cập nhật Chăm sóc khách hàng',
        'design': 'Cập nhật Tiến độ Thiết kế & Làm túi',
        'production': 'Cập nhật Tiến độ Sản xuất chính',
        'npl': 'Cập nhật Nguyên Phụ Liệu',
        'debt': 'Cập nhật Công Nợ / Kế Toán',
        'photo': 'Cập nhật Hình chụp mẫu / Media',
        'delivery': 'Cập nhật Thông tin Giao hàng',
        'other': 'Cập nhật Ghi chú chung',
        'other2': 'Cập nhật Ghi chú chung 2'
    }

    const renderMobileView = () => {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {filteredData.map(r => {
                    const total = Number(r.total_amount) || 0;
                    const paid = Number(r.paid_amount) || 0;
                    const remain = total - paid;
                    const pct = total > 0 ? Math.min(Math.round((paid / total) * 100), 100) : 0;
                    
                    let statusColor = 'default';
                    let statusLabel = r.status;
                    if (r.status === 'LEAD') { statusColor = 'geekblue'; statusLabel = 'Lead'; }
                    if (r.status === 'QUOTATION') { statusColor = 'orange'; statusLabel = 'Báo Giá'; }
                    if (r.status === 'SO_PENDING') { statusColor = 'processing'; statusLabel = 'Mới/Chưa cọc'; }
                    if (r.status === 'SAMPLE_APPROVED') { statusColor = 'cyan'; statusLabel = 'Đã Duyệt'; }
                    if (r.status === 'DEPOSITED') { statusColor = 'purple'; statusLabel = 'Đã Cọc'; }
                    if (r.status === 'IN_PRODUCTION') { statusColor = 'blue'; statusLabel = 'Đang SX'; }
                    if (r.status === 'MANUFACTURING_COMPLETED') { statusColor = 'gold'; statusLabel = 'Xong SX'; }
                    if (r.status === 'DELIVERED') { statusColor = 'geekblue'; statusLabel = 'Đã Giao'; }

                    const followUpItems = [
                        { key: 'debt', label: 'Công Nợ' },
                        { key: 'care', label: 'Chăm sóc' },
                        { key: 'design', label: 'Thiết kế & Túi' },
                        { key: 'npl', label: 'Nguyên Phụ Liệu' },
                        { key: 'production', label: 'Sản xuất' },
                        { key: 'photo', label: 'Chụp mẫu' },
                        { key: 'delivery', label: 'Giao hàng' },
                        { key: 'other', label: 'Khác' },
                        { key: 'other2', label: 'Khác 2' }
                    ];

                    let linkPath = `/orders?order=${r.id}`;
                    if (r.is_customer_record) {
                        linkPath = `/sales?customer=${r.id}`;
                    }

                    return (
                        <Card key={r.is_customer_record ? `cust_${r.id}` : `sale_${r.id}`} bodyStyle={{ padding: '16px' }} style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <a href={linkPath} target="_blank" rel="noreferrer" style={{ fontSize: 16, fontWeight: 700, color: '#1890ff' }}>
                                    {r.order_code}
                                </a>
                                <Tag color={statusColor} style={{ margin: 0 }}>{statusLabel}</Tag>
                            </div>
                            
                            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12, color: '#333' }}>
                                {r.customer?.name || r.customer_name || 'Khách lẻ'}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16, background: '#fafafa', padding: 12, borderRadius: 8, border: '1px solid #f0f0f0' }}>
                                <div>
                                    <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 2 }}>Doanh thu</div>
                                    <div style={{ fontWeight: 600, color: '#cf1322' }}>{total.toLocaleString()} đ</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 2 }}>Đã thu ({pct}%)</div>
                                    <div style={{ fontWeight: 600, color: '#389e0d' }}>{paid.toLocaleString()} đ</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 2 }}>Còn lại</div>
                                    <div style={{ fontWeight: 600, color: remain > 0 ? '#fa541c' : '#8c8c8c' }}>{remain.toLocaleString()} đ</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 2 }}>Ngày giao</div>
                                    <div style={{ fontWeight: 600, color: '#1890ff' }}>{r.delivery_date ? dayjs(r.delivery_date).format('DD/MM/YYYY') : '-'}</div>
                                </div>
                            </div>

                            <div style={{ fontWeight: 600, color: '#595959', marginBottom: 8, fontSize: 14 }}>
                                Tương tác & Follow-up:
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                {followUpItems.map(item => (
                                    <div key={item.key} style={{ border: '1px solid #d9d9d9', borderRadius: 6, padding: '8px', background: '#fff' }}>
                                        <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase' }}>
                                            {item.label}
                                        </div>
                                        {renderCell(r, item.key as FollowUpKey, item.label)}
                                    </div>
                                ))}
                            </div>
                        </Card>
                    );
                })}
            </div>
        );
    };

    return (
        <div>
            <div style={{ marginBottom: 16 }}>
                {/* FILTER BAR - MOBILE FRIENDLY */}
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', marginBottom: 16, gap: isMobile ? 12 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: isMobile ? 14 : 16, fontWeight: 600, color: '#555', whiteSpace: 'nowrap' }}><CalendarOutlined />  Thống kê:</span>

                        {/* Year Select */}
                        <Select
                            value={selectedYear}
                            onChange={handleYearChange}
                            style={{ width: isMobile ? 100 : 120 }}
                            options={years.map(y => ({ label: `${y}`, value: y }))}
                        />

                        {/* Month Blocks - HIDE ON MOBILE */}
                        {!isMobile && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                                    const isActive = selectedMonth === m;
                                    return (
                                        <div
                                            key={m}
                                            onClick={() => handleMonthClick(m)}
                                            style={{
                                                padding: '4px 12px',
                                                borderRadius: 4,
                                                cursor: 'pointer',
                                                border: isActive ? '1px solid #1890ff' : '1px solid #d9d9d9',
                                                background: isActive ? '#e6f7ff' : '#fff',
                                                color: isActive ? '#1890ff' : '#666',
                                                fontSize: 13,
                                                transition: 'all 0.2s',
                                                fontWeight: isActive ? 500 : 400
                                            }}
                                            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.borderColor = '#40a9ff'; }}
                                            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.borderColor = '#d9d9d9'; }}
                                        >
                                            T{m}
                                        </div>
                                    )
                                })}
                                {/* ALL BLOCK */}
                                <div
                                    onClick={handleAllMonthClick}
                                    style={{
                                        padding: '4px 12px',
                                        borderRadius: 4,
                                        cursor: 'pointer',
                                        border: selectedMonth === null ? '1px solid #722ed1' : '1px solid #d9d9d9',
                                        background: selectedMonth === null ? '#f9f0ff' : '#fff',
                                        color: selectedMonth === null ? '#722ed1' : '#666',
                                        fontSize: 13,
                                        transition: 'all 0.2s',
                                        fontWeight: selectedMonth === null ? 500 : 400
                                    }}
                                    onMouseEnter={(e) => { if (selectedMonth !== null) e.currentTarget.style.borderColor = '#b37feb'; }}
                                    onMouseLeave={(e) => { if (selectedMonth !== null) e.currentTarget.style.borderColor = '#d9d9d9'; }}
                                >
                                    All
                                </div>
                            </div>
                        )}
                    </div>

                    <RangePicker
                        style={{ width: isMobile ? '100%' : 260 }}
                        placeholder={['Từ ngày', 'Đến ngày']}
                        value={dateRange as any}
                        onChange={(dates) => {
                            setDateRange(dates as any);
                            if (dates) setSelectedMonth(null);
                        }}
                    />
                </div>
            </div>

            <Card bodyStyle={{ padding: '16px 24px' }}>
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', marginBottom: 16, gap: 12 }}>
                    <Title level={4} style={{ margin: 0, color: '#fa8c16' }}>BOD Follow Up: Tiến độ Công việc</Title>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Input prefix={<SearchOutlined />} placeholder="Tìm mã, tên khách..." value={searchText} onChange={e => setSearchText(e.target.value)} style={{ width: isMobile ? '100%' : 250 }} />
                        <Button icon={<DownloadOutlined />} onClick={handleExportExcel} type="primary" style={{ width: isMobile ? '100%' : 'auto' }}>Xuất Excel</Button>
                    </div>
                </div>

                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={[
                        { key: 'ORDERS', label: 'Đơn Hàng (Đang SX)' },
                        { key: 'LEADS', label: 'Tab Lead (Báo giá & Chưa cọc)' }
                    ]}
                    style={{ marginBottom: 16 }}
                />

                {/* THỐNG KÊ */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 24, overflowX: 'auto' }}>
                    <Card size="small" style={{ minWidth: 200, flex: 1, borderLeft: '4px solid #1890ff' }}>
                        <Statistic title="Tổng G.Trị" value={totalRevenue} precision={0} valueStyle={{ color: '#1890ff', fontWeight: 'bold' }} suffix="đ" />
                    </Card>
                    <Card size="small" style={{ minWidth: 200, flex: 1, borderLeft: '4px solid #52c41a' }}>
                        <Statistic title="Thực Thu" value={totalPaid} precision={0} valueStyle={{ color: '#52c41a', fontWeight: 'bold' }} suffix="đ" />
                    </Card>
                    <Card size="small" style={{ minWidth: 200, flex: 1, borderLeft: '4px solid #f5222d' }}>
                        <Statistic title="Công Nợ" value={totalDebt > 0 ? totalDebt : 0} precision={0} valueStyle={{ color: '#f5222d', fontWeight: 'bold' }} suffix="đ" />
                    </Card>
                </div>

                {isMobile ? renderMobileView() : (
                    <Table
                        columns={columns}
                        dataSource={filteredData}
                        rowKey={(r) => r.is_customer_record ? `cust_${r.id}` : `sale_${r.id}`}
                        loading={loading}
                        scroll={{ x: 2600 }}
                        sticky={true}
                        size="middle"
                        bordered
                        pagination={{ pageSize: 20 }}
                    />
                )}
            </Card>

            <Drawer
                title={drawerTitleMap[currentColumn || 'other']}
                width={isMobile ? '100%' : 700}
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                extra={<Button type="primary" onClick={() => form.submit()}>Lưu thông tin</Button>}
                destroyOnClose
            >
                <Form form={form} layout="vertical" onFinish={handleSaveFollowUp}>
                    {currentColumn === 'design' && (
                        <Card size="small" style={{ marginBottom: 16, background: '#e6f7ff' }}>
                            <Form.Item name="design_checkboxes" label={<b>Checklist Các khâu</b>}>
                                <Checkbox.Group style={{ width: '100%' }}>
                                    <Space direction="vertical">
                                        <Checkbox value="design">Design mẫu in</Checkbox>
                                        <Checkbox value="approve">KH duyệt in</Checkbox>
                                        <Checkbox value="print">Đặt in</Checkbox>
                                        <Checkbox value="sew">Đạt may túi</Checkbox>
                                    </Space>
                                </Checkbox.Group>
                            </Form.Item>
                        </Card>
                    )}

                    {currentColumn === 'production' && (
                        <Card size="small" style={{ marginBottom: 16, background: '#fffbe6' }}>
                            <Form.Item name="prod_checkboxes" label={<b>Checklist Vật tư & Gia công</b>}>
                                <Checkbox.Group style={{ width: '100%' }}>
                                    <Space direction="vertical">
                                        <Checkbox value="fabric">Đặt vải</Checkbox>
                                        <Checkbox value="quilt">Đặt chần gòn</Checkbox>
                                        <Checkbox value="embroider">Đặt thêu</Checkbox>
                                        <Checkbox value="process">Đặt gia công</Checkbox>
                                    </Space>
                                </Checkbox.Group>
                            </Form.Item>
                        </Card>
                    )}

                    {currentColumn === 'npl' && (
                        <Card size="small" style={{ marginBottom: 16, background: '#f9f0ff' }}>
                            <Form.Item name="npl_checkboxes" label={<b>Checklist NPL</b>}>
                                <Checkbox.Group style={{ width: '100%' }}>
                                    <Space direction="vertical">
                                        <Checkbox value="fabric">Vải</Checkbox>
                                        <Checkbox value="quilt">Gòn</Checkbox>
                                        <Checkbox value="accessories">Phụ kiện</Checkbox>
                                    </Space>
                                </Checkbox.Group>
                            </Form.Item>
                        </Card>
                    )}

                    <Form.Item name={currentColumn === 'design' ? 'design_note' :
                        currentColumn === 'production' ? 'prod_note' :
                            currentColumn === 'npl' ? 'npl_note' :
                                `${currentColumn}_note`}
                        label={<b>Ghi chú chi tiết</b>}>
                        <RichTextEditor />
                    </Form.Item>
                </Form>

                {/* Phần hiển thị chi tiết PFO nếu có */}
                {(currentColumn === 'npl' || currentColumn === 'production') && loadingPfo && (
                    <div style={{ textAlign: 'center', marginTop: 24 }}><Typography.Text type="secondary">Đang tải dữ liệu từ Lệnh SX...</Typography.Text></div>
                )}
                
                {currentColumn === 'npl' && !loadingPfo && pfoBodDetails && (
                    <Card size="small" title={<><ProfileOutlined /> Thông tin Lệnh SX (PFO) - NPL</>} style={{ marginTop: 16 }}>
                        <Tabs items={[
                            {
                                key: 'PO_NPL',
                                label: 'PO_NPL',
                                children: (
                                    <Table 
                                        columns={[
                                            { title: 'Mã PO', dataIndex: 'po_code', key: 'po_code' },
                                            { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (val: string) => <Tag color="blue">{val}</Tag> },
                                            { title: 'Nhà cung cấp', dataIndex: ['supplier', 'name'], key: 'supplier' },
                                            { title: 'Tổng tiền', dataIndex: 'total_amount', key: 'total_amount', render: (val: any) => <b>{Number(val).toLocaleString()} ₫</b> }
                                        ]}
                                        dataSource={pfoBodDetails.pos?.pos_npl || []} 
                                        size="small" 
                                        rowKey="id"
                                        expandable={{ 
                                            expandedRowRender: (record: any) => {
                                                if (!record.items || record.items.length === 0) return <Typography.Text type="secondary" style={{ marginLeft: 32 }}>Không có chi tiết</Typography.Text>;
                                                return <Table columns={[{ title: 'Vật tư / SP', dataIndex: 'product_name', key: 'product_name', render: (val: any, rec: any) => val || rec.material?.name || rec.product?.name || 'N/A' }, { title: 'Số lượng', dataIndex: 'quantity', key: 'quantity', align: 'right' as const, render: (val: any) => Number(val || 0).toLocaleString() }, { title: 'Đơn giá', dataIndex: 'unit_price', key: 'unit_price', align: 'right' as const, render: (val: any) => `${Number(val || 0).toLocaleString()} ₫` }, { title: 'Thành tiền', dataIndex: 'total_price', key: 'total_price', align: 'right' as const, render: (val: any, rec: any) => `${(Number(rec.quantity || 0) * Number(rec.unit_price || 0)).toLocaleString()} ₫` }]} dataSource={record.items} pagination={false} size="small" rowKey="id" bordered />;
                                            }
                                        }}
                                    />
                                )
                            },
                            {
                                key: 'PXK_NPL',
                                label: 'PXK NPL',
                                children: (
                                    <Table 
                                        columns={[
                                            { title: 'Mã PXK', dataIndex: 'code', key: 'code', render: (val: any, record: any) => record.pxk_code || record.code || val || 'N/A' },
                                            { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (val: string) => <Tag color="orange">{val || 'N/A'}</Tag> },
                                            { title: 'Ngày xuất', dataIndex: 'issue_date', key: 'issue_date', render: (val: any, record: any) => val ? dayjs(val).format('DD/MM/YYYY') : (record?.created_at ? dayjs(record.created_at).format('DD/MM/YYYY') : '-') },
                                            { title: 'Nguồn', key: 'source', render: (_: any, record: any) => record.from_inventory ? <Tag color="green">Từ Tồn Kho</Tag> : (record.supplier?.name || <Tag>Khác</Tag>) }
                                        ]}
                                        dataSource={pfoBodDetails.pxks?.pxk_npl || []} 
                                        size="small" 
                                        rowKey="id"
                                        expandable={{ 
                                            expandedRowRender: (record: any) => {
                                                if (!record.items || record.items.length === 0) return <Typography.Text type="secondary" style={{ marginLeft: 32 }}>Không có chi tiết</Typography.Text>;
                                                return <Table columns={[{ title: 'Vật tư / SP', dataIndex: 'product_name', key: 'product_name', render: (val: any, rec: any) => val || rec.material?.name || rec.product?.name || 'N/A' }, { title: 'Số lượng', dataIndex: 'quantity', key: 'quantity', align: 'right' as const, render: (val: any) => Number(val || 0).toLocaleString() }, { title: 'Đơn giá', dataIndex: 'unit_price', key: 'unit_price', align: 'right' as const, render: (val: any) => `${Number(val || 0).toLocaleString()} ₫` }, { title: 'Thành tiền', dataIndex: 'total_price', key: 'total_price', align: 'right' as const, render: (val: any, rec: any) => `${(Number(rec.quantity || 0) * Number(rec.unit_price || 0)).toLocaleString()} ₫` }]} dataSource={record.items} pagination={false} size="small" rowKey="id" bordered />;
                                            }
                                        }}
                                    />
                                )
                            }
                        ]} />
                    </Card>
                )}

                {currentColumn === 'production' && !loadingPfo && pfoBodDetails && (
                    <Card size="small" title={<><ProfileOutlined /> Thông tin Lệnh SX (PFO) - Gia Công</>} style={{ marginTop: 16 }}>
                        <Tabs items={[
                            {
                                key: 'PO_GC',
                                label: 'PO_GC',
                                children: (
                                    <Table 
                                        columns={[
                                            { title: 'Mã PO', dataIndex: 'po_code', key: 'po_code' },
                                            { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (val: string) => <Tag color="blue">{val}</Tag> },
                                            { title: 'Nhà cung cấp', dataIndex: ['supplier', 'name'], key: 'supplier' },
                                            { title: 'Tổng tiền', dataIndex: 'total_amount', key: 'total_amount', render: (val: any) => <b>{Number(val).toLocaleString()} ₫</b> }
                                        ]}
                                        dataSource={pfoBodDetails.pos?.pos_gc || []} 
                                        size="small" 
                                        rowKey="id"
                                        expandable={{ 
                                            expandedRowRender: (record: any) => {
                                                if (!record.items || record.items.length === 0) return <Typography.Text type="secondary" style={{ marginLeft: 32 }}>Không có chi tiết</Typography.Text>;
                                                return <Table columns={[{ title: 'Vật tư / SP', dataIndex: 'product_name', key: 'product_name', render: (val: any, rec: any) => val || rec.material?.name || rec.product?.name || 'N/A' }, { title: 'Số lượng', dataIndex: 'quantity', key: 'quantity', align: 'right' as const, render: (val: any) => Number(val || 0).toLocaleString() }, { title: 'Đơn giá', dataIndex: 'unit_price', key: 'unit_price', align: 'right' as const, render: (val: any) => `${Number(val || 0).toLocaleString()} ₫` }, { title: 'Thành tiền', dataIndex: 'total_price', key: 'total_price', align: 'right' as const, render: (val: any, rec: any) => `${(Number(rec.quantity || 0) * Number(rec.unit_price || 0)).toLocaleString()} ₫` }]} dataSource={record.items} pagination={false} size="small" rowKey="id" bordered />;
                                            }
                                        }}
                                    />
                                )
                            },
                            {
                                key: 'PXK_GC',
                                label: 'PXK GC',
                                children: (
                                    <Table 
                                        columns={[
                                            { title: 'Mã PXK', dataIndex: 'code', key: 'code', render: (val: any, record: any) => record.pxk_code || record.code || val || 'N/A' },
                                            { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (val: string) => <Tag color="orange">{val || 'N/A'}</Tag> },
                                            { title: 'Ngày xuất', dataIndex: 'issue_date', key: 'issue_date', render: (val: any, record: any) => val ? dayjs(val).format('DD/MM/YYYY') : (record?.created_at ? dayjs(record.created_at).format('DD/MM/YYYY') : '-') },
                                            { title: 'Nguồn', key: 'source', render: (_: any, record: any) => record.from_inventory ? <Tag color="green">Từ Tồn Kho</Tag> : (record.supplier?.name || <Tag>Khác</Tag>) }
                                        ]}
                                        dataSource={pfoBodDetails.pxks?.pxk_gc || []} 
                                        size="small" 
                                        rowKey="id"
                                        expandable={{ 
                                            expandedRowRender: (record: any) => {
                                                if (!record.items || record.items.length === 0) return <Typography.Text type="secondary" style={{ marginLeft: 32 }}>Không có chi tiết</Typography.Text>;
                                                return <Table columns={[{ title: 'Vật tư / SP', dataIndex: 'product_name', key: 'product_name', render: (val: any, rec: any) => val || rec.material?.name || rec.product?.name || 'N/A' }, { title: 'Số lượng', dataIndex: 'quantity', key: 'quantity', align: 'right' as const, render: (val: any) => Number(val || 0).toLocaleString() }, { title: 'Đơn giá', dataIndex: 'unit_price', key: 'unit_price', align: 'right' as const, render: (val: any) => `${Number(val || 0).toLocaleString()} ₫` }, { title: 'Thành tiền', dataIndex: 'total_price', key: 'total_price', align: 'right' as const, render: (val: any, rec: any) => `${(Number(rec.quantity || 0) * Number(rec.unit_price || 0)).toLocaleString()} ₫` }]} dataSource={record.items} pagination={false} size="small" rowKey="id" bordered />;
                                            }
                                        }}
                                    />
                                )
                            }
                        ]} />
                    </Card>
                )}
            </Drawer>
        </div>
    );
}
