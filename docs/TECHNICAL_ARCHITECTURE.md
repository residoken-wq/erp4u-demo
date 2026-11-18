# ERP4U - Technical Architecture

## Overview

ERP4U is a comprehensive Enterprise Resource Planning system designed for manufacturing companies, particularly in the garment/packaging industry. It manages sales, production, inventory, HR, and finance operations.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                         │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│   ERP Frontend  │   Website       │   CMS           │   Customer Portal     │
│   (React SPA)   │   (Next.js SSG) │   (Next.js)     │   (Public URL)        │
│   Port: 80      │   Port: 3000    │   Port: 3001    │   /sales/portal/:uuid │
└────────┬────────┴────────┬────────┴────────┬────────┴───────────┬───────────┘
         │                 │                 │                     │
         │                 ▼                 ▼                     │
         │        ┌────────────────────────────────┐               │
         │        │       Nginx Reverse Proxy      │               │
         │        │       (Port 80/443)            │               │
         │        └────────────────┬───────────────┘               │
         │                         │                               │
         ▼                         ▼                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NESTJS BACKEND API                                   │
│                           (Port: 3000)                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │   Auth       │ │   Sales      │ │   HR         │ │   Finance    │        │
│  │   Module     │ │   Module     │ │   Module     │ │   Module     │        │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │  Inventory   │ │  Production  │ │  Purchasing  │ │  Products    │        │
│  │   Module     │ │   Module     │ │   Module     │ │   Module     │        │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │   Tasks      │ │ Notifications│ │   Upload     │ │   Firebase   │        │
│  │   Module     │ │   Module     │ │   Module     │ │   Module     │        │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │  Customers   │ │  Suppliers   │ │  Materials   │ │   Blogs      │        │
│  │   Module     │ │   Module     │ │   Module     │ │   Module     │        │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │  Categories  │ │   BOM        │ │  Planning    │ │   AI         │        │
│  │   Module     │ │   Module     │ │   Module     │ │   Module     │        │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
         │                                                              │
         ▼                                                              ▼
┌──────────────────────┐                              ┌───────────────────────┐
│     PostgreSQL       │                              │  Firebase Realtime DB │
│    (Port: 5432)      │                              │  (Cloud Service)      │
│                      │                              │                       │
│  - Users             │                              │  - Real-time Notifs   │
│  - Sales Orders      │                              │  - Push Events        │
│  - Products          │                              │                       │
│  - Inventory         │                              └───────────────────────┘
│  - HR Records        │
│  - Finance           │
│  - etc.              │
└──────────────────────┘

┌──────────────────────┐
│   File Storage       │
│   (Local: /uploads)  │
│                      │
│  - Product Images    │
│  - Attachments       │
│  - Documents         │
└──────────────────────┘
```

## Technology Stack

### Backend (NestJS)
| Component | Technology | Version |
|-----------|------------|---------|
| Framework | NestJS | ^10.x |
| ORM | TypeORM | ^0.3.x |
| Database | PostgreSQL | 15+ |
| Real-time | Firebase Admin SDK | ^12.0.0 |
| Authentication | JWT + Passport | ^10.x |
| File Processing | Sharp | ^0.33.x |
| Scheduling | @nestjs/schedule | ^4.x |

### Frontend (React)
| Component | Technology | Version |
|-----------|------------|---------|
| Framework | React | ^18.x |
| Build Tool | Vite | ^5.x |
| UI Library | Ant Design | ^5.x |
| Router | React Router | ^6.x |
| HTTP Client | Axios | ^1.x |
| Rich Text | ReactQuill + quill-mention | ^2.x |
| Real-time | Firebase SDK | ^10.7.0 |

### Website & CMS (Next.js)
| Component | Technology | Version |
|-----------|------------|---------|
| Framework | Next.js | 14.x |
| UI Library | Ant Design | ^5.x |
| Layout | @ant-design/pro-components | ^2.x |

### Infrastructure (Docker)
| Component | Technology |
|-----------|------------|
| Containerization | Docker + Docker Compose |
| Reverse Proxy | Nginx |
| Process Manager | PM2 (legacy) |

## Module Details

### 1. Auth Module (`src/auth/`)
- JWT-based authentication
- Role-based access control (RBAC)
- Session management

### 2. Sales Module (`src/sales/`)
Largest module with 14 files:
- **Entities:** SalesOrder, SalesOrderItem, Delivery, SalesComment, SalesChecklist, Sample, PriceList
- **Features:**
  - Quotation → Sales Order conversion
  - Order versioning/revisions
  - Delivery tracking
  - Payment integration (via Finance)
  - Customer portal (public UUID access)
  - Comments with @mentions
  - Production sample management
  - Checklist per order status

### 3. HR Module (`src/hr/`)
- Employee management
- Attendance tracking
- Leave management
- Payslip generation
- Holiday calendar

### 4. Finance Module (`src/finance/`)
- Payment records
- Revenue/expense tracking
- Bank transactions
- Payslip integration

### 5. Inventory Module (`src/inventory/`)
- Stock in/out transactions
- Stock levels per warehouse
- Stock alerts (low stock)
- Inventory valuation

### 6. Production Module (`src/production/`)
- Production orders
- Work orders
- Machine scheduling
- Output tracking

### 7. Purchasing Module (`src/purchasing/`)
- Purchase orders
- Supplier management
- Receiving/GRN

### 8. Products Module (`src/products/`)
- Product catalog
- SKU management
- Pricing
- Product images

### 9. Tasks Module (`src/tasks/`)
- Task management
- Assignment & tracking
- Due date reminders (CRON job)
- Status workflow

### 10. Notifications Module (`src/notifications/`)
- In-app notifications
- Firebase real-time push
- Read/unread tracking
- Deep link support

### 11. Upload Module (`src/upload/`)
- File upload handling
- Image compression (Sharp)
- Streaming download
- CORS support

### 12. Firebase Module (`src/firebase/`)
- Firebase Admin SDK integration
- Real-time database writes
- Graceful degradation if unavailable

## Data Flow Diagrams

### Sales Order Lifecycle

```
┌──────────┐     ┌──────────┐     ┌───────────┐     ┌─────────────┐
│ QUOTATION│────▶│SO_PENDING│────▶│ DEPOSITED │────▶│SAMPLE_APPROV│
└──────────┘     └──────────┘     └───────────┘     └─────────────┘
                                                           │
                                                           ▼
