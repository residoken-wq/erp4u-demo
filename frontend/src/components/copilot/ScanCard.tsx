import React, { useState } from 'react';
import { Card, Tag, Button, Select, Space, Typography, message, theme } from 'antd';
import {
  FileSearchOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { DocumentScanResponse, patchScanDocumentKind } from '../documents/documentScanApi';

const { Text } = Typography;

export interface ScanCardProps {
  scan: DocumentScanResponse;
  onKindChanged?: (newKind: string) => void;
}

const KIND_INFO: Record<string, { label: string; route: string; color: string }> = {
  supplier_quote: {
    label: 'Báo giá / PO nhà cung cấp',
    route: '/purchasing',
    color: 'blue',
  },
  delivery_note: {
    label: 'Phiếu giao hàng (Nhập kho)',
    route: '/inventory',
    color: 'cyan',
  },
  expense_invoice: {
    label: 'Hoá đơn chi phí (Tài chính)',
    route: '/finance',
    color: 'purple',
  },
};

export const ScanCard: React.FC<ScanCardProps> = ({ scan, onKindChanged }) => {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const [currentKind, setCurrentKind] = useState<string>(scan.kind || 'supplier_quote');
  const [changing, setChanging] = useState<boolean>(false);

  const kindMeta = KIND_INFO[currentKind] || {
    label: currentKind,
    route: '/purchasing',
    color: 'default',
  };

  const handleKindChange = async (newKind: string) => {
    setChanging(true);
    try {
      await patchScanDocumentKind(scan.id, newKind);
      setCurrentKind(newKind);
      message.success('Đã cập nhật loại chứng từ');
      if (onKindChanged) {
        onKindChanged(newKind);
      }
    } catch (err: any) {
      message.error(err.message || 'Không thể đổi loại chứng từ');
    } finally {
      setChanging(false);
    }
  };

  const handleOpenReview = () => {
    const route = kindMeta.route;
    navigate(`${route}?aiScan=${scan.id}`);
  };

  return (
    <Card
      size="small"
      style={{
        marginTop: 10,
        borderRadius: 8,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
      bodyStyle={{ padding: '12px 14px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Space size={6}>
          <FileSearchOutlined style={{ color: token.colorPrimary, fontSize: 16 }} />
          <Text strong style={{ fontSize: 13, color: token.colorTextHeading }}>
            Chứng từ AI đã nhận diện
          </Text>
        </Space>
        <Tag color={kindMeta.color} style={{ borderRadius: 4, margin: 0 }}>
          {kindMeta.label}
        </Tag>
      </div>

      <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 12 }}>
        Định dạng: <b>{scan.source?.toUpperCase()}</b> &bull; Kích thước: <b>{(scan.size_bytes / 1024).toFixed(1)} KB</b>
        {scan.page_count > 1 ? ` • ${scan.page_count} trang` : ''}
      </div>

      <div style={{ background: token.colorBgLayout, padding: 8, borderRadius: 6, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 12, color: token.colorTextSecondary, flexShrink: 0 }}>
          <SwapOutlined /> Đổi loại chứng từ:
        </Text>
        <Select
          size="small"
          value={currentKind}
          loading={changing}
          onChange={handleKindChange}
          style={{ width: '100%' }}
          options={[
            { label: 'Báo giá / PO nhà cung cấp', value: 'supplier_quote' },
            { label: 'Phiếu giao hàng (Nhập kho)', value: 'delivery_note' },
            { label: 'Hoá đơn chi phí (Tài chính)', value: 'expense_invoice' },
          ]}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="primary"
          size="small"
          icon={<ArrowRightOutlined />}
          onClick={handleOpenReview}
          style={{ borderRadius: 6, background: token.colorPrimary, borderColor: token.colorPrimary }}
        >
          Mở để duyệt
        </Button>
      </div>
    </Card>
  );
};

export default ScanCard;
