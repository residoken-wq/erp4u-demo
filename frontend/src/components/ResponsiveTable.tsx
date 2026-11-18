import React from 'react';
import { Table, List, Card, Empty } from 'antd';
import useMobile from '../hooks/useMobile';

interface ResponsiveTableProps {
    columns: any[];
    dataSource: any[];
    rowKey?: string;
    loading?: boolean;
    pagination?: any;
    renderMobileItem: (item: any) => React.ReactNode;
    // ... allow other props
    [key: string]: any;
}

const ResponsiveTable: React.FC<ResponsiveTableProps> = ({
    columns,
    dataSource,
    rowKey = 'id',
    loading,
    pagination,
    renderMobileItem,
    ...rest
}) => {
    const isMobile = useMobile();

    if (isMobile) {
        return (
            <List
                loading={loading}
                dataSource={dataSource}
                pagination={pagination}
                rowKey={rowKey}
                renderItem={(item) => (
                    <List.Item style={{ padding: '8px 0' }}>
                        <div style={{ width: '100%' }}>
                            {renderMobileItem(item)}
                        </div>
                    </List.Item>
                )}
                {...rest}
            />
        );
    }

    return (
        <Table
            columns={columns}
            dataSource={dataSource}
            rowKey={rowKey}
            loading={loading}
            pagination={pagination}
            {...rest}
        />
    );
};

export default ResponsiveTable;