┌──────────┐     ┌──────────┐     ┌───────────┐     ┌─────────────┐
│COMPLETED │◀────│ DELIVERED│◀────│PARTIAL_DEL│◀────│IN_PRODUCTION│
└──────────┘     └──────────┘     └───────────┘     └─────────────┘
                                                           
                 ┌──────────┐                              
                 │CANCELLED │ (Can be set from most states)
                 └──────────┘                              
```

### Notification Flow (Real-time)

```
┌────────────┐    ┌─────────────────┐    ┌────────────────┐
│ Backend    │───▶│ PostgreSQL      │    │ Firebase RTDB  │
│ Action     │    │ (notification   │───▶│ (push event)   │
│            │    │  table)         │    │                │
└────────────┘    └─────────────────┘    └───────┬────────┘
                                                 │
                                                 ▼
                                         ┌──────────────┐
                                         │ Frontend     │
                                         │ onValue()    │
                                         │ listener     │
                                         └──────────────┘
```

## API Structure

All APIs follow RESTful conventions:

```
/api
├── /auth
│   ├── POST /login
│   ├── POST /register
│   └── GET /profile
├── /sales
│   ├── GET / (list orders)
│   ├── POST / (create order)
│   ├── GET /:id (get order)
│   ├── PUT /:id (update order)
│   ├── GET /:id/comments
│   ├── POST /:id/comment
│   ├── GET /:id/deliveries
│   ├── POST /:id/delivery
│   └── ...
├── /tasks
│   ├── GET / (list tasks)
│   ├── POST / (create task)
│   ├── PUT /:id
│   └── DELETE /:id
├── /users
├── /customers
├── /products
├── /inventory
├── /hr
├── /finance
└── /notifications
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        VPS (Ubuntu)                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │                  Docker Network                      │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │    │
│  │  │   nginx     │  │   backend   │  │   postgres  │  │    │
│  │  │   :80/:443  │  │   :3000     │  │   :5432     │  │    │
│  │  └──────┬──────┘  └──────▲──────┘  └──────▲──────┘  │    │
│  │         │                │                │         │    │
│  │         └────────────────┴────────────────┘         │    │
│  │                                                     │    │
│  │  ┌─────────────┐  ┌─────────────┐                  │    │
│  │  │  frontend   │  │   website   │                  │    │
│  │  │  (static)   │  │   :3000     │                  │    │
│  │  └─────────────┘  └─────────────┘                  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Volumes:                                                    │
│  - postgres_data:/var/lib/postgresql/data                   │
│  - uploads:/app/uploads                                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Security Considerations

1. **Authentication:** JWT tokens with 24h expiry
2. **Password:** Bcrypt hashing
3. **CORS:** Configured per environment
4. **File Upload:** Allowed extensions whitelist
5. **SQL Injection:** TypeORM parameterized queries
6. **Secrets:** `.gitignore` for credentials, env files

## Performance Optimizations

1. **Database:** Indexes on frequently queried columns
2. **Images:** Sharp compression on upload
3. **Docker:** Multi-stage builds, .dockerignore
4. **Real-time:** Firebase instead of polling
5. **Frontend:** Code splitting, lazy loading

## Monitoring & Logging

- NestJS Logger for backend
- Console logs for development
- Docker logs for production
- Firebase Console for real-time events

---

*Last Updated: 2026-01-14*
