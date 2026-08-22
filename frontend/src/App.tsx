import React, { useState, useEffect, useMemo } from 'react';
import { Layout, Menu, theme, Button, Avatar, Dropdown, Modal, Form, Input, message } from 'antd';
import type { MenuProps } from 'antd';
import {
    DesktopOutlined, PieChartOutlined, TeamOutlined, ShopOutlined, DropboxOutlined, CloudUploadOutlined,
    SettingOutlined, UserOutlined, LogoutOutlined, BankOutlined, CalendarOutlined, ShoppingCartOutlined, QuestionCircleOutlined, CodeOutlined, MenuOutlined, IdcardOutlined,
    LinkOutlined, RocketOutlined, FacebookOutlined, NotificationOutlined, FolderOutlined, MessageOutlined, GlobalOutlined, PrinterOutlined, ExperimentOutlined, RobotOutlined
} from '@ant-design/icons';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { Drawer } from 'antd'; // <--- Import Drawer
import useMobile from './hooks/useMobile'; // <--- Import Hook
import api from './utils/api';

// Import Components
import HeaderNotifications from './components/HeaderNotifications';
import LoadingDisplay from './components/LoadingDisplay';
import AiChatWidget from './components/common/AiChatWidget'; // <--- Import AI Widget
import AnnouncementBanner from './components/common/AnnouncementBanner'; // <--- Import Announcement Banner

const { Header, Content, Footer, Sider } = Layout;
type MenuItem = Required<MenuProps>['items'][number];

