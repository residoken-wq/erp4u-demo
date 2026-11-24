import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Spin, Alert, Button, Space, Typography, theme } from 'antd';
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
import { getDocumentPreviewMode, DocumentPreviewMode } from './documentScanTransformers';

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
  const { token } = theme.useToken();
  const isMobile = useMobile();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');
  const [xmlContent, setXmlContent] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<DocumentPreviewMode>('unsupported');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(100);

  useEffect(() => {
    let currentBlobUrl: string | null = null;
    let isMounted = true;

    setLoading(true);
    setError(null);
    setXmlContent(null);
    setBlobUrl(null);

    fetchDocumentFileBlobUrl(scanId)
      .then(async ({ blobUrl: url, mimeType: mime, blob }) => {
        if (!isMounted) {
          URL.revokeObjectURL(url);
          return;
        }

        const mode = getDocumentPreviewMode(sourceType, mime);
        setMimeType(mime);
        setPreviewMode(mode);

        if (mode === 'text') {
          // XML: đọc text thuần qua blob.text(), tuyệt đối không dùng iframe/object/dangerouslySetInnerHTML
          URL.revokeObjectURL(url);
          currentBlobUrl = null;
          setBlobUrl(null);

          const fullText = await blob.text();
          const maxChars = 200 * 1024; // Giới hạn hiển thị 200 KB
          if (fullText.length > maxChars) {
            setXmlContent(fullText.slice(0, maxChars) + '\n\n... [Nội dung đã được cắt bớt vì vượt quá 200 KB]');
          } else {
            setXmlContent(fullText);
          }
        } else if (mode === 'pdf') {
          // PDF: chỉ tạo iframe khi blob.type === 'application/pdf'
          if (blob.type !== 'application/pdf') {
            const pdfBlob = new Blob([blob], { type: 'application/pdf' });
            URL.revokeObjectURL(url);
            const pdfUrl = URL.createObjectURL(pdfBlob);
            currentBlobUrl = pdfUrl;
            setBlobUrl(pdfUrl);
          } else {
            currentBlobUrl = url;
            setBlobUrl(url);
          }
        } else if (mode === 'image') {
          currentBlobUrl = url;
          setBlobUrl(url);
        } else {
          URL.revokeObjectURL(url);
          currentBlobUrl = null;
          setBlobUrl(null);
          setError('Định dạng file không được hỗ trợ để xem trước hoặc có nguy cơ bảo mật');
        }
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
  }, [scanId, sourceType]);

  const renderCardTitle = () => {
    let icon = <FileImageOutlined style={{ color: token.colorSuccess }} />;
    if (previewMode === 'pdf') {
      icon = <FilePdfOutlined style={{ color: token.colorError }} />;
    } else if (previewMode === 'text') {
      icon = <FileTextOutlined style={{ color: token.colorPrimary }} />;
    }
    return (
      <Space>
        {icon}
        <span>Chứng từ gốc</span>
      </Space>
    );
  };

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
                <a href={duplicateWarning.link} target="_blank" rel="noreferrer" style={{ fontWeight: 600, color: token.colorLink }}>
                  Xem giao dịch cũ #{duplicateWarning.transaction_id}
                </a>
              )}
              <div style={{ marginTop: 4, fontSize: 12, color: token.colorTextSecondary }}>
                Hệ thống vẫn cho phép bạn lưu nếu đây là hoá đơn hợp lệ riêng biệt.
              </div>
            </div>
          }
          style={{ marginBottom: 16, borderRadius: 8, border: `1px solid ${token.colorWarningBorder}` }}
        />
      )}

      {/* Legend độ tin cậy */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '8px 12px',
          background: token.colorBgLayout,
          borderRadius: 8,
          marginBottom: 16,
          border: `1px solid ${token.colorBorderSecondary}`,
          fontSize: 12,
        }}
      >
        <span style={{ fontWeight: 600, color: token.colorText }}>
          <InfoCircleOutlined style={{ marginRight: 4 }} /> Chú thích AI trích xuất:
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 14,
              height: 14,
              border: `2px solid ${token.colorWarning}`,
              borderRadius: 3,
              background: token.colorWarningBg,
            }}
          />
          <Text style={{ color: token.colorWarningText }}>Viền vàng: AI đọc chưa chắc chắn, vui lòng kiểm tra</Text>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 14,
              height: 14,
              border: `2px solid ${token.colorError}`,
              borderRadius: 3,
              background: token.colorErrorBg,
            }}
          />
          <Text style={{ color: token.colorErrorText }}>Viền đỏ: Trường thiếu hoặc chưa khớp hệ thống</Text>
        </span>
      </div>

      <Row gutter={[16, 16]}>
        {/* Left Pane: File gốc */}
        <Col xs={24} lg={11}>
          <Card
            title={renderCardTitle()}
            extra={
              previewMode === 'image' && blobUrl ? (
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
              background: token.colorBgLayout,
            }}
          >
            {loading ? (
              <div style={{ textAlign: 'center' }}>
                <Spin tip="Đang tải file gốc..." />
              </div>
            ) : error ? (
              <Alert type="error" message={error} showIcon />
            ) : previewMode === 'pdf' && blobUrl ? (
              <iframe
                src={blobUrl}
                title="PDF Viewer"
                style={{ width: '100%', height: '100%', border: 'none', borderRadius: 4 }}
              />
            ) : previewMode === 'text' && xmlContent !== null ? (
              <pre
                style={{
                  width: '100%',
                  height: '100%',
                  margin: 0,
                  padding: 12,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  overflow: 'auto',
                  background: token.colorBgContainer,
                  color: token.colorText,
                  borderRadius: 4,
                  fontSize: 12,
                  fontFamily: 'monospace',
                }}
              >
                {xmlContent}
              </pre>
            ) : previewMode === 'image' && blobUrl ? (
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
