import React, { useState } from 'react';
import { Card, Typography, Space, Button, Row, Col, Tag } from 'antd';
import {
  FileExcelOutlined,
  CloudUploadOutlined,
  DownloadOutlined,
  AppstoreAddOutlined,
  TeamOutlined,
  ShoppingCartOutlined,
  ShopOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { API_URL } from '../config';
import ExcelUploadModal from '../components/ExcelUploadModal';

const { Title, Paragraph, Text } = Typography;

type ImportType = 'materials' | 'products' | 'boms' | 'combos' | 'customers' | 'sales' | 'suppliers';

interface ImportCardConfig {
  id: ImportType;
  title: string;
  subTitle: string;
  desc: string;
  color: string;
  icon: React.ReactNode;
  tags: string[];
}

const IMPORT_MODULES: ImportCardConfig[] = [
  {
    id: 'materials',
    title: '1. Nguyên Liệu',
    subTitle: 'Danh mục nguyên phụ liệu',
    desc: 'Mã NL, Tên, ĐVT tiêu hao & mua hàng, Hệ số quy đổi, Giá mua, Giá vốn BOM, Tồn kho, Nhà cung cấp.',
    color: '#1890ff',
    icon: <FileExcelOutlined style={{ fontSize: 36, color: '#1890ff' }} />,
    tags: ['Vải, Gòn, Chỉ', 'Quy đổi ĐVT', 'Giá vốn BOM'],
  },
  {
    id: 'products',
    title: '2. Sản Phẩm',
    subTitle: 'Thành phẩm & Hàng bán',
    desc: 'Mã SKU, Tên, Giá bán, Giá vốn, Tồn kho, Màu, Size, Chất liệu, Mô tả báo giá, Mô tả gia công, Mô tả VAT, Tags.',
    color: '#52c41a',
    icon: <AppstoreAddOutlined style={{ fontSize: 36, color: '#52c41a' }} />,
    tags: ['SKU lẻ / Combo', 'Mô tả báo giá', 'Diễn giải VAT'],
  },
  {
    id: 'boms',
    title: '3. Định Mức (BOM)',
    subTitle: 'Công thức sản xuất',
    desc: 'Liên kết Mã Sản Phẩm với Mã Nguyên Liệu, Định mức tiêu hao/SP, Tỷ lệ hao hụt (%) và Ghi chú công đoạn.',
    color: '#fa8c16',
    icon: <FileExcelOutlined style={{ fontSize: 36, color: '#fa8c16' }} />,
    tags: ['Định mức SP lẻ', '% Hao hụt', 'Ghi chú công đoạn'],
  },
  {
    id: 'combos',
    title: '4. Bộ / Combo',
    subTitle: 'Định nghĩa thành phần bộ',
    desc: 'Khai báo Mã SP Cha (Bộ/Combo), Mã SP Con (Thành phần), Số lượng con trong bộ và Thứ tự hiển thị.',
    color: '#722ed1',
    icon: <AppstoreAddOutlined style={{ fontSize: 36, color: '#722ed1' }} />,
    tags: ['Mã bộ/combo', 'SP thành phần', 'Thứ tự hiển thị'],
  },
  {
    id: 'customers',
    title: '5. Khách Hàng (CRM)',
    subTitle: 'Khách hàng & Lead CRM',
    desc: 'Mã KH, Tên, Loại (Lead/Customer), SĐT, Email, Địa chỉ, Tỉnh/Thành, MST, Pháp nhân, Email nhận HĐĐT, Hạn mức nợ.',
    color: '#eb2f96',
    icon: <TeamOutlined style={{ fontSize: 36, color: '#eb2f96' }} />,
    tags: ['Khách hàng & Lead', 'Thông tin xuất HĐ', 'Hạn mức nợ'],
  },
  {
    id: 'suppliers',
    title: '6. Nhà Cung Cấp',
    subTitle: 'Đối tác & Xưởng gia công',
    desc: 'Mã NCC, Tên, Loại (Vật tư, Gia công, Dịch vụ...), SĐT, Email, Địa chỉ, MST, Tên pháp nhân, Địa chỉ VAT, Công nợ.',
    color: '#fa541c',
    icon: <ShopOutlined style={{ fontSize: 36, color: '#fa541c' }} />,
    tags: ['NCC Vật tư', 'Xưởng gia công', 'Thông tin thuế'],
  },
  {
    id: 'sales',
    title: '7. Đơn Hàng (Sales)',
    subTitle: 'Nhập đơn hàng hàng loạt',
    desc: 'Mã KH, Ngày đặt, Ngày hẹn giao, Mã SP, Số lượng, Đơn giá, Màu sắc, Người nhận, SĐT nhận, Địa chỉ giao, Chiết khấu, VAT.',
    color: '#13c2c2',
    icon: <ShoppingCartOutlined style={{ fontSize: 36, color: '#13c2c2' }} />,
    tags: ['Tạo nhiều đơn/items', 'Thông tin giao hàng', 'Chiết khấu & VAT'],
  },
];

const UploadPage: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<ImportType>('materials');
  const [modalTitle, setModalTitle] = useState('');

  const handleDownloadTemplate = (type: ImportType) => {
    window.open(`${API_URL}/upload/template/${type}`, '_blank');
  };

  const openImportModal = (type: ImportType, title: string) => {
    setModalType(type);
    setModalTitle(title);
    setModalOpen(true);
  };

  return (
    <div style={{ padding: '4px 0' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ marginBottom: 4 }}>
          Trung Tâm Nhập Liệu Excel
        </Title>
        <Text type="secondary" style={{ fontSize: 14 }}>
          Nhập dữ liệu hàng loạt từ file Excel chuẩn vào hệ thống ERP4U. Tải file mẫu bên dưới để đảm bảo đúng định dạng cột.
        </Text>
      </div>

      <Row gutter={[20, 20]}>
        {IMPORT_MODULES.map((mod) => (
          <Col xs={24} sm={12} lg={8} xl={6} key={mod.id}>
            <Card
              hoverable
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 8,
                borderTop: `4px solid ${mod.color}`,
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}
              bodyStyle={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                padding: 20,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 12 }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 8,
                    background: `${mod.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {mod.icon}
                </div>
                <div>
                  <Title level={4} style={{ margin: 0, fontSize: 16 }}>
                    {mod.title}
                  </Title>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {mod.subTitle}
                  </Text>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                {mod.tags.map((tag, idx) => (
                  <Tag key={idx} color="default" style={{ fontSize: 11, marginBottom: 4 }}>
                    {tag}
                  </Tag>
                ))}
              </div>

              <Paragraph
                type="secondary"
                style={{
                  fontSize: 13,
                  lineHeight: '1.5',
                  flex: 1,
                  marginBottom: 16,
                }}
              >
                {mod.desc}
              </Paragraph>

              <Space direction="vertical" style={{ width: '100%', marginTop: 'auto' }}>
                <Button
                  type="default"
                  icon={<DownloadOutlined />}
                  onClick={() => handleDownloadTemplate(mod.id)}
                  block
                  style={{ fontSize: 13 }}
                >
                  Tải File Mẫu
                </Button>
                <Button
                  type="primary"
                  icon={<CloudUploadOutlined />}
                  block
                  style={{
                    background: mod.color,
                    borderColor: mod.color,
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                  onClick={() => openImportModal(mod.id, mod.title)}
                >
                  Mở Công Cụ Import
                </Button>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

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