import React, { useEffect, useState } from 'react';
import { Popover, Button, Input } from 'antd';
import { LinkOutlined, FolderOpenOutlined, SaveOutlined, InfoCircleOutlined } from '@ant-design/icons';
import api from '../../utils/api';

const DEFAULT_DRIVE = 'https://drive.google.com/drive/folders/1TmL0dVOf9';

interface Props {
    value: string;
    onChange: (val: string) => void;
}

const ImageLinkCell: React.FC<Props> = ({ value, onChange }) => {
    const [open, setOpen] = useState(false);
    const [tempValue, setTempValue] = useState(value);
    const [driveLink, setDriveLink] = useState(DEFAULT_DRIVE);

    useEffect(() => {
        if (open) {
            setTempValue(value || '');
            api.get('/system/config/SALES_SHARED_DRIVE_LINK').then(res => {
                if (res.data && res.data.value) setDriveLink(res.data.value);
            }).catch(() => { });
        }
    }, [open, value]);

    const handleSave = () => {
        onChange(tempValue);
        setOpen(false);
    };

    return (
        <Popover
            open={open}
            onOpenChange={setOpen}
            trigger="click"
            title="Thêm ảnh từ Google Drive"
            content={
                <div style={{ width: 320 }}>
                    <div style={{ marginBottom: 12, padding: '8px', background: '#e6f7ff', borderRadius: 4, border: '1px solid #91d5ff' }}>
                        <InfoCircleOutlined style={{ color: '#1890ff', marginRight: 5 }} />
                        <span style={{ fontSize: 12 }}>Mở folder, copy link ảnh, rồi dán vào đây.</span>
                    </div>

                    <Button
                        block
                        icon={<FolderOpenOutlined />}
                        onClick={() => window.open(driveLink, '_blank')}
                        style={{ marginBottom: 12, borderColor: '#1890ff', color: '#1890ff' }}
                    >
                        Mở Kho Ảnh (Google Drive)
                    </Button>

                    <Input
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        placeholder="Paste link Google Drive/Image vào đây..."
                        style={{ marginBottom: 12 }}
                        autoFocus
                    />

                    <div style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button size="small" onClick={() => setOpen(false)}>Hủy</Button>
                        <Button size="small" type="primary" onClick={handleSave} icon={<SaveOutlined />}>OK (Lưu)</Button>
                    </div>
                </div>
            }
        >
            <Button size="small" icon={<LinkOutlined />} style={{ fontSize: 10 }}>
                {value ? 'Sửa Link' : 'Dán Link'}
            </Button>
        </Popover>
    );
};

export default ImageLinkCell;
