// ERP4U Frontend Application
import React, { useState, useEffect, useMemo } from 'react';
import { Layout, Menu, theme, Button, Avatar, Dropdown, Modal, Form, Input, message, Alert, ConfigProvider } from 'antd';
import { antdTheme, brandColors } from './theme/brand';
import type { MenuProps } from 'antd';
import {
    DesktopOutlined, PieChartOutlined, TeamOutlined, ShopOutlined, DropboxOutlined, CloudUploadOutlined,
    SettingOutlined, UserOutlined, LogoutOutlined, BankOutlined, CalendarOutlined, ShoppingCartOutlined, QuestionCircleOutlined, CodeOutlined, MenuOutlined, IdcardOutlined,
    LinkOutlined, RocketOutlined, FacebookOutlined, NotificationOutlined, FolderOutlined, MessageOutlined, GlobalOutlined, PrinterOutlined, ExperimentOutlined, RobotOutlined,
    SafetyCertificateOutlined
} from '@ant-design/icons';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { Drawer } from 'antd'; // <--- Import Drawer
import useMobile from './hooks/useMobile'; // <--- Import Hook
import useDemoMode from './hooks/useDemoMode';
import api from './utils/api';
import { PackageKey, getRoutePackage, AddonKey, getRouteAddon } from './config/packages';
import { EntitlementsProvider, useEntitlements, resetEntitlementsCache } from './hooks/useEntitlements';
import { SubscriptionProvider, useSubscription, resetSubscriptionCache } from './hooks/useSubscription';
import PackageLockedPage from './pages/PackageLockedPage';
import AddonUnavailablePage from './pages/AddonUnavailablePage';

// Import Components
import HeaderNotifications from './components/HeaderNotifications';
import SubscriptionTag from './components/SubscriptionTag';
import LoadingDisplay from './components/LoadingDisplay';
import CopilotPanel from './components/copilot/CopilotPanel';
import AnnouncementBanner from './components/common/AnnouncementBanner'; // <--- Import Announcement Banner
import { LanguageSwitcher } from './components/common/LanguageSwitcher';

ConfigProvider.config({
    holderRender: (children) => <ConfigProvider theme={antdTheme}>{children}</ConfigProvider>,
});

const { Header, Content, Footer, Sider } = Layout;
type MenuItem = Required<MenuProps>['items'][number];

// Lazy Load Pages
const ProductsPage = React.lazy(() => import('./pages/ProductsPage'));
const CombosPage = React.lazy(() => import('./pages/CombosPage'));
const PackingSpecsPage = React.lazy(() => import('./pages/PackingSpecsPage'));
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
const DeliveriesManagementPage = React.lazy(() => import('./pages/DeliveriesManagementPage'));
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
const RbacLogPage = React.lazy(() => import('./pages/RbacLogPage'));
const ChatbotInboxPage = React.lazy(() => import('./pages/chatbot/ChatbotInboxPage'));
const ChatbotRequestsPage = React.lazy(() => import('./pages/chatbot/ChatbotRequestsPage'));
const SubscriptionPage = React.lazy(() => import('./pages/SubscriptionPage'));


function getItem(label: React.ReactNode, key: React.Key, icon?: React.ReactNode, children?: MenuItem[]): MenuItem {
    return { key, icon, children, label } as MenuItem;
}

interface AppShellProps {
    isAuthenticated: boolean;
    setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean>>;
    currentUser: any;
    setCurrentUser: React.Dispatch<React.SetStateAction<any>>;
    permissions: any[];
    setPermissions: React.Dispatch<React.SetStateAction<any[]>>;
}

