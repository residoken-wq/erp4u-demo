import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Layout } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';
import api from '../utils/api';
// import { API_URL } from '../config'; // Not needed if using api

const { Title, Text } = Typography;

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      // Path is relative to baseURL in api
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

  return (
    <Layout style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1890ff 0%, #001529 100%)' }}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Card
          style={{ width: 400, borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
          bordered={false}
        >
          <div style={{ textAlign: 'center', marginBottom: 30 }}>
            <div style={{ fontSize: 40, color: '#1890ff', marginBottom: 10 }}><LoginOutlined /></div>
            <Title level={3} style={{ color: '#001529', margin: 0 }}>ERP4U</Title>
            <Text type="secondary">Hệ thống quản lý doanh nghiệp</Text>
          </div>

          <Form
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

            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading} style={{ height: 45, fontWeight: 'bold' }}>
                ĐĂNG NHẬP
              </Button>
            </Form.Item>

            <div style={{ textAlign: 'center', fontSize: 12, color: '#888' }}>
              &copy; 2025 ERP4U System
            </div>
          </Form>
        </Card>
      </div>
    </Layout>
  );
};

export default LoginPage;