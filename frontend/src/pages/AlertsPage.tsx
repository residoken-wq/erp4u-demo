import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Tabs,
  Tag,
  Button,
  Select,
  Space,
  Typography,
  message,
  Dropdown,
  Tooltip,
  Badge,
  Empty,
  Row,
  Col,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  AlertOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  RobotOutlined,
  LinkOutlined,
  ReloadOutlined,
  FilterOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { useSearchParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../utils/api';
import { brandColors } from '../theme/brand';
import {
  getAlertTypeLabel,
  getAlertSeverityInfo,
  getAlertStatusInfo,
  formatAlertMetrics,
  isValidAlertPath,
  getEntityRoute,
  buildCopilotAlertQuestion,
} from '../utils/alertsHelper';
import { openCopilotWithPrompt } from '../components/copilot/CopilotPanel';

const { Title, Text } = Typography;

export interface AlertItem {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | string;
  entity_type: string;
  entity_id: string;
  fingerprint: string;
  title: string;
  detail: Record<string, any>;
  status: 'open' | 'acknowledged' | 'snoozed' | 'resolved' | string;
  snoozed_until?: string | null;
  acknowledged_by?: number | null;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
}

const ALERT_TABS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'stock.low_cover', label: 'Tồn kho thấp' },
  { key: 'order.at_risk', label: 'Đơn hàng trễ hạn' },
  { key: 'receivable.overdue', label: 'Công nợ quá hạn' },
  { key: 'cash.anomaly', label: 'Biến động chi phí' },
];

