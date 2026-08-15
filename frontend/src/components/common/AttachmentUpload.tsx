import React, { useState } from 'react';
import { Upload, Button, message, Popover } from 'antd';
import { UploadOutlined, FileOutlined, DeleteOutlined, PaperClipOutlined, EyeOutlined, DownloadOutlined } from '@ant-design/icons';
import { API_URL } from '../../config';
import axios from 'axios';

interface Props {
    value?: string[]; // Array of file URLs
    onChange?: (urls: string[]) => void;
    maxFiles?: number;
    title?: string;
    allowDelete?: boolean; // NEW: explicit control over delete button
    allowUpload?: boolean; // NEW: explicit control over upload button
}

const AttachmentUpload: React.FC<Props> = ({
    value = [],
    onChange,
    maxFiles = 5,
    title = "Đính kèm chứng từ",
    allowDelete = true, // Default: allow delete
    allowUpload = true  // Default: allow upload
}) => {
    const [uploading, setUploading] = useState(false);

    // Read-only mode when maxFiles is 0 (legacy behavior) OR both delete and upload are false
    const isReadOnly = maxFiles === 0 || (!allowDelete && !allowUpload);

    const handleUpload = async (options: any) => {
        const { file, onSuccess, onError } = options;

        if (value.length >= maxFiles) {
            message.error(`Chỉ được tải lên tối đa ${maxFiles} file.`);
            onError("Max files exceeded");
            return;
        }

        const isLt1M = file.size / 1024 / 1024 < 1;
        if (!isLt1M) {
            message.error('File phải nhỏ hơn 1MB!');
            onError("File too large");
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('source', 'erp'); // Prevent CMS from showing ERP attachments

        setUploading(true);
        try {
            const res = await axios.post(`${API_URL}/upload/file`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const newUrl = res.data.url;
            const newFileList = [...value, newUrl];
            if (onChange) onChange(newFileList);
            onSuccess("Ok");
            message.success('Tải lên thành công');
        } catch (err) {
            message.error('Lỗi tải lên file');
            onError(err);
        } finally {
            setUploading(false);
        }
    };

    const handleRemove = async (index: number) => {
        const fileUrl = value[index];

        // Extract filename and call DELETE API
        if (fileUrl) {
            const filename = fileUrl.split('/').pop();
            if (filename) {
                try {
                    await axios.delete(`${API_URL}/upload/files/${encodeURIComponent(filename)}`);
                } catch (e) {
                    // Silently fail - file might already be deleted
                    console.warn('Could not delete physical file:', e);
                }
            }
        }

        const newFileList = [...value];
        newFileList.splice(index, 1);
        if (onChange) onChange(newFileList);
    };

    const getDownloadUrl = (path: string) => {
        if (!path) return '';

        // If already a full URL, ensure hash is encoded if it exists
        if (path.startsWith('http://') || path.startsWith('https://')) {
            return path.replace(/#/g, '%23');
        }

        // Extract just the filename from any path format (handles /uploads/filename or just filename)
        const filename = path.split('/').pop();
        if (!filename) return '';

        // IMPORTANT: Use static /uploads/ route, NOT /api/upload/files/
        // NestJS useStaticAssets serves files at /uploads/ WITHOUT the /api prefix
        // API_URL = 'https://localhost:3000/api' -> Base URL = 'https://localhost:3000'
        const baseUrl = API_URL.replace('/api', '');
        return `${baseUrl}/uploads/${encodeURIComponent(filename)}`;
    };

    const openFile = (url: string) => {
        const fullUrl = getDownloadUrl(url);
        console.log('[AttachmentUpload] Opening file:', { originalUrl: url, fullUrl, API_URL });
        if (fullUrl) {
            // Open in new tab - fullUrl is now always an absolute URL
            window.open(fullUrl, '_blank', 'noopener,noreferrer');
        }
    };

    // Don't render anything if read-only mode and no attachments
    if (isReadOnly && (!value || value.length === 0)) {
        return null;
    }

    return (
        <div style={{ marginTop: isReadOnly ? 0 : 10 }}>
            {/* Hide title in read-only mode */}
            {!isReadOnly && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontWeight: 500 }}>
                        <PaperClipOutlined /> {title} ({value.length}/{maxFiles})
                    </span>
                </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: isReadOnly ? 0 : 8 }}>
                {value.map((url, index) => {
                    const fileName = url ? url.split('/').pop() : 'file';
                    const fullUrl = getDownloadUrl(url);
                    // Improved isImage detection - check filename for common extensions
                    const isImage = fileName ? /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(fileName) : false;

                    return (
                        <div key={index} style={{ position: 'relative', display: 'inline-block' }}>
                            <Popover
                                content={
                                    <div style={{ maxWidth: 200 }}>
                                        <div style={{ marginBottom: 8, wordBreak: 'break-all' }}>{fileName}</div>
                                        <Button
                                            size="small"
                                            icon={<EyeOutlined />}
                                            onClick={() => openFile(url)}
                                            style={{ marginRight: 4 }}
                                        >
                                            Xem
                                        </Button>
                                        <Button
                                            size="small"
                                            icon={<DownloadOutlined />}
                                            onClick={async () => {
                                                try {
                                                    // Use fetch to download as blob (handles CORS properly)
                                                    const response = await fetch(fullUrl);
                                                    if (!response.ok) throw new Error('Download failed');
                                                    const blob = await response.blob();
                                                    const blobUrl = window.URL.createObjectURL(blob);
                                                    const link = document.createElement('a');
                                                    link.href = blobUrl;
                                                    link.download = fileName || 'file';
                                                    document.body.appendChild(link);
                                                    link.click();
                                                    document.body.removeChild(link);
                                                    window.URL.revokeObjectURL(blobUrl);
                                                } catch (e) {
                                                    // Fallback: open in new tab
                                                    window.open(fullUrl, '_blank', 'noopener,noreferrer');
                                                }
                                            }}
                                        >
                                            Tải
                                        </Button>
                                    </div>
                                }
                                trigger="hover"
                            >
                                {isImage ? (
                                    <div
                                        style={{
                                            width: 40, height: 40,
                                            border: '1px solid #d9d9d9',
                                            borderRadius: 4,
                                            overflow: 'hidden',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer',
                                            background: '#fafafa'
                                        }}
                                        onClick={() => openFile(url)}
                                    >
                                        <img
                                            src={fullUrl}
                                            alt={fileName}
                                            style={{ width: 40, height: 40, objectFit: 'cover' }}
                                            onError={(e) => {
                                                // On error, replace with file icon
                                                const target = e.target as HTMLImageElement;
                                                target.style.display = 'none';
                                                target.parentElement!.innerHTML = '<span style="font-size:20px;color:#1890ff">📷</span>';
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div
                                        onClick={() => openFile(url)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: 40,
                                            height: 40,
                                            border: '1px solid #d9d9d9',
                                            borderRadius: 4,
                                            background: '#fafafa',
                                            color: '#1890ff',
                                            fontSize: 20,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <FileOutlined />
                                    </div>
                                )}
                            </Popover>
                            {onChange && allowDelete && (
                                <Button
                                    type="text"
                                    size="small"
                                    style={{
                                        position: 'absolute',
                                        top: -8,
                                        right: -8,
                                        background: 'white',
                                        border: '1px solid #eee',
                                        borderRadius: '50%',
                                        width: 16,
                                        height: 16,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: 0,
                                        fontSize: 10,
                                        color: 'red',
                                        zIndex: 10,
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}
                                    onClick={() => handleRemove(index)}
                                >
                                    <DeleteOutlined />
                                </Button>
                            )}
                        </div>
                    );
                })}

                {/* Only show upload button if allowUpload is true and under max files */}
                {allowUpload && value.length < maxFiles && (
                    <Upload
                        customRequest={handleUpload}
                        showUploadList={false}
                        multiple={false}
                        accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx"
                    >
                        <Button icon={<UploadOutlined />} loading={uploading} type="dashed" style={{ height: 40, width: 40, padding: 0 }} />
                    </Upload>
                )}
            </div>
        </div>
    );
};

export default AttachmentUpload;

