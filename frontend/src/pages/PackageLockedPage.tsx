import React from 'react';
import { Button, Result } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { getPackageLabel, PackageKey } from '../config/packages';

interface PackageLockedPageProps {
  packageKey?: PackageKey | string;
  showHomeButton?: boolean;
}

const PackageLockedPage: React.FC<PackageLockedPageProps> = ({
  packageKey,
  showHomeButton = true,
}) => {
  const packageName = getPackageLabel(packageKey);

  return (
    <div style={{ padding: '48px 16px' }}>
      <Result
        icon={<LockOutlined style={{ color: '#faad14' }} />}
        title={`Tính năng thuộc gói ${packageName} chưa được kích hoạt`}
        subTitle="Liên hệ quản trị viên để nâng cấp"
        extra={
          showHomeButton ? (
            <Link to="/">
              <Button type="primary">Về trang tổng quan</Button>
            </Link>
          ) : undefined
        }
      />
    </div>
  );
};

export default PackageLockedPage;
