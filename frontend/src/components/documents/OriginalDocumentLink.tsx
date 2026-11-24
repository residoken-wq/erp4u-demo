import React, { useEffect, useState } from 'react';
import { Button, Modal, Spin, Typography, Alert, theme } from 'antd';
import { PaperClipOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getScanDocumentByRef, fetchDocumentFileBlobUrl, DocumentScanByRefResponse } from './documentScanApi';
import { getDocumentPreviewMode, DocumentPreviewMode } from './documentScanTransformers';

const { Text } = Typography;

export interface OriginalDocumentLinkProps {
  resultType: 'purchase_order' | 'goods_receipt' | 'transaction' | string;
  resultId: string | number;
  style?: React.CSSProperties;
}

export const OriginalDocumentLink: React.FC<OriginalDocumentLinkProps> = ({
  resultType,
  resultId,
  style,
}) => {
  const { token } = theme.useToken();
  const [scanInfo, setScanInfo] = useState<DocumentScanByRefResponse | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [xmlContent, setXmlContent] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<DocumentPreviewMode>('unsupported');
  const [loadingFile, setLoadingFile] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resultType || !resultId) {
      setScanInfo(null);
      return;
    }

    let isMounted = true;
    getScanDocumentByRef(resultType, resultId).then((info) => {
      if (isMounted) {
        setScanInfo(info);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [resultType, resultId]);

  const handleOpenModal = async () => {
    if (!scanInfo) return;
    setModalOpen(true);
    setLoadingFile(true);
    setError(null);
    setXmlContent(null);
    setBlobUrl(null);

    try {
      const { blobUrl: url, mimeType: mime, blob } = await fetchDocumentFileBlobUrl(scanInfo.id);
      const mode = getDocumentPreviewMode(undefined, mime);
      setPreviewMode(mode);

      if (mode === 'text') {
        URL.revokeObjectURL(url);
        const fullText = await blob.text();
        const maxChars = 200 * 1024;
        if (fullText.length > maxChars) {
          setXmlContent(fullText.slice(0, maxChars) + '\n\n... [Nội dung đã được cắt bớt vì vượt quá 200 KB]');
        } else {
          setXmlContent(fullText);
        }
      } else if (mode === 'pdf') {
        if (blob.type !== 'application/pdf') {
          const pdfBlob = new Blob([blob], { type: 'application/pdf' });
          URL.revokeObjectURL(url);
          setBlobUrl(URL.createObjectURL(pdfBlob));
        } else {
          setBlobUrl(url);
        }
      } else if (mode === 'image') {
        setBlobUrl(url);
      } else {
        URL.revokeObjectURL(url);
        setError('Định dạng file không được hỗ trợ để xem trước hoặc có nguy cơ bảo mật');
      }
    } catch (err: any) {
      setError(err?.message || 'Không thể tải chứng từ gốc');
    } finally {
      setLoadingFile(false);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    }
    setXmlContent(null);
    setError(null);
  };

  // 404 / 403 hoặc không có chứng từ -> ẩn hoàn toàn
  if (!scanInfo) {
    return null;
  }

  const formattedExpiry = scanInfo.expires_at
    ? dayjs(scanInfo.expires_at).format('DD/MM/YYYY')
    : '';

  return (
    <>
      <Button
        type="link"
        size="small"
        icon={<PaperClipOutlined />}
        onClick={handleOpenModal}
        style={{ padding: 0, fontSize: 13, color: token.colorLink, ...style }}
      >
        Chứng từ gốc {formattedExpiry ? `(lưu đến ${formattedExpiry})` : ''}
      </Button>

      <Modal
        open={modalOpen}
        title={`Chứng từ gốc ${formattedExpiry ? `(Lưu đến ${formattedExpiry})` : ''}`}
        onCancel={handleCloseModal}
        footer={[
          <Button key="close" onClick={handleCloseModal}>
            Đóng
          </Button>,
        ]}
        width={850}
        centered
        destroyOnClose
      >
        <div
          style={{
            height: 550,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: token.colorBgLayout,
            borderRadius: 8,
            overflow: 'auto',
            padding: 8,
          }}
        >
          {loadingFile ? (
            <Spin tip="Đang tải chứng từ gốc..." />
          ) : error ? (
            <Alert type="error" message={error} showIcon />
          ) : previewMode === 'pdf' && blobUrl ? (
            <iframe
              src={blobUrl}
              title="PDF Viewer"
              style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 }}
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
            <div style={{ textAlign: 'center', width: '100%', height: '100%', overflow: 'auto' }}>
              <img
                src={blobUrl}
                alt="Chứng từ gốc"
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  borderRadius: 4,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}
              />
            </div>
          ) : (
            <Text type="secondary">Không thể xem nội dung file</Text>
          )}
        </div>
      </Modal>
    </>
  );
};

export default OriginalDocumentLink;
