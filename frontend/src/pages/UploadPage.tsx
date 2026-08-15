import React, { useState } from 'react';
import { Upload, Button, message, Card, Typography, Space } from 'antd';
import { FileExcelOutlined, CloudUploadOutlined, DownloadOutlined, AppstoreAddOutlined, TeamOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import axios from 'axios';
import { API_URL } from '../config';
import ExcelUploadModal from '../components/ExcelUploadModal';

const { Title, Paragraph } = Typography;

const UploadPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'sales' | 'customers' | 'products' | 'materials' | 'boms' | 'combos'>('sales');
  const [modalTitle, setModalTitle] = useState('');

  // --- LEGACY UPLOAD HANDLER (cho các mục cũ chưa dùng Modal) ---
  const handleUpload = async (endpoint: string, file: File) => {
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(`${API_URL}/upload/${endpoint}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success(`Upload thành công! Đã xử lý ${res.data.count || 0} dòng.`);
    } catch (error) { message.error('Upload thất bại.'); }
    finally { setLoading(false); }
  };

  const handleDownloadTemplate = (type: string) => {
    window.open(`${API_URL}/upload/template/${type}`, '_blank');
  };

  const getUploadProps = (endpoint: string): UploadProps => ({
    beforeUpload: (file) => { handleUpload(endpoint, file); return false; },
    showUploadList: false,
  });

  const uploadCard = (title: string, endpoint: string, desc: string, color: string, icon: any, useModal: boolean = false) => (
    <Card hoverable style={{ textAlign: 'center', borderTop: `4px solid ${color}` }}>
      {icon}
      <Title level={4}>{title}</Title>
      <Paragraph type="secondary" style={{ minHeight: 44 }}>{desc}</Paragraph>
      <Space direction="vertical" style={{ width: '100%' }}>
        {!useModal ? (
          <>
            <Button icon={<DownloadOutlined />} onClick={() => handleDownloadTemplate(endpoint)} block>Tải file mẫu</Button>
            <Upload {...getUploadProps(endpoint)}><Button type="primary" icon={<CloudUploadOutlined />} loading={loading} block style={{ background: color, borderColor: color }}>Chọn File Excel</Button></Upload>
          </>
        ) : (
          <Button
            type="primary"
            icon={<CloudUploadOutlined />}
            block
            style={{ background: color, borderColor: color, marginTop: 32 }}
            onClick={() => {
              setModalType(endpoint as any);
              setModalTitle(title);
              setModalOpen(true);
            }}
          >
            Mở Công Cụ Import
          </Button>
        )}
      </Space>
    </Card>
  );

  return (
    <div>
      <Title level={2} style={{ marginBottom: 30 }}>Nhập Liệu Hệ Thống</Title>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 24 }}>
        {uploadCard('1. Nguyên Liệu', 'materials', 'DS Vải, Gòn, Chỉ...', '#1890ff', <FileExcelOutlined style={{ fontSize: 40, color: '#1890ff', marginBottom: 16 }} />)}
        {uploadCard('2. Sản Phẩm', 'products', 'DS Mã SP lẻ & Mã Combo', '#52c41a', <AppstoreAddOutlined style={{ fontSize: 40, color: '#52c41a', marginBottom: 16 }} />)}
        {uploadCard('3. Công Thức (BOM)', 'boms', 'Định mức SX cho SP lẻ', '#fa8c16', <FileExcelOutlined style={{ fontSize: 40, color: '#fa8c16', marginBottom: 16 }} />)}
        {uploadCard('4. Combo / Bộ', 'combos', 'Định nghĩa thành phần bộ', '#722ed1', <AppstoreAddOutlined style={{ fontSize: 40, color: '#722ed1', marginBottom: 16 }} />)}
        {uploadCard('5. Khách Hàng (CRM)', 'customers', 'Import Lead & Customer', '#eb2f96', <TeamOutlined style={{ fontSize: 40, color: '#eb2f96', marginBottom: 16 }} />)}

        {/* --- 6. ĐƠN HÀNG (Dùng Modal mới) --- */}
        {uploadCard('6. Đơn Hàng (Sales)', 'sales', 'Tạo đơn hàng hàng loạt', '#13c2c2', <ShoppingCartOutlined style={{ fontSize: 40, color: '#13c2c2', marginBottom: 16 }} />, true)}
      </div>

      <ExcelUploadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        type={modalType}
        title={`Import Excel: ${modalTitle}`}
      />
    </div>
  );
};
export default UploadPage;