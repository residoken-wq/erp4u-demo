import React, { useState, useEffect } from 'react';
import { Table, Checkbox, Button, message, Typography, Alert, Card, Spin } from 'antd';
import { SaveOutlined, BellOutlined } from '@ant-design/icons';
import api from '../../utils/api';
import { getAlertTypeLabel } from '../../utils/alertsHelper';
import { brandColors } from '../../theme/brand';

const { Text } = Typography;

export interface UserPrefRow {
  type: string;
  in_app: boolean;
  email_digest: boolean;
}

const DEFAULT_ALERT_TYPES = [
  'stock.low_cover',
  'order.at_risk',
  'receivable.overdue',
  'cash.anomaly',
];

export const AlertUserPrefsTab: React.FC = () => {
  const [prefs, setPrefs] = useState<UserPrefRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    loadPrefs();
  }, []);

  const loadPrefs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/alerts/prefs');
      const loaded: UserPrefRow[] = res.data?.prefs || [];
      // Đảm bảo đủ 4 loại chuẩn
      const fullList: UserPrefRow[] = DEFAULT_ALERT_TYPES.map((type) => {
        const found = loaded.find((p) => p.type === type);
        return {
          type,
          in_app: found ? found.in_app : true,
          email_digest: found ? found.email_digest : false,
        };
      });
      setPrefs(fullList);
    } catch (err: any) {
      console.warn('[AlertUserPrefs] Could not load prefs, using defaults:', err?.message);
      setPrefs(
        DEFAULT_ALERT_TYPES.map((type) => ({
          type,
          in_app: true,
          email_digest: false,
        })),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (type: string, field: 'in_app' | 'email_digest', val: boolean) => {
    setPrefs((prev) =>
      prev.map((p) => (p.type === type ? { ...p, [field]: val } : p)),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/alerts/prefs', { prefs });
      message.success('Đã lưu cài đặt thông báo cảnh báo');
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể lưu cài đặt');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: 'Loại cảnh báo',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <div>
          <Text strong style={{ color: brandColors.navy }}>
            {getAlertTypeLabel(type)}
          </Text>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{type}</div>
        </div>
      ),
    },
    {
      title: 'Trong ứng dụng (In-App)',
      dataIndex: 'in_app',
      key: 'in_app',
      width: 220,
      render: (val: boolean, record: UserPrefRow) => (
        <Checkbox
          checked={val}
          onChange={(e) => handleToggle(record.type, 'in_app', e.target.checked)}
        >
          Nhận thông báo gom
        </Checkbox>
      ),
    },
    {
      title: 'Email tóm tắt hằng ngày',
      dataIndex: 'email_digest',
      key: 'email_digest',
      width: 240,
      render: (val: boolean, record: UserPrefRow) => (
        <Checkbox
          checked={val}
          onChange={(e) => handleToggle(record.type, 'email_digest', e.target.checked)}
        >
          Nhận email tổng hợp (07:00)
        </Checkbox>
      ),
    },
  ];

  return (
    <div>
      <Alert
        message="Bảo mật & Quyền riêng tư Email"
        description="Email chỉ gồm số lượng cảnh báo và link đăng nhập vào hệ thống, không chứa dữ liệu khách hàng hay số tiền cụ thể."
        type="info"
        showIcon
        style={{ marginBottom: 16, borderRadius: 8 }}
      />

      <Card bordered={false} bodyStyle={{ padding: 0 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : (
          <>
            <Table
              rowKey="type"
              columns={columns}
              dataSource={prefs}
              pagination={false}
              bordered
            />
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saving}
                onClick={handleSave}
                style={{
                  borderRadius: 8,
                  background: brandColors.navy,
                  borderColor: brandColors.navy,
                }}
              >
                Lưu cài đặt
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default AlertUserPrefsTab;
