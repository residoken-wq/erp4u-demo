import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Switch,
  Radio,
  Button,
  Typography,
  message,
  Space,
  Alert,
  Modal,
  Tag,
  Divider,
} from 'antd';
import {
  AudioOutlined,
  SaveOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  SafetyCertificateOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { brandColors } from '../../theme/brand.ts';
import {
  getVoiceSettings,
  updateVoiceSettings,
  VoiceSettings,
} from '../copilot/voice/voiceApi.ts';
import { VoiceProvider } from '../copilot/voice/voiceStateMachine.ts';

const { Title, Text, Paragraph } = Typography;

export const AiVoiceAdminSettingsTab: React.FC = () => {
  const [enabled, setEnabled] = useState<boolean>(true);
  const [provider, setProvider] = useState<VoiceProvider>('gemini');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [initialSettings, setInitialSettings] = useState<VoiceSettings | null>(null);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await getVoiceSettings();
      setEnabled(data.enabled !== false);
      setProvider(data.provider === 'browser' ? 'browser' : 'gemini');
      setInitialSettings(data);
    } catch (err: any) {
      console.warn('[VoiceSettings] Could not load settings, using defaults:', err?.message);
      // Fallback defaults
      setEnabled(true);
      setProvider('gemini');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleProviderChange = (newProvider: VoiceProvider) => {
    if (newProvider === 'browser' && provider !== 'browser') {
      Modal.confirm({
        title: 'Cảnh báo tính bảo mật & tương thích khi dùng nhận dạng trình duyệt',
        icon: <ExclamationCircleOutlined style={{ color: '#faad14' }} />,
        content: (
          <div style={{ marginTop: 8 }}>
            <Paragraph style={{ fontSize: 13, color: '#334155', lineHeight: 1.6 }}>
              Trình duyệt (Chrome/Edge) sẽ gửi âm thanh tới Google ngoài hợp đồng của ERP4U, và chỉ chạy trên Chrome/Edge. Trình duyệt không hỗ trợ sẽ tự động dùng Gemini.
            </Paragraph>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Bạn có chắc chắn muốn chuyển sang nguồn nhận dạng này không?
            </Text>
          </div>
        ),
        okText: 'Xác nhận chuyển',
        cancelText: 'Giữ mặc định (Gemini)',
        okButtonProps: { style: { background: brandColors.navy, borderColor: brandColors.navy } },
        onOk: () => {
          setProvider('browser');
        },
      });
      return;
    }
    setProvider(newProvider);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updateVoiceSettings({
        enabled,
        provider,
      });
      message.success('Đã lưu cấu hình nhập liệu giọng nói thành công!');
      setInitialSettings(res);
    } catch (err: any) {
      message.error(err.message || 'Lỗi khi lưu cấu hình giọng nói');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#1a1a1a' }}>
          <AudioOutlined style={{ marginRight: 8, color: brandColors.navy }} />
          Cấu Hình Giọng Nói (Copilot Voice STT)
        </h3>
        <p style={{ color: '#888', margin: 0, fontSize: 13 }}>
          Quản lý tính năng nhập câu hỏi bằng giọng nói cho trợ lý Copilot, nguồn nhận diện âm thanh và chính sách bảo mật cho toàn doanh nghiệp.
        </p>
      </div>

      <Card
        bordered
        style={{ borderRadius: 12, marginBottom: 20 }}
        bodyStyle={{ padding: 24 }}
        loading={loading}
      >
        <Form layout="vertical">
          {/* Bật/Tắt Micro */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: 20,
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <div>
              <Text strong style={{ fontSize: 14, color: '#0f172a', display: 'block' }}>
                Bật tính năng nhập giọng nói (Micro)
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Khi bật, người dùng sẽ thấy nút micro trong ô nhập câu hỏi Copilot để nói thay vì gõ văn bản.
              </Text>
            </div>
            <Switch
              checked={enabled}
              onChange={(val) => setEnabled(val)}
              checkedChildren="BẬT"
              unCheckedChildren="TẮT"
            />
          </div>

          {/* Chọn nguồn nhận dạng */}
          <div style={{ marginTop: 20 }}>
            <Form.Item
              label={
                <span style={{ fontWeight: 600, fontSize: 14 }}>
                  Nguồn nhận dạng giọng nói (STT Provider):
                </span>
              }
              extra="Chọn dịch vụ AI xử lý và chuyển đổi âm thanh thành văn bản tiếng Việt"
            >
              <Radio.Group
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value)}
                disabled={!enabled}
                style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <Radio
                  value="gemini"
                  style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    background: provider === 'gemini' ? '#f0fdf4' : '#ffffff',
                  }}
                >
                  <div>
                    <Space>
                      <Text strong style={{ fontSize: 13 }}>
                        Mặc định: Gemini qua máy chủ
                      </Text>
                      <Tag color="green">Khuyến nghị</Tag>
                    </Space>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                      Độ chính xác cao, nhận dạng chuẩn tiếng Việt, hỗ trợ tất cả thiết bị (Chrome, Safari iOS, Android). Tính vào hạn mức giây nhận dạng (<code>stt_seconds</code>) của gói AI.
                    </div>
                  </div>
                </Radio>

                <Radio
                  value="browser"
                  style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    background: provider === 'browser' ? '#f8fafc' : '#ffffff',
                  }}
                >
                  <div>
                    <Space>
                      <Text strong style={{ fontSize: 13 }}>
                        Nhận dạng của trình duyệt (Web Speech API)
                      </Text>
                      <Tag color="orange">Tiết kiệm hạn mức</Tag>
                    </Space>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                      Không gọi qua server ERP4U, không tốn hạn mức gói AI. Trình duyệt Chrome/Edge sẽ gửi âm thanh tới Google ngoài hợp đồng của ERP4U. Trình duyệt không hỗ trợ (Safari, Firefox) sẽ tự động dùng Gemini.
                    </div>
                  </div>
                </Radio>
              </Radio.Group>
            </Form.Item>
          </div>

          <Divider style={{ margin: '20px 0' }} />

          {/* Chính sách PACE Info Box */}
          <Alert
            type="info"
            showIcon
            icon={<SafetyCertificateOutlined style={{ color: '#0284c7' }} />}
            message="Chính sách bảo mật âm thanh (PACE)"
            description="Âm thanh ghi âm chỉ được xử lý tạm thời trong bộ nhớ và không bao giờ được lưu trữ trên máy chủ hay cơ sở dữ liệu. Văn bản nhận dạng sẽ được điền vào ô nhập để người dùng tự kiểm tra và bấm Gửi, không tự động gửi."
            style={{ borderRadius: 8, marginBottom: 20 }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadSettings}
              disabled={loading || saving}
            >
              Tải lại
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={saving}
              style={{
                background: brandColors.navy,
                borderColor: brandColors.navy,
                minWidth: 140,
              }}
            >
              Lưu Cấu Hình
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default AiVoiceAdminSettingsTab;
