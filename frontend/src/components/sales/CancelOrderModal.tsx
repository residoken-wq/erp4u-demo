import React from 'react';
import { Modal, Form, Input } from 'antd';

interface Props {
    open: boolean;
    cancelReason: string;
    onReasonChange: (value: string) => void;
    onConfirm: () => void;
    onCancel: () => void;
}

const CancelOrderModal: React.FC<Props> = ({
    open,
    cancelReason,
    onReasonChange,
    onConfirm,
    onCancel,
}) => {
    return (
        <Modal
            title="Xác nhận hủy đơn hàng"
            open={open}
            onCancel={onCancel}
            onOk={onConfirm}
            okText="Xác nhận Hủy"
            okButtonProps={{ danger: true }}
        >
            <p>Bạn có chắc chắn muốn hủy đơn hàng này không? Hành động này không thể hoàn tác.</p>
            <Form layout="vertical">
                <Form.Item label="Lý do hủy" required>
                    <Input.TextArea
                        rows={3}
                        value={cancelReason}
                        onChange={e => onReasonChange(e.target.value)}
                        placeholder="Nhập lý do hủy đơn..."
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default CancelOrderModal;
