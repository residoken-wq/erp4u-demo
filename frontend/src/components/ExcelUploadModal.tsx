import React, { useState } from 'react';
import { Modal, Upload, Button, message, Alert, List, Typography, Progress } from 'antd';
import { InboxOutlined, DownloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import api from '../utils/api';

const { Dragger } = Upload;
const { Text } = Typography;

interface ExcelUploadModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    type: 'sales' | 'customers' | 'products' | 'materials' | 'boms' | 'combos';
    title?: string;
}

const ExcelUploadModal: React.FC<ExcelUploadModalProps> = ({ open, onClose, onSuccess, type, title }) => {
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleDownloadTemplate = async () => {
        try {
            const response = await api.get(`/upload/template/${type}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Template_${type}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
        } catch (error) {
            message.error('Lỗi tải mẫu');
        }
    };

    const handleUpload = async (file: File) => {
        setUploading(true);
        setResult(null);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post(`/upload/${type}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setResult(res.data);
            if (res.data.count > 0) {
                message.success(`Đã import thành công ${res.data.count} dòng!`);
                if (onSuccess) onSuccess();
            } else {
                message.warning('Không có dữ liệu nào được import.');
            }
        } catch (error: any) {
            console.error(error);
            message.error(error.response?.data?.message || 'Lỗi upload file');
            setResult({ errors: [{ row: 0, error: 'Lỗi server / Mạng' }] });
        } finally {
            setUploading(false);
        }
    };

    const reset = () => {
        setResult(null);
        setUploading(false);
    }

    return (
        <Modal
            title={title || "Import Excel"}
            open={open}
            onCancel={() => { reset(); onClose(); }}
            footer={[
                <Button key="close" onClick={() => { reset(); onClose(); }}>Đóng</Button>
            ]}
            width={700}
        >
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary">Vui lòng sử dụng file mẫu để import dữ liệu chính xác.</Text>
                <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate} type="link">Tải File Mẫu</Button>
            </div>

            {!result ? (
                <Dragger
                    accept=".xlsx, .xls"
                    showUploadList={false}
                    beforeUpload={(file) => { handleUpload(file); return false; }}
                    disabled={uploading}
                    style={{ padding: 20 }}
                >
                    <p className="ant-upload-drag-icon">
                        <InboxOutlined style={{ color: '#1890ff' }} />
                    </p>
                    <p className="ant-upload-text">Kéo thả file vào đây hoặc click để chọn file</p>
                    <p className="ant-upload-hint">Chỉ hỗ trợ file Excel (.xlsx, .xls)</p>
                </Dragger>
            ) : (
                <div>
                    <Alert
                        message={result.count > 0 ? "Import Hoàn Tất" : "Có Lỗi Xảy Ra"}
                        description={
                            <div>
                                <p>✅ Thành công: <b>{result.count}</b> dòng</p>
                                <p>❌ Lỗi: <b>{result.errors?.length || 0}</b> dòng</p>
                            </div>
                        }
                        type={result.errors?.length > 0 ? "warning" : "success"}
                        showIcon
                        action={
                            <Button size="small" type="primary" onClick={reset}>Import Tiếp</Button>
                        }
                    />

                    {result.errors?.length > 0 && (
                        <div style={{ marginTop: 16 }}>
                            <Text strong>Chi tiết lỗi:</Text>
                            <List
                                size="small"
                                bordered
                                dataSource={result.errors}
                                style={{ maxHeight: 300, overflow: 'auto', marginTop: 8 }}
                                renderItem={(item: any) => (
                                    <List.Item>
                                        <Text type="danger">
                                            {item.row ? `[Dòng ${JSON.stringify(item.row)}] ` : ''}
                                            {item.key ? `[Key ${item.key}] ` : ''}
                                            {item.error}
                                        </Text>
                                    </List.Item>
                                )}
                            />
                        </div>
                    )}
                </div>
            )}

            {uploading && <div style={{ textAlign: 'center', marginTop: 16 }}><Progress percent={99} status="active" /></div>}
        </Modal>
    );
};

export default ExcelUploadModal;
