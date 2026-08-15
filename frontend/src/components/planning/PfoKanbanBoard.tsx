import React, { useState } from 'react';
import { 
    Card, Tag, Typography, Button, Progress, Tooltip, Badge, Modal, 
    Spin, Alert, Space, Divider, message, Input 
} from 'antd';
import { 
    ClockCircleOutlined, 
    ShopOutlined, 
    WarningOutlined,
    CalculatorOutlined,
    UserAddOutlined,
    ShoppingCartOutlined,
    FileTextOutlined,
    CheckCircleOutlined,
    InfoCircleOutlined,
    ArrowRightOutlined,
    DragOutlined,
    ExclamationCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../utils/api';

const { Text, Title } = Typography;

interface PfoKanbanBoardProps {
    pfos: any[];
    onPfoClick: (pfo: any) => void;
    onRefresh?: () => void;
}

interface ColumnConfig {
    key: string;
    title: string;
    color: string;
    matchingStatuses: string[];
}

const COLUMNS: ColumnConfig[] = [
    { key: 'DRAFT', title: 'Khởi tạo / Tính BOM', color: '#8c8c8c', matchingStatuses: ['DRAFT', 'PENDING_APPROVAL'] },
    { key: 'WAITING_VENDOR', title: 'Chờ Giao Gia Công', color: '#fa8c16', matchingStatuses: ['WAITING_VENDOR'] },
    { key: 'MATERIAL_PREP', title: 'Chuẩn bị NPL', color: '#1890ff', matchingStatuses: ['MATERIAL_PREP'] },
    { key: 'IN_PRODUCTION', title: 'Đang Sản Xuất', color: '#52c41a', matchingStatuses: ['IN_PRODUCTION', 'QC'] },
    { key: 'RECEIVING', title: 'Chờ Nhập Kho', color: '#722ed1', matchingStatuses: ['RECEIVING', 'READY_TO_SHIP', 'RECONCILIATION'] },
    { key: 'COMPLETED', title: 'Hoàn Thành', color: '#389e0d', matchingStatuses: ['COMPLETED', 'CLOSED'] },
    { key: 'CANCELLED', title: 'Hủy', color: '#f5222d', matchingStatuses: ['CANCELLED'] },
];

const PfoKanbanBoard: React.FC<PfoKanbanBoardProps> = ({ pfos, onPfoClick, onRefresh }) => {
    // Drag & Drop State
    const [draggedPfo, setDraggedPfo] = useState<any | null>(null);
    const [dragOverColKey, setDragOverColKey] = useState<string | null>(null);

    // Modal Validation State
    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
    const [pendingMove, setPendingMove] = useState<{ pfo: any; fromCol: ColumnConfig; toCol: ColumnConfig } | null>(null);
    const [validating, setValidating] = useState(false);
    const [validationDetails, setValidationDetails] = useState<any>(null);
    const [confirmLoading, setConfirmLoading] = useState(false);
    
    // Search State
    const [searchTerm, setSearchTerm] = useState('');

    const getPfosByColumn = (col: ColumnConfig) => {
        let filteredPfos = pfos;
        
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            filteredPfos = filteredPfos.filter(pfo => {
                const customerName = pfo.sales_order?.customer?.name || '';
                const soCode = pfo.sales_order?.order_code || pfo.sales_order_code || '';
                const pfoCode = pfo.code || '';
                
                return customerName.toLowerCase().includes(lowerSearch) || 
                       soCode.toLowerCase().includes(lowerSearch) ||
                       pfoCode.toLowerCase().includes(lowerSearch);
            });
        }
        
        return filteredPfos.filter(pfo => {
            const isCancelled = pfo.status === 'CANCELLED' || pfo.sales_order?.status === 'CANCELLED';
            if (col.key === 'CANCELLED') return isCancelled;
            if (isCancelled) return false;

            if (col.matchingStatuses.includes(pfo.status)) return true;
            return pfo.status === col.key;
        });
    };

    const findColumnForPfo = (pfo: any): ColumnConfig => {
        const isCancelled = pfo.status === 'CANCELLED' || pfo.sales_order?.status === 'CANCELLED';
        if (isCancelled) return COLUMNS.find(c => c.key === 'CANCELLED') || COLUMNS[0];
        return COLUMNS.find(c => c.matchingStatuses.includes(pfo.status) || c.key === pfo.status) || COLUMNS[0];
    };

    // --- Drag & Drop Handlers ---
    const handleDragStart = (e: React.DragEvent, pfo: any) => {
        e.dataTransfer.setData('text/plain', String(pfo.id));
        e.dataTransfer.effectAllowed = 'move';
        setDraggedPfo(pfo);
    };

    const handleDragEnd = () => {
        setDraggedPfo(null);
        setDragOverColKey(null);
    };

    const handleDragOver = (e: React.DragEvent, colKey: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverColKey !== colKey) {
            setDragOverColKey(colKey);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragOverColKey(null);
    };

    const handleDrop = async (e: React.DragEvent, targetColKey: string) => {
        e.preventDefault();
        setDragOverColKey(null);
        if (!draggedPfo) return;

        const fromCol = findColumnForPfo(draggedPfo);
        const toCol = COLUMNS.find(c => c.key === targetColKey) || COLUMNS[0];

        if (fromCol.key === toCol.key) {
            // Drop in same column, do nothing
            return;
        }

        // Open validation & confirmation modal
        initiateMoveConfirmation(draggedPfo, fromCol, toCol);
    };

    const initiateMoveConfirmation = async (pfo: any, fromCol: ColumnConfig, toCol: ColumnConfig) => {
        setPendingMove({ pfo, fromCol, toCol });
        setIsMoveModalOpen(true);
        setValidating(true);
        setValidationDetails(null);

        try {
            const [posRes, pxksRes] = await Promise.all([
                api.get(`/planning/pfo/${pfo.id}/pos`).catch(() => ({ data: { pos_npl: [], pos_gc: [] } })),
                api.get(`/planning/pfo/${pfo.id}/pxks`).catch(() => ({ data: { pxk_npl: [], pxk_gc: [] } }))
            ]);

            setValidationDetails({
                pos_npl: posRes.data?.pos_npl || [],
                pos_gc: posRes.data?.pos_gc || [],
                pxk_npl: pxksRes.data?.pxk_npl || [],
            });
        } catch (err) {
            console.error('Error fetching PFO validation details:', err);
            setValidationDetails({
                pos_npl: [],
                pos_gc: [],
                pxk_npl: []
            });
        } finally {
            setValidating(false);
        }
    };

    const handleConfirmMove = async () => {
        if (!pendingMove) return;
        setConfirmLoading(true);
        try {
            await api.put(`/planning/pfo/${pendingMove.pfo.id}/status`, {
                status: pendingMove.toCol.key
            });
            message.success(`Đã chuyển trạng thái Lệnh SX [${pendingMove.pfo.code}] sang: ${pendingMove.toCol.title}`);
            setIsMoveModalOpen(false);
            setPendingMove(null);
            if (onRefresh) onRefresh();
        } catch (err: any) {
            message.error(err.response?.data?.message || 'Không thể cập nhật trạng thái Lệnh SX');
        } finally {
            setConfirmLoading(false);
        }
    };

    // Build checklist & warnings
    const renderValidationContent = () => {
        if (!pendingMove) return null;
        if (validating) {
            return (
                <div style={{ textAlign: 'center', padding: '30px 0' }}>
                    <Spin tip="Đang kiểm tra và xác thực dữ liệu đơn hàng..." />
                </div>
            );
        }

        const { pfo, toCol } = pendingMove;
        const posNpl = validationDetails?.pos_npl || [];
        const posGc = validationDetails?.pos_gc || [];
        const pxkNpl = validationDetails?.pxk_npl || [];

        const hasBom = pfo.material_requirements && pfo.material_requirements.length > 0;
        const hasRouting = pfo.milestones && pfo.milestones.length > 0;
        const hasVendor = pfo.vendor_name || pfo.vendor_id || (hasRouting && pfo.milestones.some((m: any) => m.vendor_id));
        const hasPoNpl = posNpl.length > 0;
        const hasPoGc = posGc.length > 0;
        const hasPxk = pxkNpl.length > 0;

        const checks: { label: string; pass: boolean; info: string; severity: 'success' | 'warning' | 'info' }[] = [];
        const warnings: string[] = [];

        // 1. BOM check
        if (hasBom) {
            checks.push({
                label: 'Định mức BOM & Nhu cầu NPL',
                pass: true,
                info: `Đã tính toán ${pfo.material_requirements.length} danh mục nguyên phụ liệu`,
                severity: 'success'
            });
        } else {
            checks.push({
                label: 'Định mức BOM & Nhu cầu NPL',
                pass: false,
                info: 'Chưa có dữ liệu định mức BOM được lưu',
                severity: 'warning'
            });
            if (toCol.key !== 'DRAFT') {
                warnings.push('Lệnh SX chưa tính BOM & nhu cầu nguyên phụ liệu.');
            }
        }

        // 2. Routing / Vendor check
        if (hasVendor) {
            checks.push({
                label: 'Quy trình & Xưởng gia công',
                pass: true,
                info: `Đã gán xưởng: ${pfo.vendor_name || (hasRouting ? pfo.milestones.map((m: any) => m.vendor_name).filter(Boolean).join(', ') : 'Đã gán')}`,
                severity: 'success'
            });
        } else {
            checks.push({
                label: 'Quy trình & Xưởng gia công',
                pass: false,
                info: 'Chưa thiết lập quy trình hoặc chưa gán xưởng gia công',
                severity: 'warning'
            });
            if (['WAITING_VENDOR', 'MATERIAL_PREP', 'IN_PRODUCTION'].includes(toCol.key)) {
                warnings.push('Chưa gán xưởng / nhà gia công cho các công đoạn.');
            }
        }

        // 3. PO check
        if (hasPoNpl || hasPoGc) {
            checks.push({
                label: 'Đơn Đặt Hàng & Gia Công (PO)',
                pass: true,
                info: `Đã phát hành: ${posNpl.length} PO Mua NPL, ${posGc.length} PO Gia Công`,
                severity: 'success'
            });
        } else {
            checks.push({
                label: 'Đơn Đặt Hàng & Gia Công (PO)',
                pass: false,
                info: 'Chưa phát hành đơn PO nào',
                severity: 'warning'
            });
            if (['MATERIAL_PREP', 'IN_PRODUCTION'].includes(toCol.key)) {
                warnings.push('Chưa phát hành PO Mua NPL hoặc PO Gia Công.');
            }
        }

        // 4. Goods Issue (PXK) check
        if (hasPxk) {
            checks.push({
                label: 'Xuất kho NPL cho Xưởng (PXK)',
                pass: true,
                info: `Đã tạo ${pxkNpl.length} Phiếu xuất kho NPL từ tồn kho`,
                severity: 'success'
            });
        } else {
            checks.push({
                label: 'Xuất kho NPL cho Xưởng (PXK)',
                pass: false,
                info: 'Chưa có phiếu xuất kho NPL nào từ kho',
                severity: toCol.key === 'IN_PRODUCTION' ? 'warning' : 'info'
            });
            if (toCol.key === 'IN_PRODUCTION' && !hasPoGc) {
                warnings.push('Chưa xuất NPL hoặc chưa phát hành PO Gia Công trước khi sản xuất.');
            }
        }

        return (
            <div>
                <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: 10, marginBottom: 16, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text strong style={{ fontSize: 15, color: '#1e293b' }}>
                            {pfo.code}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                            Đơn hàng: <b style={{ color: '#1890ff' }}>{pfo.sales_order?.order_code || 'N/A'}</b>
                        </Text>
                    </div>
                    <div style={{ fontSize: 13, color: '#475569' }}>
                        Khách hàng: <b>{pfo.sales_order?.customer?.name || 'N/A'}</b>
                    </div>
                    {pfo.committed_finish_date && (
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                            Hạn hoàn thành: {dayjs(pfo.committed_finish_date).format('DD/MM/YYYY')}
                        </div>
                    )}
                </div>

                <div style={{ marginBottom: 16 }}>
                    <Text strong style={{ fontSize: 13, color: '#334155', display: 'block', marginBottom: 8 }}>
                        📋 Kết quả kiểm tra điều kiện chuyển trạng thái:
                    </Text>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {checks.map((c, idx) => (
                            <div 
                                key={idx} 
                                style={{ 
                                    display: 'flex', 
                                    alignItems: 'flex-start', 
                                    gap: 10, 
                                    background: c.pass ? '#f6ffed' : (c.severity === 'warning' ? '#fffbe6' : '#f0f5ff'), 
                                    padding: '8px 12px', 
                                    borderRadius: 8,
                                    border: `1px solid ${c.pass ? '#b7eb8f' : (c.severity === 'warning' ? '#ffe58f' : '#adc6ff')}`
                                }}
                            >
                                {c.pass ? (
                                    <CheckCircleOutlined style={{ color: '#52c41a', marginTop: 2, fontSize: 14 }} />
                                ) : c.severity === 'warning' ? (
                                    <WarningOutlined style={{ color: '#faad14', marginTop: 2, fontSize: 14 }} />
                                ) : (
                                    <InfoCircleOutlined style={{ color: '#1890ff', marginTop: 2, fontSize: 14 }} />
                                )}
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13, color: '#1f2937' }}>{c.label}</div>
                                    <div style={{ fontSize: 12, color: '#6b7280' }}>{c.info}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {warnings.length > 0 ? (
                    <Alert
                        message="Cảnh báo quy trình"
                        description={
                            <ul style={{ margin: 0, paddingLeft: 18 }}>
                                {warnings.map((w, i) => (
                                    <li key={i}>{w}</li>
                                ))}
                            </ul>
                        }
                        type="warning"
                        showIcon
                        style={{ borderRadius: 8 }}
                    />
                ) : (
                    <Alert
                        message="Điều kiện hợp lệ"
                        description={`Các tiêu chuẩn của giai đoạn ${toCol.title} đã được đáp ứng đầy đủ.`}
                        type="success"
                        showIcon
                        style={{ borderRadius: 8 }}
                    />
                )}
            </div>
        );
    };

    const renderCard = (pfo: any) => {
        const isLate = pfo.committed_finish_date && dayjs().isAfter(dayjs(pfo.committed_finish_date));
        const soCode = pfo.sales_order?.order_code || pfo.sales_order_code || pfo.code?.replace('PFO-', '');
        const isBeingDragged = draggedPfo?.id === pfo.id;

        // Dynamic vendor name resolution
        let resolvedVendorName = pfo.vendor_name;
        if (!resolvedVendorName && pfo.milestones && pfo.milestones.length > 0) {
            const vNames = Array.from(new Set(pfo.milestones.map((m: any) => m.vendor_name).filter(Boolean)));
            if (vNames.length > 0) resolvedVendorName = vNames.join(', ');
        }
        if (!resolvedVendorName && pfo.vendor_id) {
            resolvedVendorName = `Xưởng #${pfo.vendor_id}`;
        }
        
        return (
            <div
                key={pfo.id}
                draggable
                onDragStart={(e) => handleDragStart(e, pfo)}
                onDragEnd={handleDragEnd}
                style={{
                    opacity: isBeingDragged ? 0.4 : 1,
                    cursor: 'grab',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    marginBottom: 12
                }}
            >
                <Card 
                    size="small" 
                    hoverable 
                    style={{ 
                        borderRadius: 12,
                        borderLeft: `4px solid ${isLate ? '#ff4d4f' : '#1890ff'}`,
                        boxShadow: isBeingDragged ? '0 8px 24px rgba(0,0,0,0.15)' : '0 2px 8px rgba(0,0,0,0.04)',
                        background: '#ffffff',
                        borderTop: '1px solid #f0f0f0',
                        borderRight: '1px solid #f0f0f0',
                        borderBottom: '1px solid #f0f0f0',
                    }}
                    bodyStyle={{ padding: 14 }}
                    onClick={() => onPfoClick(pfo)}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <DragOutlined style={{ color: '#bfbfbf', fontSize: 12, cursor: 'grab' }} />
                            <Text strong style={{ fontSize: 14, color: '#1f1f1f' }}>{pfo.code}</Text>
                        </div>
                        {isLate ? (
                            <Tooltip title="Trễ tiến độ giao hàng">
                                <Tag color="error" style={{ margin: 0, fontSize: 11 }}>Trễ hạn</Tag>
                            </Tooltip>
                        ) : (
                            <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>{pfo.status}</Tag>
                        )}
                    </div>
                    
                    {soCode && (
                        <div style={{ fontSize: 12, color: '#1890ff', fontWeight: 600, marginBottom: 4 }}>
                            <FileTextOutlined style={{ marginRight: 4 }} /> Đơn hàng: {soCode}
                        </div>
                    )}
                    <div style={{ fontSize: 12, color: '#595959', fontWeight: 600, marginBottom: 6 }}>
                        <UserAddOutlined style={{ marginRight: 4 }} /> Khách: {pfo.sales_order?.customer?.name || 'N/A'}
                    </div>
                    
                    <div style={{ fontSize: 12, color: resolvedVendorName ? '#389e0d' : '#fa8c16', fontWeight: resolvedVendorName ? 500 : 400, marginBottom: 6 }}>
                        <ShopOutlined style={{ marginRight: 4 }} /> {resolvedVendorName || 'Chưa gán xưởng'}
                    </div>
                    
                    <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 10 }}>
                        <ClockCircleOutlined style={{ marginRight: 4 }} /> Deadline: {pfo.committed_finish_date ? dayjs(pfo.committed_finish_date).format('DD/MM/YYYY') : 'N/A'}
                    </div>
                    
                    {['IN_PRODUCTION', 'RECEIVING'].includes(pfo.status) && (
                        <div style={{ marginTop: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                                <Text type="secondary">Tiến độ gia công</Text>
                                <Text strong style={{ color: '#52c41a' }}>{pfo.progress || 0}%</Text>
                            </div>
                            <Progress percent={pfo.progress || 0} size="small" showInfo={false} strokeColor="#52c41a" />
                        </div>
                    )}

                    <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed #f0f0f0', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {pfo.status === 'DRAFT' && (
                            <Button size="small" type="primary" ghost icon={<CalculatorOutlined />} style={{ borderRadius: 6, fontSize: 12 }}>
                                Tính BOM & Vật tư
                            </Button>
                        )}
                        {pfo.status === 'WAITING_VENDOR' && (
                            <Button size="small" type="primary" icon={<UserAddOutlined />} style={{ borderRadius: 6, fontSize: 12 }}>
                                Gán Xưởng
                            </Button>
                        )}
                        {pfo.status === 'MATERIAL_PREP' && (
                            <Button size="small" type="default" icon={<ShoppingCartOutlined />} style={{ borderRadius: 6, fontSize: 12, borderColor: '#1890ff', color: '#1890ff' }}>
                                Cấp NPL / Tạo PO
                            </Button>
                        )}
                        {['IN_PRODUCTION', 'RECEIVING', 'COMPLETED'].includes(pfo.status) && (
                            <Text type="secondary" style={{ fontSize: 11 }}>Click xem chi tiết &rarr;</Text>
                        )}
                    </div>
                </Card>
            </div>
        );
    };

    return (
        <>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-start' }}>
                <Input.Search
                    placeholder="Tìm kiếm theo mã Lệnh KHSX, mã SO hoặc tên khách hàng..."
                    allowClear
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onSearch={(value) => setSearchTerm(value)}
                    style={{ width: 450 }}
                />
            </div>
            
            <div style={{ display: 'flex', overflowX: 'auto', paddingBottom: 16, minHeight: 560, gap: 16 }}>
                {COLUMNS.map(col => {
                    const colPfos = getPfosByColumn(col);
                    const isDragOver = dragOverColKey === col.key;
                    
                    return (
                        <div 
                            key={col.key} 
                            onDragOver={(e) => handleDragOver(e, col.key)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, col.key)}
                            style={{ 
                                flex: '1 0 270px',
                                minWidth: 270, 
                                maxWidth: 320, 
                                background: isDragOver ? '#e6f7ff' : '#f7f8fa', 
                                border: isDragOver ? '2px dashed #1890ff' : '1px solid #e8e8e8',
                                borderRadius: 14, 
                                padding: '14px 12px',
                                display: 'flex',
                                flexDirection: 'column',
                                transition: 'all 0.2s ease',
                                boxShadow: isDragOver ? '0 0 12px rgba(24,144,255,0.2)' : 'none'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, padding: '0 4px' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13, color: '#262626' }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: col.color, display: 'inline-block' }}></span>
                                    {col.title}
                                </span>
                                <Tag color="default" style={{ borderRadius: 10, margin: 0, fontWeight: 600 }}>
                                    {colPfos.length}
                                </Tag>
                            </div>
                            
                            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 2, minHeight: 120 }}>
                                {colPfos.map(pfo => renderCard(pfo))}
                                {colPfos.length === 0 && (
                                    <div style={{ 
                                        textAlign: 'center', 
                                        color: '#bfbfbf', 
                                        padding: '36px 0', 
                                        border: isDragOver ? '1px dashed #1890ff' : '1px dashed #d9d9d9', 
                                        borderRadius: 8, 
                                        fontSize: 12,
                                        background: isDragOver ? '#ffffff' : 'transparent'
                                    }}>
                                        {isDragOver ? 'Thả vào đây để chuyển trạng thái' : 'Không có lệnh SX'}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal Xác nhận & Validate Chuyển Trạng Thái */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
                        <ExclamationCircleOutlined style={{ color: '#1890ff' }} />
                        <span>Xác nhận chuyển trạng thái Lệnh SX</span>
                    </div>
                }
                open={isMoveModalOpen}
                onCancel={() => {
                    if (!confirmLoading) {
                        setIsMoveModalOpen(false);
                        setPendingMove(null);
                    }
                }}
                footer={[
                    <Button 
                        key="cancel" 
                        disabled={confirmLoading}
                        onClick={() => {
                            setIsMoveModalOpen(false);
                            setPendingMove(null);
                        }}
                    >
                        Hủy bỏ
                    </Button>,
                    <Button 
                        key="confirm" 
                        type="primary" 
                        loading={confirmLoading}
                        disabled={validating}
                        onClick={handleConfirmMove}
                        style={{ background: pendingMove?.toCol.color || '#1890ff', borderColor: pendingMove?.toCol.color || '#1890ff' }}
                    >
                        Xác nhận chuyển sang: {pendingMove?.toCol.title}
                    </Button>
                ]}
                width={560}
                destroyOnClose
            >
                {pendingMove && (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, margin: '12px 0 18px 0', padding: '10px', background: '#fafafa', borderRadius: 8 }}>
                            <Tag color="default" style={{ fontSize: 13, padding: '4px 10px' }}>
                                {pendingMove.fromCol.title}
                            </Tag>
                            <ArrowRightOutlined style={{ color: '#8c8c8c', fontSize: 14 }} />
                            <Tag color="blue" style={{ fontSize: 13, padding: '4px 10px', fontWeight: 600 }}>
                                {pendingMove.toCol.title}
                            </Tag>
                        </div>

                        {renderValidationContent()}
                    </div>
                )}
            </Modal>
        </>
    );
};

export default PfoKanbanBoard;

