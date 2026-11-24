import React, { useEffect, useState } from 'react';
import { Button, Modal, Spin, Typography } from 'antd';
import { PaperClipOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getScanDocumentByRef, fetchDocumentFileBlobUrl, DocumentScanByRefResponse } from './documentScanApi';

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
  const [scanInfo, setScanInfo] = useState<DocumentScanByRefResponse | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState<boolean>(false);

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

    try {
      const { blobUrl: url } = await fetchDocumentFileBlobUrl(scanInfo.id);
      setBlobUrl(url);
    } catch {
      setBlobUrl(null);
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
        style={{ padding: 0, fontSize: 13, color: '#1890ff', ...style }}
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
        <div style={{ height: 550, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: 8, overflow: 'auto' }}>
          {loadingFile ? (
            <Spin tip="Đang tải chứng từ gốc..." />
          ) : blobUrl ? (
            <iframe
              src={blobUrl}
              title="Original Document"
              style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 }}
            />
          ) : (
            <Text type="secondary">Không thể xem nội dung file</Text>
          )}
        </div>
      </Modal>
    </>
  );
};

export default OriginalDocumentLink;
