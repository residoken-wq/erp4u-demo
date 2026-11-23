import React from 'react';
import { Tag } from 'antd';
import { Link } from 'react-router-dom';
import { useSubscription, getSubscriptionTagConfig } from '../hooks/useSubscription';

export const SubscriptionTag: React.FC = () => {
  const { subscription } = useSubscription();
  const config = getSubscriptionTagConfig(subscription);

  if (!config) {
    return null;
  }

  return (
    <Link to="/subscription" style={{ textDecoration: 'none' }}>
      <Tag
        color={config.color}
        style={{
          cursor: 'pointer',
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: 4,
          fontSize: 12,
          display: 'inline-flex',
          alignItems: 'center',
          userSelect: 'none',
        }}
      >
        {config.label}
      </Tag>
    </Link>
  );
};

export default SubscriptionTag;
