# 🏭 ERP4U — Modern Open-Source Manufacturing ERP

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![NestJS](https://img.shields.io/badge/Backend-NestJS_10-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![React](https://img.shields.io/badge/Frontend-React_18-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL_15-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Deploy-Docker_Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Security: AES-256-GCM](https://img.shields.io/badge/Security-AES--256--GCM_PII_Encryption-green.svg)](SECURITY.md)

> **ERP4U** is a comprehensive, enterprise-ready open-source ERP system crafted for manufacturing and distribution businesses (particularly in packaging, printing, apparel, and custom goods). Built with **NestJS**, **React**, **TypeORM**, and **PostgreSQL**.

---

## 🌟 Key Features

| Module | Highlights |
|---|---|
| 📋 **Sales & CRM** | Complete sales cycle: Lead → Quotation → Sales Order → Multi-stage Deliveries → Customer Portal |
| 🏭 **Production Planning & MRP** | Multi-level Bill of Materials (BOM), Work Orders, Routing steps, Machine capacity, Quality Control (QC) |
| 📦 **Inventory & Warehouse** | Multi-warehouse tracking, Stock alerts, Goods Receipts (GRN), Goods Issues, Valuation |
| 🛍️ **Purchasing & Suppliers** | Supplier price lists, Material POs, Supplier debt management, Receiving inspections |
| 👥 **Human Resources (HR)** | Employee directory, Work shifts, Time & Attendance, Leave requests, Automated payroll |
| 💰 **Finance & Accounting** | Payment vouchers, Revenue/Expense tracking, Invoicing, Cash flow analytics |
| 🔔 **Real-Time Notifications** | Server-Sent Events (SSE) stream for instant event dispatch without external dependencies |
| 🔒 **PII Database Encryption** | Column-level **AES-256-GCM** encryption for sensitive customer, contact, and employee records |
| 🛡️ **Role-Based Access Control** | Granular CRUD permission matrix across all 10 core business modules |

---

## 🚀 Quick Start (One Command Demo)

### 1. Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)

### 2. Clone & Launch
```bash
# Clone the repository
git clone https://github.com/residoken-wq/erp4u-demo.git
cd erp4u-demo

# Launch DB, Backend, and Frontend containers
docker compose -f docker-compose.demo.yml up --build -d
```

### 3. Seed Demo Data
```bash
# Run the automated seeder inside backend container
docker exec erp4u_backend npm run seed
```

### 4. Access the Application
- 🖥️ **Frontend Web App**: [http://localhost:8080](http://localhost:8080)
- 🔌 **Backend REST API**: [http://localhost:3000/api](http://localhost:3000/api)
- 🗄️ **PostgreSQL Database**: `localhost:5432` (User: `erp4u_user`, DB: `erp4u_db`)

---

## 🔑 Demo Accounts

Use any of the pre-configured accounts to test role-based permissions:

| Username | Password | Role | Responsibilities |
|---|---|---|---|
| **`admin`** | `admin123` | **Super Admin** | Full access to all modules, settings & permissions |
| **`sales01`** | `demo123` | **Kinh Doanh (Sales Lead)** | Leads, Quotations, Sales Orders, CRM |
| **`warehouse01`** | `demo123` | **Quản Lý Kho (Warehouse)** | Materials, Inventory Stock, Goods Receipts & Issues |
| **`accountant01`** | `demo123` | **Kế Toán (Finance)** | Cashflow, Payment tracking, Customer & Supplier Debts |
| **`hr01`** | `demo123` | **Nhân Sự (HR)** | Employees, Attendance, Work Shifts, Leave Requests |

---

## 🛠️ Local Development Setup

If you want to run the project locally without Docker:

### 1. Backend Setup
```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Start development server
npm run start:dev

# Seed database
npm run seed
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
# Frontend runs at http://localhost:5173
```

---

## 🔒 Security & PII Encryption

ERP4U implements application-layer authenticated encryption (**AES-256-GCM**) via TypeORM `ValueTransformer`. Sensitive fields are encrypted transparently before hitting PostgreSQL:

- **Customer Data**: Phone, email, tax code, legal representative, einvoice email.
- **Supplier Data**: Contact numbers, emails, tax registration codes.
- **Employee Data**: Personal phone numbers, home addresses.
- **User Data**: Emails, stored IP logs.

Check [SECURITY.md](SECURITY.md) for details on encryption key rotation and vulnerability reporting.

---

## 📁 Repository Architecture

```text
erp4u-demo/
├── src/
│   ├── common/
│   │   └── encryption/       # 🔒 AES-256-GCM column encryption transformer
│   ├── customers/            # Customer & CRM module
│   ├── database/
│   │   └── seeds/            # 🌱 Deterministic database seeder suite
│   ├── finance/              # Cashflow & transaction tracking
│   ├── hr/                   # Human resources & payroll
│   ├── inventory/            # Warehouse & multi-location stock
│   ├── materials/            # Raw materials catalog
│   ├── notifications/        # 🔔 SSE notification stream
│   ├── production/           # Work orders & manufacturing
│   ├── products/             # Product catalog & BOM
│   ├── purchasing/           # Purchase orders & supplier relations
│   ├── sales/                # Quotations & sales orders
│   ├── suppliers/            # Supplier directory
│   └── users/                # RBAC & authentication
├── frontend/
│   ├── src/                  # React 18 + Vite + Ant Design SPA
│   ├── nginx.conf            # Production Nginx reverse proxy
│   └── Dockerfile
├── docs/                     # Technical architecture documentation
├── docker-compose.demo.yml   # One-command demo stack
├── .env.example              # Environment variables template
└── LICENSE                   # AGPL-3.0 License
```

---

## 🤝 Contributing

We welcome contributions from the community! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before submitting pull requests.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. See [`LICENSE`](LICENSE) for more information.
