import React from 'react';
import {
  CrownOutlined,
  ShopOutlined,
  InboxOutlined,
  AccountBookOutlined,
  TeamOutlined,
} from '@ant-design/icons';

export interface DemoAccount {
  username: string;
  password: string;
  fullName: string;
  roleTitle: string;
  groupName: string;
  color: string;
  icon: React.ReactNode;
  description: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    username: 'admin',
    password: 'admin123',
    fullName: 'Quản Trị Viên (Admin)',
    roleTitle: 'Ban Giám Đốc / Quản Trị Hệ Thống',
    groupName: 'Admin',
    color: '#722ed1',
    icon: React.createElement(CrownOutlined, { style: { fontSize: 20, color: '#722ed1' } }),
    description: 'Toàn quyền cấu hình hệ thống, quản lý người dùng & phân quyền, duyệt báo cáo tổng quan.'
  },
  {
    username: 'sales01',
    password: 'demo123',
    fullName: 'Nhân viên Demo 01',
    roleTitle: 'Trưởng Nhóm Kinh Doanh (Sales Lead)',
    groupName: 'Kinh Doanh',
    color: '#272F72',
    icon: React.createElement(ShopOutlined, { style: { fontSize: 20, color: '#272F72' } }),
    description: 'Bán hàng POS, quản lý khách hàng (CRM), tạo báo giá, theo dõi tiến độ đơn hàng (SO).'
  },
  {
    username: 'warehouse01',
    password: 'demo123',
    fullName: 'Nhân viên Demo 02',
    roleTitle: 'Thủ Kho (Warehouse Manager)',
    groupName: 'Quản Lý Kho',
    color: '#fa8c16',
    icon: React.createElement(InboxOutlined, { style: { fontSize: 20, color: '#fa8c16' } }),
    description: 'Quản lý nguyên phụ liệu & thành phẩm, xuất/nhập kho, kiểm kê tồn kho, cảnh báo hết hàng.'
  },
  {
    username: 'accountant01',
    password: 'demo123',
    fullName: 'Nhân viên Demo 03',
    roleTitle: 'Kế Toán Trưởng (Chief Accountant)',
    groupName: 'Kế Toán',
    color: '#52c41a',
    icon: React.createElement(AccountBookOutlined, { style: { fontSize: 20, color: '#52c41a' } }),
    description: 'Quản lý sổ quỹ thu chi, dòng tiền, theo dõi công nợ khách hàng và nhà cung cấp.'
  },
  {
    username: 'hr01',
    password: 'demo123',
    fullName: 'Nhân viên Demo 04',
    roleTitle: 'Trưởng Phòng Nhân Sự (HR Lead)',
    groupName: 'Nhân Sự',
    color: '#eb2f96',
    icon: React.createElement(TeamOutlined, { style: { fontSize: 20, color: '#eb2f96' } }),
    description: 'Hồ sơ nhân viên, cơ cấu phòng ban, chấm công, tính lương và hợp đồng lao động.'
  }
];

export default DEMO_ACCOUNTS;
