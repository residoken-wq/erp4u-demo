import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Spin, Alert, Button, Space, Typography, Tooltip } from 'antd';
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  ReloadOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import useMobile from '../../hooks/useMobile';
import { fetchDocumentFileBlobUrl } from './documentScanApi';

const { Text } = Typography;

export interface ScanReviewLayoutProps {
  scanId: string;
  sourceType?: 'image' | 'pdf' | 'xml' | string;
  duplicateWarning?: {
    transaction_id: number | string;
    message: string;
    link: string;
  } | null;
  children: React.ReactNode;
}

export const ScanReviewLayout: React.FC<ScanReviewLayoutProps> = ({
  scanId,
  sourceType = 'image',
  duplicateWarning,
  children,
}) => {
  const isMobile = useMobile();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(100);

  useEffect(() => {
    let currentBlobUrl: string | null = null;
    let isMounted = true;

    setLoading(true);
    setError(null);

    fetchDocumentFileBlobUrl(scanId)
      .then(({ blobUrl: url, mimeType: mime }) => {
        if (!isMounted) {
          URL.revokeObjectURL(url);
          return;
        }
        currentBlobUrl = url;
        setBlobUrl(url);
        setMimeType(mime);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Không thể tải file chứng từ gốc');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [scanId]);

  const isPdf = sourceType === 'pdf' || mimeType.includes('pdf');
  const isXml = sourceType === 'xml' || mimeType.includes('xml');

  return (
    <div style={{ width: '100%' }}>
      {/* Cảnh báo trùng giao dịch (nếu có) */}
      {duplicateWarning && (
        <Alert
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          message="Cảnh báo trùng hoá đơn"
          description={
            <div>
              <span>{duplicateWarning.message}. </span>
              {duplicateWarning.link && (
                <a href={duplicateWarning.link} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
                  Xem giao dịch cũ #{duplicateWarning.transaction_id}
                </a>
              )}
              <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>
                Hệ thống vẫn cho phép bạn lưu nếu đây là hoá đơn hợp lệ riêng biệt.
              </div>
            </div>
          }
          style={{ marginBottom: 16, borderRadius: 8, border: '1px solid #ffe58f' }}
        />
      )}

      {/* Legend độ tin cậy */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '8px 12px',
          background: '#f8fafc',
          borderRadius: 8,
          marginBottom: 16,
          border: '1px solid #e2e8f0',
          fontSize: 12,
        }}
      >
        <span style={{ fontWeight: 600, color: '#475569' }}>
          <InfoCircleOutlined style={{ marginRight: 4 }} /> Chú thích AI trích xuất:
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 14,
              height: 14,
              border: '2px solid #faad14', // Status warning yellow
              borderRadius: 3,
              background: '#fffbe6',
            }}
          />
          <Text style={{ color: '#d48806' }}>Viền vàng: AI đọc chưa chắc chắn, vui lòng kiểm tra</Text>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 14,
              height: 14,
              border: '2px solid #ff4d4f', // Status error red
              borderRadius: 3,
              background: '#fff1f0',
            }}
          />
          <Text style={{ color: '#cf1322' }}>Viền đỏ: Trường thiếu hoặc chưa khớp hệ thống</Text>
        </span>
      </div>

      <Row gutter={[16, 16]}>
        {/* Left Pane: File gốc */}
        <Col xs={24} lg={11}>
          <Card
            title={
              <Space>
                {isPdf ? <FilePdfOutlined style={{ color: '#ff4d4f' }} /> : isXml ? <FileTextOutlined style={{ color: '#1890ff' }} /> : <FileImageOutlined style={{ color: '#52c41a' }} />}
                <span>Chứng từ gốc</span>
              </Space>
            }
            extra={
              !isPdf && !isXml && blobUrl ? (
                <Space size="small">
                  <Button
                    size="small"
                    icon={<ZoomOutOutlined />}
                    onClick={() => setZoom((z) => Math.max(50, z - 25))}
                  />
                  <Text style={{ fontSize: 12 }}>{zoom}%</Text>
                  <Button
                    size="small"
                    icon={<ZoomInOutlined />}
                    onClick={() => setZoom((z) => Math.min(250, z + 25))}
                  />
                  <Button size="small" icon={<ReloadOutlined />} onClick={() => setZoom(100)} />
                </Space>
              ) : null
            }
            bodyStyle={{
              padding: 8,
              height: isMobile ? 320 : 640,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'auto',
              background: '#f1f5f9',
            }}
          >
            {loading ? (
              <div style={{ textAlign: 'center' }}>
                <Spin tip="Đang tải file gốc..." />
              </div>
            ) : error ? (
              <Alert type="error" message={error} showIcon />
            ) : blobUrl ? (
              isPdf ? (
                <iframe
                  src={blobUrl}
                  title="PDF Viewer"
                  style={{ width: '100%', height: '100%', border: 'none', borderRadius: 4 }}
                />
              ) : isXml ? (
                <iframe
                  src={blobUrl}
                  title="XML Viewer"
                  style={{ width: '100%', height: '100%', border: 'none', background: '#ffffff', borderRadius: 4 }}
                />
              ) : (
                <div style={{ textAlign: 'center', overflow: 'auto', width: '100%', height: '100%' }}>
                  <img
                    src={blobUrl}
                    alt="Chứng từ gốc"
                    style={{
                      width: `${zoom}%`,
                      maxWidth: 'none',
                      transition: 'width 0.2s',
                      borderRadius: 4,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    }}
                  />
                </div>
              )
            ) : (
              <Text type="secondary">Không có file hiển thị</Text>
            )}
          </Card>
        </Col>

        {/* Right Pane: Form nghiệp vụ */}
        <Col xs={24} lg={13}>
          <div style={{ minHeight: isMobile ? 'auto' : 640 }}>
            {children}
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default ScanReviewLayout;
