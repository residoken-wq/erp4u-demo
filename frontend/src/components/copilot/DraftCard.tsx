import React, { useEffect, useState } from 'react';
import { Card, Tag, Button, Popconfirm, Space, Typography, message } from 'antd';
import {
  FileTextOutlined,
  LinkOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { CopilotDraftItem, getDraftDetail, rejectDraft } from './draftApi';
import { getDraftKindLabel, getDraftRoute, getDraftStatusInfo } from './draftRoutes';
import { isValidSourcePath } from './copilotApi';

const { Text } = Typography;

interface DraftCardProps {
  draft: CopilotDraftItem;
  onStatusChange?: (draftId: string, newStatus: string) => void;
}

export const DraftCard: React.FC<DraftCardProps> = ({ draft, onStatusChange }) => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>('pending');
  const [resultRef, setResultRef] = useState<{ entity: string; id: string | number; path: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    getDraftDetail(draft.id)
      .then((detail) => {
        if (!isMounted) return;
        setStatus(detail.status);
        if (detail.result_ref) {
          setResultRef(detail.result_ref);
        }
      })
      .catch(() => {
        // Nếu không tải được (vd 404 hoặc mạng), giữ trạng thái pending mặc định
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [draft.id]);

  const handleReject = async () => {
    setActionLoading(true);
    try {
      await rejectDraft(draft.id);
      setStatus('rejected');
      message.success('Đã bỏ bản nháp');
      if (onStatusChange) {
        onStatusChange(draft.id, 'rejected');
      }
    } catch (err: any) {
      message.error(err.message || 'Lỗi khi bỏ bản nháp');
    } finally {
      setActionLoading(false);
    }
  };

  const kindLabel = getDraftKindLabel(draft.kind);
  const route = getDraftRoute(draft.kind, draft.id);
  const statusInfo = getDraftStatusInfo(status);

  const getStatusIcon = (st: string) => {
    switch (st) {
      case 'confirmed':
        return <CheckCircleOutlined />;
      case 'rejected':
        return <CloseCircleOutlined />;
      case 'expired':
        return <ClockCircleOutlined />;
      case 'failed':
        return <ExclamationCircleOutlined />;
      case 'executing':
        return <SyncOutlined spin />;
      default:
        return undefined;
    }
  };

  const canLinkResult = resultRef?.path && isValidSourcePath(resultRef.path);

  return (
    <Card
      size="small"
      style={{
        marginTop: 10,
        borderRadius: 8,
        border: '1px solid #e2e8f0',
        background: '#ffffff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}
      bodyStyle={{ padding: '10px 12px' }}
    >
      {/* Header: Kind tag & Status tag */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Space size={4}>
          <Tag color="cyan" style={{ margin: 0, fontSize: 11, fontWeight: 600 }}>
            <FileTextOutlined style={{ marginRight: 4 }} />
            {kindLabel}
          </Tag>
          <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
            {draft.title}
          </Text>
        </Space>

        <Tag
          color={statusInfo.color}
          icon={getStatusIcon(status)}
          style={{ margin: 0, fontSize: 11, borderRadius: 4 }}
        >
          {statusInfo.label}
        </Tag>
      </div>

      {/* Summary (plain text, completely safe from HTML injection) */}
      {draft.summary && (
        <div
          className="draft-summary"
          style={{
            fontSize: 12,
            color: '#475569',
            marginBottom: 8,
            lineHeight: 1.4,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {draft.summary}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, paddingTop: 4, borderTop: '1px solid #f1f5f9' }}>
        {status === 'pending' && (
          <>
            <Popconfirm
              title="Bỏ bản nháp"
              description="Bạn có chắc chắn muốn bỏ bản nháp này?"
              onConfirm={handleReject}
              okText="Bỏ nháp"
              cancelText="Huỷ"
              okButtonProps={{ danger: true, loading: actionLoading }}
            >
              <Button size="small" danger disabled={loading}>
                Bỏ nháp
              </Button>
            </Popconfirm>

            {route && (
              <Button
                type="primary"
                size="small"
                onClick={() => navigate(route)}
                disabled={loading}
              >
                Mở để duyệt
              </Button>
            )}
          </>
        )}

        {status === 'confirmed' && canLinkResult && (
          <Link to={resultRef.path}>
            <Button type="link" size="small" icon={<LinkOutlined />} style={{ padding: 0 }}>
              Xem chi tiết ({resultRef.entity})
            </Button>
          </Link>
        )}

        {status === 'rejected' && (
          <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>
            Đã bỏ qua
          </Text>
        )}

        {status === 'expired' && (
          <Text type="secondary" style={{ fontSize: 11, color: '#ef4444' }}>
            Bản nháp đã hết hạn (quá 24h)
          </Text>
        )}

        {status === 'failed' && (
          <Text type="secondary" style={{ fontSize: 11, color: '#ef4444' }}>
            Có lỗi khi thực thi nháp
          </Text>
        )}
      </div>
    </Card>
  );
};

export default DraftCard;