// Lazy Load Pages
const ProductsPage = React.lazy(() => import('./pages/ProductsPage'));
const CombosPage = React.lazy(() => import('./pages/CombosPage'));
const UploadPage = React.lazy(() => import('./pages/UploadPage'));
const MaterialsPage = React.lazy(() => import('./pages/MaterialsPage'));
const SuppliersPage = React.lazy(() => import('./pages/SuppliersPage'));
const CrmPage = React.lazy(() => import('./pages/CrmPage'));
const CustomersPage = React.lazy(() => import('./pages/CustomersPage'));
const PlanningPage = React.lazy(() => import('./pages/PlanningPage'));
const ManufacturersPage = React.lazy(() => import('./pages/ManufacturersPage'));
const ProductionRoutePage = React.lazy(() => import('./pages/ProductionRoutePage'));
const CategoriesPage = React.lazy(() => import('./pages/CategoriesPage'));
const DesignManagementPage = React.lazy(() => import('./pages/DesignManagementPage')); // <--- MỚI
const PortalQuotePage = React.lazy(() => import('./pages/PortalQuotePage'));
const PortalPurchasePage = React.lazy(() => import('./pages/PortalPurchasePage'));
const PortalRecruitmentPage = React.lazy(() => import('./pages/PortalRecruitmentPage'));
const PortalLoginPage = React.lazy(() => import('./pages/PortalLoginPage'));
const PortalDashboardPage = React.lazy(() => import('./pages/PortalDashboardPage'));
const PortalSupplierDashboard = React.lazy(() => import('./pages/PortalSupplierDashboard'));
const PromotionPage = React.lazy(() => import('./pages/PromotionPage'));
const PriceListsPage = React.lazy(() => import('./pages/PriceListPage'));
const UsersPage = React.lazy(() => import('./pages/UsersPage'));
const UserGroupsPage = React.lazy(() => import('./pages/UserGroupsPage'));
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const InventoryPage = React.lazy(() => import('./pages/InventoryPage'));
const SampleInventoryPage = React.lazy(() => import('./pages/inventory/SampleInventoryPage'));
const FinancePage = React.lazy(() => import('./pages/FinancePage'));
const TasksPage = React.lazy(() => import('./pages/TasksPage'));
const PurchasingPage = React.lazy(() => import('./pages/PurchasingPage'));
const SalesPage = React.lazy(() => import('./pages/SalesPage'));
const PosPage = React.lazy(() => import('./pages/PosPage')); // <--- MỚI
const BodFollowUpPage = React.lazy(() => import('./pages/sales/BodFollowUpPage'));
const HelpPage = React.lazy(() => import('./pages/HelpPage'));
const DocsPage = React.lazy(() => import('./pages/DocsPage'));
const SystemSettingsPage = React.lazy(() => import('./pages/SystemSettingsPage'));
const ActivityLogPage = React.lazy(() => import('./pages/ActivityLogPage'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage')); // <--- Import Dashboard
const WebsiteProductsPage = React.lazy(() => import('./pages/WebsiteProductsPage')); // <--- Website Products
const HRPage = React.lazy(() => import('./pages/HRPage')); // <--- HR Module
const ProfilePage = React.lazy(() => import('./pages/ProfilePage')); // <--- Profile Page
const SocialChannelsPage = React.lazy(() => import('./pages/SocialChannelsPage')); // <--- Social Channels
const SocialOrdersPage = React.lazy(() => import('./pages/SocialOrdersPage')); // <--- Social Orders
const MarketingPage = React.lazy(() => import('./pages/MarketingPage')); // <--- Marketing
const AnnouncementsPage = React.lazy(() => import('./pages/AnnouncementsPage')); // <--- Announcements
const ProjectsPage = React.lazy(() => import('./pages/ProjectsPage')); // <--- Projects
const ProjectDetailPage = React.lazy(() => import('./pages/ProjectDetailPage')); // <--- Project Detail
const WorkSpacePage = React.lazy(() => import('./pages/WorkSpacePage')); // <--- Consolidated WorkSpace
const SalesStrategyDashboard = React.lazy(() => import('./pages/SalesStrategyDashboard')); // <--- Sales Strategy
const BodDashboard = React.lazy(() => import('./pages/BodDashboard'));
const DiscussionDetailPage = React.lazy(() => import('./pages/DiscussionDetailPage'));
const QCPage = React.lazy(() => import('./pages/QCPage'));
const ProductionDashboardPage = React.lazy(() => import('./pages/ProductionDashboardPage'));
const ProcessesPage = React.lazy(() => import('./pages/ProcessesPage'));
const PrintReportDashboard = React.lazy(() => import('./pages/PrintReportDashboard'));
const AiDashboardPage = React.lazy(() => import('./pages/AiDashboardPage'));


function getItem(label: React.ReactNode, key: React.Key, icon?: React.ReactNode, children?: MenuItem[]): MenuItem {
    return { key, icon, children, label } as MenuItem;
}

const App: React.FC = () => {
    const [collapsed, setCollapsed] = useState(false);
    const { token: { colorBgContainer, borderRadiusLG } } = theme.useToken();

    // Initialize state synchronously to prevent route redirects on first render
    const initialToken = localStorage.getItem('token');
    const initialUserStr = localStorage.getItem('user');
    const initialUser = initialUserStr ? JSON.parse(initialUserStr) : null;

    const [isAuthenticated, setIsAuthenticated] = useState(!!(initialToken && initialUser));
    const [currentUser, setCurrentUser] = useState<any>(initialUser);
    const [permissions, setPermissions] = useState<any[]>(initialUser?.permissions || []);

    // --- CHANGE PASSWORD STATE ---
    const [isChangePassOpen, setIsChangePassOpen] = useState(false);
    const [passForm] = Form.useForm();

    const handleChangePass = async (values: any) => {
        try {
            await api.post(`/users/${currentUser?.id}/change-password`, { password: values.password });
            message.success('Đổi mật khẩu thành công');
            setIsChangePassOpen(false);
            passForm.resetFields();
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Có lỗi xảy ra');
        }
    };

    // Mobile Logic
    const isMobile = useMobile();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Check Token & Load Permissions
    useEffect(() => {
        const token = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');

        if (token && userStr) {
            const user = JSON.parse(userStr);
            setIsAuthenticated(true);
            setCurrentUser(user);
            const perms = user.permissions || [];
            setPermissions(perms);
            // axios.defaults.headers.common['Authorization'] = `Bearer ${token}`; // Handled by api interceptor
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setIsAuthenticated(false);
        window.location.href = '/login';
    };

    const hasPerm = (moduleCode: string) => {
        if (currentUser?.username === 'admin') return true;
        const p = permissions.find((perm: any) => perm.module_code === moduleCode);
        return !!(p && (p.can_view === true || p.can_view === 1));
    };

    const menuItems = useMemo(() => {
        const items: MenuItem[] = [];

        // 1. Tổng quan
        if (hasPerm('DASHBOARD') || true) {
            items.push(getItem(<Link to="/">Tổng quan</Link>, '1', <PieChartOutlined />));
        }

        // 2. Quản lý sản phẩm
        if (hasPerm('PRODUCT')) {
            items.push(getItem('Quản lý sản phẩm', 'sub_prod', <ShopOutlined />, [
                getItem(<Link to="/categories">Danh mục & Định giá</Link>, 'cat_page'),
                getItem(<Link to="/products">Sản phẩm (Lẻ)</Link>, '2'),
                getItem(<Link to="/combos">Combo sản phẩm</Link>, 'combo_page')
            ]));
        }

        // CMS Website
        if (hasPerm('PRODUCT') || hasPerm('SALES')) {
            items.push(getItem('CMS Website', 'sub_cms', <GlobalOutlined />, [
                getItem(<Link to="/website-products">Sản phẩm (Bán online)</Link>, 'web_prod'),
            ]));
        }

        // 3. Nhập liệu
        if (hasPerm('PRODUCT') || hasPerm('INVENTORY') || hasPerm('SALES')) {
            items.push(getItem(<Link to="/upload">Nhập liệu (Excel)</Link>, 'upload', <CloudUploadOutlined />));
        }

        // 4. Kho hàng & NCC
        if (hasPerm('INVENTORY')) {
            items.push(getItem('Kho hàng & NCC', 'sub1', <DropboxOutlined />, [
                getItem(<Link to="/materials">Nguyên liệu</Link>, '3'),
                getItem(<Link to="/suppliers">Nhà cung cấp (NPL)</Link>, 'supp'),
                getItem(<Link to="/manufacturers">Nhà gia công</Link>, 'manu'),
                getItem(<Link to="/inventory">Nhập xuất kho</Link>, '4'),
                getItem(<Link to="/inventory/samples">Kho hàng mẫu</Link>, 'inv_samples'),
            ]));
        }

        // 5. Bán hàng (CRM & Orders) --> CẬP NHẬT CẤU TRÚC MENU
        if (hasPerm('SALES')) {
            items.push(getItem('Bán hàng (CRM)', 'sub2', <TeamOutlined />, [
                getItem(<Link to="/sales">Leads & Báo giá</Link>, 'crm_lead'), // Đổi tên cho rõ
                getItem(<Link to="/orders">Đơn Hàng (SO)</Link>, 'crm_order'), // <--- MỚI: Menu Đơn hàng
                getItem(<Link to="/customers">Danh sách Khách hàng</Link>, 'cust'),
                getItem(<Link to="/sales/pricelist">Bảng giá (Price List)</Link>, 'pl_page'),
                getItem(<Link to="/sales/strategy">📊 Chiến lược Sales</Link>, 'sales_strategy'),
                getItem(<Link to="/sales/bod">🏫 BOD Dashboard</Link>, 'sales_bod'),
                getItem(<Link to="/sales/bod-follow-up">BOD Follow Up</Link>, 'bod_followup'),
                getItem(<Link to="/sales/promotions">🎁 Khuyến mãi</Link>, 'promotions'),
            ]));
        }

        // 6. Sản xuất (MRP)
        if (hasPerm('PRODUCTION')) {
            items.push(getItem('Sản xuất (MRP)', '9', <DesktopOutlined />, [
                getItem(<Link to="/planning">Lập Kế Hoạch SX</Link>, 'plan'),
                getItem(<Link to="/purchasing">Đơn Mua Hàng & GC</Link>, 'po_page'),
                getItem(<Link to="/print-production">Báo cáo Gia công In</Link>, 'print-production', <PrinterOutlined />),
                getItem(<Link to="/designs">Thiết kế In ấn & Thêu</Link>, 'designs_page'),
                getItem(<Link to="/routes">Định nghĩa Quy trình</Link>, 'route'),
                getItem(<Link to="/processes">DM Công Đoạn</Link>, 'proc_list'),
                getItem(<Link to="/qc">🔬 Kiểm Tra Chất Lượng</Link>, 'qc_page'),
                getItem(<Link to="/production-dashboard">📊 Dashboard Sản xuất</Link>, 'prod_dashboard'),
            ]));
        }

        // 7. Tài chính
        // 7. Tài chính
        if (hasPerm('FINANCE')) {
            items.push(getItem(<Link to="/finance">Tài chính (Thu/Chi)</Link>, 'finance', <BankOutlined />));
        }

        // 8. Công việc & Hướng dẫn
        if (isAuthenticated) {
            items.push(getItem(<Link to="/workspace">Công việc chung</Link>, '/workspace', <CalendarOutlined />)); // <--- Unified Menu
            items.push(getItem(<Link to="/projects">Quản lý Dự án</Link>, '/projects', <FolderOutlined />));
            items.push(getItem(<Link to="/help">Hướng dẫn sử dụng</Link>, '/help', <QuestionCircleOutlined />));
            if (currentUser?.username === 'admin') {
                items.push(getItem(<Link to="/docs">Dev Docs (Technical)</Link>, '/docs', <CodeOutlined />));
            }
            items.push(getItem(<Link to="/profile">Hồ sơ cá nhân</Link>, '/profile', <UserOutlined />));
        }

        // HR - Chỉ hiện cho user có quyền HR
        if (hasPerm('HR')) {
            items.push(getItem(<Link to="/hr">Nhân sự (HR)</Link>, '/hr', <IdcardOutlined />));
        }

        // SOCIAL & MARKETING
        if (hasPerm('SALES')) {
            items.push(getItem('Kênh Bán Hàng Social', 'sub_social', <FacebookOutlined />, [
                getItem(<Link to="/social/channels">Quản lý Kênh</Link>, 'social_channels'),
                getItem(<Link to="/social/orders">Đơn hàng từ Sàn</Link>, 'social_orders'),
            ]));
            items.push(getItem(<Link to="/marketing">Marketing</Link>, 'marketing', <RocketOutlined />));
        }

        // 9. Hệ thống
        if (hasPerm('USERS')) {
            items.push(getItem('Hệ thống & Phân quyền', 'sub_sys', <SettingOutlined />, [
                getItem(<Link to="/users">Danh sách User</Link>, 'user_list'),
                getItem(<Link to="/users/groups">Nhóm & Phân quyền</Link>, 'group_perm'),
                getItem(<Link to="/announcements">Thông báo nội bộ</Link>, 'announcements'),
                getItem(<Link to="/system/settings">Cấu hình Email (SMTP)</Link>, 'sys_smtp'),
                getItem(<Link to="/system/logs">Nhật ký hoạt động</Link>, 'sys_logs'), // <--- Activity Log Menu
                getItem(<Link to="/ai-dashboard">AI Dashboard</Link>, 'ai_dash', <RobotOutlined />),
            ]));
        }

        return items;
    }, [permissions, currentUser, isAuthenticated]);

    const userMenu = (
        <Menu items={[
            { key: '1', label: <span>Xin chào, <b>{currentUser?.full_name}</b></span>, icon: <UserOutlined /> },
            { key: 'change_pass', label: 'Đổi mật khẩu', icon: <SettingOutlined />, onClick: () => setIsChangePassOpen(true) },
            { key: '2', label: 'Đăng xuất', icon: <LogoutOutlined />, onClick: handleLogout, danger: true }
        ]} />
    );

    return (
        <Router>
            <Routes>
                <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" />} />
                <Route path="/portal/quote/:uuid" element={<PortalQuotePage />} />
                <Route path="/portal/po/:uuid" element={<PortalPurchasePage />} />
                <Route path="/portal/recruitment/:token" element={<PortalRecruitmentPage />} />
                <Route path="/portal/login" element={<PortalLoginPage />} />
                <Route path="/portal/supplier/:uuid" element={<PortalSupplierDashboard />} />
                <Route path="/portal/:slug" element={<PortalDashboardPage />} />

                <Route path="*" element={
                    isAuthenticated ? (
                        <Layout style={{ minHeight: '100vh' }}>
                            {/* DESKTOP SIDER */}
                            {!isMobile && (
                                <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
                                    <div style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)', textAlign: 'center', color: '#fff', lineHeight: '32px', fontWeight: 'bold' }}>ERP4U</div>
                                    <Menu theme="dark" selectedKeys={[window.location.pathname]} mode="inline" items={menuItems} />
                                </Sider>
                            )}

                            {/* MOBILE DRAWER MENU */}
                            {isMobile && (
                                <Drawer
                                    title={<span style={{ fontWeight: 'bold' }}>ERP4U</span>}
                                    placement="left"
                                    onClose={() => setMobileMenuOpen(false)}
                                    open={mobileMenuOpen}
                                    bodyStyle={{ padding: 0 }}
                                    width={260}
                                >
                                    <Menu
                                        theme="light"
                                        selectedKeys={[window.location.pathname]}
                                        mode="inline"
                                        items={menuItems}
                                        onClick={() => setMobileMenuOpen(false)} // Auto close on click
                                    />
                                </Drawer>
                            )}
                            <Layout>
                                <Header style={{ padding: '0 24px', background: colorBgContainer, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    {/* MOBILE BURGER TRIGGER */}
                                    {isMobile ? (
                                        <Button type="text" icon={<MenuOutlined />} onClick={() => setMobileMenuOpen(true)} style={{ fontSize: '18px', width: 46, height: 46 }} />
                                    ) : (
                                        <div /> // Spacer if needed or just justify-end
                                    )}

                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <HeaderNotifications />
                                        <div style={{ width: 20 }} />
                                        <Dropdown overlay={userMenu}>
                                            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <Avatar style={{ backgroundColor: '#87d068' }} icon={<UserOutlined />} />
                                            </div>
                                        </Dropdown>
                                    </div>
                                </Header>
                                <Content style={{ margin: isMobile ? '16px 8px' : '0 16px' }}> {/* Less margin on mobile */}
                                    <div style={{ padding: isMobile ? 12 : 24, minHeight: 360, background: colorBgContainer, borderRadius: borderRadiusLG, marginTop: 16 }}>
                                        <AnnouncementBanner />
                                        <React.Suspense fallback={<LoadingDisplay />}>
                                            <Routes>
                                                <Route path="/" element={<DashboardPage />} />

                                                {(hasPerm('PRODUCT') || hasPerm('INVENTORY') || hasPerm('SALES')) && <Route path="/upload" element={<UploadPage />} />}

                                                {hasPerm('PRODUCT') && (
                                                    <>
                                                        <Route path="/products" element={<ProductsPage />} />
                                                        <Route path="/combos" element={<CombosPage />} />
                                                        <Route path="/categories" element={<CategoriesPage />} />
                                                        <Route path="/website-products" element={<WebsiteProductsPage />} />
                                                    </>
                                                )}

                                                {hasPerm('INVENTORY') && (
                                                    <>
                                                        <Route path="/materials" element={<MaterialsPage />} />
                                                        <Route path="/suppliers" element={<SuppliersPage />} />
                                                        <Route path="/manufacturers" element={<ManufacturersPage />} />
                                                        <Route path="/inventory" element={<InventoryPage />} />
                                                        <Route path="/inventory/samples" element={<SampleInventoryPage />} />
                                                    </>
                                                )}

                                                {hasPerm('SALES') && (
                                                    <>
                                                        <Route path="/sales" element={<CrmPage />} /> {/* CRM Page */}
                                                        <Route path="/sales/pos" element={<PosPage />} /> {/* <--- MỚI: Route POS */}
                                                        <Route path="/sales/strategy" element={<SalesStrategyDashboard />} />
                                                        <Route path="/sales/bod" element={<BodDashboard />} />
                                                        <Route path="/sales/bod-follow-up" element={<BodFollowUpPage />} />
                                                        <Route path="/orders" element={<SalesPage />} /> {/* <--- MỚI: Route cho trang Đơn hàng */}
                                                        <Route path="/customers" element={<CustomersPage />} />
                                                        <Route path="/sales/pricelist" element={<PriceListsPage />} />
                                                        <Route path="/sales/promotions" element={<PromotionPage />} />
                                                    </>
                                                )}

                                                {hasPerm('PRODUCTION') && (
                                                    <>
                                                        <Route path="/planning" element={<PlanningPage />} />
                                                        <Route path="/routes" element={<ProductionRoutePage />} />
                                                        <Route path="/processes" element={<ProcessesPage />} />
                                                        <Route path="/purchasing" element={<PurchasingPage />} />
                                                        <Route path="/qc" element={<QCPage />} />
                                                        <Route path="/production-dashboard" element={<ProductionDashboardPage />} />
                                                        <Route path="/designs" element={<DesignManagementPage />} />
                                                        <Route path="/print-production" element={<PrintReportDashboard />} />
                                                    </>
                                                )}

                                                {hasPerm('FINANCE') && (
                                                    <Route path="/finance" element={<FinancePage />} />
                                                )}

                                                <Route path="/workspace" element={<WorkSpacePage />} />
                                                <Route path="/workspace/discussions/:id" element={<DiscussionDetailPage />} />
                                                <Route path="/projects" element={<ProjectsPage />} />
                                                <Route path="/projects/:id" element={<ProjectDetailPage />} />
                                                <Route path="/help" element={<HelpPage />} />
                                                <Route path="/docs" element={<DocsPage />} />
                                                <Route path="/profile" element={<ProfilePage />} />

                                                {hasPerm('HR') && (
                                                    <Route path="/hr" element={<HRPage />} />
                                                )}

                                                {/* SOCIAL & MARKETING ROUTES */}
                                                {hasPerm('SALES') && (
                                                    <>
                                                        <Route path="/social/channels" element={<SocialChannelsPage />} />
                                                        <Route path="/social/orders" element={<SocialOrdersPage />} />
                                                        <Route path="/marketing" element={<MarketingPage />} />
                                                    </>
                                                )}

                                                {hasPerm('USERS') && (
                                                    <>
                                                        <Route path="/users" element={<UsersPage />} />
                                                        <Route path="/users/groups" element={<UserGroupsPage />} />
                                                        <Route path="/announcements" element={<AnnouncementsPage />} />
                                                        <Route path="/system/settings" element={<SystemSettingsPage />} />
                                                        <Route path="/system/logs" element={<ActivityLogPage />} /> {/* <--- Activity Log Route */}
                                                    </>
                                                )}

                                                <Route path="/ai-dashboard" element={<AiDashboardPage />} />

                                                <Route path="*" element={<h2>Không tìm thấy trang hoặc bạn không có quyền truy cập.</h2>} />
                                            </Routes>
                                        </React.Suspense>
                                    </div>
                                </Content>
                                <Footer style={{ textAlign: 'center' }}>ERP4U ©2025 Created by AI</Footer>
                                <AiChatWidget /> {/* <--- Insert AI Widget */}
                            </Layout>
                        </Layout>
                    ) : (
                        <Navigate to="/login" />
                    )
                } />
            </Routes>
            <Modal
                title={`Đổi mật khẩu: ${currentUser?.username}`}
                open={isChangePassOpen}
                onCancel={() => setIsChangePassOpen(false)}
                onOk={() => passForm.submit()}
            >
                <Form form={passForm} layout="vertical" onFinish={handleChangePass}>
                    <Form.Item
                        name="password"
                        label="Mật khẩu mới"
                        rules={[{ required: true, message: 'Vui lòng nhập mật khẩu mới' }]}
                    >
                        <Input.Password placeholder="Nhập mật khẩu mới..." />
                    </Form.Item>
                </Form>
            </Modal>
        </Router>
    );
};
export default App;