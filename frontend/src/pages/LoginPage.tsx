import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Layout, Tag, Divider, Tooltip } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined, KeyOutlined, CheckCircleOutlined } from '@ant-design/icons';
import api from '../utils/api';

const { Title, Text } = Typography;

const DEMO_ACCOUNTS = [
  { username: 'admin', pass: 'admin123', role: 'Super Admin', desc: 'Toàn quyền quản trị', color: 'volcano' },
  { username: 'sales01', pass: 'demo123', role: 'Kinh Doanh', desc: 'Bán hàng & CRM', color: 'blue' },
  { username: 'warehouse01', pass: 'demo123', role: 'Quản Lý Kho', desc: 'Kho & Vật tư', color: 'cyan' },
  { username: 'accountant01', pass: 'demo123', role: 'Kế Toán', desc: 'Tài chính & Thu chi', color: 'green' },
  { username: 'hr01', pass: 'demo123', role: 'Nhân Sự', desc: 'Nhân sự & Bảng lương', color: 'purple' },
];

const LoginPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState('admin');

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', values);

      // Lưu Token và User Info vào LocalStorage
      localStorage.setItem('token', res.data.access_token);
      localStorage.setItem('user', JSON.stringify(res.data.user));

      message.success('Đăng nhập thành công!');
      window.location.href = '/';
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại!');
    }
    setLoading(false);
  };

  const handleSelectDemo = (acc: typeof DEMO_ACCOUNTS[0]) => {
    setSelectedUser(acc.username);
    form.setFieldsValue({
      username: acc.username,
      password: acc.pass,
    });
    message.info(`Đã điền tài khoản: ${acc.username} (${acc.role})`);
  };

  return (
    <Layout style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #096dd9 0%, #001529 100%)' }}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '24px 16px' }}>
        <Card
          style={{ width: 440, borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.25)', overflow: 'hidden' }}
          bordered={false}
          bodyStyle={{ padding: '32px 28px' }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: '#e6f7ff',
              color: '#1890ff',
              fontSize: 28,
              marginBottom: 12
            }}>
              <LoginOutlined />
            </div>
            <Title level={3} style={{ color: '#001529', margin: 0, fontWeight: 700 }}>ERP4U</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>Hệ thống quản trị doanh nghiệp sản xuất mở</Text>
          </div>

          {/* Demo Accounts Quick Selection */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 20
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text strong style={{ fontSize: 12, color: '#334155' }}>
                <KeyOutlined style={{ color: '#1890ff', marginRight: 6 }} />
                Tài khoản dùng thử (1-Click điền nhanh):
              </Text>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {DEMO_ACCOUNTS.map((acc) => {
                const isSelected = selectedUser === acc.username;
                return (
                  <Tooltip key={acc.username} title={`${acc.role} (${acc.desc}) - Mật khẩu: ${acc.pass}`}>
                    <Tag
                      color={isSelected ? acc.color : 'default'}
                      onClick={() => handleSelectDemo(acc)}
                      style={{
                        cursor: 'pointer',
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: isSelected ? 600 : 400,
                        border: isSelected ? undefined : '1px dashed #d9d9d9',
                        transition: 'all 0.2s',
                        userSelect: 'none'
                      }}
                    >
                      {acc.username} {isSelected && <CheckCircleOutlined style={{ marginLeft: 4 }} />}
                    </Tag>
                  </Tooltip>
                );
              })}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>
              💡 <i>Click vào thẻ tài khoản bất kỳ để tự động điền user / pass</i>
            </div>
          </div>

          {/* Login Form */}
          <Form
            form={form}
            name="login_form"
            initialValues={{
              username: 'admin',
              password: 'admin123',
            }}
            onFinish={onFinish}
            layout="vertical"
            size="large"
          >
            <Form.Item
              name="username"
              label={<span style={{ fontSize: 13, fontWeight: 500 }}>Tên đăng nhập</span>}
              rules={[{ required: true, message: 'Vui lòng nhập tên đăng nhập!' }]}
              style={{ marginBottom: 16 }}
            >
              <Input prefix={<UserOutlined style={{ color: '#bfbfbf' }} />} placeholder="Tên đăng nhập" />
            </Form.Item>

            <Form.Item
              name="password"
              label={<span style={{ fontSize: 13, fontWeight: 500 }}>Mật khẩu</span>}
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }]}
              style={{ marginBottom: 20 }}
            >
              <Input.Password prefix={<LockOutlined style={{ color: '#bfbfbf' }} />} placeholder="Mật khẩu" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 12 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loading}
                style={{
                  height: 46,
                  fontWeight: 600,
                  fontSize: 15,
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                  boxShadow: '0 4px 12px rgba(24, 144, 255, 0.35)'
                }}
              >
                ĐĂNG NHẬP
              </Button>
            </Form.Item>

            {/* Quick credentials reference table */}
            <Divider style={{ margin: '16px 0 12px', fontSize: 11, color: '#94a3b8' }}>
              Danh sách tài khoản thử nghiệm
            </Divider>

            <div style={{ fontSize: 11, color: '#475569', background: '#f1f5f9', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '90px 75px 1fr', fontWeight: 600, borderBottom: '1px solid #e2e8f0', paddingBottom: 4, marginBottom: 4 }}>
                <span>Tài khoản</span>
                <span>Mật khẩu</span>
                <span>Vai trò</span>
              </div>
              {DEMO_ACCOUNTS.map(a => (
                <div key={a.username} style={{ display: 'grid', gridTemplateColumns: '90px 75px 1fr', padding: '3px 0', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#2563eb' }}>{a.username}</span>
                  <span style={{ fontFamily: 'monospace' }}>{a.pass}</span>
                  <span style={{ color: '#64748b' }}>{a.desc}</span>
                </div>
              ))}
            </div>

            <div style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', marginTop: 16 }}>
              &copy; 2026 ERP4U Open Source Community (AGPL-3.0)
            </div>
          </Form>
        </Card>
      </div>
    </Layout>
  );
};

export default LoginPage;
