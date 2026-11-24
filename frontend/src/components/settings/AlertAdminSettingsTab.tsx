import React, { useState, useEffect } from 'react';
import {
  Card,
  Tabs,
  Form,
  InputNumber,
  Switch,
  Button,
  Table,
  Tag,
  Typography,
  message,
  Divider,
  Space,
  Row,
  Col,
  Alert,
} from 'antd';
import {
  SaveOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  HistoryOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../utils/api';
import {
  ALERT_SETTING_SPECS,
  getAlertTypeLabel,
  validateAlertSettingParams,
} from '../../utils/alertsHelper';
import { brandColors } from '../../theme/brand';

const { Title, Text } = Typography;

export interface AlertSettingItem {
  type: string;
  enabled: boolean;
  params: Record<string, any>;
  updated_at?: string;
}

export interface AlertRunItem {
  id: string;
  started_at: string;
  finished_at?: string | null;
  status: string;
  counts?: { created?: number; updated?: number; resolved?: number } | null;
  error_code?: string | null;
}

export const AlertAdminSettingsTab: React.FC = () => {
  const [settings, setSettings] = useState<Record<string, AlertSettingItem>>({});
  const [loadingSettings, setLoadingSettings] = useState<boolean>(true);
  const [savingType, setSavingType] = useState<string | null>(null);

  const [runs, setRuns] = useState<AlertRunItem[]>([]);
  const [loadingRuns, setLoadingRuns] = useState<boolean>(false);
  const [triggeringRun, setTriggeringRun] = useState<boolean>(false);

  useEffect(() => {
    loadSettings();
    loadRuns();
  }, []);

  const loadSettings = async () => {
    setLoadingSettings(true);
    try {
      const res = await api.get('/alerts/settings');
      const list: AlertSettingItem[] = res.data?.settings || [];
      const map: Record<string, AlertSettingItem> = {};
      list.forEach((s) => {
        map[s.type] = s;
      });

      // Bổ sung mặc định nếu chưa có
      Object.keys(ALERT_SETTING_SPECS).forEach((type) => {
        if (!map[type]) {
          const defaultParams: Record<string, any> = {};
          ALERT_SETTING_SPECS[type].forEach((spec) => {
            defaultParams[spec.name] = spec.default;
          });
          map[type] = {
            type,
            enabled: true,
            params: defaultParams,
          };
        }
      });

      setSettings(map);
    } catch (err: any) {
      console.warn('[AlertSettings] Could not load settings, using defaults:', err?.message);
      const defaultMap: Record<string, AlertSettingItem> = {};
      Object.keys(ALERT_SETTING_SPECS).forEach((type) => {
        const defaultParams: Record<string, any> = {};
        ALERT_SETTING_SPECS[type].forEach((spec) => {
          defaultParams[spec.name] = spec.default;
        });
        defaultMap[type] = {
          type,
          enabled: true,
          params: defaultParams,
        };
      });
      setSettings(defaultMap);
    } finally {
      setLoadingSettings(false);
    }
  };

  const loadRuns = async () => {
    setLoadingRuns(true);
    try {
      const res = await api.get('/alerts/runs?limit=15');
      setRuns(res.data?.runs || []);
    } catch (err: any) {
      console.warn('[AlertRuns] Could not load runs:', err?.message);
    } finally {
      setLoadingRuns(false);
    }
  };

  const handleParamChange = (type: string, paramName: string, value: any) => {
    setSettings((prev) => {
      const current = prev[type] || { type, enabled: true, params: {} };
      return {
        ...prev,
        [type]: {
          ...current,
          params: {
            ...current.params,
            [paramName]: value,
          },
        },
      };
    });
  };

  const handleEnabledChange = (type: string, enabled: boolean) => {
    setSettings((prev) => {
      const current = prev[type] || { type, enabled: true, params: {} };
      return {
        ...prev,
        [type]: {
          ...current,
          enabled,
        },
      };
    });
  };

  const handleSaveSetting = async (type: string) => {
    const item = settings[type];
    if (!item) return;

    // Validate client-side against min/max
    const validation = validateAlertSettingParams(type, item.params);
    if (!validation.valid) {
      const firstError = Object.values(validation.errors)[0];
      message.error(firstError);
      return;
    }

    setSavingType(type);
    try {
      await api.put('/alerts/settings', {
        type,
        enabled: item.enabled,
        params: item.params,
      });
      message.success(`Đã lưu cấu hình ${getAlertTypeLabel(type)}`);
    } catch (err: any) {
      if (err.response?.status === 400) {
        message.error(err.response.data.message || 'Dữ liệu cấu hình không hợp lệ');
      } else if (err.response?.status === 403) {
        message.error('Bạn không có quyền thay đổi cấu hình hệ thống');
      } else {
        message.error(err.response?.data?.message || 'Lỗi lưu cấu hình');
      }
    } finally {
      setSavingType(null);
    }
  };

  // Quét lại ngay (Trigger Manual Scan with 429 handling)
  const handleTriggerRun = async () => {
    setTriggeringRun(true);
    try {
      const res = await api.post('/alerts/run');
      message.success(res.data?.message || 'Đã kích hoạt quét cảnh báo thành công');
      loadRuns();
      window.dispatchEvent(new Event('erp4u:alerts-updated'));
    } catch (err: any) {
      if (err.response?.status === 429) {
        message.warning(
          err.response.data?.message ||
            'Chỉ được phép quét lại tối đa 1 lần mỗi 15 phút. Vui lòng thử lại sau.',
        );
      } else if (err.response?.status === 403) {
        message.error('Chỉ quản trị viên mới có quyền kích hoạt quét lại');
      } else {
        message.error(err.response?.data?.message || 'Không thể kích hoạt quét lại');
      }
    } finally {
      setTriggeringRun(false);
    }
  };

  const runColumns = [
    {
      title: 'Bắt đầu',
      dataIndex: 'started_at',
      key: 'started_at',
      render: (val: string) => dayjs(val).format('DD/MM/YYYY HH:mm:ss'),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        if (status === 'success') return <Tag color="success">Thành công</Tag>;
        if (status === 'failed') return <Tag color="error">Lỗi</Tag>;
        return <Tag color="processing">Đang chạy</Tag>;
      },
    },
    {
      title: 'Thời lượng',
      key: 'duration',
      render: (_: any, record: AlertRunItem) => {
        if (!record.finished_at) return '-';
        const ms = dayjs(record.finished_at).diff(dayjs(record.started_at));
        return `${(ms / 1000).toFixed(1)}s`;
      },
    },
    {
      title: 'Kết quả phát hiện',
      key: 'counts',
      render: (_: any, record: AlertRunItem) => {
        const c = record.counts;
        if (!c) return '-';
        return (
          <Space size="small">
            <Tag color="blue">Tạo mới: {c.created ?? 0}</Tag>
            <Tag color="cyan">Cập nhật: {c.updated ?? 0}</Tag>
            <Tag color="green">Đã giải quyết: {c.resolved ?? 0}</Tag>
          </Space>
        );
      },
    },
    {
      title: 'Mã lỗi',
      dataIndex: 'error_code',
      key: 'error_code',
      render: (err: string | null) => (err ? <Tag color="error">{err}</Tag> : '-'),
    },
  ];

  return (
    <div>
      {/* Top Banner Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          background: '#f8fafc',
          padding: '16px 20px',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0, color: brandColors.navy }}>
            Cấu Hình Ngưỡng & Vận Hành Cảnh Báo
          </Title>
          <Text style={{ fontSize: 13, color: '#64748b' }}>
            Hệ thống chạy tự động mỗi ngày lúc 07:00 VN. Bạn có thể kích hoạt quét lại ngay bất cứ lúc nào (tối đa 1 lần / 15 phút).
          </Text>
        </div>
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          loading={triggeringRun}
          onClick={handleTriggerRun}
          style={{
            borderRadius: 8,
            background: brandColors.navy,
            borderColor: brandColors.navy,
            height: 40,
            fontWeight: 600,
          }}
        >
          Quét lại ngay
        </Button>
      </div>

      {/* Thresholds Config by Type */}
      <Title level={5} style={{ marginBottom: 12, color: brandColors.navy }}>
        <SettingOutlined /> Ngưỡng phát hiện từng loại cảnh báo
      </Title>

      <Row gutter={[16, 16]}>
        {Object.keys(ALERT_SETTING_SPECS).map((type) => {
          const specs = ALERT_SETTING_SPECS[type];
          const item = settings[type] || {
            type,
            enabled: true,
            params: {},
          };
          const isSaving = savingType === type;

          return (
            <Col xs={24} lg={12} key={type}>
              <Card
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: brandColors.navy, fontWeight: 700 }}>
                      {getAlertTypeLabel(type)}
                    </span>
                    <Space>
                      <Text style={{ fontSize: 12, color: '#64748b' }}>Bật cảnh báo:</Text>
                      <Switch
                        checked={item.enabled}
                        onChange={(val) => handleEnabledChange(type, val)}
                      />
                    </Space>
                  </div>
                }
                bordered
                style={{ borderRadius: 12, height: '100%' }}
                bodyStyle={{ padding: 18 }}
              >
                <Form layout="vertical">
                  {specs.map((spec) => (
                    <Form.Item
                      key={spec.name}
                      label={
                        <span style={{ fontSize: 13 }}>
                          {spec.label} {spec.unit ? `(${spec.unit})` : ''}
                        </span>
                      }
                      style={{ marginBottom: 12 }}
                    >
                      <InputNumber
                        value={item.params?.[spec.name] ?? spec.default}
                        min={spec.min}
                        max={spec.max}
                        step={spec.step || 1}
                        onChange={(val) => handleParamChange(type, spec.name, val)}
                        style={{ width: '100%', borderRadius: 6 }}
                      />
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                        Khoảng cho phép: {spec.min} – {spec.max} {spec.unit || ''} (Mặc định: {spec.default})
                      </div>
                    </Form.Item>
                  ))}

                  <div style={{ textAlign: 'right', marginTop: 16 }}>
                    <Button
                      type="primary"
                      size="small"
                      icon={<SaveOutlined />}
                      loading={isSaving}
                      onClick={() => handleSaveSetting(type)}
                      style={{
                        borderRadius: 6,
                        background: brandColors.navy,
                        borderColor: brandColors.navy,
                      }}
                    >
                      Lưu ngưỡng
                    </Button>
                  </div>
                </Form>
              </Card>
            </Col>
          );
        })}
      </Row>

      <Divider style={{ margin: '30px 0' }} />

      {/* Runs History */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Title level={5} style={{ margin: 0, color: brandColors.navy }}>
          <HistoryOutlined /> Lịch sử các lần quét
        </Title>
        <Button size="small" icon={<ReloadOutlined />} onClick={loadRuns} loading={loadingRuns}>
          Tải lại
        </Button>
      </div>

      <Table
        rowKey="id"
        columns={runColumns}
        dataSource={runs}
        loading={loadingRuns}
        pagination={{ pageSize: 5 }}
        bordered
        size="small"
      />
    </div>
  );
};

export default AlertAdminSettingsTab;
