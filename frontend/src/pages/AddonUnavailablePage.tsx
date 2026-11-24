import React from 'react';
import { Result, Button } from 'antd';
import { CloudOutlined } from '@ant-design/icons';
import { AddonKey, getAddonLabel } from '../config/packages';

interface AddonUnavailablePageProps {
  addon?: AddonKey | string;
  showHomeButton?: boolean;
}

const AddonUnavailablePage: React.FC<AddonUnavailablePageProps> = ({
  addon,
  showHomeButton = true,
}) => {
  const addonName = addon ? getAddonLabel(addon) : 'mở rộng';

  return (
    <div style={{ padding: '48px 24px', display: 'flex', justifyContent: 'center' }}>
      <Result
        icon={<CloudOutlined style={{ color: '#272F72', fontSize: 64 }} />}
        status="info"
        title={`Tính năng ${addonName} có trên ERP4U Cloud`}
        subTitle="Tính năng này thuộc phiên bản đám mây (ERP4U Cloud) và chưa được cài đặt trên phiên bản Open-Core hiện tại."
        extra={[
          <Button
            type="primary"
            key="learn-more"
            href="https://erp4u.conix.cloud"
            target="_blank"
            rel="noopener noreferrer"
          >
            Tìm hiểu thêm
          </Button>,
          showHomeButton ? (
            <Button key="home" onClick={() => (window.location.href = '/')}>
              Về trang chủ
            </Button>
          ) : null,
        ].filter(Boolean)}
      />
    </div>
  );
};

export default AddonUnavailablePage;
