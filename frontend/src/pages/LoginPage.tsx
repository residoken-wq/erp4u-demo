import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Layout, Modal, Tag, Tooltip } from 'antd';
import {
  UserOutlined,
  LockOutlined,
  LoginOutlined,
  CrownOutlined,
  ShopOutlined,
  InboxOutlined,
  AccountBookOutlined,
  TeamOutlined,
  CopyOutlined,
  RightOutlined
} from '@ant-design/icons';
import api from '../utils/api';

const { Title, Text } = Typography;

interface DemoAccount {
  username: string;
  password: string;
  fullName: string;
  roleTitle: string;
  groupName: string;
  color: string;
  icon: React.ReactNode;
  description: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    username: 'admin',
    password: 'admin123',
    fullName: 'Quản Trị Viên (Admin)',
    roleTitle: 'Ban Giám Đốc / Quản Trị Hệ Thống',
    groupName: 'Admin',
    color: '#722ed1',
    icon: <CrownOutlined style={{ fontSize: 20, color: '#722ed1' }} />,
    description: 'Toàn quyền cấu hình hệ thống, quản lý người dùng & phân quyền, duyệt báo cáo tổng quan.'
  },
  {
    username: 'sales01',
    password: 'demo123',
    fullName: 'Nguyễn Văn Minh',
    roleTitle: 'Trưởng Nhóm Kinh Doanh (Sales Lead)',
    groupName: 'Kinh Doanh',
    color: '#1890ff',
    icon: <ShopOutlined style={{ fontSize: 20, color: '#1890ff' }} />,
    description: 'Bán hàng POS, quản lý khách hàng (CRM), tạo báo giá, theo dõi tiến độ đơn hàng (SO).'
  },
  {
    username: 'warehouse01',
    password: 'demo123',
    fullName: 'Trần Thị Thu Thảo',
    roleTitle: 'Thủ Kho (Warehouse Manager)',
    groupName: 'Quản Lý Kho',
    color: '#fa8c16',
    icon: <InboxOutlined style={{ fontSize: 20, color: '#fa8c16' }} />,
    description: 'Quản lý nguyên phụ liệu & thành phẩm, xuất/nhập kho, kiểm kê tồn kho, cảnh báo hết hàng.'
  },
  {
    username: 'accountant01',
    password: 'demo123',
    fullName: 'Lê Hoàng Anh',
    roleTitle: 'Kế Toán Trưởng (Chief Accountant)',
    groupName: 'Kế Toán',
    color: '#52c41a',
    icon: <AccountBookOutlined style={{ fontSize: 20, color: '#52c41a' }} />,
    description: 'Quản lý sổ quỹ thu chi, dòng tiền, theo dõi công nợ khách hàng và nhà cung cấp.'
  },
  {
    username: 'hr01',
    password: 'demo123',
    fullName: 'Phạm Ngọc Mai',
    roleTitle: 'Trưởng Phòng Nhân Sự (HR Lead)',
    groupName: 'Nhân Sự',
    color: '#eb2f96',
    icon: <TeamOutlined style={{ fontSize: 20, color: '#eb2f96' }} />,
    description: 'Hồ sơ nhân viên, cơ cấu phòng ban, chấm công, tính lương và hợp đồng lao động.'
  }
];

const LoginPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);

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
      message.error(error.response?.data?.message || 'Đăng nhập thất bại');
    }
    setLoading(false);
  };

  const handleSelectDemoAccount = (acc: DemoAccount) => {
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
    <Layout style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1890ff 0%, #001529 100%)' }}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', padding: '16px' }}>
        <Card
          style={{ width: 420, borderRadius: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}
          bordered={false}
        >
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 42, color: '#1890ff', marginBottom: 8 }}><LoginOutlined /></div>
            <Title level={3} style={{ color: '#001529', margin: 0 }}>ERP4U</Title>
            <Text type="secondary">Hệ thống quản lý doanh nghiệp</Text>
          </div>

          {/* Quick banner to open demo accounts modal */}
          <div
            onClick={() => setDemoModalOpen(true)}
            style={{
              marginBottom: 20,
              padding: '10px 14px',
              background: 'linear-gradient(135deg, #e6f7ff 0%, #f9f0ff 100%)',
              border: '1px solid #91d5ff',
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 13,
              color: '#0050b3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.2s',
              boxShadow: '0 2px 6px rgba(24, 144, 255, 0.1)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>🔑</span>
              <span><strong>Trải nghiệm Demo?</strong> Chọn tài khoản mẫu</span>
            </div>
            <RightOutlined style={{ fontSize: 12, color: '#1890ff' }} />
          </div>

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
              <Input prefix={<UserOutlined />} placeholder="Tên đăng nhập" />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 12 }}>
              <Button type="primary" htmlType="submit" block loading={loading} style={{ height: 46, fontWeight: 'bold', borderRadius: 8 }}>
                ĐĂNG NHẬP
              </Button>
            </Form.Item>

            <Form.Item style={{ marginBottom: 16 }}>
              <Button
                type="dashed"
                block
                icon={<TeamOutlined />}
                onClick={() => setDemoModalOpen(true)}
                style={{
                  height: 42,
                  borderRadius: 8,
                  borderColor: '#1890ff',
                  color: '#1890ff',
                  fontWeight: 600,
                  background: '#f0f5ff'
                }}
              >
                Danh sách tài khoản Demo
              </Button>
            </Form.Item>

            <div style={{ textAlign: 'center', fontSize: 12, color: '#888' }}>
              &copy; 2025 ERP4U System
            </div>
          </Form>
        </Card>
      </div>

      {/* MODAL DANH SÁCH TÀI KHOẢN DEMO */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 4 }}>
            <span style={{ fontSize: 20 }}>✨</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 17, color: '#001529' }}>Danh Sách Tài Khoản Trải Nghiệm Demo</div>
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
          {DEMO_ACCOUNTS.map((acc) => (
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
    </Layout>
  );
};

export default LoginPage;