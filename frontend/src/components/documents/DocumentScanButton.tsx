import React, { useRef, useState } from 'react';
import { Button, Upload, Progress, Modal, message, Typography, theme } from 'antd';
import { ScanOutlined, LoadingOutlined, UploadOutlined } from '@ant-design/icons';
import { useEntitlements } from '../../hooks/useEntitlements';
import { usePermission } from '../../hooks/usePermission';
import useMobile from '../../hooks/useMobile';
import { PackageKey } from '../../config/packages';
import { uploadScanDocument, DocumentScanResponse } from './documentScanApi';
import { validateScanFile } from './documentScanTransformers';

const { Text } = Typography;

export interface DocumentScanButtonProps {
  kind: 'supplier_quote' | 'delivery_note' | 'expense_invoice' | 'auto';
  moduleCode: 'PURCHASE' | 'INVENTORY' | 'FINANCE';
  onSuccess: (scan: DocumentScanResponse) => void;
  buttonText?: string;
  buttonType?: 'primary' | 'default' | 'dashed';
  icon?: React.ReactNode;
  style?: React.CSSProperties;
}

export const DocumentScanButton: React.FC<DocumentScanButtonProps> = ({
  kind,
  moduleCode,
  onSuccess,
  buttonText = 'Đọc từ chứng từ',
  buttonType = 'default',
  icon = <ScanOutlined />,
  style,
}) => {
  const { token } = theme.useToken();
  const { isEnabled } = useEntitlements();
  const perms = usePermission(moduleCode);
  const isMobile = useMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);

  // Chỉ hiện khi gói AI bật và user có quyền create module đó
  if (!isEnabled(PackageKey.AI) || !perms.canCreate) {
    return null;
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be picked again if needed
    e.target.value = '';

    await processFile(file);
  };

  const processFile = async (file: File) => {
    // 1. Kiểm tra kích thước và loại file client-side (≤ 10 MB, ảnh/PDF/XML)
    const validation = validateScanFile(file);
    if (!validation.valid) {
      message.error(validation.error);
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const scanResult = await uploadScanDocument(file, kind, (percent) => {
        setProgress(percent);
      });

      message.success('Đọc và trích xuất chứng từ thành công!');
      onSuccess(scanResult);
    } catch (err: any) {
      message.error(err.message || 'Lỗi khi tải lên và đọc chứng từ');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept={isMobile ? 'image/*,application/pdf,.xml' : 'image/jpeg,image/png,image/webp,image/heic,application/pdf,.xml,text/xml'}
        capture={isMobile ? 'environment' : undefined}
        onChange={handleFileChange}
      />

      <Button
        type={buttonType}
        icon={uploading ? <LoadingOutlined /> : icon}
        loading={uploading}
        onClick={() => fileInputRef.current?.click()}
        style={{
          borderRadius: 8,
          borderColor: token.colorPrimary,
          color: buttonType === 'primary' ? undefined : token.colorPrimary,
          ...style,
        }}
      >
        {uploading ? `Đang đọc (${progress}%)` : buttonText}
      </Button>

      {/* Uploading progress modal */}
      <Modal
        open={uploading}
        title="Đang phân tích chứng từ bằng AI"
        footer={null}
        closable={false}
        centered
        width={400}
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Progress type="circle" percent={progress} size={80} status={progress === 100 ? 'normal' : 'active'} />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">
              Đang tải file lên và trích xuất dữ liệu tự động...
            </Text>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default DocumentScanButton;