const AppShell: React.FC<AppShellProps> = ({
    isAuthenticated,
    setIsAuthenticated,
    currentUser,
    setCurrentUser,
    permissions,
    setPermissions,
}) => {
    const [collapsed, setCollapsed] = useState(false);
    const { token: { colorBgContainer, borderRadiusLG } } = theme.useToken();
    const { isEnabled, isAddonInstalled } = useEntitlements();
    const { subscription } = useSubscription();
    const isDemo = useDemoMode();

    const isRouteEnabled = (path: string) => isEnabled(getRoutePackage(path));
    const renderRoute = (path: string, element: React.ReactElement) => {
        const routeAddon = getRouteAddon(path);
        if (routeAddon && !isAddonInstalled(routeAddon)) {
            return <AddonUnavailablePage addon={routeAddon} />;
        }
        return isRouteEnabled(path) ? element : <PackageLockedPage packageKey={getRoutePackage(path)} />;
    };

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
            try {
                const user = JSON.parse(userStr);
                setIsAuthenticated(true);
                setCurrentUser(user);
                const perms = user.permissions || [];
                setPermissions(perms);
            } catch {
                // Ignore parse error
            }

            // P0.9: Auth refresh on mount
            api.get('/auth/me')
                .then(res => {
                    if (res.data) {
                        localStorage.setItem('user', JSON.stringify(res.data));
                        setCurrentUser(res.data);
                        setPermissions(res.data.permissions || []);
                        window.dispatchEvent(new Event('erp4u:auth-updated'));
                    }
                })
                .catch(err => {
                    // Network error: giữ token cũ trong RAM/localStorage, KHÔNG redirect login
                    // 401: api interceptor đã xử lý (xóa token, redirect)
                    console.warn('[App] Failed to refresh auth info from /auth/me:', err?.message);
                });
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        resetEntitlementsCache();
        resetSubscriptionCache();
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

        const cloudBadge = (
            <span
                style={{
                    marginLeft: 6,
                    fontSize: 10,
                    padding: '1px 5px',
                    borderRadius: 4,
                    background: brandColors.navy,
                    color: '#fff',
                    fontWeight: 'normal',
                    display: 'inline-block',
                    lineHeight: '14px',
                }}
            >
                Cloud
            </span>
        );
        const isAiInstalled = isAddonInstalled(AddonKey.AI);
        const isOmniInstalled = isAddonInstalled(AddonKey.OMNICHANNEL);
        const isDesignInstalled = isAddonInstalled(AddonKey.DESIGN);
        const isWebsiteInstalled = isAddonInstalled(AddonKey.WEBSITE);

        // 1. Tổng quan
        if (hasPerm('DASHBOARD') || true) {
            items.push(getItem(<Link to="/">Tổng quan</Link>, '1', <PieChartOutlined />));
        }

        // 2. Quản lý sản phẩm
        if (hasPerm('PRODUCT')) {
            items.push(getItem('Quản lý sản phẩm', 'sub_prod', <ShopOutlined />, [
                getItem(<Link to="/categories">Danh mục & Định giá</Link>, 'cat_page'),
                getItem(<Link to="/products">Sản phẩm (Lẻ)</Link>, '2'),
                getItem(<Link to="/combos">Combo sản phẩm</Link>, 'combo_page'),
                getItem(<Link to="/packing-specs">Quy cách đóng gói (Packing List)</Link>, 'packing_specs_page')
            ]));
        }

        // CMS Website
        if (hasPerm('PRODUCT')) {
            items.push(getItem(
                <span>CMS Website {!isWebsiteInstalled && cloudBadge}</span>,
                'sub_cms',
                <GlobalOutlined />,
                [
                    getItem(
                        <Link to="/website-products">Sản phẩm (Bán online) {!isWebsiteInstalled && cloudBadge}</Link>,
                        'web_prod'
                    ),
                ]
            ));
        }

        // 3. Nhập liệu
        if (hasPerm('PRODUCT') || hasPerm('INVENTORY') || hasPerm('SALES')) {
            items.push(getItem(<Link to="/upload">Nhập liệu (Excel)</Link>, 'upload', <CloudUploadOutlined />));
        }

        // 4. Kho hàng & NCC
        if (hasPerm('INVENTORY')) {
            const invChildren: MenuItem[] = [];
            if (isRouteEnabled('/materials')) invChildren.push(getItem(<Link to="/materials">Nguyên liệu</Link>, '3'));
            if (isRouteEnabled('/suppliers')) invChildren.push(getItem(<Link to="/suppliers">Nhà cung cấp (NPL)</Link>, 'supp'));
            if (isRouteEnabled('/manufacturers')) invChildren.push(getItem(<Link to="/manufacturers">Nhà gia công</Link>, 'manu'));
            if (isRouteEnabled('/inventory')) invChildren.push(getItem(<Link to="/inventory">Nhập xuất kho</Link>, '4'));
            if (isRouteEnabled('/inventory/samples')) invChildren.push(getItem(<Link to="/inventory/samples">Kho hàng mẫu</Link>, 'inv_samples'));
            if (isRouteEnabled('/inventory/deliveries')) invChildren.push(getItem(<Link to="/inventory/deliveries">Giao nhận</Link>, 'inv_deliveries'));
            if (invChildren.length > 0) {
                items.push(getItem('Kho hàng & NCC', 'sub1', <DropboxOutlined />, invChildren));
            }
        }

        // 5. Bán hàng (CRM & Orders) --> CẬP NHẬT CẤU TRÚC MENU
        if (hasPerm('SALES')) {
            const salesChildren: MenuItem[] = [];
            if (isRouteEnabled('/sales')) salesChildren.push(getItem(<Link to="/sales">Leads & Báo giá</Link>, 'crm_lead')); // Đổi tên cho rõ
            if (isRouteEnabled('/orders')) salesChildren.push(getItem(<Link to="/orders">Đơn Hàng (SO)</Link>, 'crm_order')); // <--- MỚI: Menu Đơn hàng
            if (isRouteEnabled('/customers')) salesChildren.push(getItem(<Link to="/customers">Danh sách Khách hàng</Link>, 'cust'));
            if (isRouteEnabled('/sales/pricelist')) salesChildren.push(getItem(<Link to="/sales/pricelist">Bảng giá (Price List)</Link>, 'pl_page'));
            if (isRouteEnabled('/sales/strategy')) salesChildren.push(getItem(<Link to="/sales/strategy">📊 Chiến lược Sales</Link>, 'sales_strategy'));
            if (isRouteEnabled('/sales/bod')) salesChildren.push(getItem(<Link to="/sales/bod">🏫 BOD Dashboard</Link>, 'sales_bod'));
            if (isRouteEnabled('/sales/bod-follow-up')) salesChildren.push(getItem(<Link to="/sales/bod-follow-up">BOD Follow Up</Link>, 'bod_followup'));
            if (isRouteEnabled('/sales/promotions')) salesChildren.push(getItem(<Link to="/sales/promotions">🎁 Khuyến mãi</Link>, 'promotions'));
            if (salesChildren.length > 0) {
                items.push(getItem('Bán hàng (CRM)', 'sub2', <TeamOutlined />, salesChildren));
            }
        }

        // 6. Sản xuất (MRP) & Mua hàng
        const prodChildren: MenuItem[] = [];
        if (hasPerm('PRODUCTION') && isRouteEnabled('/planning')) {
            prodChildren.push(getItem(<Link to="/planning">Lập Kế Hoạch SX</Link>, 'plan'));
        }
        if (hasPerm('PURCHASE') && isRouteEnabled('/purchasing')) {
            prodChildren.push(getItem(<Link to="/purchasing">Đơn Mua Hàng & GC</Link>, 'po_page'));
        }
        if (hasPerm('PRODUCT') || hasPerm('PRODUCTION')) {
            prodChildren.push(
                getItem(
                    <Link to="/print-production">Báo cáo Gia công In {!isDesignInstalled && cloudBadge}</Link>,
                    'print-production',
                    <PrinterOutlined />
                )
            );
            prodChildren.push(
                getItem(
                    <Link to="/designs">Thiết kế In ấn & Thêu {!isDesignInstalled && cloudBadge}</Link>,
                    'designs_page'
                )
            );
        }
        if (hasPerm('PRODUCTION')) {
            if (isRouteEnabled('/routes')) prodChildren.push(getItem(<Link to="/routes">Định nghĩa Quy trình</Link>, 'route'));
            if (isRouteEnabled('/processes')) prodChildren.push(getItem(<Link to="/processes">DM Công Đoạn</Link>, 'proc_list'));
            if (isRouteEnabled('/qc')) prodChildren.push(getItem(<Link to="/qc">🔬 Kiểm Tra Chất Lượng</Link>, 'qc_page'));
            if (isRouteEnabled('/production-dashboard')) prodChildren.push(getItem(<Link to="/production-dashboard">📊 Dashboard Sản xuất</Link>, 'prod_dashboard'));
        }
        if (prodChildren.length > 0) {
            items.push(getItem('Sản xuất (MRP)', '9', <DesktopOutlined />, prodChildren));
        }

        // 7. Tài chính
        if (hasPerm('FINANCE') && isRouteEnabled('/finance')) {
            items.push(getItem(<Link to="/finance">Tài chính (Thu/Chi)</Link>, 'finance', <BankOutlined />));
        }

        // 8. Công việc & Hướng dẫn
        if (isAuthenticated) {
            items.push(getItem(<Link to="/workspace">Công việc chung</Link>, '/workspace', <CalendarOutlined />)); // <--- Unified Menu
            if (isRouteEnabled('/projects')) {
                items.push(getItem(<Link to="/projects">Quản lý Dự án</Link>, '/projects', <FolderOutlined />));
            }
            items.push(getItem(<Link to="/help">Hướng dẫn sử dụng</Link>, '/help', <QuestionCircleOutlined />));
            if (currentUser?.username === 'admin') {
                items.push(getItem(<Link to="/docs">Dev Docs (Technical)</Link>, '/docs', <CodeOutlined />));
            }
            items.push(getItem(<Link to="/profile">Hồ sơ cá nhân</Link>, '/profile', <UserOutlined />));
        }

        // HR - Chỉ hiện cho user có quyền HR
        if (hasPerm('HR') && isRouteEnabled('/hr')) {
            items.push(getItem(<Link to="/hr">Nhân sự (HR)</Link>, '/hr', <IdcardOutlined />));
        }

        // Chatbot (Trợ lý AI) - Chỉ hiện cho user có quyền CHATBOT
        if (hasPerm('CHATBOT')) {
            items.push(getItem(
                <span>Trợ lý AI {!isAiInstalled && cloudBadge}</span>,
                'sub_chatbot',
                <MessageOutlined />,
                [
                    getItem(<Link to="/chatbot/inbox">Hộp thư hội thoại {!isAiInstalled && cloudBadge}</Link>, 'cb_inbox'),
                    getItem(<Link to="/chatbot/requests">Yêu cầu tư vấn {!isAiInstalled && cloudBadge}</Link>, 'cb_requests'),
                ]
            ));
        }

        // SOCIAL & MARKETING
        if (hasPerm('MARKETING')) {
            const socialChildren: MenuItem[] = [
                getItem(<Link to="/social/channels">Quản lý Kênh {!isOmniInstalled && cloudBadge}</Link>, 'social_channels'),
                getItem(<Link to="/social/orders">Đơn hàng từ Sàn {!isOmniInstalled && cloudBadge}</Link>, 'social_orders'),
            ];
            items.push(getItem(
                <span>Kênh Bán Hàng Social {!isOmniInstalled && cloudBadge}</span>,
                'sub_social',
                <FacebookOutlined />,
                socialChildren
            ));
            items.push(getItem(
                <Link to="/marketing">Marketing {!isOmniInstalled && cloudBadge}</Link>,
                'marketing',
                <RocketOutlined />
            ));
        }

        // 9. Hệ thống
        if (hasPerm('USERS') || hasPerm('SYSTEM')) {
            const systemChildren: MenuItem[] = [];
            if (hasPerm('USERS')) {
                systemChildren.push(getItem(<Link to="/users">Danh sách User</Link>, 'user_list'));
                systemChildren.push(getItem(<Link to="/users/groups">Nhóm & Phân quyền</Link>, 'group_perm'));
                systemChildren.push(getItem(<Link to="/announcements">Thông báo nội bộ</Link>, 'announcements'));
            }
            if (hasPerm('SYSTEM')) {
                systemChildren.push(getItem(<Link to="/system/settings">Cấu hình Email (SMTP)</Link>, 'sys_smtp'));
            }
            if (hasPerm('USERS')) {
                systemChildren.push(getItem(<Link to="/system/logs">Nhật ký hoạt động</Link>, 'sys_logs'));
                systemChildren.push(
                    getItem(
                        <Link to="/ai-dashboard">AI Dashboard {!isAiInstalled && cloudBadge}</Link>,
                        'ai_dash',
                        <RobotOutlined />
                    )
                );
            }

            if (currentUser?.username === 'admin') {
                systemChildren.push(
                    getItem(<Link to="/system/rbac">🛡️ Nhật ký RBAC</Link>, 'sys_rbac', <SafetyCertificateOutlined />)
                );
            }

            if (subscription) {
                systemChildren.push(
                    getItem(<Link to="/subscription">Gói dịch vụ</Link>, 'sys_subscription')
                );
            }

            items.push(getItem('Hệ thống & Phân quyền', 'sub_sys', <SettingOutlined />, systemChildren));
        }

        return items;
    }, [permissions, currentUser, isAuthenticated, isEnabled, isAddonInstalled, subscription]);

    const userMenu = (
        <Menu items={[
            { key: '1', label: <span>Xin chào, <b>{currentUser?.full_name}</b></span>, icon: <UserOutlined /> },
            { key: 'change_pass', label: 'Đổi mật khẩu', icon: <SettingOutlined />, onClick: () => setIsChangePassOpen(true) },
            { key: '2', label: 'Đăng xuất', icon: <LogoutOutlined />, onClick: handleLogout, danger: true }
        ]} />
    );

    return (
        <Router>
            {isDemo && (
                <Alert
                    message="Bản demo — dữ liệu tự reset mỗi đêm"
                    type="warning"
                    banner
                    closable={false}
                    style={{ textAlign: 'center', fontWeight: 'bold' }}
                />
            )}
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
                        <Layout style={{ minHeight: '100vh', background: brandColors.creamLayout }}>
                            {/* DESKTOP SIDER */}
                            {!isMobile && (
                                <Sider
                                    collapsible
                                    collapsed={collapsed}
                                    onCollapse={(value) => setCollapsed(value)}
                                    style={{ background: brandColors.navy }}
                                >
                                    <div style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.12)', textAlign: 'center', color: '#fff', lineHeight: '32px', fontWeight: 'bold', borderRadius: 8, letterSpacing: 1 }}>ERP4U</div>
                                    <Menu theme="dark" selectedKeys={[window.location.pathname]} mode="inline" items={menuItems} style={{ background: brandColors.navy }} />
                                </Sider>
                            )}

                            {/* MOBILE DRAWER MENU */}
                            {isMobile && (
                                <Drawer
                                    title={<span style={{ fontWeight: 'bold', color: brandColors.navy }}>ERP4U</span>}
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
                            <Layout style={{ background: brandColors.creamLayout }}>
                                <Header style={{ padding: '0 24px', background: colorBgContainer, borderBottom: '1px solid rgba(39, 47, 114, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    {/* MOBILE BURGER TRIGGER */}
                                    {isMobile ? (
                                        <Button type="text" icon={<MenuOutlined />} onClick={() => setMobileMenuOpen(true)} style={{ fontSize: '18px', width: 46, height: 46 }} />
                                    ) : (
                                        <div /> // Spacer if needed or just justify-end
                                    )}

                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <SubscriptionTag />
                                        <div style={{ width: 12 }} />
                                        <LanguageSwitcher />
                                        <div style={{ width: 10 }} />
                                        <HeaderNotifications />
                                        <div style={{ width: 20 }} />
                                        <Dropdown overlay={userMenu}>
                                            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <Avatar style={{ backgroundColor: '#87d068' }} icon={<UserOutlined />} />
                                            </div>
                                        </Dropdown>
                                    </div>
                                </Header>
                                <Content style={{ margin: isMobile ? '16px 8px' : '0 16px', background: brandColors.creamLayout }}> {/* Less margin on mobile */}
                                    <div style={{ padding: isMobile ? 12 : 24, minHeight: 360, background: colorBgContainer, borderRadius: borderRadiusLG, marginTop: 16, border: '1px solid rgba(39, 47, 114, 0.06)' }}>
                                        <AnnouncementBanner />
                                        <React.Suspense fallback={<LoadingDisplay />}>
                                            <Routes>
                                                <Route path="/" element={renderRoute('/', <DashboardPage />)} />

                                                {(hasPerm('PRODUCT') || hasPerm('INVENTORY') || hasPerm('SALES')) && <Route path="/upload" element={renderRoute('/upload', <UploadPage />)} />}

                                                {hasPerm('PRODUCT') && (
                                                    <>
                                                        <Route path="/products" element={renderRoute('/products', <ProductsPage />)} />
                                                        <Route path="/combos" element={renderRoute('/combos', <CombosPage />)} />
                                                        <Route path="/categories" element={renderRoute('/categories', <CategoriesPage />)} />
                                                        <Route path="/packing-specs" element={renderRoute('/packing-specs', <PackingSpecsPage />)} />
                                                        <Route path="/website-products" element={renderRoute('/website-products', <WebsiteProductsPage />)} />
                                                    </>
                                                )}

                                                {hasPerm('INVENTORY') && (
                                                    <>
                                                        <Route path="/materials" element={renderRoute('/materials', <MaterialsPage />)} />
                                                        <Route path="/suppliers" element={renderRoute('/suppliers', <SuppliersPage />)} />
                                                        <Route path="/manufacturers" element={renderRoute('/manufacturers', <ManufacturersPage />)} />
                                                        <Route path="/inventory" element={renderRoute('/inventory', <InventoryPage />)} />
                                                        <Route path="/inventory/samples" element={renderRoute('/inventory/samples', <SampleInventoryPage />)} />
                                                        <Route path="/inventory/deliveries" element={renderRoute('/inventory/deliveries', <DeliveriesManagementPage />)} />
                                                    </>
                                                )}

                                                {hasPerm('SALES') && (
                                                    <>
                                                        <Route path="/sales" element={renderRoute('/sales', <CrmPage />)} /> {/* CRM Page */}
                                                        <Route path="/sales/pos" element={renderRoute('/sales/pos', <PosPage />)} /> {/* <--- MỚI: Route POS */}
                                                        <Route path="/sales/strategy" element={renderRoute('/sales/strategy', <SalesStrategyDashboard />)} />
                                                        <Route path="/sales/bod" element={renderRoute('/sales/bod', <BodDashboard />)} />
                                                        <Route path="/sales/bod-follow-up" element={renderRoute('/sales/bod-follow-up', <BodFollowUpPage />)} />
                                                        <Route path="/orders" element={renderRoute('/orders', <SalesPage />)} /> {/* <--- MỚI: Route cho trang Đơn hàng */}
                                                        <Route path="/customers" element={renderRoute('/customers', <CustomersPage />)} />
                                                        <Route path="/sales/pricelist" element={renderRoute('/sales/pricelist', <PriceListsPage />)} />
                                                        <Route path="/sales/promotions" element={renderRoute('/sales/promotions', <PromotionPage />)} />
                                                    </>
                                                )}

                                                {hasPerm('PURCHASE') && (
                                                    <Route path="/purchasing" element={renderRoute('/purchasing', <PurchasingPage />)} />
                                                )}

                                                {(hasPerm('PRODUCT') || hasPerm('PRODUCTION')) && (
                                                    <>
                                                        <Route path="/designs" element={renderRoute('/designs', <DesignManagementPage />)} />
                                                        <Route path="/print-production" element={renderRoute('/print-production', <PrintReportDashboard />)} />
                                                    </>
                                                )}

                                                {hasPerm('PRODUCTION') && (
                                                    <>
                                                        <Route path="/planning" element={renderRoute('/planning', <PlanningPage />)} />
                                                        <Route path="/routes" element={renderRoute('/routes', <ProductionRoutePage />)} />
                                                        <Route path="/processes" element={renderRoute('/processes', <ProcessesPage />)} />
                                                        <Route path="/qc" element={renderRoute('/qc', <QCPage />)} />
                                                        <Route path="/production-dashboard" element={renderRoute('/production-dashboard', <ProductionDashboardPage />)} />
                                                    </>
                                                )}

                                                {hasPerm('FINANCE') && (
                                                    <Route path="/finance" element={renderRoute('/finance', <FinancePage />)} />
                                                )}

                                                <Route path="/workspace" element={renderRoute('/workspace', <WorkSpacePage />)} />
                                                <Route path="/tasks" element={renderRoute('/tasks', <TasksPage />)} />
                                                <Route path="/workspace/discussions/:id" element={renderRoute('/workspace/discussions/:id', <DiscussionDetailPage />)} />
                                                <Route path="/projects" element={renderRoute('/projects', <ProjectsPage />)} />
                                                <Route path="/projects/:id" element={renderRoute('/projects/:id', <ProjectDetailPage />)} />
                                                <Route path="/help" element={renderRoute('/help', <HelpPage />)} />
                                                {currentUser?.username === 'admin' && (
                                                    <Route path="/docs" element={renderRoute('/docs', <DocsPage />)} />
                                                )}
                                                <Route path="/profile" element={renderRoute('/profile', <ProfilePage />)} />

                                                {hasPerm('HR') && (
                                                    <Route path="/hr" element={renderRoute('/hr', <HRPage />)} />
                                                )}

                                                {/* CHATBOT ROUTES */}
                                                {hasPerm('CHATBOT') && (
                                                    <>
                                                        <Route path="/chatbot/inbox" element={renderRoute('/chatbot/inbox', <ChatbotInboxPage />)} />
                                                        <Route path="/chatbot/inbox/:id" element={renderRoute('/chatbot/inbox/:id', <ChatbotInboxPage />)} />
                                                        <Route path="/chatbot/requests" element={renderRoute('/chatbot/requests', <ChatbotRequestsPage />)} />
                                                        <Route path="/chatbot/requests/:id" element={renderRoute('/chatbot/requests/:id', <ChatbotRequestsPage />)} />
                                                    </>
                                                )}

                                                {/* SOCIAL & MARKETING ROUTES */}
                                                {hasPerm('MARKETING') && (
                                                    <>
                                                        <Route path="/social/channels" element={renderRoute('/social/channels', <SocialChannelsPage />)} />
                                                        <Route path="/social/orders" element={renderRoute('/social/orders', <SocialOrdersPage />)} />
                                                        <Route path="/marketing" element={renderRoute('/marketing', <MarketingPage />)} />
                                                    </>
                                                )}

                                                {hasPerm('USERS') && (
                                                    <>
                                                        <Route path="/users" element={renderRoute('/users', <UsersPage />)} />
                                                        <Route path="/users/groups" element={renderRoute('/users/groups', <UserGroupsPage />)} />
                                                        <Route path="/announcements" element={renderRoute('/announcements', <AnnouncementsPage />)} />
                                                        <Route path="/system/logs" element={renderRoute('/system/logs', <ActivityLogPage />)} /> {/* <--- Activity Log Route */}
                                                        <Route path="/ai-dashboard" element={renderRoute('/ai-dashboard', <AiDashboardPage />)} />
                                                        {currentUser?.username === 'admin' && (
                                                            <Route path="/system/rbac" element={renderRoute('/system/rbac', <RbacLogPage />)} />
                                                        )}
                                                    </>
                                                )}

                                                {hasPerm('SYSTEM') && (
                                                    <Route path="/system/settings" element={renderRoute('/system/settings', <SystemSettingsPage />)} />
                                                )}

                                                {subscription && (
                                                    <Route path="/subscription" element={renderRoute('/subscription', <SubscriptionPage />)} />
                                                )}

                                                <Route path="*" element={<h2>Không tìm thấy trang hoặc bạn không có quyền truy cập.</h2>} />
                                            </Routes>
                                        </React.Suspense>
                                    </div>
                                </Content>
                                <Footer style={{ textAlign: 'center' }}>ERP4U ©2025 Created by AI</Footer>
                                {isEnabled(PackageKey.AI) && <CopilotPanel />}
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

const App: React.FC = () => {
    // Initialize state synchronously to prevent route redirects on first render
    const initialToken = localStorage.getItem('token');
    const initialUserStr = localStorage.getItem('user');
    const initialUser = initialUserStr ? JSON.parse(initialUserStr) : null;

    const [isAuthenticated, setIsAuthenticated] = useState(!!(initialToken && initialUser));
    const [currentUser, setCurrentUser] = useState<any>(initialUser);
    const [permissions, setPermissions] = useState<any[]>(initialUser?.permissions || []);

    const isPublicPortal = typeof window !== 'undefined' && window.location.pathname.startsWith('/portal/');

    return (
        <ConfigProvider theme={antdTheme}>
            <EntitlementsProvider enabled={isAuthenticated && !isPublicPortal}>
                <SubscriptionProvider isAuthenticated={isAuthenticated && !isPublicPortal}>
                    <AppShell
                        isAuthenticated={isAuthenticated}
                        setIsAuthenticated={setIsAuthenticated}
                        currentUser={currentUser}
                        setCurrentUser={setCurrentUser}
                        permissions={permissions}
                        setPermissions={setPermissions}
                    />
                </SubscriptionProvider>
            </EntitlementsProvider>
        </ConfigProvider>
    );
};

export default App;