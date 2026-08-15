import React from 'react';
import { Card, Row, Col, Statistic, Progress } from 'antd';
import { 
    AlertOutlined, 
    FileDoneOutlined, 
    AppstoreAddOutlined, 
    SafetyCertificateOutlined,
    ClockCircleOutlined
} from '@ant-design/icons';
import useMobile from '../../hooks/useMobile';

interface ControlTowerKPIProps {
    stats: any;
}

const ControlTowerKPI: React.FC<ControlTowerKPIProps> = ({ stats }) => {
    const isMobile = !!useMobile();

    return (
        <div style={{ overflowX: isMobile ? 'auto' : 'visible', marginBottom: 16 }}>
            <Row gutter={[isMobile ? 8 : 16, 8]} wrap={!isMobile} style={{ flexWrap: isMobile ? 'nowrap' : 'wrap', minWidth: isMobile ? 800 : 'auto' }}>
                <Col flex={isMobile ? '160px' : 1}>
                    <Card 
                        hoverable
                        bodyStyle={{ padding: isMobile ? 10 : 16 }} 
                        style={{ 
                            borderRadius: 16, 
                            border: '1px solid rgba(255, 213, 145, 0.5)', 
                            background: 'linear-gradient(135deg, rgba(255,247,230,0.8) 0%, rgba(255,251,230,0.4) 100%)',
                            backdropFilter: 'blur(8px)',
                            boxShadow: '0 4px 12px rgba(255, 213, 145, 0.1)',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <Statistic 
                            title={<span style={{ fontSize: 13, color: '#d46b08', fontWeight: 600 }}>Cảnh báo (Chờ Quyết Định)</span>} 
                            value={stats?.alerts ?? 3} 
                            prefix={<AlertOutlined />} 
                            valueStyle={{ color: '#cf1322', fontSize: 24, fontWeight: 700 }} 
                        />
                    </Card>
                </Col>
                <Col flex={isMobile ? '160px' : 1}>
                    <Card 
                        hoverable
                        bodyStyle={{ padding: isMobile ? 10 : 16 }} 
                        style={{ 
                            borderRadius: 16, 
                            border: '1px solid rgba(145, 213, 255, 0.5)', 
                            background: 'linear-gradient(135deg, rgba(230,247,255,0.8) 0%, rgba(240,245,255,0.4) 100%)',
                            backdropFilter: 'blur(8px)',
                            boxShadow: '0 4px 12px rgba(145, 213, 255, 0.1)',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <Statistic 
                            title={<span style={{ fontSize: 13, color: '#096dd9', fontWeight: 600 }}>PFO Đang Chạy</span>} 
                            value={stats?.activePfos ?? 12} 
                            prefix={<AppstoreAddOutlined />} 
                            valueStyle={{ color: '#096dd9', fontSize: 24, fontWeight: 700 }} 
                        />
                    </Card>
                </Col>
                <Col flex={isMobile ? '160px' : 1}>
                    <Card 
                        hoverable
                        bodyStyle={{ padding: isMobile ? 10 : 16 }} 
                        style={{ 
                            borderRadius: 16, 
                            border: '1px solid rgba(183, 235, 143, 0.5)', 
                            background: 'linear-gradient(135deg, rgba(246,255,237,0.8) 0%, rgba(252,255,230,0.4) 100%)',
                            backdropFilter: 'blur(8px)',
                            boxShadow: '0 4px 12px rgba(183, 235, 143, 0.1)',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <Statistic 
                            title={<span style={{ fontSize: 13, color: '#389e0d', fontWeight: 600 }}>Lô hàng Pass QC (Tuần)</span>} 
                            value={stats?.qcPassed ?? 45} 
                            prefix={<SafetyCertificateOutlined />} 
                            valueStyle={{ color: '#389e0d', fontSize: 24, fontWeight: 700 }} 
                        />
                    </Card>
                </Col>
                <Col flex={isMobile ? '160px' : 1}>
                    <Card 
                        hoverable
                        bodyStyle={{ padding: isMobile ? 10 : 16 }} 
                        style={{ 
                            borderRadius: 16, 
                            border: '1px solid rgba(217, 217, 217, 0.5)', 
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(250,250,250,0.4) 100%)',
                            backdropFilter: 'blur(8px)',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: 13, color: '#595959', fontWeight: 600, marginBottom: 8 }}>OTIF (Giao hàng đúng hạn)</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Progress type="circle" percent={stats?.otif ?? 92} size={40} strokeColor="#52c41a" />
                                <span style={{ fontSize: 16, fontWeight: 700, color: '#52c41a' }}>Mục tiêu: 95%</span>
                            </div>
                        </div>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default ControlTowerKPI;