export const AlertsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialType = searchParams.get('type') || 'all';
  const [activeTab, setActiveTab] = useState<string>(initialType);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Sync tab with URL query parameter
  useEffect(() => {
    const typeFromUrl = searchParams.get('type');
    if (typeFromUrl && typeFromUrl !== activeTab) {
      setActiveTab(typeFromUrl);
      setPage(1);
    }
  }, [searchParams]);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setPage(1);
    if (key === 'all') {
      searchParams.delete('type');
    } else {
      searchParams.set('type', key);
    }
    setSearchParams(searchParams);
  };

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page,
        limit: pageSize,
      };
      if (activeTab !== 'all') {
        params.type = activeTab;
      }
      if (severityFilter !== 'all') {
        params.severity = severityFilter;
      }
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      const res = await api.get('/alerts', { params });
      const rawData = res.data;
      if (Array.isArray(rawData)) {
        setAlerts(rawData);
        setTotal(rawData.length);
      } else if (rawData && Array.isArray(rawData.data)) {
        setAlerts(rawData.data);
        setTotal(rawData.total ?? rawData.data.length);
      } else {
        setAlerts([]);
        setTotal(0);
      }
    } catch (err: any) {
      console.warn('[Alerts] Could not load alerts list:', err?.message);
      message.error('Không thể tải danh sách cảnh báo');
      setAlerts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [activeTab, severityFilter, statusFilter, page, pageSize]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // Acknowledge alert
  const handleAcknowledge = async (id: string) => {
    try {
      await api.post(`/alerts/${id}/acknowledge`);
      message.success('Đã xác nhận xem cảnh báo');
      setAlerts((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: 'acknowledged' } : item,
        ),
      );
      window.dispatchEvent(new Event('erp4u:alerts-updated'));
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể cập nhật trạng thái');
    }
  };

  // Snooze alert (1, 3, 7 days)
  const handleSnooze = async (id: string, days: number) => {
    try {
      await api.post(`/alerts/${id}/snooze`, { days });
      message.success(`Đã tạm ẩn cảnh báo trong ${days} ngày`);
      setAlerts((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: 'snoozed' } : item,
        ),
      );
      window.dispatchEvent(new Event('erp4u:alerts-updated'));
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể tạm ẩn cảnh báo');
    }
  };

  // Ask Copilot: pre-fill question, DO NOT auto-send
  const handleAskCopilot = (alert: AlertItem) => {
    const question = buildCopilotAlertQuestion(alert.id);
    openCopilotWithPrompt(question);
  };

  // Open Document route
  const handleOpenDoc = (alert: AlertItem) => {
    const route = getEntityRoute(alert.entity_type, alert.entity_id);
    if (isValidAlertPath(route)) {
      navigate(route);
    } else {
      message.warning('Đường dẫn chứng từ không hợp lệ');
    }
  };

  const getSnoozeMenuItems = (id: string): MenuProps['items'] => [
    {
      key: '1',
      label: 'Tạm ẩn 1 ngày',
      onClick: () => handleSnooze(id, 1),
    },
    {
      key: '3',
      label: 'Tạm ẩn 3 ngày',
      onClick: () => handleSnooze(id, 3),
    },
    {
      key: '7',
      label: 'Tạm ẩn 7 ngày',
      onClick: () => handleSnooze(id, 7),
    },
  ];

  const columns = [
    {
      title: 'Mức độ',
      dataIndex: 'severity',
      key: 'severity',
      width: 110,
      render: (severity: string) => {
        const info = getAlertSeverityInfo(severity);
        return (
          <Tag
            color={info.tagColor}
            style={{
              fontWeight: 600,
              borderRadius: 6,
              color: info.color === '#ff4d4f' ? '#ff4d4f' : undefined,
            }}
          >
            {info.label}
          </Tag>
        );
      },
    },
    {
      title: 'Tiêu đề cảnh báo',
      dataIndex: 'title',
      key: 'title',
      width: 260,
      render: (title: string, record: AlertItem) => (
        <div>
          <Text strong style={{ color: brandColors.navy }}>
            {title}
          </Text>
          <div style={{ marginTop: 2 }}>
            <Tag color="geekblue" style={{ fontSize: 11, borderRadius: 4 }}>
              {getAlertTypeLabel(record.type)}
            </Tag>
          </div>
        </div>
      ),
    },
    {
      title: 'Số liệu chính',
      key: 'metrics',
      render: (_: any, record: AlertItem) => {
        const metricsStr = formatAlertMetrics(record.type, record.detail);
        return (
          <Text style={{ fontSize: 13, color: '#334155' }}>
            {metricsStr}
          </Text>
        );
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string, record: AlertItem) => {
        const info = getAlertStatusInfo(status);
        return (
          <div>
            <Tag color={info.tagColor} style={{ borderRadius: 4 }}>
              {info.label}
            </Tag>
            {status === 'snoozed' && record.snoozed_until && (
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                Đến {dayjs(record.snoozed_until).format('DD/MM')}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Thời gian',
      key: 'timing',
      width: 160,
      render: (_: any, record: AlertItem) => (
        <div style={{ fontSize: 12, color: '#64748b' }}>
          <div>Lần đầu: {dayjs(record.first_seen_at).format('DD/MM/YYYY')}</div>
          <div>Lần cuối: {dayjs(record.last_seen_at).format('DD/MM HH:mm')}</div>
        </div>
      ),
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 320,
      render: (_: any, record: AlertItem) => (
        <Space size="small" wrap>
          <Button
            size="small"
            icon={<LinkOutlined />}
            onClick={() => handleOpenDoc(record)}
            style={{ borderRadius: 6 }}
          >
            Mở
          </Button>

          {record.status === 'open' && (
            <Button
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleAcknowledge(record.id)}
              style={{ borderRadius: 6 }}
            >
              Đã xem
            </Button>
          )}

          {record.status !== 'resolved' && (
            <Dropdown menu={{ items: getSnoozeMenuItems(record.id) }}>
              <Button
                size="small"
                icon={<ClockCircleOutlined />}
                style={{ borderRadius: 6 }}
              >
                Tạm ẩn
              </Button>
            </Dropdown>
          )}

          <Button
            size="small"
            type="primary"
            icon={<RobotOutlined />}
            onClick={() => handleAskCopilot(record)}
            style={{
              borderRadius: 6,
              background: brandColors.navy,
              borderColor: brandColors.navy,
            }}
          >
            Hỏi Copilot
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1D2459 0%, #272F72 100%)',
          borderRadius: 16,
          padding: '24px 32px',
          marginBottom: 20,
          color: '#ffffff',
          boxShadow: '0 4px 16px rgba(39, 47, 114, 0.15)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <AlertOutlined style={{ fontSize: 26, color: '#64FAE1' }} />
            <Title level={3} style={{ color: '#ffffff', margin: 0, fontWeight: 700 }}>
              Trung Tâm Cảnh Báo & Dự Báo
            </Title>
          </div>
          <Text style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: 13 }}>
            Phát hiện chủ động các rủi ro tồn kho, chậm giao hàng, quá hạn công nợ và biến động dòng tiền bằng quy tắc cố định.
          </Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={loadAlerts}
          loading={loading}
          style={{
            background: 'rgba(255,255,255,0.15)',
            borderColor: 'rgba(255,255,255,0.3)',
            color: '#fff',
            borderRadius: 8,
          }}
        >
          Làm mới
        </Button>
      </div>

      {/* Main Content Card */}
      <Card
        bordered={false}
        style={{
          borderRadius: 16,
          boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
        }}
        bodyStyle={{ padding: 20 }}
      >
        {/* Type Tabs */}
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={ALERT_TABS.map((t) => ({
            key: t.key,
            label: t.label,
          }))}
          style={{ marginBottom: 16 }}
        />

        {/* Filters Toolbar */}
        <Row gutter={[16, 12]} align="middle" style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8}>
            <Space align="center">
              <FilterOutlined style={{ color: '#64748b' }} />
              <Text style={{ fontSize: 13 }}>Mức độ:</Text>
              <Select
                value={severityFilter}
                onChange={(val) => {
                  setSeverityFilter(val);
                  setPage(1);
                }}
                style={{ width: 140 }}
                options={[
                  { value: 'all', label: 'Tất cả mức' },
                  { value: 'high', label: 'Cao' },
                  { value: 'medium', label: 'Trung bình' },
                  { value: 'low', label: 'Thấp' },
                ]}
              />
            </Space>
          </Col>

          <Col xs={24} sm={12} md={8}>
            <Space align="center">
              <Text style={{ fontSize: 13 }}>Trạng thái:</Text>
              <Select
                value={statusFilter}
                onChange={(val) => {
                  setStatusFilter(val);
                  setPage(1);
                }}
                style={{ width: 150 }}
                options={[
                  { value: 'all', label: 'Tất cả trạng thái' },
                  { value: 'open', label: 'Đang mở' },
                  { value: 'acknowledged', label: 'Đã xem' },
                  { value: 'snoozed', label: 'Tạm ẩn' },
                  { value: 'resolved', label: 'Đã xử lý' },
                ]}
              />
            </Space>
          </Col>
        </Row>

        {/* Alerts Table */}
        <Table
          rowKey="id"
          columns={columns}
          dataSource={alerts}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
            showTotal: (tot) => `Tổng cộng ${tot} cảnh báo`,
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Không có cảnh báo nào phù hợp"
              />
            ),
          }}
          scroll={{ x: 1000 }}
        />
      </Card>
    </div>
  );
};

export default AlertsPage;
