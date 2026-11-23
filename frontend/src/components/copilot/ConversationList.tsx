import React, { useState } from 'react';
import { List, Button, Input, Popconfirm, Typography, Tooltip, Empty, Spin } from 'antd';
import {
  PlusOutlined,
  MessageOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ConversationItem } from './copilotApi';

const { Text } = Typography;

interface ConversationListProps {
  conversations: ConversationItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, newTitle: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  loading: boolean;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  activeId,
  onSelect,
  onNew,
  onRename,
  onDelete,
  loading,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const startRename = (conv: ConversationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const cancelRename = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingId(null);
    setEditTitle('');
  };

  const submitRename = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!editTitle.trim()) return;
    try {
      setActionLoading(true);
      await onRename(id, editTitle.trim());
      setEditingId(null);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#ffffff' }}>
      {/* Header Actions */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          block
          onClick={onNew}
          style={{ background: '#0284c7', borderColor: '#0284c7', borderRadius: 8, height: 38, fontWeight: 500 }}
        >
          Tạo cuộc hội thoại mới
        </Button>
      </div>

      {/* Conversation List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <Spin tip="Đang tải danh sách..." />
          </div>
        ) : conversations.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center' }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Chưa có cuộc trò chuyện nào"
            />
          </div>
        ) : (
          <List
            dataSource={conversations}
            renderItem={(item) => {
              const isActive = item.id === activeId;
              const isEditing = editingId === item.id;

              return (
                <div
                  key={item.id}
                  onClick={() => !isEditing && onSelect(item.id)}
                  style={{
                    padding: '10px 12px',
                    marginBottom: 6,
                    borderRadius: 8,
                    cursor: isEditing ? 'default' : 'pointer',
                    background: isActive ? '#e0f2fe' : '#f8fafc',
                    border: isActive ? '1px solid #7dd3fc' : '1px solid #f1f5f9',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {isEditing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                      <Input
                        size="small"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onPressEnter={() => submitRename(item.id)}
                        autoFocus
                        disabled={actionLoading}
                        style={{ borderRadius: 6 }}
                      />
                      <Button
                        size="small"
                        type="primary"
                        icon={<CheckOutlined />}
                        onClick={(e) => submitRename(item.id, e)}
                        loading={actionLoading}
                      />
                      <Button
                        size="small"
                        icon={<CloseOutlined />}
                        onClick={cancelRename}
                        disabled={actionLoading}
                      />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', flex: 1 }}>
                        <MessageOutlined style={{ color: isActive ? '#0284c7' : '#94a3b8', fontSize: 15 }} />
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <Text strong={isActive} style={{ fontSize: 13, color: '#1e293b' }}>
                            {item.title || 'Hội thoại không tên'}
                          </Text>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                            {dayjs(item.updated_at).format('DD/MM/YYYY HH:mm')}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 4, marginLeft: 8 }} onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="Đổi tên">
                          <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined style={{ color: '#64748b', fontSize: 13 }} />}
                            onClick={(e) => startRename(item, e)}
                          />
                        </Tooltip>
                        <Popconfirm
                          title="Xoá cuộc hội thoại"
                          description="Bạn có chắc chắn muốn xoá hội thoại này không?"
                          onConfirm={() => onDelete(item.id)}
                          okText="Xoá"
                          cancelText="Huỷ"
                          okButtonProps={{ danger: true }}
                        >
                          <Tooltip title="Xoá hội thoại">
                            <Button
                              type="text"
                              size="small"
                              icon={<DeleteOutlined style={{ color: '#ef4444', fontSize: 13 }} />}
                            />
                          </Tooltip>
                        </Popconfirm>
                      </div>
                    </div>
                  )}
                </div>
              );
            }}
          />
        )}
      </div>

      {/* Footer Notice */}
      <div style={{ padding: '8px 16px', borderTop: '1px solid #f0f0f0', background: '#fafafa', textAlign: 'center' }}>
        <Text type="secondary" style={{ fontSize: 11, color: '#94a3b8' }}>
          Lịch sử được lưu 90 ngày.
        </Text>
      </div>
    </div>
  );
};

export default ConversationList;
