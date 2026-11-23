import React, { useEffect } from 'react';
import { Card, Row, Col, Tag, Progress, Typography, Space, Divider, Alert, Spin } from 'antd';
import {
  RocketOutlined,
  TeamOutlined,
  AppstoreOutlined,
  CustomerServiceOutlined,
  MailOutlined,
  PhoneOutlined,
  LinkOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSubscription } from '../hooks/useSubscription';
import { PACKAGE_LABELS, PackageKey } from '../config/packages';

const { Title, Text, Paragraph } = Typography;

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  active: { text: 'Đang hoạt động', color: 'success' },
  trialing: { text: 'Đang dùng thử', color: 'processing' },
  past_due: { text: 'Quá hạn thanh toán', color: 'error' },
  suspended: { text: 'Tạm ngưng', color: 'error' },
};

export const SubscriptionPage: React.FC = () => {
  const { subscription, users, packages, loading, refetch } = useSubscription();

  useEffect(() => {
    refetch();
  }, [refetch]);

  if (loading && !subscription) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <Spin size="large" tip="Đang tải thông tin gói dịch vụ..." />
      </div>
    );
  }

  if (!subscription) {
    return (
      <Alert
        message="Không có thông tin gói dịch vụ"
        description="Hệ thống đang hoạt động ở chế độ mã nguồn mở (Open-Core) hoặc bản Demo."
        type="info"
        showIcon
      />
    );
  }

  const statusInfo = STATUS_LABELS[subscription.status] || {
    text: subscription.status,
    color: 'default',
  };

  const isUnlimited = users.max === null;
  const userPercent = isUnlimited
    ? 100
    : Math.min(100, Math.round((users.used / (users.max || 1)) * 100));
  const isUserFull = !isUnlimited && users.used >= (users.max || 0);

  const activePackages = packages.filter((p) => p.enabled);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '8px 0' }}>
      <Title level={3} style={{ marginBottom: 24 }}>
        <RocketOutlined style={{ marginRight: 8, color: '#1890ff' }} />
        Gói Dịch Vụ
      </Title>

      <Row gutter={[16, 16]}>
        {/* THÔNG TIN GÓI */}
        <Col xs={24} md={12}>
          <Card
            title={
              <Space>
                <RocketOutlined />
                <span>Thông tin Gói Thuê Bao</span>
              </Space>
            }
            bordered={false}
            style={{ height: '100%', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
          >
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">Gói đang sử dụng:</Text>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff', marginTop: 4 }}>
                {subscription.plan_name}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">Trạng thái:</Text>
              <div style={{ marginTop: 4 }}>
                <Tag color={statusInfo.color} style={{ fontSize: 13, padding: '2px 10px' }}>
                  {statusInfo.text}
                </Tag>
              </div>
            </div>

            {subscription.status === 'trialing' && subscription.trial_ends_at && (
              <div style={{ marginBottom: 16 }}>
                <Text type="secondary">Hạn dùng thử kết thúc:</Text>
                <div style={{ fontWeight: 500, marginTop: 4 }}>
                  {dayjs(subscription.trial_ends_at).format('DD/MM/YYYY HH:mm')} (
                  {Math.max(
                    0,
                    Math.ceil(
                      (new Date(subscription.trial_ends_at).getTime() - Date.now()) /
                        (1000 * 60 * 60 * 24),
                    ),
                  )}{' '}
                  ngày còn lại)
                </div>
              </div>
            )}

            {subscription.current_period_end && (
              <div style={{ marginBottom: 16 }}>
                <Text type="secondary">Kỳ hiện tại kết thúc:</Text>
                <div style={{ fontWeight: 500, marginTop: 4 }}>
                  {dayjs(subscription.current_period_end).format('DD/MM/YYYY')}
                </div>
              </div>
            )}
          </Card>
        </Col>

        {/* HẠN MỨC NGƯỜI DÙNG */}
        <Col xs={24} md={12}>
          <Card
            title={
              <Space>
                <TeamOutlined />
                <span>Số Lượng Người Dùng (Quota)</span>
              </Space>
            }
            bordered={false}
            style={{ height: '100%', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
          >
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">Người dùng đang hoạt động:</Text>
              <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 4 }}>
                {users.used}{' '}
                <span style={{ fontSize: 16, fontWeight: 'normal', color: '#888' }}>
                  / {isUnlimited ? 'Không giới hạn' : users.max}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Progress
                percent={userPercent}
                status={isUserFull ? 'exception' : 'active'}
                strokeColor={isUserFull ? '#ff4d4f' : '#1890ff'}
              />
            </div>

            {isUserFull && (
              <Alert
                message="Đã đạt số người dùng tối đa của gói"
                description="Bạn không thể tạo thêm hoặc kích hoạt lại người dùng. Vui lòng liên hệ hỗ trợ để nâng cấp gói."
                type="warning"
                showIcon
                style={{ marginTop: 12 }}
              />
            )}
          </Card>
        </Col>

        {/* DANH SÁCH GÓI TÍNH NĂNG ĐANG BẬT */}
        <Col xs={24}>
          <Card
            title={
              <Space>
                <AppstoreOutlined />
                <span>Gói Tính Năng Đang Bật</span>
              </Space>
            }
            bordered={false}
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
          >
            {activePackages.length === 0 ? (
              <Text type="secondary">Không có gói tính năng nào đang kích hoạt.</Text>
            ) : (
              <Space wrap size={[8, 12]}>
                {activePackages.map((pkg) => {
                  const label =
                    PACKAGE_LABELS[pkg.key as PackageKey] || pkg.key;
                  return (
                    <Tag
                      key={pkg.key}
                      color="blue"
                      icon={<CheckCircleOutlined />}
                      style={{ fontSize: 13, padding: '4px 10px', borderRadius: 4 }}
                    >
                      {label}
                    </Tag>
                  );
                })}
              </Space>
            )}
          </Card>
        </Col>

        {/* NÂNG CẤP VÀ HỖ TRỢ */}
        {subscription.support_contact && (
          <Col xs={24}>
            <Card
              title={
                <Space>
                  <CustomerServiceOutlined />
                  <span>Nâng Cấp & Hỗ Trợ</span>
                </Space>
              }
              bordered={false}
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
            >
              <Paragraph>
                Để nâng cấp gói dịch vụ hoặc mở rộng thêm số lượng người dùng, vui lòng liên hệ
                với bộ phận hỗ trợ kỹ thuật:
              </Paragraph>

              <Space direction="vertical" size={10}>
                {subscription.support_contact.email && (
                  <Space>
                    <MailOutlined style={{ color: '#1890ff' }} />
                    <Text strong>Email:</Text>
                    <a href={`mailto:${subscription.support_contact.email}`}>
                      {subscription.support_contact.email}
                    </a>
                  </Space>
                )}

                {subscription.support_contact.phone && (
                  <Space>
                    <PhoneOutlined style={{ color: '#52c41a' }} />
                    <Text strong>Điện thoại:</Text>
                    <a href={`tel:${subscription.support_contact.phone}`}>
                      {subscription.support_contact.phone}
                    </a>
                  </Space>
                )}

                {subscription.support_contact.url && (
                  <Space>
                    <LinkOutlined style={{ color: '#722ed1' }} />
                    <Text strong>Trang hỗ trợ:</Text>
                    <a
                      href={subscription.support_contact.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {subscription.support_contact.url}
                    </a>
                  </Space>
                )}
              </Space>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
};

export default SubscriptionPage;
