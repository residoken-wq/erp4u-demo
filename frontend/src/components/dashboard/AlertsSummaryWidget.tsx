import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Badge, Spin, Typography } from 'antd';
import {
  AlertOutlined,
  DropboxOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  FundOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useEntitlements } from '../../hooks/useEntitlements';
import { PackageKey } from '../../config/packages';
import { brandColors } from '../../theme/brand';

const { Text } = Typography;

export interface AlertsSummaryData {
  total_open: number;
  by_type: {
    'stock.low_cover'?: number;
    'order.at_risk'?: number;
    'receivable.overdue'?: number;
    'cash.anomaly'?: number;
    [key: string]: number | undefined;
  };
  by_severity: {
    high?: number;
    medium?: number;
    low?: number;
    [key: string]: number | undefined;
  };
}

export const AlertsSummaryWidget: React.FC = () => {
  const navigate = useNavigate();
  const { isEnabled } = useEntitlements();
  const [data, setData] = useState<AlertsSummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [hidden, setHidden] = useState<boolean>(false);

  useEffect(() => {
    // Ẩn hoàn toàn nếu gói AI tắt
    if (!isEnabled(PackageKey.AI)) {
      setHidden(true);
      return;
    }

    let isMounted = true;
    api
      .get('/alerts/summary')
      .then((res) => {
        if (!isMounted) return;
        if (res.data) {
          setData(res.data);
        }
      })
      .catch((err) => {
        // Ẩn nếu 403 hoặc 404 (chưa bật gói hoặc không có quyền)
        const status = err.response?.status;
        if (status === 403 || status === 404) {
          if (isMounted) setHidden(true);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isEnabled]);

  if (hidden || !isEnabled(PackageKey.AI)) {
    return null;
  }

  const stockCount = data?.by_type?.['stock.low_cover'] ?? 0;
  const orderCount = data?.by_type?.['order.at_risk'] ?? 0;
  const receivableCount = data?.by_type?.['receivable.overdue'] ?? 0;
  const cashCount = data?.by_type?.['cash.anomaly'] ?? 0;
  const totalOpen = data?.total_open ?? stockCount + orderCount + receivableCount + cashCount;
  const highSeverityCount = data?.by_severity?.high ?? 0;

  return (
    <Card
      style={{
        borderRadius: 16,
        marginBottom: 20,
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
        border: '1px solid rgba(39, 47, 114, 0.08)',
      }}
      bodyStyle={{ padding: 18 }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertOutlined style={{ fontSize: 18, color: brandColors.navy }} />
          <Text strong style={{ fontSize: 15, color: brandColors.navy }}>
            Cảnh Báo Cần Xử Lý
          </Text>
          {totalOpen > 0 && (
            <Badge
              count={totalOpen}
              overflowCount={99}
              style={{
                backgroundColor: highSeverityCount > 0 ? '#ff4d4f' : '#faad14',
              }}
            />
          )}
        </div>
        <div
          onClick={() => navigate('/alerts')}
          style={{
            cursor: 'pointer',
            fontSize: 12,
            color: brandColors.navy,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>Xem tất cả</span>
          <ArrowRightOutlined />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <Spin size="small" />
        </div>
      ) : (
        <Row gutter={[12, 12]}>
          <Col xs={12} sm={6}>
            <div
              onClick={() => navigate('/alerts?type=stock.low_cover')}
              style={{
                background: stockCount > 0 ? '#fff1f0' : '#f8fafc',
                borderRadius: 12,
                padding: '10px 14px',
                cursor: 'pointer',
                border: stockCount > 0 ? '1px solid #ffccc7' : '1px solid #e2e8f0',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <DropboxOutlined style={{ color: stockCount > 0 ? '#ff4d4f' : '#64748b' }} />
                <span style={{ fontSize: 12, color: '#475569' }}>Tồn kho thấp</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: stockCount > 0 ? '#cf1322' : '#1e293b' }}>
                {stockCount}
              </div>
            </div>
          </Col>

          <Col xs={12} sm={6}>
            <div
              onClick={() => navigate('/alerts?type=order.at_risk')}
              style={{
                background: orderCount > 0 ? '#fffbe6' : '#f8fafc',
                borderRadius: 12,
                padding: '10px 14px',
                cursor: 'pointer',
                border: orderCount > 0 ? '1px solid #ffe58f' : '1px solid #e2e8f0',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <ClockCircleOutlined style={{ color: orderCount > 0 ? '#faad14' : '#64748b' }} />
                <span style={{ fontSize: 12, color: '#475569' }}>Đơn trễ hạn</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: orderCount > 0 ? '#d48806' : '#1e293b' }}>
                {orderCount}
              </div>
            </div>
          </Col>

          <Col xs={12} sm={6}>
            <div
              onClick={() => navigate('/alerts?type=receivable.overdue')}
              style={{
                background: receivableCount > 0 ? '#fff7e6' : '#f8fafc',
                borderRadius: 12,
                padding: '10px 14px',
                cursor: 'pointer',
                border: receivableCount > 0 ? '1px solid #ffd591' : '1px solid #e2e8f0',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <DollarOutlined style={{ color: receivableCount > 0 ? '#fa8c16' : '#64748b' }} />
                <span style={{ fontSize: 12, color: '#475569' }}>Công nợ quá hạn</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: receivableCount > 0 ? '#d46b08' : '#1e293b' }}>
                {receivableCount}
              </div>
            </div>
          </Col>

          <Col xs={12} sm={6}>
            <div
              onClick={() => navigate('/alerts?type=cash.anomaly')}
              style={{
                background: cashCount > 0 ? '#f0f5ff' : '#f8fafc',
                borderRadius: 12,
                padding: '10px 14px',
                cursor: 'pointer',
                border: cashCount > 0 ? '1px solid #adc6ff' : '1px solid #e2e8f0',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <FundOutlined style={{ color: cashCount > 0 ? '#2f54eb' : '#64748b' }} />
                <span style={{ fontSize: 12, color: '#475569' }}>Chi phí bất thường</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: cashCount > 0 ? '#1d39c4' : '#1e293b' }}>
                {cashCount}
              </div>
            </div>
          </Col>
        </Row>
      )}
    </Card>
  );
};

export default AlertsSummaryWidget;
