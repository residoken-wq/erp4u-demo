import React, { useState } from 'react';
import { Layout, Menu, Typography, Card, Tag, Descriptions, Divider, Badge, Table, Alert } from 'antd';
import {
    CodeOutlined, DatabaseOutlined, CloudServerOutlined, ToolOutlined, DeploymentUnitOutlined,
    ApiOutlined, BellOutlined, SafetyOutlined, RocketOutlined, GlobalOutlined
} from '@ant-design/icons';

const { Content, Sider } = Layout;
const { Title, Paragraph, Text } = Typography;

const DocsPage: React.FC = () => {
    const [selectedKey, setSelectedKey] = useState('intro');

    const moduleData = [
        { name: 'Auth', path: 'src/auth/', desc: 'JWT Authentication, RBAC' },
        { name: 'Sales', path: 'src/sales/', desc: 'Quotations, Orders, POS, Deliveries, Comments, Samples' },
        { name: 'Social', path: 'src/social/', desc: 'Facebook Integration, Social Orders' },
        { name: 'HR', path: 'src/hr/', desc: 'Employees, Attendance, Leave, Payslip' },
        { name: 'Finance', path: 'src/finance/', desc: 'Payments, Revenue, Expenses' },
        { name: 'Inventory', path: 'src/inventory/', desc: 'Stock In/Out, Levels, Alerts' },
        { name: 'Production', path: 'src/production/', desc: 'Work Orders, Output Tracking, Dashboard' },
        { name: 'Purchasing', path: 'src/purchasing/', desc: 'PO, Receiving, GRN' },
        { name: 'Products', path: 'src/products/', desc: 'Catalog, SKU, Pricing' },
        { name: 'Website', path: 'src/website/', desc: 'CMS Website Products, SEO' },
        { name: 'Tasks', path: 'src/tasks/', desc: 'Task Management, Reminders (CRON)' },
        { name: 'Notifications', path: 'src/notifications/', desc: 'In-app + Firebase Push' },
        { name: 'Upload', path: 'src/upload/', desc: 'File Upload, Image Compression' },
        { name: 'Firebase', path: 'src/firebase/', desc: 'Real-time Database Integration' },
        { name: 'Customers', path: 'src/customers/', desc: 'Customer Database' },
        { name: 'Suppliers', path: 'src/suppliers/', desc: 'Supplier Management' },
        { name: 'Materials', path: 'src/materials/', desc: 'Raw Materials' },
        { name: 'BOM', path: 'src/bom/', desc: 'Bill of Materials' },
        { name: 'Planning', path: 'src/planning/', desc: 'MRP Planning' },
        { name: 'Processes', path: 'src/processes/', desc: 'Production Processes' },
        { name: 'Categories', path: 'src/categories/', desc: 'Product Categories' },
        { name: 'Blogs', path: 'src/blogs/', desc: 'Blog Management' },
        { name: 'AI', path: 'src/ai/', desc: 'AI Assistant Integration' },
        { name: 'System', path: 'src/system/', desc: 'Settings, Activity Logs' },
        { name: 'Users', path: 'src/users/', desc: 'User Management' },
        { name: 'Common', path: 'src/common/', desc: 'Shared Utilities' },
    ];

    const renderContent = () => {
        switch (selectedKey) {
            case 'intro':
                return (
                    <div>
                        <Title level={2}>🛠️ ERP4U Technical Documentation</Title>
                        <Paragraph>
                            Tài liệu kỹ thuật dành cho Developer và DevOps. Hệ thống được xây dựng trên kiến trúc Monorepo (Frontend + Backend) với Docker hóa toàn bộ.
                        </Paragraph>

                        <Alert
                            message="Last Updated: May 2026"
                            description="Added POS Module, Social Channels Integration, Website CMS, and Activity Logs"
                            type="info"
                            showIcon
                            style={{ marginBottom: 20 }}
                        />

                        <Descriptions title="Tech Stack" bordered column={1}>
                            <Descriptions.Item label="Backend">NestJS 10.x, TypeORM 0.3.x, PostgreSQL 15+</Descriptions.Item>
                            <Descriptions.Item label="Frontend">React 18.x (Vite), Ant Design 5.x, TypeScript</Descriptions.Item>
                            <Descriptions.Item label="Real-time">Firebase Realtime Database</Descriptions.Item>
                            <Descriptions.Item label="Website">Next.js 14 (SSG)</Descriptions.Item>
                            <Descriptions.Item label="CMS">Next.js 14 + Ant Design Pro</Descriptions.Item>
                            <Descriptions.Item label="Database">PostgreSQL 15 (Dockerized)</Descriptions.Item>
                            <Descriptions.Item label="Containerization">Docker, Docker Compose</Descriptions.Item>
                        </Descriptions>
                    </div>
                );

            case 'architecture':
                return (
                    <div>
                        <Tag color="purple">Architecture</Tag>
                        <Title level={2}>System Architecture</Title>

                        <Card title="🏗️ High-Level Architecture" style={{ marginBottom: 20 }}>
                            <pre style={{
                                background: '#1e1e1e',
                                color: '#d4d4d4',
                                padding: 20,
                                borderRadius: 8,
                                overflow: 'auto',
                                fontSize: 12,
                                lineHeight: 1.5
                            }}>
                                {`┌─────────────────────────────────────────────────────────────┐
│                         CLIENTS                              │
├───────────────┬───────────────┬───────────────┬─────────────┤
│  ERP Frontend │   Website     │     CMS       │   Portal    │
│  (React SPA)  │  (Next.js)    │  (Next.js)    │  (Public)   │
│   Port: 80    │  Port: 3000   │  Port: 3001   │    /portal  │
└───────┬───────┴───────┬───────┴───────┬───────┴──────┬──────┘
        │               │               │              │
        └───────────────┴───────┬───────┴──────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   Nginx Reverse Proxy │
                    │     (Port 80/443)     │
                    └───────────┬───────────┘
                                │
              ┌─────────────────▼─────────────────┐
              │        NESTJS BACKEND API         │
              │           (Port: 3000)            │
              │                                   │
              │  ┌─────────────────────────────┐  │
              │  │     25 Feature Modules       │  │
              │  │  Auth, Sales, HR, Finance,  │  │
              │  │  Inventory, Production...   │  │
              │  └─────────────────────────────┘  │
              └──────────────┬────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
┌──────────────────┐ ┌──────────────┐ ┌─────────────────┐
│   PostgreSQL     │ │   Firebase   │ │  File Storage   │
│   (Port: 5432)   │ │  Realtime DB │ │   (/uploads)    │
└──────────────────┘ └──────────────┘ └─────────────────┘`}
                            </pre>
                        </Card>

                        <Card title="📊 Sales Order Lifecycle">
                            <pre style={{ background: '#f5f5f5', padding: 15, borderRadius: 5, overflow: 'auto' }}>
                                {`QUOTATION → SO_PENDING → DEPOSITED → SAMPLE_APPROVED
                                          ↓
COMPLETED ← DELIVERED ← PARTIAL_DELIVERY ← IN_PRODUCTION`}
                            </pre>
                        </Card>
                    </div>
                );

            case 'modules':
                return (
                    <div>
                        <Tag color="green">Modules</Tag>
                        <Title level={2}>Backend Modules ({moduleData.length} Total)</Title>
                        <Paragraph>
                            Tất cả modules đều nằm trong thư mục <code>src/</code> và được import vào <code>app.module.ts</code>.
                        </Paragraph>

                        <Table
                            dataSource={moduleData}
                            rowKey="name"
                            pagination={false}
                            size="small"
                            columns={[
                                { title: 'Module', dataIndex: 'name', width: 120, render: (t: string) => <Tag color="blue">{t}</Tag> },
                                { title: 'Path', dataIndex: 'path', width: 150, render: (t: string) => <code>{t}</code> },
                                { title: 'Description', dataIndex: 'desc' },
                            ]}
                        />
                    </div>
                );

            case 'features':
                return (
                    <div>
                        <Tag color="orange">Features</Tag>
                        <Title level={2}>Key Features & Integrations</Title>

                        <Card title="🔔 Real-time Notifications (Firebase)" style={{ marginBottom: 16 }}>
                            <Paragraph>
                                <b>Backend:</b> <code>src/firebase/firebase.service.ts</code> - Firebase Admin SDK<br />
                                <b>Frontend:</b> <code>src/utils/firebaseConfig.ts</code> + <code>HeaderNotifications.tsx</code><br />
                                <b>Flow:</b> Backend writes to Firebase RTDB → Frontend subscribes with onValue()<br />
                                <b>Fallback:</b> Polling every 30s if Firebase unavailable
                            </Paragraph>
                        </Card>

                        <Card title="🔗 Notification Deep Links" style={{ marginBottom: 16 }}>
                            <Paragraph>
                                Click notification → Navigate to exact content:
                            </Paragraph>
                            <ul>
                                <li><b>Sales Comments:</b> <code>/sales?order=X&tab=INTERNAL&highlight=comment-Y</code></li>
                                <li><b>Tasks:</b> <code>/tasks?task=X&highlight=task-X</code></li>
                            </ul>
                            <Paragraph>
                                <b>Frontend handling:</b> useSearchParams() → auto-open modal → scroll & highlight 3s
                            </Paragraph>
                        </Card>

                        <Card title="📤 File Upload & Compression" style={{ marginBottom: 16 }}>
                            <Paragraph>
                                <b>Service:</b> <code>src/upload/upload.service.ts</code><br />
                                <b>Compression:</b> Sharp library auto-compresses images on upload<br />
                                <b>Streaming:</b> Uses pipe() for efficient download
                            </Paragraph>
                        </Card>

                        <Card title="📝 Sales Comments @Mentions" style={{ marginBottom: 16 }}>
                            <Paragraph>
                                <b>Component:</b> <code>SalesComments.tsx</code><br />
                                <b>Editor:</b> ReactQuill with quill-mention<br />
                                <b>Notification:</b> Mentioned users receive real-time notification
                            </Paragraph>
                        </Card>

                        <Card title="⏰ Task Reminders (CRON)" style={{ marginBottom: 16 }}>
                            <Paragraph>
                                <b>Service:</b> <code>src/tasks/tasks.service.ts</code><br />
                                <b>Schedule:</b> EVERY_MINUTE checks for tasks with due_date &lt; now + 30min<br />
                                <b>Action:</b> Creates notification for assignee, marks task as reminded
                            </Paragraph>
                        </Card>
                    </div>
                );

            case 'backend':
                return (
                    <div>
                        <Tag color="red">Backend (NestJS)</Tag>
                        <Title level={2}>Backend Architecture</Title>
                        <Paragraph>
                            Backend nằm trong thư mục gốc (root), sử dụng framework NestJS.
                        </Paragraph>

                        <Title level={4}>Key Services</Title>
                        <Descriptions bordered size="small" column={1}>
                            <Descriptions.Item label="SalesService">
                                Orders, Quotations, Deliveries, Comments, Checklist, Samples<br />
                                <code>addComment()</code>: Creates comment + Firebase notification
                            </Descriptions.Item>
                            <Descriptions.Item label="TasksService">
                                CRUD + CRON reminder job<br />
                                <code>checkDeadlines()</code>: Auto-remind before due date
                            </Descriptions.Item>
                            <Descriptions.Item label="NotificationsService">
                                Writes to PostgreSQL + Firebase RTDB
                            </Descriptions.Item>
                            <Descriptions.Item label="FinanceService">
                                Payments linked to SalesOrders
                            </Descriptions.Item>
                            <Descriptions.Item label="UploadService">
                                File handling with Sharp compression
                            </Descriptions.Item>
                        </Descriptions>

                        <Divider />
                        <Title level={4}>Database (PostgreSQL)</Title>
                        <Paragraph>
                            TypeORM with <code>synchronize: true</code> (development).<br />
                            Key entities: SalesOrder, SalesOrderItem, SalesComment, Task, Notification, User, Customer, Product, etc.
                        </Paragraph>
                    </div>
                );

            case 'frontend':
                return (
                    <div>
                        <Tag color="blue">Frontend (React)</Tag>
                        <Title level={2}>Frontend Architecture</Title>
                        <Paragraph>
                            Frontend trong <code>/frontend</code>, React SPA với Vite build tool.
                        </Paragraph>

                        <Title level={4}>Structure</Title>
                        <ul>
                            <li><code>src/pages/</code>: Main pages (SalesPage, TasksPage, HRPage...)</li>
                            <li><code>src/components/</code>: Reusable components</li>
                            <li><code>src/utils/api.ts</code>: Axios instance with Auth interceptor</li>
                            <li><code>src/utils/firebaseConfig.ts</code>: Firebase client config</li>
                            <li><code>src/hooks/</code>: Custom hooks (useMobile, etc.)</li>
                        </ul>

                        <Divider />
                        <Title level={4}>Key Features</Title>
                        <ul>
                            <li><b>Real-time:</b> Firebase subscription in HeaderNotifications</li>
                            <li><b>Deep Links:</b> useSearchParams for notification navigation</li>
                            <li><b>Lazy Loading:</b> React.lazy() for all pages</li>
                            <li><b>Mobile Responsive:</b> useMobile() hook for adaptive UI</li>
                        </ul>
                    </div>
                );

            case 'deployment':
                return (
                    <div>
                        <Tag color="cyan">DevOps</Tag>
                        <Title level={2}>Deployment Guide</Title>

                        <Title level={4}>1. Docker Commands</Title>
                        <div style={{ background: '#1e1e1e', color: '#d4d4d4', padding: 15, borderRadius: 8, marginBottom: 20 }}>
                            <code># Build & Start all services</code><br />
                            <code style={{ color: '#4fc3f7' }}>docker-compose up --build -d</code><br /><br />
                            <code># Rebuild after code changes</code><br />
                            <code style={{ color: '#4fc3f7' }}>docker-compose build --no-cache</code><br /><br />
                            <code># View logs</code><br />
                            <code style={{ color: '#4fc3f7' }}>docker-compose logs -f backend</code>
                        </div>

                        <Title level={4}>2. Containers</Title>
                        <ul>
                            <li><code>postgres_erp4u</code>: PostgreSQL Database (Port 5432)</li>
                            <li><code>erp4u_backend</code>: NestJS API (Port 3000)</li>
                            <li><code>erp4u_frontend</code>: React + Nginx (Port 80)</li>
                        </ul>

                        <Title level={4}>3. Environment Variables</Title>
                        <pre style={{ background: '#222', color: '#fff', padding: 15, borderRadius: 5 }}>
                            {`POSTGRES_USER=admin
POSTGRES_PASSWORD=your_password
POSTGRES_DB=erp4u_erp
DB_HOST=postgres_erp4u
JWT_SECRET=super_secret_key`}
                        </pre>

                        <Title level={4}>4. Firebase Setup</Title>
                        <ul>
                            <li>Place <code>firebase-service-account.json</code> in <code>src/firebase/</code></li>
                            <li>Ensure it's in <code>.gitignore</code></li>
                            <li>Frontend: Set config in <code>firebaseConfig.ts</code></li>
                        </ul>
                    </div>
                );

            default:
                return <div>Select a topic</div>;
        }
    };

    return (
        <Layout style={{ height: '100%', background: '#fff' }}>
            <Sider width={240} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
                <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CodeOutlined style={{ fontSize: 24, color: '#fa8c16' }} />
                    <span style={{ fontSize: 18, fontWeight: 'bold' }}>Dev Docs</span>
                </div>
                <Menu
                    mode="inline"
                    selectedKeys={[selectedKey]}
                    onClick={(e) => setSelectedKey(e.key)}
                    style={{ borderRight: 0 }}
                    items={[
                        { key: 'intro', icon: <DeploymentUnitOutlined />, label: 'Tổng quan' },
                        { key: 'architecture', icon: <GlobalOutlined />, label: 'Architecture (Diagram)' },
                        { key: 'modules', icon: <ApiOutlined />, label: 'Modules (25)' },
                        { key: 'features', icon: <RocketOutlined />, label: 'Key Features' },
                        { key: 'backend', icon: <DatabaseOutlined />, label: 'Backend Guide' },
                        { key: 'frontend', icon: <ToolOutlined />, label: 'Frontend Guide' },
                        { key: 'deployment', icon: <CloudServerOutlined />, label: 'Deployment' },
                    ]}
                />
            </Sider>
            <Layout style={{ padding: '24px' }}>
                <Content style={{ padding: 24, background: '#fff', borderRadius: 8, overflow: 'auto' }}>
                    {renderContent()}
                </Content>
            </Layout>
        </Layout>
    );
};

export default DocsPage;
