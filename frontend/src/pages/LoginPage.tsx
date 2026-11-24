import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Typography, message, Layout, Modal, Tag, Tooltip } from 'antd';
import {
  UserOutlined,
  LockOutlined,
  LoginOutlined,
  TeamOutlined,
  CopyOutlined,
  RightOutlined
} from '@ant-design/icons';
import api from '../utils/api';
import useDemoMode from '../hooks/useDemoMode';
import { brandColors } from '../theme/brand';
import type { DemoAccount } from '../demo/demoAccounts';

const { Title, Text } = Typography;

const LoginPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);
  const isDemo = useDemoMode();

  useEffect(() => {
    if (isDemo) {
      import('../demo/demoAccounts').then((mod) => {
        setDemoAccounts(mod.DEMO_ACCOUNTS || mod.default || []);
      });
    }
  }, [isDemo]);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', values);

      // Lưu Token và User Info vào LocalStorage
      localStorage.setItem('token', res.data.access_token);
      localStorage.setItem('user', JSON.stringify(res.data.user));

      message.success('Đăng nhập thành công!');
      // Reload để App.tsx nhận diện trạng thái login
      window.location.href = '/';
    } catch (error: any) {
      if (error.response?.status === 429) {
        const retryAfter = error.response?.data?.retryAfter;
        const msg = retryAfter
          ? `Bạn đã thử quá số lần cho phép. Vui lòng thử lại sau ${retryAfter} giây.`
          : 'Bạn đã thử quá số lần cho phép. Vui lòng thử lại sau ít phút.';
        message.error(msg);
      } else {
        message.error(error.response?.data?.message || 'Đăng nhập thất bại');
      }
    }
    setLoading(false);
  };

  const handleSelectDemoAccount = (acc: DemoAccount) => {
    if (!isDemo) return;
    form.setFieldsValue({
      username: acc.username,
      password: acc.password
    });
    setDemoModalOpen(false);
    message.loading({ content: `Đang đăng nhập với vai trò ${acc.roleTitle}...`, key: 'demoLogin', duration: 1.5 });
    onFinish({ username: acc.username, password: acc.password });
  };

  const copyToClipboard = (text: string, label: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    message.success(`Đã sao chép ${label}: ${text}`);
  };

  return (
    <Layout style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #FFF5E1 0%, #FAF8F5 100%)' }}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', padding: '16px' }}>
        <Card
          style={{ width: 420, borderRadius: 16, boxShadow: '0 8px 32px rgba(39, 47, 114, 0.08)', border: '1px solid #F2E8D5', background: '#FFFFFF' }}
          bordered={false}
        >
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 42, color: brandColors.navy, marginBottom: 8 }}><LoginOutlined /></div>
            <Title level={3} style={{ color: brandColors.navy, margin: 0 }}>ERP4U</Title>
            <div style={{ width: 36, height: 3, background: brandColors.orange, margin: '8px auto 10px', borderRadius: 2 }} />
            <Text type="secondary">Hệ thống quản lý doanh nghiệp</Text>
          </div>

          {/* Quick banner to open demo accounts modal (only in demo mode) */}
          {isDemo && (
            <div
              onClick={() => setDemoModalOpen(true)}
              style={{
                marginBottom: 20,
                padding: '10px 14px',
                background: 'linear-gradient(135deg, #FFF5E1 0%, #FAF8F5 100%)',
                border: '1px solid #F2E8D5',
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: 13,
                color: brandColors.navy,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.2s',
                boxShadow: '0 2px 6px rgba(39, 47, 114, 0.05)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>🔑</span>
                <span><strong>Trải nghiệm Demo?</strong> Chọn tài khoản mẫu</span>
              </div>
              <RightOutlined style={{ fontSize: 12, color: brandColors.orange }} />
            </div>
          )}

          <Form
            form={form}
            name="login_form"
            initialValues={{ remember: true }}
            onFinish={onFinish}
            layout="vertical"
            size="large"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: 'Vui lòng nhập tên đăng nhập!' }]}
            >
              <Input prefix={<UserOutlined style={{ color: brandColors.navy }} />} placeholder="Tên đăng nhập" />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }]}
            >
              <Input.Password prefix={<LockOutlined style={{ color: brandColors.navy }} />} placeholder="Mật khẩu" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 12 }}>
              <Button type="primary" htmlType="submit" block loading={loading} style={{ height: 46, fontWeight: 'bold', borderRadius: 8, background: brandColors.navy, borderColor: brandColors.navy }}>
                ĐĂNG NHẬP
              </Button>
            </Form.Item>

            {/* Demo accounts button (only in demo mode) */}
            {isDemo && (
              <Form.Item style={{ marginBottom: 16 }}>
                <Button
                  type="dashed"
                  block
                  icon={<TeamOutlined />}
                  onClick={() => setDemoModalOpen(true)}
                  style={{
                    height: 42,
                    borderRadius: 8,
                    borderColor: brandColors.navy,
                    color: brandColors.navy,
                    fontWeight: 600,
                    background: brandColors.creamLayout
                  }}
                >
                  Danh sách tài khoản Demo
                </Button>
              </Form.Item>
            )}

            <div style={{ textAlign: 'center', fontSize: 12, color: '#888' }}>
              &copy; 2025 ERP4U System
            </div>
          </Form>
        </Card>
      </div>

      {/* MODAL DANH SÁCH TÀI KHOẢN DEMO (only in demo mode) */}
      {isDemo && (
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 4 }}>
              <span style={{ fontSize: 20 }}>✨</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17, color: brandColors.navy }}>Danh Sách Tài Khoản Trải Nghiệm Demo</div>
                <div style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 400 }}>
                  Nhấn <strong>"Đăng nhập ngay"</strong> để tự động điền và vào hệ thống với vai trò tương ứng
                </div>
              </div>
            </div>
          }
          open={demoModalOpen}
          onCancel={() => setDemoModalOpen(false)}
          footer={null}
          width={660}
          style={{ top: 24 }}
          styles={{ body: { maxHeight: '75vh', overflowY: 'auto', padding: '16px 8px' } }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {demoAccounts.map((acc) => (
              <div
                key={acc.username}
                style={{
                  border: `1px solid ${acc.color}33`,
                  borderRadius: 12,
                  padding: '14px 16px',
                  background: `linear-gradient(135deg, ${acc.color}08, #ffffff)`,
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: `${acc.color}18`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {acc.icon}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: '#262626' }}>{acc.fullName}</span>
                        <Tag color={acc.color} style={{ borderRadius: 6, fontWeight: 500 }}>{acc.groupName}</Tag>
                      </div>
                      <div style={{ fontSize: 12, color: '#595959', marginTop: 2 }}>{acc.roleTitle}</div>
                    </div>
                  </div>

                  {/* 1-Click Login Button */}
                  <Button
                    type="primary"
                    onClick={() => handleSelectDemoAccount(acc)}
                    style={{
                      borderRadius: 8,
                      background: `linear-gradient(135deg, ${acc.color}, ${acc.color}dd)`,
                      borderColor: acc.color,
                      fontWeight: 600,
                      height: 36
                    }}
                    icon={<LoginOutlined />}
                  >
                    Đăng nhập ngay
                  </Button>
                </div>

                {/* Description */}
                <div style={{ fontSize: 12, color: '#666', background: 'rgba(0,0,0,0.02)', padding: '6px 10px', borderRadius: 6 }}>
                  <strong>Quyền hạn:</strong> {acc.description}
                </div>

                {/* Credentials & Copy buttons */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 12, color: '#595959', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f5f5f5', padding: '4px 8px', borderRadius: 6 }}>
                    <span>Tài khoản:</span>
                    <code style={{ fontWeight: 700, color: '#001529' }}>{acc.username}</code>
                    <Tooltip title="Sao chép tên đăng nhập">
                      <Button
                        type="text"
                        size="small"
                        icon={<CopyOutlined style={{ fontSize: 12 }} />}
                        onClick={(e) => copyToClipboard(acc.username, 'tài khoản', e)}
                        style={{ padding: '0 4px', height: 20 }}
                      />
                    </Tooltip>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f5f5f5', padding: '4px 8px', borderRadius: 6 }}>
                    <span>Mật khẩu:</span>
                    <code style={{ fontWeight: 700, color: '#001529' }}>{acc.password}</code>
                    <Tooltip title="Sao chép mật khẩu">
                      <Button
                        type="text"
                        size="small"
                        icon={<CopyOutlined style={{ fontSize: 12 }} />}
                        onClick={(e) => copyToClipboard(acc.password, 'mật khẩu', e)}
                        style={{ padding: '0 4px', height: 20 }}
                      />
                    </Tooltip>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </Layout>
  );
};

export default LoginPage;
