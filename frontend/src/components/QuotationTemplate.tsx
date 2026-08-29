import React from 'react';
import { Row, Col, Typography, Table, Tag, Image } from 'antd';
import { CheckCircleFilled } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// --- FIX: ĐỊNH NGHĨA TYPE RÕ RÀNG ĐỂ TRÁNH LỖI TS2322 ---
interface QuotationProps {
    data: any;
}

const QuotationTemplate: React.FC<QuotationProps> = ({ data }) => {
    if (!data) return null;

    const isOrder = data.status !== 'QUOTATION';
    const docTitle = isOrder ? "ĐƠN ĐẶT HÀNG" : "BẢNG BÁO GIÁ";

    const paidAmount = Number(data.paid_amount) || 0;
    const remainingAmount = Number(data.total_amount) - paidAmount;
    const finalAmount = remainingAmount > 0 ? remainingAmount : Number(data.total_amount);

    const customerName = data.customer?.name || data.customer_name || data.receiver_name || 'Khách lẻ';
    const qrLink = `https://img.vietqr.io/image/ACB-141847859-compact2.jpg?amount=${Math.floor(finalAmount)}&addInfo=${data.order_code}&accountName=CTY TNHH TM DV TUONG LINH`;

    return (
        <div style={{ padding: 40, background: '#fff', fontSize: 14, fontFamily: "'Inter', sans-serif", color: '#1f2937' }}>

            {/* HEADER */}
            <Row gutter={40} align="stretch" style={{ borderBottom: '2px solid #1e3a8a', paddingBottom: 20, marginBottom: 30 }}>
                <Col span={12}>
                    <div style={{ textAlign: 'left', height: '100%', display: 'flex', alignItems: 'center' }}>
                        <Image preview={false} src="/company_header.png" alt="Company Header" style={{ width: '100%', objectFit: 'contain', objectPosition: 'left center' }} />
                    </div>
                </Col>
                <Col span={12} style={{ textAlign: 'right' }}>
                    <Title level={2} style={{ margin: 0, color: '#1e3a8a', textTransform: 'uppercase', fontFamily: "'Outfit', sans-serif", letterSpacing: '1px' }}>{docTitle}</Title>
                    <div>Số: <b>{data.order_code}</b></div>
                    <div>TP. HCM, ngày {dayjs(data.order_date).format('DD')} tháng {dayjs(data.order_date).format('MM')} năm {dayjs(data.order_date).format('YYYY')}</div>
                </Col>
            </Row>

            {/* THÔNG TIN 2 BÊN */}
            <Row gutter={40} style={{ marginBottom: 30 }}>
                <Col span={12}>
                    <div style={{ background: '#f8fafc', padding: 15, borderRadius: 8, height: '100%', border: '1px solid #e2e8f0' }}>
                        <h4 style={{ marginTop: 0, color: '#1e3a8a', borderBottom: '1px solid #cbd5e1', paddingBottom: 5, textTransform: 'uppercase', fontFamily: "'Outfit', sans-serif" }}>BÊN BÁN</h4>
                        <p style={{ marginBottom: 5 }}><b>CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ TƯỜNG LINH</b></p>
                        <p style={{ marginBottom: 5 }}>📍 74/21/24 Nguyễn Khuyến, Phường Bình Thạnh, TP. Hồ Chí Minh</p>
                        <p style={{ marginBottom: 5 }}>📞 0983.882210 - 0983.796654</p>
                        <p style={{ marginBottom: 5 }}><b>MST:</b> 0311.874.522</p>
                        <p style={{ marginBottom: 5 }}><b>Email:</b> nemmanonerp4u@gmail.com</p>
                        <p style={{ marginBottom: 0 }}><b>Sale Agent:</b> {data.created_by?.full_name || data.created_by?.name || data.sale_agent?.name || data.sale_name || '...'} - {data.created_by?.phone || data.sale_agent?.phone || data.sale_phone || '...'}</p>
                    </div>
                </Col>
                <Col span={12}>
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: 15, borderRadius: 8, height: '100%' }}>
                        <h4 style={{ marginTop: 0, color: '#1e3a8a', borderBottom: '1px solid #bfdbfe', paddingBottom: 5, textTransform: 'uppercase', fontFamily: "'Outfit', sans-serif" }}>BÊN MUA</h4>
                        <p style={{ marginBottom: 5, fontSize: 15 }}><b>{customerName}</b></p>
                        <p style={{ marginBottom: 5 }}>📍 {data.vat_address || data.shipping_address || '...'}</p>
                        <p style={{ marginBottom: 5 }}>📞 {data.customer?.phone || data.receiver_phone || '...'}</p>
                        <p style={{ marginBottom: 5 }}><b>MST:</b> {data.vat_tax_code || '...'}</p>
                        {data.contact_name && (
                            <p style={{ marginBottom: 5 }}><b>Người liên hệ:</b> {data.contact_name} {data.contact_phone ? `- ${data.contact_phone}` : ''}</p>
                        )}
                        {(data.shipping_address || data.customer?.address) && (
                            <p style={{ marginBottom: 5, whiteSpace: 'pre-wrap' }}><b>Địa chỉ giao hàng:</b> {data.shipping_address || data.customer?.address || ''}</p>
                        )}
                        {(data.receiver_name || data.receiver_phone) && (
                            <p style={{ marginBottom: 0 }}><b>Người nhận:</b> {data.receiver_name || customerName} {data.receiver_phone ? `- ${data.receiver_phone}` : ''}</p>
                        )}
                    </div>
                </Col>
            </Row>

            <p>Kính gửi Quý khách hàng bảng chi tiết các sản phẩm như sau:</p>

            {/* BẢNG SẢN PHẨM */}
            <Table
                dataSource={data.items}
                pagination={false}
                rowKey="id"
                bordered
                size="small"
                columns={[
                    { title: 'STT', width: 50, align: 'center', render: (_: any, __: any, index: number) => index + 1 },
                    {
                        title: 'Tên Sản phẩm',
                        render: (r: any) => {
                            const productName = r.product_name_real || r.product?.name || r.sku;
                            const vatName = r.vat_content;
                            return (
                                <div>
                                    <div style={{ fontWeight: 600 }}>{vatName || productName}</div>
                                    {vatName && (
                                        <div style={{ fontStyle: 'italic', fontSize: 12, color: '#555' }}>{productName}</div>
                                    )}
                                    {r.variant_color && <div style={{ fontSize: 12, color: '#666' }}>Màu: {r.variant_color}</div>}
                                    {r.is_sample_approved && <div style={{ marginTop: 5, fontSize: 12 }}><Tag color="success" icon={<CheckCircleFilled />}>Mẫu đã duyệt</Tag></div>}
                                </div>
                            );
                        }
                    },
                    // --- MỚI: CỘT MÔ TẢ SẢN PHẨM ---
                    {
                        title: 'Mô tả chi tiết',
                        width: '30%',
                        render: (r: any) => {
                            const desc = r.product?.customer_description || r.product_desc || '';
                            return <div style={{ whiteSpace: 'pre-line', fontSize: 12, color: '#555' }}>{desc}</div>;
                        }
                    },
                    // -------------------------------
                    { title: 'SL', dataIndex: 'quantity', align: 'center', width: 60, render: (v: any) => Number(v).toLocaleString() },
                    { title: 'ĐVT', width: 60, align: 'center', render: (t: any, r: any) => r.unit || 'Cái' },
                    { title: 'Đơn giá', dataIndex: 'unit_price', align: 'right', width: 100, render: (v: any) => Number(v).toLocaleString() },
                    { title: 'Thành tiền', dataIndex: 'subtotal', align: 'right', width: 110, render: (v: any) => <b>{Number(v).toLocaleString()}</b> }
                ]}
                summary={() => (
                    <>
                        <Table.Summary.Row>
                            <Table.Summary.Cell index={0} colSpan={6} align="right"><b>Tổng tiền hàng:</b></Table.Summary.Cell>
                            <Table.Summary.Cell index={1} align="right">
                                {data.items.reduce((s: number, i: any) => s + Number(i.subtotal), 0).toLocaleString()}
                            </Table.Summary.Cell>
                        </Table.Summary.Row>
                        <Table.Summary.Row>
                            <Table.Summary.Cell index={0} colSpan={6} align="right">Thuế GTGT ({data.vat_rate || 0}%):</Table.Summary.Cell>
                            <Table.Summary.Cell index={1} align="right">
                                {(Number(data.total_amount) - Number(data.shipping_fee || 0) - data.items.reduce((s: number, i: any) => s + Number(i.subtotal), 0)).toLocaleString()}
                            </Table.Summary.Cell>
                        </Table.Summary.Row>
                        <Table.Summary.Row>
                            <Table.Summary.Cell index={0} colSpan={6} align="right">Phí vận chuyển:</Table.Summary.Cell>
                            <Table.Summary.Cell index={1} align="right">{Number(data.shipping_fee || 0).toLocaleString()}</Table.Summary.Cell>
                        </Table.Summary.Row>
                        <Table.Summary.Row style={{ background: '#f1f5f9' }}>
                            <Table.Summary.Cell index={0} colSpan={6} align="right"><b style={{ fontSize: 16, color: '#1e3a8a', fontFamily: "'Outfit', sans-serif" }}>TỔNG CỘNG:</b></Table.Summary.Cell>
                            <Table.Summary.Cell index={1} align="right"><b style={{ fontSize: 16, color: '#dc2626' }}>{Number(data.total_amount).toLocaleString()} ₫</b></Table.Summary.Cell>
                        </Table.Summary.Row>
                        {paidAmount > 0 && (
                            <Table.Summary.Row>
                                <Table.Summary.Cell index={0} colSpan={6} align="right"><b style={{ color: 'green' }}>ĐÃ CỌC:</b></Table.Summary.Cell>
                                <Table.Summary.Cell index={1} align="right"><b style={{ color: 'green' }}>{paidAmount.toLocaleString()} ₫</b></Table.Summary.Cell>
                            </Table.Summary.Row>
                        )}
                    </>
                )}
            />

            <div style={{ marginTop: 20 }}><p><i>(Bằng chữ: .........................................................................................................................)</i></p></div>

            {/* FOOTER & THANH TOÁN */}
            <div style={{ marginTop: 30, display: 'flex', gap: 20 }}>
                <div style={{ flex: 1 }}>
                    <b style={{ textDecoration: 'underline' }}>GHI CHÚ & ĐIỀU KHOẢN:</b>
                    <div style={{ fontSize: 13, marginTop: 5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{data.terms_content || "Chưa có điều khoản."}</div>
                </div>
                {isOrder && (
                    <div style={{ width: 300, textAlign: 'center', border: '1px solid #ddd', padding: 10, borderRadius: 8 }}>
                        {Number(data.deposit_amount) > 0 && (
                            <div style={{ background: '#f9f0ff', padding: 10, borderRadius: 8, border: '1px solid #d3adf7', textAlign: 'center', marginBottom: 10 }}>
                                <div style={{ color: '#722ed1', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>💰 Cần đặt cọc ({data.deposit_percent || 0}%)</div>
                                <div style={{ fontSize: 16, fontWeight: '700', color: '#531dab' }}>{Number(data.deposit_amount).toLocaleString()} ₫</div>
                            </div>
                        )}

                        {paidAmount > 0 && (
                            <div style={{ background: '#f0f5ff', padding: 8, borderRadius: 8, border: '1px solid #adc6ff', textAlign: 'center', marginBottom: 8 }}>
                                <div style={{ color: '#2f54eb', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Đã thanh toán</div>
                                <div style={{ fontSize: 16, fontWeight: '700', color: '#1d39c4' }}>{paidAmount.toLocaleString()} ₫</div>
                            </div>
                        )}

                        <div style={{ background: '#f6ffed', padding: 10, borderRadius: 8, border: '1px solid #b7eb8f', textAlign: 'center', marginBottom: 10 }}>
                            <div style={{ color: '#52c41a', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Cần thanh toán</div>
                            <div style={{ fontSize: 18, fontWeight: '800', color: '#389e0d' }}>{(Number(data.total_amount) - paidAmount).toLocaleString()} ₫</div>
                        </div>
                        <div style={{ fontSize: 11, lineHeight: 1.6, textAlign: 'left', marginBottom: 15 }}>
                            <div><b>ACB - TP.HCM</b></div>
                            <div>STK: <span style={{ fontFamily: 'monospace', background: '#f0f0f0', padding: '0 4px' }}>141847859</span></div>
                            <div>Chủ TK: CTY TNHH TM DV TƯỜNG LINH</div>
                            <div>Nội dung: <b>{data.order_code}</b></div>
                        </div>
                        
                        <div style={{ marginBottom: 5, fontSize: 11, color: '#666' }}>Quét mã để thanh toán</div>
                        <Image src={qrLink} width={150} preview={false} />
                        <div style={{ marginTop: 5, fontWeight: 'bold', color: '#1890ff', fontSize: 12 }}>ERP4U PAYMENT</div>
                    </div>
                )}
            </div>

            <Row style={{ marginTop: 50, textAlign: 'center' }}>
                <Col span={12}><b>ĐẠI DIỆN KHÁCH HÀNG</b><br /><i>(Ký, ghi rõ họ tên)</i></Col>
                <Col span={12}><b>ĐẠI DIỆN CÔNG TY TƯỜNG LINH</b><br /><i>(Ký, đóng dấu)</i><div style={{ height: 80 }}></div></Col>
            </Row>
        </div>
    );
};

export default QuotationTemplate;