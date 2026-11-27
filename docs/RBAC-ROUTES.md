# Bảng Kiểm Kê Phân Quyền Route (RBAC Route Inventory)

> Tự động tạo bởi `npm run rbac:inventory` vào lúc 2026-11-27T07:39:24.522Z

## Tổng quan theo tầng

- **Tổng số route**: 551
- **PERM** (Phân quyền chi tiết): 449
- **AUTH** (Chỉ cần đăng nhập): 61
- **PUBLIC** (Công khai): 36
- **APIKEY** (Xác thực qua API Key): 5
- **LEGACY** (Decorator cũ @RequirePermission): 0
- **UNCLASSIFIED** (Chưa phân loại): 0

## Danh sách chi tiết các Route

| Phương thức | Đường dẫn (Path) | Tầng | Module/Action | Gói | File:Dòng |
|---|---|---|---|---|---|
| `GET` | `/announcements` | `PERM` | USERS:view | `CORE` | [src/announcements/announcements.controller.ts:16](../src/announcements/announcements.controller.ts:16) |
| `POST` | `/announcements` | `PERM` | USERS:create | `CORE` | [src/announcements/announcements.controller.ts:35](../src/announcements/announcements.controller.ts:35) |
| `DELETE` | `/announcements/:id` | `PERM` | USERS:delete | `CORE` | [src/announcements/announcements.controller.ts:50](../src/announcements/announcements.controller.ts:50) |
| `GET` | `/announcements/:id` | `PERM` | USERS:view | `CORE` | [src/announcements/announcements.controller.ts:29](../src/announcements/announcements.controller.ts:29) |
| `PUT` | `/announcements/:id` | `PERM` | USERS:update | `CORE` | [src/announcements/announcements.controller.ts:44](../src/announcements/announcements.controller.ts:44) |
| `POST` | `/announcements/:id/read` | `AUTH` | AUTH | `CORE` | [src/announcements/announcements.controller.ts:94](../src/announcements/announcements.controller.ts:94) |
| `GET` | `/announcements/user/active` | `AUTH` | AUTH | `CORE` | [src/announcements/announcements.controller.ts:61](../src/announcements/announcements.controller.ts:61) |
| `POST` | `/announcements/user/read-all` | `AUTH` | AUTH | `CORE` | [src/announcements/announcements.controller.ts:105](../src/announcements/announcements.controller.ts:105) |
| `GET` | `/announcements/user/unread` | `AUTH` | AUTH | `CORE` | [src/announcements/announcements.controller.ts:72](../src/announcements/announcements.controller.ts:72) |
| `GET` | `/announcements/user/unread-count` | `AUTH` | AUTH | `CORE` | [src/announcements/announcements.controller.ts:83](../src/announcements/announcements.controller.ts:83) |
| `GET` | `/api/v1/agent/customers` | `APIKEY` | - | `CORE` | [src/system/agent-api.controller.ts:45](../src/system/agent-api.controller.ts:45) |
| `GET` | `/api/v1/agent/inventory` | `APIKEY` | - | `CORE` | [src/system/agent-api.controller.ts:26](../src/system/agent-api.controller.ts:26) |
| `GET` | `/api/v1/agent/mrp/needs` | `APIKEY` | - | `CORE` | [src/system/agent-api.controller.ts:34](../src/system/agent-api.controller.ts:34) |
| `GET` | `/api/v1/agent/orders` | `APIKEY` | - | `CORE` | [src/system/agent-api.controller.ts:12](../src/system/agent-api.controller.ts:12) |
| `GET` | `/api/v1/agent/orders/:id` | `APIKEY` | - | `CORE` | [src/system/agent-api.controller.ts:21](../src/system/agent-api.controller.ts:21) |
| `POST` | `/auth/login` | `PUBLIC` | - | `CORE` | [src/auth/auth.controller.ts:29](../src/auth/auth.controller.ts:29) |
| `GET` | `/auth/me` | `AUTH` | AUTH | `CORE` | [src/auth/auth.controller.ts:79](../src/auth/auth.controller.ts:79) |
| `GET` | `/auth/permission-catalog` | `AUTH` | AUTH | `CORE` | [src/auth/auth.controller.ts:72](../src/auth/auth.controller.ts:72) |
| `GET` | `/auth/rbac/mode` | `PERM` | SYSTEM:view | `CORE` | [src/auth/rbac.controller.ts:28](../src/auth/rbac.controller.ts:28) |
| `PUT` | `/auth/rbac/mode` | `PERM` | SYSTEM:update | `CORE` | [src/auth/rbac.controller.ts:35](../src/auth/rbac.controller.ts:35) |
| `GET` | `/auth/rbac/readiness` | `PERM` | SYSTEM:view | `CORE` | [src/auth/rbac.controller.ts:43](../src/auth/rbac.controller.ts:43) |
| `GET` | `/auth/rbac/report` | `PERM` | SYSTEM:view | `CORE` | [src/auth/rbac.controller.ts:51](../src/auth/rbac.controller.ts:51) |
| `GET` | `/auth/rbac/unclassified` | `PERM` | SYSTEM:view | `CORE` | [src/auth/rbac.controller.ts:63](../src/auth/rbac.controller.ts:63) |
| `GET` | `/categories` | `PERM` | PRODUCT:view | `CORE` | [src/categories/categories.controller.ts:13](../src/categories/categories.controller.ts:13) |
| `POST` | `/categories` | `PERM` | PRODUCT:create | `CORE` | [src/categories/categories.controller.ts:17](../src/categories/categories.controller.ts:17) |
| `DELETE` | `/categories/:id` | `PERM` | PRODUCT:delete | `CORE` | [src/categories/categories.controller.ts:23](../src/categories/categories.controller.ts:23) |
| `GET` | `/categories/:id` | `PERM` | PRODUCT:view | `CORE` | [src/categories/categories.controller.ts:15](../src/categories/categories.controller.ts:15) |
| `PUT` | `/categories/:id` | `PERM` | PRODUCT:update | `CORE` | [src/categories/categories.controller.ts:21](../src/categories/categories.controller.ts:21) |
| `POST` | `/categories/:id/sync-size` | `PERM` | PRODUCT:update | `CORE` | [src/categories/categories.controller.ts:19](../src/categories/categories.controller.ts:19) |
| `GET` | `/customers` | `PERM` | SALES:view | `CORE` | [src/customers/customers.controller.ts:16](../src/customers/customers.controller.ts:16) |
| `POST` | `/customers` | `PERM` | SALES:create | `CORE` | [src/customers/customers.controller.ts:15](../src/customers/customers.controller.ts:15) |
| `DELETE` | `/customers/:id` | `PERM` | SALES:delete | `CORE` | [src/customers/customers.controller.ts:29](../src/customers/customers.controller.ts:29) |
| `GET` | `/customers/:id` | `PERM` | SALES:view | `CORE` | [src/customers/customers.controller.ts:27](../src/customers/customers.controller.ts:27) |
| `PUT` | `/customers/:id` | `PERM` | SALES:update | `CORE` | [src/customers/customers.controller.ts:28](../src/customers/customers.controller.ts:28) |
| `PUT` | `/customers/:id/bod-follow-up` | `PERM` | SALES:update | `CORE` | [src/customers/customers.controller.ts:51](../src/customers/customers.controller.ts:51) |
| `POST` | `/customers/:id/comment` | `PERM` | SALES:create | `CORE` | [src/customers/customers.controller.ts:64](../src/customers/customers.controller.ts:64) |
| `GET` | `/customers/:id/comments` | `PERM` | SALES:view | `CORE` | [src/customers/customers.controller.ts:58](../src/customers/customers.controller.ts:58) |
| `GET` | `/customers/:id/credits` | `PERM` | SALES:view | `CORE` | [src/customers/customers.controller.ts:71](../src/customers/customers.controller.ts:71) |
| `POST` | `/customers/:id/credits` | `PERM` | SALES:create | `CORE` | [src/customers/customers.controller.ts:77](../src/customers/customers.controller.ts:77) |
| `POST` | `/customers/:id/follow` | `PERM` | SALES:create | `CORE` | [src/customers/customers.controller.ts:39](../src/customers/customers.controller.ts:39) |
| `POST` | `/customers/:id/impersonate` | `PERM` | SALES:view | `CORE` | [src/customers/customers.controller.ts:31](../src/customers/customers.controller.ts:31) |
| `GET` | `/customers/:id/orders` | `PERM` | SALES:view | `CORE` | [src/customers/customers.controller.ts:45](../src/customers/customers.controller.ts:45) |
| `GET` | `/customers/:id/portrait-360` | `PERM` | SALES:view | `CORE` | [src/customers/customers.controller.ts:84](../src/customers/customers.controller.ts:84) |
| `PUT` | `/customers/:id/portrait-notes` | `PERM` | SALES:update | `CORE` | [src/customers/customers.controller.ts:90](../src/customers/customers.controller.ts:90) |
| `GET` | `/discussions` | `AUTH` | AUTH | `PROJECTS` | [src/discussions/discussions.controller.ts:33](../src/discussions/discussions.controller.ts:33) |
| `POST` | `/discussions` | `AUTH` | AUTH | `PROJECTS` | [src/discussions/discussions.controller.ts:56](../src/discussions/discussions.controller.ts:56) |
| `DELETE` | `/discussions/:id` | `AUTH` | AUTH | `PROJECTS` | [src/discussions/discussions.controller.ts:68](../src/discussions/discussions.controller.ts:68) |
| `GET` | `/discussions/:id` | `AUTH` | AUTH | `PROJECTS` | [src/discussions/discussions.controller.ts:50](../src/discussions/discussions.controller.ts:50) |
| `PUT` | `/discussions/:id` | `AUTH` | AUTH | `PROJECTS` | [src/discussions/discussions.controller.ts:62](../src/discussions/discussions.controller.ts:62) |
| `POST` | `/discussions/:id/comments` | `AUTH` | AUTH | `PROJECTS` | [src/discussions/discussions.controller.ts:81](../src/discussions/discussions.controller.ts:81) |
| `PUT` | `/discussions/:id/pin` | `AUTH` | AUTH | `PROJECTS` | [src/discussions/discussions.controller.ts:74](../src/discussions/discussions.controller.ts:74) |
| `DELETE` | `/discussions/comments/:commentId` | `AUTH` | AUTH | `PROJECTS` | [src/discussions/discussions.controller.ts:93](../src/discussions/discussions.controller.ts:93) |
| `PUT` | `/discussions/comments/:commentId` | `AUTH` | AUTH | `PROJECTS` | [src/discussions/discussions.controller.ts:87](../src/discussions/discussions.controller.ts:87) |
| `GET` | `/finance/cash-flow/alerts` | `PERM` | FINANCE:view | `FINANCE` | [src/finance/cash-flow.controller.ts:61](../src/finance/cash-flow.controller.ts:61) |
| `GET` | `/finance/cash-flow/chart` | `PERM` | FINANCE:view | `FINANCE` | [src/finance/cash-flow.controller.ts:30](../src/finance/cash-flow.controller.ts:30) |
| `GET` | `/finance/cash-flow/payables` | `PERM` | FINANCE:view | `FINANCE` | [src/finance/cash-flow.controller.ts:51](../src/finance/cash-flow.controller.ts:51) |
| `GET` | `/finance/cash-flow/receivables` | `PERM` | FINANCE:view | `FINANCE` | [src/finance/cash-flow.controller.ts:41](../src/finance/cash-flow.controller.ts:41) |
| `GET` | `/finance/cash-flow/summary` | `PERM` | FINANCE:view | `FINANCE` | [src/finance/cash-flow.controller.ts:20](../src/finance/cash-flow.controller.ts:20) |
| `GET` | `/finance/categories` | `PERM` | FINANCE:view | `FINANCE` | [src/finance/finance.controller.ts:18](../src/finance/finance.controller.ts:18) |
| `POST` | `/finance/categories` | `PERM` | FINANCE:create | `FINANCE` | [src/finance/finance.controller.ts:19](../src/finance/finance.controller.ts:19) |
| `DELETE` | `/finance/categories/:id` | `PERM` | FINANCE:delete | `FINANCE` | [src/finance/finance.controller.ts:21](../src/finance/finance.controller.ts:21) |
| `PUT` | `/finance/categories/:id` | `PERM` | FINANCE:update | `FINANCE` | [src/finance/finance.controller.ts:20](../src/finance/finance.controller.ts:20) |
| `POST` | `/finance/delivery-expense/:deliveryId` | `PERM` | FINANCE:create | `FINANCE` | [src/finance/finance.controller.ts:47](../src/finance/finance.controller.ts:47) |
| `POST` | `/finance/delivery-expense/batch` | `PERM` | FINANCE:create | `FINANCE` | [src/finance/finance.controller.ts:57](../src/finance/finance.controller.ts:57) |
| `GET` | `/finance/history/:refCode` | `PERM` | FINANCE:view | `FINANCE` | [src/finance/finance.controller.ts:82](../src/finance/finance.controller.ts:82) |
| `POST` | `/finance/payment` | `PERM` | FINANCE:create | `FINANCE` | [src/finance/finance.controller.ts:89](../src/finance/finance.controller.ts:89) |
| `POST` | `/finance/payment/bulk-po` | `PERM` | FINANCE:create | `FINANCE` | [src/finance/finance.controller.ts:99](../src/finance/finance.controller.ts:99) |
| `POST` | `/finance/payment/fix-mapping` | `PERM` | FINANCE:create | `FINANCE` | [src/finance/finance.controller.ts:106](../src/finance/finance.controller.ts:106) |
| `POST` | `/finance/payment/po` | `PERM` | FINANCE:create | `FINANCE` | [src/finance/finance.controller.ts:92](../src/finance/finance.controller.ts:92) |
| `GET` | `/finance/report` | `PERM` | FINANCE:view | `FINANCE` | [src/finance/finance.controller.ts:67](../src/finance/finance.controller.ts:67) |
| `GET` | `/finance/so-profit` | `PERM` | FINANCE:view | `FINANCE` | [src/finance/finance.controller.ts:73](../src/finance/finance.controller.ts:73) |
| `GET` | `/finance/summary` | `PERM` | FINANCE:view | `FINANCE` | [src/finance/finance.controller.ts:17](../src/finance/finance.controller.ts:17) |
| `GET` | `/finance/transactions` | `PERM` | FINANCE:view | `FINANCE` | [src/finance/finance.controller.ts:23](../src/finance/finance.controller.ts:23) |
| `POST` | `/finance/transactions` | `PERM` | FINANCE:create | `FINANCE` | [src/finance/finance.controller.ts:33](../src/finance/finance.controller.ts:33) |
| `DELETE` | `/finance/transactions/:id` | `PERM` | FINANCE:delete | `FINANCE` | [src/finance/finance.controller.ts:35](../src/finance/finance.controller.ts:35) |
| `PUT` | `/finance/transactions/:id` | `PERM` | FINANCE:update | `FINANCE` | [src/finance/finance.controller.ts:34](../src/finance/finance.controller.ts:34) |
| `PUT` | `/finance/transactions/:id/approve` | `PERM` | FINANCE:update | `FINANCE` | [src/finance/finance.controller.ts:37](../src/finance/finance.controller.ts:37) |
| `GET` | `/health` | `PUBLIC` | - | `CORE` | [src/app.controller.ts:22](../src/app.controller.ts:22) |
| `POST` | `/hr/assessments/:id/approve-interview` | `PERM` | HR:update | `HR` | [src/hr/hr.controller.ts:403](../src/hr/hr.controller.ts:403) |
| `POST` | `/hr/assessments/:id/reject` | `PERM` | HR:update | `HR` | [src/hr/hr.controller.ts:414](../src/hr/hr.controller.ts:414) |
| `GET` | `/hr/assets` | `PERM` | HR:view | `HR` | [src/hr/hr.controller.ts:213](../src/hr/hr.controller.ts:213) |
| `POST` | `/hr/assets` | `PERM` | HR:create | `HR` | [src/hr/hr.controller.ts:220](../src/hr/hr.controller.ts:220) |
| `DELETE` | `/hr/assets/:id` | `PERM` | HR:delete | `HR` | [src/hr/hr.controller.ts:234](../src/hr/hr.controller.ts:234) |
| `PUT` | `/hr/assets/:id` | `PERM` | HR:update | `HR` | [src/hr/hr.controller.ts:227](../src/hr/hr.controller.ts:227) |
| `GET` | `/hr/attendances` | `PERM` | HR:view | `HR` | [src/hr/hr.controller.ts:90](../src/hr/hr.controller.ts:90) |
| `POST` | `/hr/attendances` | `PERM` | HR:create | `HR` | [src/hr/hr.controller.ts:119](../src/hr/hr.controller.ts:119) |
| `DELETE` | `/hr/attendances/:id` | `PERM` | HR:delete | `HR` | [src/hr/hr.controller.ts:133](../src/hr/hr.controller.ts:133) |
| `PUT` | `/hr/attendances/:id` | `PERM` | HR:update | `HR` | [src/hr/hr.controller.ts:126](../src/hr/hr.controller.ts:126) |
| `GET` | `/hr/balance/:employeeId` | `PERM` | HR:view | `HR` | [src/hr/hr.controller.ts:201](../src/hr/hr.controller.ts:201) |
| `POST` | `/hr/check-in` | `PERM` | HR:create | `HR` | [src/hr/hr.controller.ts:105](../src/hr/hr.controller.ts:105) |
| `POST` | `/hr/check-out` | `PERM` | HR:create | `HR` | [src/hr/hr.controller.ts:112](../src/hr/hr.controller.ts:112) |
| `GET` | `/hr/employee-reviews` | `PERM` | HR:view | `HR` | [src/hr/hr.controller.ts:513](../src/hr/hr.controller.ts:513) |
| `POST` | `/hr/employee-reviews/:id/submit` | `PERM` | HR:create | `HR` | [src/hr/hr.controller.ts:526](../src/hr/hr.controller.ts:526) |
| `GET` | `/hr/employees` | `PERM` | HR:view | `HR` | [src/hr/hr.controller.ts:47](../src/hr/hr.controller.ts:47) |
| `POST` | `/hr/employees` | `PERM` | HR:create | `HR` | [src/hr/hr.controller.ts:68](../src/hr/hr.controller.ts:68) |
| `DELETE` | `/hr/employees/:id` | `PERM` | HR:delete | `HR` | [src/hr/hr.controller.ts:82](../src/hr/hr.controller.ts:82) |
| `GET` | `/hr/employees/:id` | `PERM` | HR:view | `HR` | [src/hr/hr.controller.ts:61](../src/hr/hr.controller.ts:61) |
| `PUT` | `/hr/employees/:id` | `PERM` | HR:update | `HR` | [src/hr/hr.controller.ts:75](../src/hr/hr.controller.ts:75) |
| `GET` | `/hr/employees/by-user/:userId` | `PERM` | HR:view | `HR` | [src/hr/hr.controller.ts:54](../src/hr/hr.controller.ts:54) |
| `GET` | `/hr/entitlements` | `PERM` | HR:view | `HR` | [src/hr/hr.controller.ts:174](../src/hr/hr.controller.ts:174) |
| `POST` | `/hr/entitlements` | `PERM` | HR:create | `HR` | [src/hr/hr.controller.ts:187](../src/hr/hr.controller.ts:187) |
| `PUT` | `/hr/entitlements/:id` | `PERM` | HR:update | `HR` | [src/hr/hr.controller.ts:194](../src/hr/hr.controller.ts:194) |
| `GET` | `/hr/leaves` | `PERM` | HR:view | `HR` | [src/hr/hr.controller.ts:141](../src/hr/hr.controller.ts:141) |
| `POST` | `/hr/leaves` | `PERM` | HR:create | `HR` | [src/hr/hr.controller.ts:148](../src/hr/hr.controller.ts:148) |
| `DELETE` | `/hr/leaves/:id` | `PERM` | HR:delete | `HR` | [src/hr/hr.controller.ts:166](../src/hr/hr.controller.ts:166) |
| `PUT` | `/hr/leaves/:id/approve` | `PERM` | HR:update | `HR` | [src/hr/hr.controller.ts:155](../src/hr/hr.controller.ts:155) |
| `GET` | `/hr/me` | `AUTH` | selfOr(HR:view) | `HR` | [src/hr/hr-me.controller.ts:38](../src/hr/hr-me.controller.ts:38) |
| `GET` | `/hr/me/assets` | `AUTH` | selfOr(HR:view) | `HR` | [src/hr/hr-me.controller.ts:143](../src/hr/hr-me.controller.ts:143) |
| `GET` | `/hr/me/attendances` | `AUTH` | selfOr(HR:view) | `HR` | [src/hr/hr-me.controller.ts:44](../src/hr/hr-me.controller.ts:44) |
| `GET` | `/hr/me/attendances/:id` | `AUTH` | selfOr(HR:view) | `HR` | [src/hr/hr-me.controller.ts:59](../src/hr/hr-me.controller.ts:59) |
| `GET` | `/hr/me/balance` | `AUTH` | selfOr(HR:view) | `HR` | [src/hr/hr-me.controller.ts:150](../src/hr/hr-me.controller.ts:150) |
| `POST` | `/hr/me/check-in` | `AUTH` | selfOr(HR:create) | `HR` | [src/hr/hr-me.controller.ts:161](../src/hr/hr-me.controller.ts:161) |
| `POST` | `/hr/me/check-out` | `AUTH` | selfOr(HR:create) | `HR` | [src/hr/hr-me.controller.ts:168](../src/hr/hr-me.controller.ts:168) |
| `GET` | `/hr/me/leaves` | `AUTH` | selfOr(HR:view) | `HR` | [src/hr/hr-me.controller.ts:73](../src/hr/hr-me.controller.ts:73) |
| `POST` | `/hr/me/leaves` | `AUTH` | selfOr(HR:create) | `HR` | [src/hr/hr-me.controller.ts:98](../src/hr/hr-me.controller.ts:98) |
| `GET` | `/hr/me/leaves/:id` | `AUTH` | selfOr(HR:view) | `HR` | [src/hr/hr-me.controller.ts:84](../src/hr/hr-me.controller.ts:84) |
| `GET` | `/hr/me/payslips` | `AUTH` | selfOr(HR:view) | `HR` | [src/hr/hr-me.controller.ts:114](../src/hr/hr-me.controller.ts:114) |
| `GET` | `/hr/me/payslips/:id` | `AUTH` | selfOr(HR:view) | `HR` | [src/hr/hr-me.controller.ts:129](../src/hr/hr-me.controller.ts:129) |
| `GET` | `/hr/me/reviews` | `AUTH` | selfOr(HR:view) | `HR` | [src/hr/hr-me.controller.ts:175](../src/hr/hr-me.controller.ts:175) |
| `POST` | `/hr/me/reviews/:id/submit` | `AUTH` | selfOr(HR:create) | `HR` | [src/hr/hr-me.controller.ts:182](../src/hr/hr-me.controller.ts:182) |
| `GET` | `/hr/payslips` | `PERM` | HR:view | `HR` | [src/hr/hr.controller.ts:242](../src/hr/hr.controller.ts:242) |
| `POST` | `/hr/payslips` | `PERM` | HR:create | `HR` | [src/hr/hr.controller.ts:257](../src/hr/hr.controller.ts:257) |
| `DELETE` | `/hr/payslips/:id` | `PERM` | HR:delete | `HR` | [src/hr/hr.controller.ts:271](../src/hr/hr.controller.ts:271) |
| `PUT` | `/hr/payslips/:id` | `PERM` | HR:update | `HR` | [src/hr/hr.controller.ts:264](../src/hr/hr.controller.ts:264) |
| `GET` | `/hr/recruitment/assessments/:candidateId` | `PERM` | HR:view | `HR` | [src/hr/hr.controller.ts:389](../src/hr/hr.controller.ts:389) |
| `POST` | `/hr/recruitment/assessments/:id/approve-interview` | `PERM` | HR:update | `HR` | [src/hr/hr.controller.ts:403](../src/hr/hr.controller.ts:403) |
| `POST` | `/hr/recruitment/assessments/:id/evaluate` | `PERM` | HR:update | `HR` | [src/hr/hr.controller.ts:396](../src/hr/hr.controller.ts:396) |
| `POST` | `/hr/recruitment/assessments/:id/reject` | `PERM` | HR:update | `HR` | [src/hr/hr.controller.ts:414](../src/hr/hr.controller.ts:414) |
| `GET` | `/hr/recruitment/candidates` | `PERM` | HR:view | `HR` | [src/hr/hr.controller.ts:347](../src/hr/hr.controller.ts:347) |
| `POST` | `/hr/recruitment/candidates` | `PERM` | HR:create | `HR` | [src/hr/hr.controller.ts:354](../src/hr/hr.controller.ts:354) |
| `DELETE` | `/hr/recruitment/candidates/:id` | `PERM` | HR:delete | `HR` | [src/hr/hr.controller.ts:368](../src/hr/hr.controller.ts:368) |
| `PUT` | `/hr/recruitment/candidates/:id` | `PERM` | HR:update | `HR` | [src/hr/hr.controller.ts:361](../src/hr/hr.controller.ts:361) |
| `POST` | `/hr/recruitment/candidates/:id/generate-questions` | `PERM` | HR:update | `HR` | [src/hr/hr.controller.ts:382](../src/hr/hr.controller.ts:382) |
| `POST` | `/hr/recruitment/candidates/:id/send-assessment` | `PERM` | HR:update | `HR` | [src/hr/hr.controller.ts:375](../src/hr/hr.controller.ts:375) |
| `GET` | `/hr/recruitment/interviews` | `PERM` | HR:view | `HR` | [src/hr/hr.controller.ts:425](../src/hr/hr.controller.ts:425) |
| `POST` | `/hr/recruitment/interviews` | `PERM` | HR:create | `HR` | [src/hr/hr.controller.ts:432](../src/hr/hr.controller.ts:432) |
| `DELETE` | `/hr/recruitment/interviews/:id` | `PERM` | HR:delete | `HR` | [src/hr/hr.controller.ts:446](../src/hr/hr.controller.ts:446) |
| `PUT` | `/hr/recruitment/interviews/:id` | `PERM` | HR:update | `HR` | [src/hr/hr.controller.ts:439](../src/hr/hr.controller.ts:439) |
| `GET` | `/hr/recruitment/jobs` | `PERM` | HR:view | `HR` | [src/hr/hr.controller.ts:309](../src/hr/hr.controller.ts:309) |
| `POST` | `/hr/recruitment/jobs` | `PERM` | HR:create | `HR` | [src/hr/hr.controller.ts:316](../src/hr/hr.controller.ts:316) |
| `DELETE` | `/hr/recruitment/jobs/:id` | `PERM` | HR:delete | `HR` | [src/hr/hr.controller.ts:330](../src/hr/hr.controller.ts:330) |
| `PUT` | `/hr/recruitment/jobs/:id` | `PERM` | HR:update | `HR` | [src/hr/hr.controller.ts:323](../src/hr/hr.controller.ts:323) |
| `POST` | `/hr/recruitment/jobs/parse-requirements` | `PERM` | HR:create | `HR` | [src/hr/hr.controller.ts:337](../src/hr/hr.controller.ts:337) |
| `GET` | `/hr/review-campaigns` | `PERM` | HR:view | `HR` | [src/hr/hr.controller.ts:484](../src/hr/hr.controller.ts:484) |
| `POST` | `/hr/review-campaigns` | `PERM` | HR:create | `HR` | [src/hr/hr.controller.ts:491](../src/hr/hr.controller.ts:491) |
| `DELETE` | `/hr/review-campaigns/:id` | `PERM` | HR:delete | `HR` | [src/hr/hr.controller.ts:505](../src/hr/hr.controller.ts:505) |
| `PUT` | `/hr/review-campaigns/:id` | `PERM` | HR:update | `HR` | [src/hr/hr.controller.ts:498](../src/hr/hr.controller.ts:498) |
| `GET` | `/hr/review-questions` | `PERM` | HR:view | `HR` | [src/hr/hr.controller.ts:455](../src/hr/hr.controller.ts:455) |
| `POST` | `/hr/review-questions` | `PERM` | HR:create | `HR` | [src/hr/hr.controller.ts:462](../src/hr/hr.controller.ts:462) |
| `POST` | `/hr/review-questions-seed` | `PERM` | HR:create | `HR` | [src/hr/hr.controller.ts:533](../src/hr/hr.controller.ts:533) |
| `DELETE` | `/hr/review-questions/:id` | `PERM` | HR:delete | `HR` | [src/hr/hr.controller.ts:476](../src/hr/hr.controller.ts:476) |
| `PUT` | `/hr/review-questions/:id` | `PERM` | HR:update | `HR` | [src/hr/hr.controller.ts:469](../src/hr/hr.controller.ts:469) |
| `GET` | `/hr/shifts` | `PERM` | HR:view | `HR` | [src/hr/hr.controller.ts:18](../src/hr/hr.controller.ts:18) |
| `POST` | `/hr/shifts` | `PERM` | HR:create | `HR` | [src/hr/hr.controller.ts:25](../src/hr/hr.controller.ts:25) |
| `DELETE` | `/hr/shifts/:id` | `PERM` | HR:delete | `HR` | [src/hr/hr.controller.ts:39](../src/hr/hr.controller.ts:39) |
| `PUT` | `/hr/shifts/:id` | `PERM` | HR:update | `HR` | [src/hr/hr.controller.ts:32](../src/hr/hr.controller.ts:32) |
| `GET` | `/hr/trainings` | `PERM` | HR:view | `HR` | [src/hr/hr.controller.ts:279](../src/hr/hr.controller.ts:279) |
| `POST` | `/hr/trainings` | `PERM` | HR:create | `HR` | [src/hr/hr.controller.ts:286](../src/hr/hr.controller.ts:286) |
| `DELETE` | `/hr/trainings/:id` | `PERM` | HR:delete | `HR` | [src/hr/hr.controller.ts:300](../src/hr/hr.controller.ts:300) |
| `PUT` | `/hr/trainings/:id` | `PERM` | HR:update | `HR` | [src/hr/hr.controller.ts:293](../src/hr/hr.controller.ts:293) |
| `POST` | `/inventory/adjust` | `PERM` | INVENTORY:create | `INVENTORY` | [src/inventory/inventory.controller.ts:29](../src/inventory/inventory.controller.ts:29) |
| `POST` | `/inventory/convert-btp` | `PERM` | INVENTORY:create | `INVENTORY` | [src/inventory/inventory.controller.ts:66](../src/inventory/inventory.controller.ts:66) |
| `POST` | `/inventory/deliveries/:id/confirm` | `PERM` | INVENTORY:create | `INVENTORY` | [src/inventory/inventory.controller.ts:116](../src/inventory/inventory.controller.ts:116) |
| `GET` | `/inventory/deliveries/completed` | `PERM` | INVENTORY:view | `INVENTORY` | [src/inventory/inventory.controller.ts:110](../src/inventory/inventory.controller.ts:110) |
| `GET` | `/inventory/deliveries/pending` | `PERM` | INVENTORY:view | `INVENTORY` | [src/inventory/inventory.controller.ts:104](../src/inventory/inventory.controller.ts:104) |
| `GET` | `/inventory/goods-issue` | `PERM` | INVENTORY:view | `INVENTORY` | [src/inventory/inventory.controller.ts:181](../src/inventory/inventory.controller.ts:181) |
| `POST` | `/inventory/goods-issue` | `PERM` | INVENTORY:create | `INVENTORY` | [src/inventory/inventory.controller.ts:155](../src/inventory/inventory.controller.ts:155) |
| `DELETE` | `/inventory/goods-issue/:id` | `PERM` | INVENTORY:delete | `INVENTORY` | [src/inventory/inventory.controller.ts:208](../src/inventory/inventory.controller.ts:208) |
| `GET` | `/inventory/goods-issue/:id` | `PERM` | INVENTORY:view | `INVENTORY` | [src/inventory/inventory.controller.ts:190](../src/inventory/inventory.controller.ts:190) |
| `PUT` | `/inventory/goods-issue/:id` | `PERM` | INVENTORY:create | `INVENTORY` | [src/inventory/inventory.controller.ts:162](../src/inventory/inventory.controller.ts:162) |
| `POST` | `/inventory/goods-issue/:id/confirm` | `PERM` | INVENTORY:create | `INVENTORY` | [src/inventory/inventory.controller.ts:196](../src/inventory/inventory.controller.ts:196) |
| `POST` | `/inventory/goods-issue/:id/delivered` | `PERM` | INVENTORY:create | `INVENTORY` | [src/inventory/inventory.controller.ts:202](../src/inventory/inventory.controller.ts:202) |
| `POST` | `/inventory/goods-issue/:id/link-po` | `PERM` | INVENTORY:create | `INVENTORY` | [src/inventory/inventory.controller.ts:175](../src/inventory/inventory.controller.ts:175) |
| `GET` | `/inventory/goods-issue/unlinked/:pfoId` | `PERM` | INVENTORY:view | `INVENTORY` | [src/inventory/inventory.controller.ts:169](../src/inventory/inventory.controller.ts:169) |
| `DELETE` | `/inventory/goods-receipt/:id` | `PERM` | INVENTORY:delete | `INVENTORY` | [src/inventory/inventory.controller.ts:97](../src/inventory/inventory.controller.ts:97) |
| `POST` | `/inventory/goods-receipt/:id/confirm` | `PERM` | INVENTORY:create | `INVENTORY` | [src/inventory/inventory.controller.ts:91](../src/inventory/inventory.controller.ts:91) |
| `POST` | `/inventory/goods-receipt/draft` | `PERM` | INVENTORY:create | `INVENTORY` | [src/inventory/inventory.controller.ts:76](../src/inventory/inventory.controller.ts:76) |
| `GET` | `/inventory/goods-receipt/pending` | `PERM` | INVENTORY:view | `INVENTORY` | [src/inventory/inventory.controller.ts:82](../src/inventory/inventory.controller.ts:82) |
| `GET` | `/inventory/goods-receipt/po/:poId` | `PERM` | INVENTORY:view | PURCHASE:view | `INVENTORY` | [src/inventory/inventory.controller.ts:86](../src/inventory/inventory.controller.ts:86) |
| `GET` | `/inventory/history` | `PERM` | INVENTORY:view | `INVENTORY` | [src/inventory/inventory.controller.ts:18](../src/inventory/inventory.controller.ts:18) |
| `POST` | `/inventory/reset` | `PERM` | INVENTORY:delete | `INVENTORY` | [src/inventory/inventory.controller.ts:47](../src/inventory/inventory.controller.ts:47) |
| `GET` | `/inventory/samples/stocks` | `PERM` | INVENTORY:view | `INVENTORY` | [src/inventory/samples/inventory-samples.controller.ts:74](../src/inventory/samples/inventory-samples.controller.ts:74) |
| `GET` | `/inventory/samples/transactions` | `PERM` | INVENTORY:view | `INVENTORY` | [src/inventory/samples/inventory-samples.controller.ts:15](../src/inventory/samples/inventory-samples.controller.ts:15) |
| `POST` | `/inventory/samples/transactions` | `PERM` | INVENTORY:create | `INVENTORY` | [src/inventory/samples/inventory-samples.controller.ts:21](../src/inventory/samples/inventory-samples.controller.ts:21) |
| `DELETE` | `/inventory/samples/transactions/:id` | `PERM` | INVENTORY:delete | `INVENTORY` | [src/inventory/samples/inventory-samples.controller.ts:68](../src/inventory/samples/inventory-samples.controller.ts:68) |
| `GET` | `/inventory/samples/transactions/:id` | `PERM` | INVENTORY:view | `INVENTORY` | [src/inventory/samples/inventory-samples.controller.ts:56](../src/inventory/samples/inventory-samples.controller.ts:56) |
| `PUT` | `/inventory/samples/transactions/:id` | `PERM` | INVENTORY:update | `INVENTORY` | [src/inventory/samples/inventory-samples.controller.ts:39](../src/inventory/samples/inventory-samples.controller.ts:39) |
| `POST` | `/inventory/samples/transactions/:id/confirm` | `PERM` | INVENTORY:create | `INVENTORY` | [src/inventory/samples/inventory-samples.controller.ts:62](../src/inventory/samples/inventory-samples.controller.ts:62) |
| `GET` | `/inventory/shipping-carriers` | `PERM` | INVENTORY:view | `INVENTORY` | [src/inventory/inventory.controller.ts:127](../src/inventory/inventory.controller.ts:127) |
| `POST` | `/inventory/shipping-carriers` | `PERM` | INVENTORY:create | `INVENTORY` | [src/inventory/inventory.controller.ts:133](../src/inventory/inventory.controller.ts:133) |
| `DELETE` | `/inventory/shipping-carriers/:id` | `PERM` | INVENTORY:delete | `INVENTORY` | [src/inventory/inventory.controller.ts:145](../src/inventory/inventory.controller.ts:145) |
| `PUT` | `/inventory/shipping-carriers/:id` | `PERM` | INVENTORY:update | `INVENTORY` | [src/inventory/inventory.controller.ts:139](../src/inventory/inventory.controller.ts:139) |
| `GET` | `/inventory/stocks` | `PERM` | INVENTORY:view | `INVENTORY` | [src/inventory/inventory.controller.ts:24](../src/inventory/inventory.controller.ts:24) |
| `GET` | `/inventory/supplier-stocks/:supplierId` | `PERM` | INVENTORY:view | `INVENTORY` | [src/inventory/inventory.controller.ts:225](../src/inventory/inventory.controller.ts:225) |
| `GET` | `/inventory/supplier-stocks/all` | `PERM` | INVENTORY:view | `INVENTORY` | [src/inventory/inventory.controller.ts:219](../src/inventory/inventory.controller.ts:219) |
| `POST` | `/inventory/transfer` | `PERM` | INVENTORY:create | `INVENTORY` | [src/inventory/inventory.controller.ts:55](../src/inventory/inventory.controller.ts:55) |
| `GET` | `/lookups/categories` | `AUTH` | AUTH | `CORE` | [src/lookups/lookups.controller.ts:48](../src/lookups/lookups.controller.ts:48) |
| `GET` | `/lookups/customers` | `AUTH` | AUTH | `CORE` | [src/lookups/lookups.controller.ts:24](../src/lookups/lookups.controller.ts:24) |
| `GET` | `/lookups/employees` | `AUTH` | AUTH | `CORE` | [src/lookups/lookups.controller.ts:43](../src/lookups/lookups.controller.ts:43) |
| `GET` | `/lookups/materials` | `AUTH` | AUTH | `CORE` | [src/lookups/lookups.controller.ts:53](../src/lookups/lookups.controller.ts:53) |
| `GET` | `/lookups/products` | `AUTH` | AUTH | `CORE` | [src/lookups/lookups.controller.ts:19](../src/lookups/lookups.controller.ts:19) |
| `GET` | `/lookups/project-tasks` | `AUTH` | AUTH | `CORE` | [src/lookups/lookups.controller.ts:63](../src/lookups/lookups.controller.ts:63) |
| `GET` | `/lookups/projects` | `AUTH` | AUTH | `CORE` | [src/lookups/lookups.controller.ts:58](../src/lookups/lookups.controller.ts:58) |
| `GET` | `/lookups/suppliers` | `AUTH` | AUTH | `CORE` | [src/lookups/lookups.controller.ts:29](../src/lookups/lookups.controller.ts:29) |
| `GET` | `/lookups/users` | `AUTH` | AUTH | `CORE` | [src/lookups/lookups.controller.ts:14](../src/lookups/lookups.controller.ts:14) |
| `GET` | `/lookups/warehouses` | `AUTH` | AUTH | `CORE` | [src/lookups/lookups.controller.ts:38](../src/lookups/lookups.controller.ts:38) |
| `GET` | `/marketing/campaigns` | `PERM` | MARKETING:view | `MARKETING` | [src/marketing/marketing.controller.ts:25](../src/marketing/marketing.controller.ts:25) |
| `POST` | `/marketing/campaigns` | `PERM` | MARKETING:create | `MARKETING` | [src/marketing/marketing.controller.ts:37](../src/marketing/marketing.controller.ts:37) |
| `DELETE` | `/marketing/campaigns/:id` | `PERM` | MARKETING:delete | `MARKETING` | [src/marketing/marketing.controller.ts:61](../src/marketing/marketing.controller.ts:61) |
| `GET` | `/marketing/campaigns/:id` | `PERM` | MARKETING:view | `MARKETING` | [src/marketing/marketing.controller.ts:31](../src/marketing/marketing.controller.ts:31) |
| `PUT` | `/marketing/campaigns/:id` | `PERM` | MARKETING:update | `MARKETING` | [src/marketing/marketing.controller.ts:43](../src/marketing/marketing.controller.ts:43) |
| `PUT` | `/marketing/campaigns/:id/status` | `PERM` | MARKETING:update | `MARKETING` | [src/marketing/marketing.controller.ts:52](../src/marketing/marketing.controller.ts:52) |
| `GET` | `/marketing/dashboard` | `PERM` | MARKETING:view | `MARKETING` | [src/marketing/marketing.controller.ts:17](../src/marketing/marketing.controller.ts:17) |
| `GET` | `/marketing/segments` | `PERM` | MARKETING:view | `MARKETING` | [src/marketing/marketing.controller.ts:70](../src/marketing/marketing.controller.ts:70) |
| `POST` | `/marketing/segments` | `PERM` | MARKETING:create | `MARKETING` | [src/marketing/marketing.controller.ts:95](../src/marketing/marketing.controller.ts:95) |
| `DELETE` | `/marketing/segments/:id` | `PERM` | MARKETING:delete | `MARKETING` | [src/marketing/marketing.controller.ts:110](../src/marketing/marketing.controller.ts:110) |
| `GET` | `/marketing/segments/:id` | `PERM` | MARKETING:view | `MARKETING` | [src/marketing/marketing.controller.ts:76](../src/marketing/marketing.controller.ts:76) |
| `PUT` | `/marketing/segments/:id` | `PERM` | MARKETING:update | `MARKETING` | [src/marketing/marketing.controller.ts:101](../src/marketing/marketing.controller.ts:101) |
| `POST` | `/marketing/segments/:id/calculate` | `PERM` | MARKETING:view | `MARKETING` | [src/marketing/marketing.controller.ts:88](../src/marketing/marketing.controller.ts:88) |
| `GET` | `/marketing/segments/:id/customers` | `PERM` | MARKETING:view | `MARKETING` | [src/marketing/marketing.controller.ts:82](../src/marketing/marketing.controller.ts:82) |
| `GET` | `/marketing/workflows` | `PERM` | MARKETING:view | `MARKETING` | [src/marketing/marketing.controller.ts:119](../src/marketing/marketing.controller.ts:119) |
| `POST` | `/marketing/workflows` | `PERM` | MARKETING:create | `MARKETING` | [src/marketing/marketing.controller.ts:131](../src/marketing/marketing.controller.ts:131) |
| `DELETE` | `/marketing/workflows/:id` | `PERM` | MARKETING:delete | `MARKETING` | [src/marketing/marketing.controller.ts:155](../src/marketing/marketing.controller.ts:155) |
| `GET` | `/marketing/workflows/:id` | `PERM` | MARKETING:view | `MARKETING` | [src/marketing/marketing.controller.ts:125](../src/marketing/marketing.controller.ts:125) |
| `PUT` | `/marketing/workflows/:id` | `PERM` | MARKETING:update | `MARKETING` | [src/marketing/marketing.controller.ts:137](../src/marketing/marketing.controller.ts:137) |
| `PUT` | `/marketing/workflows/:id/status` | `PERM` | MARKETING:update | `MARKETING` | [src/marketing/marketing.controller.ts:146](../src/marketing/marketing.controller.ts:146) |
| `GET` | `/materials` | `PERM` | INVENTORY:view | PURCHASE:view | `INVENTORY` | [src/materials/materials.controller.ts:17](../src/materials/materials.controller.ts:17) |
| `POST` | `/materials` | `PERM` | INVENTORY:create | `INVENTORY` | [src/materials/materials.controller.ts:21](../src/materials/materials.controller.ts:21) |
| `DELETE` | `/materials/:id` | `PERM` | INVENTORY:delete | `INVENTORY` | [src/materials/materials.controller.ts:29](../src/materials/materials.controller.ts:29) |
| `PUT` | `/materials/:id` | `PERM` | INVENTORY:update | `INVENTORY` | [src/materials/materials.controller.ts:25](../src/materials/materials.controller.ts:25) |
| `GET` | `/me/entitlements` | `AUTH` | AUTH | `CORE` | [src/common/packages/me-entitlements.controller.ts:59](../src/common/packages/me-entitlements.controller.ts:59) |
| `GET` | `/notifications` | `AUTH` | AUTH | `CORE` | [src/notifications/notifications.controller.ts:14](../src/notifications/notifications.controller.ts:14) |
| `POST` | `/notifications/:id/read` | `AUTH` | AUTH | `CORE` | [src/notifications/notifications.controller.ts:19](../src/notifications/notifications.controller.ts:19) |
| `POST` | `/notifications/read-all` | `AUTH` | AUTH | `CORE` | [src/notifications/notifications.controller.ts:25](../src/notifications/notifications.controller.ts:25) |
| `GET` | `/planning` | `PERM` | PRODUCTION:view | `PRODUCTION` | [src/planning/planning.controller.ts:33](../src/planning/planning.controller.ts:33) |
| `GET` | `/planning/:id/booking-items` | `PERM` | PRODUCTION:view | `PRODUCTION` | [src/planning/planning.controller.ts:194](../src/planning/planning.controller.ts:194) |
| `POST` | `/planning/:id/confirm-bookings` | `PERM` | PRODUCTION:update | `PRODUCTION` | [src/planning/planning.controller.ts:196](../src/planning/planning.controller.ts:196) |
| `GET` | `/planning/booking-stats` | `PERM` | PRODUCTION:view | `PRODUCTION` | [src/planning/planning.controller.ts:37](../src/planning/planning.controller.ts:37) |
| `GET` | `/planning/bookings` | `PERM` | PRODUCTION:view | `PRODUCTION` | [src/planning/planning.controller.ts:39](../src/planning/planning.controller.ts:39) |
| `POST` | `/planning/bookings/:itemId/revert` | `PERM` | PRODUCTION:update | `PRODUCTION` | [src/planning/planning.controller.ts:198](../src/planning/planning.controller.ts:198) |
| `GET` | `/planning/bookings/:sku` | `PERM` | PRODUCTION:view | `PRODUCTION` | [src/planning/planning.controller.ts:41](../src/planning/planning.controller.ts:41) |
| `GET` | `/planning/demand/gc` | `PERM` | PRODUCTION:view | `PRODUCTION` | [src/planning/planning.controller.ts:55](../src/planning/planning.controller.ts:55) |
| `GET` | `/planning/demand/npl` | `PERM` | PRODUCTION:view | `PRODUCTION` | [src/planning/planning.controller.ts:49](../src/planning/planning.controller.ts:49) |
| `GET` | `/planning/gantt` | `PERM` | PRODUCTION:view | `PRODUCTION` | [src/planning/planning.controller.ts:43](../src/planning/planning.controller.ts:43) |
| `DELETE` | `/planning/pfo/:id` | `PERM` | PRODUCTION:delete | `PRODUCTION` | [src/planning/planning.controller.ts:95](../src/planning/planning.controller.ts:95) |
| `GET` | `/planning/pfo/:id` | `PERM` | PRODUCTION:view | PURCHASE:view | `PRODUCTION` | [src/planning/planning.controller.ts:89](../src/planning/planning.controller.ts:89) |
| `POST` | `/planning/pfo/:id/assign-vendor` | `PERM` | PRODUCTION:create | `PRODUCTION` | [src/planning/planning.controller.ts:149](../src/planning/planning.controller.ts:149) |
| `POST` | `/planning/pfo/:id/calculate-bom` | `PERM` | PRODUCTION:view | `PRODUCTION` | [src/planning/planning.controller.ts:126](../src/planning/planning.controller.ts:126) |
| `PUT` | `/planning/pfo/:id/custom-quantities` | `PERM` | PRODUCTION:update | `PRODUCTION` | [src/planning/planning.controller.ts:113](../src/planning/planning.controller.ts:113) |
| `POST` | `/planning/pfo/:id/generate-pos` | `PERM` | PRODUCTION:create | `PRODUCTION` | [src/planning/planning.controller.ts:162](../src/planning/planning.controller.ts:162) |
| `POST` | `/planning/pfo/:id/milestone` | `PERM` | PRODUCTION:create | `PRODUCTION` | [src/planning/planning.controller.ts:181](../src/planning/planning.controller.ts:181) |
| `GET` | `/planning/pfo/:id/pos` | `PERM` | PRODUCTION:view | `PRODUCTION` | [src/planning/planning.controller.ts:168](../src/planning/planning.controller.ts:168) |
| `GET` | `/planning/pfo/:id/preview-btp` | `PERM` | PRODUCTION:view | `PRODUCTION` | [src/planning/planning.controller.ts:120](../src/planning/planning.controller.ts:120) |
| `POST` | `/planning/pfo/:id/process-routing` | `PERM` | PRODUCTION:create | `PRODUCTION` | [src/planning/planning.controller.ts:155](../src/planning/planning.controller.ts:155) |
| `GET` | `/planning/pfo/:id/pxks` | `PERM` | PRODUCTION:view | `PRODUCTION` | [src/planning/planning.controller.ts:174](../src/planning/planning.controller.ts:174) |
| `POST` | `/planning/pfo/:id/qc` | `PERM` | PRODUCTION:create | `PRODUCTION` | [src/planning/planning.controller.ts:187](../src/planning/planning.controller.ts:187) |
| `PUT` | `/planning/pfo/:id/quantity` | `PERM` | PRODUCTION:update | `PRODUCTION` | [src/planning/planning.controller.ts:107](../src/planning/planning.controller.ts:107) |
| `POST` | `/planning/pfo/:id/request-material` | `PERM` | PRODUCTION:create | `PRODUCTION` | [src/planning/planning.controller.ts:142](../src/planning/planning.controller.ts:142) |
| `POST` | `/planning/pfo/:id/save-requirements` | `PERM` | PRODUCTION:create | `PRODUCTION` | [src/planning/planning.controller.ts:136](../src/planning/planning.controller.ts:136) |
| `PUT` | `/planning/pfo/:id/status` | `PERM` | PRODUCTION:update | `PRODUCTION` | [src/planning/planning.controller.ts:101](../src/planning/planning.controller.ts:101) |
| `POST` | `/planning/pfo/generate` | `PERM` | PRODUCTION:create | `PRODUCTION` | [src/planning/planning.controller.ts:67](../src/planning/planning.controller.ts:67) |
| `POST` | `/planning/pfo/material-issue/:reqId` | `PERM` | PRODUCTION:create | `PRODUCTION` | [src/planning/planning.controller.ts:78](../src/planning/planning.controller.ts:78) |
| `GET` | `/planning/pfo/suggestions` | `PERM` | PRODUCTION:view | `PRODUCTION` | [src/planning/planning.controller.ts:61](../src/planning/planning.controller.ts:61) |
| `GET` | `/planning/suggestion` | `PERM` | PRODUCTION:view | `PRODUCTION` | [src/planning/planning.controller.ts:35](../src/planning/planning.controller.ts:35) |
| `POST` | `/planning/sync-booking-stock` | `PERM` | PRODUCTION:create | `PRODUCTION` | [src/planning/planning.controller.ts:45](../src/planning/planning.controller.ts:45) |
| `GET` | `/processes` | `PERM` | PRODUCTION:view | `PRODUCTION` | [src/processes/processes.controller.ts:12](../src/processes/processes.controller.ts:12) |
| `POST` | `/processes` | `PERM` | PRODUCTION:create | `PRODUCTION` | [src/processes/processes.controller.ts:14](../src/processes/processes.controller.ts:14) |
| `DELETE` | `/processes/:id` | `PERM` | PRODUCTION:delete | `PRODUCTION` | [src/processes/processes.controller.ts:18](../src/processes/processes.controller.ts:18) |
| `PUT` | `/processes/:id` | `PERM` | PRODUCTION:update | `PRODUCTION` | [src/processes/processes.controller.ts:16](../src/processes/processes.controller.ts:16) |
| `POST` | `/processes/seed` | `PERM` | PRODUCTION:create | `PRODUCTION` | [src/processes/processes.controller.ts:21](../src/processes/processes.controller.ts:21) |
| `GET` | `/production/assignments` | `PERM` | PRODUCTION:view | `PRODUCTION` | [src/production/production.controller.ts:76](../src/production/production.controller.ts:76) |
| `POST` | `/production/assignments` | `PERM` | PRODUCTION:create | `PRODUCTION` | [src/production/production.controller.ts:70](../src/production/production.controller.ts:70) |
| `DELETE` | `/production/assignments/:id` | `PERM` | PRODUCTION:delete | `PRODUCTION` | [src/production/production.controller.ts:102](../src/production/production.controller.ts:102) |
| `GET` | `/production/assignments/:id` | `PERM` | PRODUCTION:view | `PRODUCTION` | [src/production/production.controller.ts:90](../src/production/production.controller.ts:90) |
| `PUT` | `/production/assignments/:id` | `PERM` | PRODUCTION:update | `PRODUCTION` | [src/production/production.controller.ts:96](../src/production/production.controller.ts:96) |
| `GET` | `/production/orders` | `PERM` | PRODUCTION:view | `PRODUCTION` | [src/production/production.controller.ts:23](../src/production/production.controller.ts:23) |
| `POST` | `/production/orders` | `PERM` | PRODUCTION:create | `PRODUCTION` | [src/production/production.controller.ts:17](../src/production/production.controller.ts:17) |
| `POST` | `/production/orders/:id/complete` | `PERM` | PRODUCTION:create | `PRODUCTION` | [src/production/production.controller.ts:35](../src/production/production.controller.ts:35) |
| `POST` | `/production/orders/:id/start` | `PERM` | PRODUCTION:create | `PRODUCTION` | [src/production/production.controller.ts:29](../src/production/production.controller.ts:29) |
| `DELETE` | `/production/steps/:stepId` | `PERM` | PRODUCTION:delete | `PRODUCTION` | [src/production/production.controller.ts:60](../src/production/production.controller.ts:60) |
| `PUT` | `/production/steps/:stepId/status` | `PERM` | PRODUCTION:update | `PRODUCTION` | [src/production/production.controller.ts:54](../src/production/production.controller.ts:54) |
| `GET` | `/production/work-orders/:id` | `PERM` | PRODUCTION:view | `PRODUCTION` | [src/production/production.controller.ts:48](../src/production/production.controller.ts:48) |
| `GET` | `/production/work-orders/plan/:pfoId` | `PERM` | PRODUCTION:view | `PRODUCTION` | [src/production/production.controller.ts:42](../src/production/production.controller.ts:42) |
| `GET` | `/products` | `PERM` | PRODUCT:view | PURCHASE:view | PRODUCTION:view | SALES:view | INVENTORY:view | `CORE` | [src/products/products.controller.ts:59](../src/products/products.controller.ts:59) |
| `POST` | `/products` | `PERM` | PRODUCT:create | `CORE` | [src/products/products.controller.ts:122](../src/products/products.controller.ts:122) |
| `DELETE` | `/products/:id` | `PERM` | PRODUCT:delete | `CORE` | [src/products/products.controller.ts:160](../src/products/products.controller.ts:160) |
| `GET` | `/products/:id` | `PERM` | PRODUCT:view | PURCHASE:view | PRODUCTION:view | SALES:view | INVENTORY:view | `CORE` | [src/products/products.controller.ts:90](../src/products/products.controller.ts:90) |
| `PUT` | `/products/:id` | `PERM` | PRODUCT:update | `CORE` | [src/products/products.controller.ts:141](../src/products/products.controller.ts:141) |
| `POST` | `/products/:id/boms` | `PERM` | PRODUCT:update | `CORE` | [src/products/products.controller.ts:233](../src/products/products.controller.ts:233) |
| `POST` | `/products/:id/components` | `PERM` | PRODUCT:create | `CORE` | [src/products/products.controller.ts:274](../src/products/products.controller.ts:274) |
| `GET` | `/products/:id/logistics` | `PERM` | PRODUCT:view | `CORE` | [src/products/products.controller.ts:183](../src/products/products.controller.ts:183) |
| `POST` | `/products/:id/logistics` | `PERM` | PRODUCT:update | `CORE` | [src/products/products.controller.ts:185](../src/products/products.controller.ts:185) |
| `GET` | `/products/:id/pattern` | `PERM` | PRODUCT:view | `CORE` | [src/products/products.controller.ts:189](../src/products/products.controller.ts:189) |
| `POST` | `/products/:id/pattern` | `PERM` | PRODUCT:update | `CORE` | [src/products/products.controller.ts:191](../src/products/products.controller.ts:191) |
| `GET` | `/products/:id/routings` | `PERM` | PRODUCT:view | PRODUCTION:view | PURCHASE:view | `CORE` | [src/products/products.controller.ts:169](../src/products/products.controller.ts:169) |
| `POST` | `/products/:id/routings` | `PERM` | PRODUCT:update | `CORE` | [src/products/products.controller.ts:180](../src/products/products.controller.ts:180) |
| `GET` | `/products/:id/sales-history` | `PERM` | PRODUCT:view | `CORE` | [src/products/products.controller.ts:320](../src/products/products.controller.ts:320) |
| `POST` | `/products/:id/sync-variants` | `PERM` | PRODUCT:create | `CORE` | [src/products/products.controller.ts:236](../src/products/products.controller.ts:236) |
| `GET` | `/products/:id/website-config` | `PERM` | PRODUCT:view | `WEBSITE` | [src/products/products.controller.ts:195](../src/products/products.controller.ts:195) |
| `POST` | `/products/:id/website-config` | `PERM` | PRODUCT:update | `WEBSITE` | [src/products/products.controller.ts:198](../src/products/products.controller.ts:198) |
| `GET` | `/products/:sku/boms` | `PERM` | PRODUCT:view | PURCHASE:view | PRODUCTION:view | SALES:view | INVENTORY:view | `CORE` | [src/products/products.controller.ts:203](../src/products/products.controller.ts:203) |
| `POST` | `/products/calculate-all-costs` | `PERM` | PRODUCT:view | `CORE` | [src/products/products.controller.ts:314](../src/products/products.controller.ts:314) |
| `GET` | `/products/calculate-cost/:sku` | `PERM` | PRODUCT:view | PRODUCTION:view | `CORE` | [src/products/products.controller.ts:304](../src/products/products.controller.ts:304) |
| `GET` | `/products/combo/:sku` | `PERM` | PRODUCT:view | PURCHASE:view | PRODUCTION:view | SALES:view | INVENTORY:view | `CORE` | [src/products/products.controller.ts:239](../src/products/products.controller.ts:239) |
| `POST` | `/products/combo/add` | `PERM` | PRODUCT:create | `CORE` | [src/products/products.controller.ts:269](../src/products/products.controller.ts:269) |
| `DELETE` | `/products/combo/item/:id` | `PERM` | PRODUCT:delete | `CORE` | [src/products/products.controller.ts:271](../src/products/products.controller.ts:271) |
| `POST` | `/products/copy-bom` | `PERM` | PRODUCT:create | `CORE` | [src/products/products.controller.ts:280](../src/products/products.controller.ts:280) |
| `POST` | `/products/copy-logistics` | `PERM` | PRODUCT:create | `CORE` | [src/products/products.controller.ts:292](../src/products/products.controller.ts:292) |
| `POST` | `/products/copy-routings` | `PERM` | PRODUCT:create | `CORE` | [src/products/products.controller.ts:286](../src/products/products.controller.ts:286) |
| `POST` | `/products/copy-semi-finished` | `PERM` | PRODUCT:create | `CORE` | [src/products/products.controller.ts:298](../src/products/products.controller.ts:298) |
| `POST` | `/products/create-variant` | `PERM` | PRODUCT:create | `CORE` | [src/products/products.controller.ts:163](../src/products/products.controller.ts:163) |
| `GET` | `/products/packing-specs` | `PERM` | PRODUCT:view | `CORE` | [src/products/products.controller.ts:27](../src/products/products.controller.ts:27) |
| `POST` | `/products/packing-specs` | `PERM` | PRODUCT:create | `CORE` | [src/products/products.controller.ts:37](../src/products/products.controller.ts:37) |
| `DELETE` | `/products/packing-specs/:id` | `PERM` | PRODUCT:delete | `CORE` | [src/products/products.controller.ts:51](../src/products/products.controller.ts:51) |
| `PUT` | `/products/packing-specs/:id` | `PERM` | PRODUCT:update | `CORE` | [src/products/products.controller.ts:44](../src/products/products.controller.ts:44) |
| `GET` | `/projects` | `PERM` | PROJECTS:view | `PROJECTS` | [src/projects/projects.controller.ts:36](../src/projects/projects.controller.ts:36) |
| `POST` | `/projects` | `PERM` | PROJECTS:create | `PROJECTS` | [src/projects/projects.controller.ts:50](../src/projects/projects.controller.ts:50) |
| `DELETE` | `/projects/:id` | `PERM` | PROJECTS:delete | `PROJECTS` | [src/projects/projects.controller.ts:64](../src/projects/projects.controller.ts:64) |
| `GET` | `/projects/:id` | `PERM` | PROJECTS:view | `PROJECTS` | [src/projects/projects.controller.ts:43](../src/projects/projects.controller.ts:43) |
| `PUT` | `/projects/:id` | `PERM` | PROJECTS:update | `PROJECTS` | [src/projects/projects.controller.ts:57](../src/projects/projects.controller.ts:57) |
| `GET` | `/projects/:id/cost-summary` | `PERM` | PROJECTS:view | `PROJECTS` | [src/projects/projects.controller.ts:80](../src/projects/projects.controller.ts:80) |
| `POST` | `/projects/:id/milestones` | `PERM` | PROJECTS:create | `PROJECTS` | [src/projects/projects.controller.ts:88](../src/projects/projects.controller.ts:88) |
| `POST` | `/projects/from-so/:soId` | `PERM` | PROJECTS:create | `PROJECTS` | [src/projects/projects.controller.ts:72](../src/projects/projects.controller.ts:72) |
| `DELETE` | `/projects/milestones/:milestoneId` | `PERM` | PROJECTS:delete | `PROJECTS` | [src/projects/projects.controller.ts:106](../src/projects/projects.controller.ts:106) |
| `PUT` | `/projects/milestones/:milestoneId` | `PERM` | PROJECTS:update | `PROJECTS` | [src/projects/projects.controller.ts:95](../src/projects/projects.controller.ts:95) |
| `GET` | `/proxy-image` | `AUTH` | AUTH | `CORE` | [src/app.controller.ts:41](../src/app.controller.ts:41) |
| `POST` | `/public/analytics/ping` | `PUBLIC` | - | `MARKETING` | [src/analytics/analytics.controller.ts:30](../src/analytics/analytics.controller.ts:30) |
| `GET` | `/public/analytics/stats` | `PERM` | CMS:view | `MARKETING` | [src/analytics/analytics.controller.ts:78](../src/analytics/analytics.controller.ts:78) |
| `GET` | `/public/analytics/visitors` | `PERM` | CMS:view | `MARKETING` | [src/analytics/analytics.controller.ts:84](../src/analytics/analytics.controller.ts:84) |
| `GET` | `/public/meta` | `PUBLIC` | - | `core` | [src/public/public.controller.ts:36](../src/public/public.controller.ts:36) |
| `POST` | `/public/portal/custom-order/:slug` | `PUBLIC` | - | `SALES` | [src/public/portal.controller.ts:669](../src/public/portal.controller.ts:669) |
| `GET` | `/public/portal/dashboard/:slug` | `PUBLIC` | - | `SALES` | [src/public/portal.controller.ts:283](../src/public/portal.controller.ts:283) |
| `GET` | `/public/portal/product-stats/:slug` | `PUBLIC` | - | `SALES` | [src/public/portal.controller.ts:603](../src/public/portal.controller.ts:603) |
| `GET` | `/public/portal/promotion/:slug/:id` | `PUBLIC` | - | `SALES` | [src/public/portal.controller.ts:491](../src/public/portal.controller.ts:491) |
| `POST` | `/public/portal/promotion/:slug/:id/order` | `PUBLIC` | - | `SALES` | [src/public/portal.controller.ts:519](../src/public/portal.controller.ts:519) |
| `GET` | `/public/portal/quote/:uuid` | `PUBLIC` | - | `SALES` | [src/public/public.controller.ts:133](../src/public/public.controller.ts:133) |
| `POST` | `/public/portal/quote/:uuid/action` | `PUBLIC` | - | `SALES` | [src/public/public.controller.ts:244](../src/public/public.controller.ts:244) |
| `POST` | `/public/portal/quote/:uuid/comment` | `PUBLIC` | - | `SALES` | [src/public/public.controller.ts:267](../src/public/public.controller.ts:267) |
| `DELETE` | `/public/portal/quote/:uuid/comment/:commentId` | `PUBLIC` | - | `SALES` | [src/public/public.controller.ts:274](../src/public/public.controller.ts:274) |
| `POST` | `/public/portal/reorder/:slug` | `PUBLIC` | - | `SALES` | [src/public/portal.controller.ts:394](../src/public/portal.controller.ts:394) |
| `POST` | `/public/portal/request-otp` | `PUBLIC` | - | `SALES` | [src/public/portal.controller.ts:74](../src/public/portal.controller.ts:74) |
| `GET` | `/public/portal/validate-token` | `PUBLIC` | - | `SALES` | [src/public/portal.controller.ts:471](../src/public/portal.controller.ts:471) |
| `POST` | `/public/portal/verify-otp` | `PUBLIC` | - | `SALES` | [src/public/portal.controller.ts:193](../src/public/portal.controller.ts:193) |
| `GET` | `/public/proxy-image` | `AUTH` | AUTH | `core` | [src/public/public.controller.ts:282](../src/public/public.controller.ts:282) |
| `POST` | `/public/recruitment/apply` | `PUBLIC` | - | `HR` | [src/public/public.controller.ts:69](../src/public/public.controller.ts:69) |
| `GET` | `/public/recruitment/jobs` | `PUBLIC` | - | `HR` | [src/public/public.controller.ts:49](../src/public/public.controller.ts:49) |
| `GET` | `/public/recruitment/jobs/:slug` | `PUBLIC` | - | `HR` | [src/public/public.controller.ts:58](../src/public/public.controller.ts:58) |
| `GET` | `/public/recruitment/portal/:token` | `PUBLIC` | - | `HR` | [src/public/public.controller.ts:91](../src/public/public.controller.ts:91) |
| `POST` | `/public/recruitment/portal/:token/submit-assessment` | `PUBLIC` | - | `HR` | [src/public/public.controller.ts:115](../src/public/public.controller.ts:115) |
| `GET` | `/purchasing` | `PERM` | PURCHASE:view | `INVENTORY` | [src/purchasing/purchasing.controller.ts:22](../src/purchasing/purchasing.controller.ts:22) |
| `POST` | `/purchasing` | `PERM` | PURCHASE:create | `INVENTORY` | [src/purchasing/purchasing.controller.ts:18](../src/purchasing/purchasing.controller.ts:18) |
| `DELETE` | `/purchasing/:id` | `PERM` | PURCHASE:delete | `INVENTORY` | [src/purchasing/purchasing.controller.ts:60](../src/purchasing/purchasing.controller.ts:60) |
| `GET` | `/purchasing/:id` | `PERM` | PURCHASE:view | `INVENTORY` | [src/purchasing/purchasing.controller.ts:41](../src/purchasing/purchasing.controller.ts:41) |
| `PUT` | `/purchasing/:id` | `PERM` | PURCHASE:update | `INVENTORY` | [src/purchasing/purchasing.controller.ts:49](../src/purchasing/purchasing.controller.ts:49) |
| `GET` | `/purchasing/:id/outsourcing-materials` | `PERM` | PURCHASE:view | `INVENTORY` | [src/purchasing/purchasing.controller.ts:68](../src/purchasing/purchasing.controller.ts:68) |
| `GET` | `/purchasing/:id/payment-history` | `PERM` | PURCHASE:view | `INVENTORY` | [src/purchasing/purchasing.controller.ts:45](../src/purchasing/purchasing.controller.ts:45) |
| `POST` | `/purchasing/:id/receive` | `PERM` | PURCHASE:create | `INVENTORY` | [src/purchasing/purchasing.controller.ts:75](../src/purchasing/purchasing.controller.ts:75) |
| `GET` | `/purchasing/available-for-pooling` | `PERM` | PURCHASE:view | `INVENTORY` | [src/purchasing/purchasing.controller.ts:31](../src/purchasing/purchasing.controller.ts:31) |
| `POST` | `/purchasing/batch-delete` | `PERM` | PURCHASE:create | `INVENTORY` | [src/purchasing/purchasing.controller.ts:54](../src/purchasing/purchasing.controller.ts:54) |
| `POST` | `/purchasing/create-pooled` | `PERM` | PURCHASE:create | `INVENTORY` | [src/purchasing/purchasing.controller.ts:35](../src/purchasing/purchasing.controller.ts:35) |
| `GET` | `/purchasing/pooled/:id/aggregate` | `PERM` | PURCHASE:view | `INVENTORY` | [src/purchasing/purchasing.controller.ts:37](../src/purchasing/purchasing.controller.ts:37) |
| `DELETE` | `/purchasing/pooled/all` | `PERM` | PURCHASE:delete | `INVENTORY` | [src/purchasing/purchasing.controller.ts:33](../src/purchasing/purchasing.controller.ts:33) |
| `GET` | `/purchasing/portal/:uuid` | `PUBLIC` | - | `INVENTORY` | [src/purchasing/purchasing.controller.ts:79](../src/purchasing/purchasing.controller.ts:79) |
| `POST` | `/purchasing/portal/:uuid/action` | `PUBLIC` | - | `INVENTORY` | [src/purchasing/purchasing.controller.ts:84](../src/purchasing/purchasing.controller.ts:84) |
| `GET` | `/purchasing/requirements` | `PERM` | PURCHASE:view | `INVENTORY` | [src/purchasing/purchasing.controller.ts:26](../src/purchasing/purchasing.controller.ts:26) |
| `GET` | `/purchasing/supplier-portal/:uuid` | `PUBLIC` | - | `INVENTORY` | [src/purchasing/purchasing.controller.ts:90](../src/purchasing/purchasing.controller.ts:90) |
| `GET` | `/purchasing/supplier-portal/:uuid/outsourcing-materials/:poId` | `PUBLIC` | - | `INVENTORY` | [src/purchasing/purchasing.controller.ts:95](../src/purchasing/purchasing.controller.ts:95) |
| `GET` | `/qc` | `PERM` | PRODUCTION:view | `PRODUCTION` | [src/qc/qc.controller.ts:21](../src/qc/qc.controller.ts:21) |
| `POST` | `/qc` | `PERM` | PRODUCTION:create | `PRODUCTION` | [src/qc/qc.controller.ts:15](../src/qc/qc.controller.ts:15) |
| `DELETE` | `/qc/:id` | `PERM` | PRODUCTION:delete | `PRODUCTION` | [src/qc/qc.controller.ts:81](../src/qc/qc.controller.ts:81) |
| `GET` | `/qc/:id` | `PERM` | PRODUCTION:view | `PRODUCTION` | [src/qc/qc.controller.ts:49](../src/qc/qc.controller.ts:49) |
| `POST` | `/qc/:id/complete` | `PERM` | PRODUCTION:create | `PRODUCTION` | [src/qc/qc.controller.ts:62](../src/qc/qc.controller.ts:62) |
| `POST` | `/qc/:id/defects` | `PERM` | PRODUCTION:create | `PRODUCTION` | [src/qc/qc.controller.ts:69](../src/qc/qc.controller.ts:69) |
| `POST` | `/qc/:id/start` | `PERM` | PRODUCTION:create | `PRODUCTION` | [src/qc/qc.controller.ts:56](../src/qc/qc.controller.ts:56) |
| `DELETE` | `/qc/defects/:defectId` | `PERM` | PRODUCTION:delete | `PRODUCTION` | [src/qc/qc.controller.ts:75](../src/qc/qc.controller.ts:75) |
| `GET` | `/qc/summary` | `PERM` | PRODUCTION:view | `PRODUCTION` | [src/qc/qc.controller.ts:37](../src/qc/qc.controller.ts:37) |
| `GET` | `/qc/supplier/:id/report` | `PERM` | PRODUCTION:view | `PRODUCTION` | [src/qc/qc.controller.ts:43](../src/qc/qc.controller.ts:43) |
| `GET` | `/rbac/mode` | `PERM` | SYSTEM:view | `CORE` | [src/auth/rbac.controller.ts:28](../src/auth/rbac.controller.ts:28) |
| `PUT` | `/rbac/mode` | `PERM` | SYSTEM:update | `CORE` | [src/auth/rbac.controller.ts:35](../src/auth/rbac.controller.ts:35) |
| `GET` | `/rbac/readiness` | `PERM` | SYSTEM:view | `CORE` | [src/auth/rbac.controller.ts:43](../src/auth/rbac.controller.ts:43) |
| `GET` | `/rbac/report` | `PERM` | SYSTEM:view | `CORE` | [src/auth/rbac.controller.ts:51](../src/auth/rbac.controller.ts:51) |
| `GET` | `/rbac/unclassified` | `PERM` | SYSTEM:view | `CORE` | [src/auth/rbac.controller.ts:63](../src/auth/rbac.controller.ts:63) |
| `GET` | `/sales` | `PERM` | SALES:view | `SALES` | [src/sales/sales.controller.ts:269](../src/sales/sales.controller.ts:269) |
| `POST` | `/sales` | `PERM` | SALES:create | `SALES` | [src/sales/sales.controller.ts:264](../src/sales/sales.controller.ts:264) |
| `GET` | `/sales/:code/payment-history` | `PERM` | SALES:view | `SALES` | [src/sales/sales.controller.ts:176](../src/sales/sales.controller.ts:176) |
| `GET` | `/sales/:code/payments` | `PERM` | SALES:view | `SALES` | [src/sales/sales.controller.ts:172](../src/sales/sales.controller.ts:172) |
| `DELETE` | `/sales/:id` | `PERM` | SALES:delete | `SALES` | [src/sales/sales.controller.ts:343](../src/sales/sales.controller.ts:343) |
| `PUT` | `/sales/:id` | `PERM` | SALES:update | `SALES` | [src/sales/sales.controller.ts:284](../src/sales/sales.controller.ts:284) |
| `GET` | `/sales/:id/activities` | `PERM` | SALES:view | `SALES` | [src/sales/sales.controller.ts:154](../src/sales/sales.controller.ts:154) |
| `POST` | `/sales/:id/approve-samples` | `PERM` | SALES:create | `SALES` | [src/sales/sales.controller.ts:313](../src/sales/sales.controller.ts:313) |
| `PUT` | `/sales/:id/bod-follow-up` | `PERM` | SALES:update | `SALES` | [src/sales/sales.controller.ts:297](../src/sales/sales.controller.ts:297) |
| `POST` | `/sales/:id/book-items` | `PERM` | SALES:create | `SALES` | [src/sales/sales.controller.ts:351](../src/sales/sales.controller.ts:351) |
| `POST` | `/sales/:id/cancel` | `PERM` | SALES:create | `SALES` | [src/sales/sales.controller.ts:321](../src/sales/sales.controller.ts:321) |
| `GET` | `/sales/:id/checklist` | `PERM` | SALES:view | `SALES` | [src/sales/sales.controller.ts:362](../src/sales/sales.controller.ts:362) |
| `DELETE` | `/sales/:id/checklist/:itemId` | `PERM` | SALES:delete | `SALES` | [src/sales/sales.controller.ts:390](../src/sales/sales.controller.ts:390) |
| `PUT` | `/sales/:id/checklist/:itemId/note` | `PERM` | SALES:update | `SALES` | [src/sales/sales.controller.ts:384](../src/sales/sales.controller.ts:384) |
| `POST` | `/sales/:id/checklist/add` | `PERM` | SALES:view | `SALES` | [src/sales/sales.controller.ts:378](../src/sales/sales.controller.ts:378) |
| `POST` | `/sales/:id/checklist/init` | `PERM` | SALES:view | `SALES` | [src/sales/sales.controller.ts:366](../src/sales/sales.controller.ts:366) |
| `POST` | `/sales/:id/checklist/sync` | `PERM` | SALES:view | `SALES` | [src/sales/sales.controller.ts:396](../src/sales/sales.controller.ts:396) |
| `POST` | `/sales/:id/checklist/toggle/:itemId` | `PERM` | SALES:view | `SALES` | [src/sales/sales.controller.ts:372](../src/sales/sales.controller.ts:372) |
| `POST` | `/sales/:id/comment` | `PERM` | SALES:create | `SALES` | [src/sales/sales.controller.ts:130](../src/sales/sales.controller.ts:130) |
| `GET` | `/sales/:id/comments` | `PERM` | SALES:view | `SALES` | [src/sales/sales.controller.ts:126](../src/sales/sales.controller.ts:126) |
| `POST` | `/sales/:id/complete` | `PERM` | SALES:create | `SALES` | [src/sales/sales.controller.ts:317](../src/sales/sales.controller.ts:317) |
| `POST` | `/sales/:id/convert` | `PERM` | SALES:create | `SALES` | [src/sales/sales.controller.ts:292](../src/sales/sales.controller.ts:292) |
| `GET` | `/sales/:id/deliveries` | `PERM` | SALES:view | `SALES` | [src/sales/sales.controller.ts:160](../src/sales/sales.controller.ts:160) |
| `POST` | `/sales/:id/delivery` | `PERM` | SALES:create | `SALES` | [src/sales/sales.controller.ts:164](../src/sales/sales.controller.ts:164) |
| `GET` | `/sales/:id/easyinvoice-pdf` | `PERM` | SALES:view | `SALES` | [src/sales/sales.controller.ts:216](../src/sales/sales.controller.ts:216) |
| `POST` | `/sales/:id/issue-vat-invoice` | `PERM` | SALES:update | `SALES` | [src/sales/sales.controller.ts:181](../src/sales/sales.controller.ts:181) |
| `POST` | `/sales/:id/revision` | `PERM` | SALES:create | `SALES` | [src/sales/sales.controller.ts:326](../src/sales/sales.controller.ts:326) |
| `GET` | `/sales/:id/revisions` | `PERM` | SALES:view | `SALES` | [src/sales/sales.controller.ts:332](../src/sales/sales.controller.ts:332) |
| `POST` | `/sales/:id/vat-invoice-email` | `PERM` | SALES:update | `SALES` | [src/sales/sales.controller.ts:202](../src/sales/sales.controller.ts:202) |
| `GET` | `/sales/:id/vat-invoice-preview` | `PERM` | SALES:view | `SALES` | [src/sales/sales.controller.ts:195](../src/sales/sales.controller.ts:195) |
| `GET` | `/sales/:id/vat-invoice-status` | `PERM` | SALES:view | `SALES` | [src/sales/sales.controller.ts:188](../src/sales/sales.controller.ts:188) |
| `DELETE` | `/sales/:id/vat-invoice/:ikey` | `PERM` | SALES:update | `SALES` | [src/sales/sales.controller.ts:209](../src/sales/sales.controller.ts:209) |
| `GET` | `/sales/:idOrCode` | `PERM` | SALES:view | `SALES` | [src/sales/sales.controller.ts:276](../src/sales/sales.controller.ts:276) |
| `GET` | `/sales/analytics` | `PERM` | SALES:view | `SALES` | [src/sales/sales.controller.ts:54](../src/sales/sales.controller.ts:54) |
| `POST` | `/sales/analytics/push-reminder` | `PERM` | SALES:view | `SALES` | [src/sales/sales.controller.ts:66](../src/sales/sales.controller.ts:66) |
| `DELETE` | `/sales/comment/:id` | `PERM` | SALES:delete | `SALES` | [src/sales/sales.controller.ts:148](../src/sales/sales.controller.ts:148) |
| `PUT` | `/sales/comment/:id` | `PERM` | SALES:update | `SALES` | [src/sales/sales.controller.ts:136](../src/sales/sales.controller.ts:136) |
| `POST` | `/sales/comment/:id/toggle` | `PERM` | SALES:create | `SALES` | [src/sales/sales.controller.ts:142](../src/sales/sales.controller.ts:142) |
| `DELETE` | `/sales/delivery/:deliveryId` | `PERM` | SALES:delete | `SALES` | [src/sales/sales.controller.ts:336](../src/sales/sales.controller.ts:336) |
| `PUT` | `/sales/delivery/:deliveryId` | `PERM` | SALES:update | `SALES` | [src/sales/sales.controller.ts:168](../src/sales/sales.controller.ts:168) |
| `GET` | `/sales/portal/:uuid` | `PERM` | SALES:view | `SALES` | [src/sales/sales.controller.ts:249](../src/sales/sales.controller.ts:249) |
| `POST` | `/sales/portal/:uuid/action` | `PERM` | SALES:update | `SALES` | [src/sales/sales.controller.ts:251](../src/sales/sales.controller.ts:251) |
| `GET` | `/sales/price-lists` | `PERM` | SALES:view | `SALES` | [src/sales/sales.controller.ts:29](../src/sales/sales.controller.ts:29) |
| `POST` | `/sales/price-lists` | `PERM` | SALES:create | `SALES` | [src/sales/sales.controller.ts:24](../src/sales/sales.controller.ts:24) |
| `GET` | `/sales/price-lists/:id/rules` | `PERM` | SALES:view | `SALES` | [src/sales/sales.controller.ts:39](../src/sales/sales.controller.ts:39) |
| `POST` | `/sales/price-lists/:id/rules` | `PERM` | SALES:create | `SALES` | [src/sales/sales.controller.ts:34](../src/sales/sales.controller.ts:34) |
| `GET` | `/sales/promotions` | `PERM` | SALES:view | `SALES` | [src/sales/sales.controller.ts:89](../src/sales/sales.controller.ts:89) |
| `POST` | `/sales/promotions` | `PERM` | SALES:create | `SALES` | [src/sales/sales.controller.ts:103](../src/sales/sales.controller.ts:103) |
| `DELETE` | `/sales/promotions/:id` | `PERM` | SALES:delete | `SALES` | [src/sales/sales.controller.ts:115](../src/sales/sales.controller.ts:115) |
| `PUT` | `/sales/promotions/:id` | `PERM` | SALES:update | `SALES` | [src/sales/sales.controller.ts:108](../src/sales/sales.controller.ts:108) |
| `GET` | `/sales/promotions/active` | `PERM` | SALES:view | `SALES` | [src/sales/sales.controller.ts:93](../src/sales/sales.controller.ts:93) |
| `GET` | `/sales/promotions/for-customer/:customerId` | `PERM` | SALES:view | `SALES` | [src/sales/sales.controller.ts:97](../src/sales/sales.controller.ts:97) |
| `DELETE` | `/sales/quote/:id` | `PERM` | SALES:delete | `SALES` | [src/sales/sales.controller.ts:307](../src/sales/sales.controller.ts:307) |
| `PUT` | `/sales/quote/:id` | `PERM` | SALES:update | `SALES` | [src/sales/sales.controller.ts:303](../src/sales/sales.controller.ts:303) |
| `GET` | `/sales/samples/all` | `PERM` | SALES:view | `SALES` | [src/sales/sales.controller.ts:49](../src/sales/sales.controller.ts:49) |
| `GET` | `/sales/targets` | `PERM` | SALES:view | `SALES` | [src/sales/sales.controller.ts:74](../src/sales/sales.controller.ts:74) |
| `POST` | `/sales/targets` | `PERM` | SALES:update | `SALES` | [src/sales/sales.controller.ts:81](../src/sales/sales.controller.ts:81) |
| `GET` | `/sales/validate-price` | `PERM` | SALES:view | `SALES` | [src/sales/sales.controller.ts:43](../src/sales/sales.controller.ts:43) |
| `GET` | `/shipping/config` | `PERM` | SYSTEM:view | `INVENTORY` | [src/shipping/shipping.controller.ts:233](../src/shipping/shipping.controller.ts:233) |
| `POST` | `/shipping/config` | `PERM` | SYSTEM:create | `INVENTORY` | [src/shipping/shipping.controller.ts:249](../src/shipping/shipping.controller.ts:249) |
| `GET` | `/shipping/deliveries` | `PERM` | SALES:view | INVENTORY:view | `INVENTORY` | [src/shipping/shipping.controller.ts:35](../src/shipping/shipping.controller.ts:35) |
| `POST` | `/shipping/delivery/:deliveryId/cancel-ghtk` | `PERM` | SALES:create | INVENTORY:create | `INVENTORY` | [src/shipping/shipping.controller.ts:288](../src/shipping/shipping.controller.ts:288) |
| `POST` | `/shipping/delivery/:deliveryId/cancel-lalamove` | `PERM` | SALES:create | INVENTORY:create | `INVENTORY` | [src/shipping/shipping.controller.ts:503](../src/shipping/shipping.controller.ts:503) |
| `POST` | `/shipping/delivery/:deliveryId/create-expense` | `PERM` | SALES:create | INVENTORY:create | `INVENTORY` | [src/shipping/shipping.controller.ts:467](../src/shipping/shipping.controller.ts:467) |
| `GET` | `/shipping/delivery/:deliveryId/label` | `PERM` | SALES:view | INVENTORY:view | `INVENTORY` | [src/shipping/shipping.controller.ts:300](../src/shipping/shipping.controller.ts:300) |
| `GET` | `/shipping/delivery/:deliveryId/label-pdf` | `PERM` | SALES:view | INVENTORY:view | `INVENTORY` | [src/shipping/shipping.controller.ts:332](../src/shipping/shipping.controller.ts:332) |
| `GET` | `/shipping/delivery/:deliveryId/lalamove-driver/:driverId` | `PERM` | SALES:view | INVENTORY:view | `INVENTORY` | [src/shipping/shipping.controller.ts:485](../src/shipping/shipping.controller.ts:485) |
| `GET` | `/shipping/delivery/:deliveryId/lalamove-order/:orderId` | `PERM` | SALES:view | INVENTORY:view | `INVENTORY` | [src/shipping/shipping.controller.ts:476](../src/shipping/shipping.controller.ts:476) |
| `POST` | `/shipping/delivery/:deliveryId/lalamove-priority-fee` | `PERM` | SALES:create | INVENTORY:create | `INVENTORY` | [src/shipping/shipping.controller.ts:494](../src/shipping/shipping.controller.ts:494) |
| `GET` | `/shipping/delivery/:deliveryId/print-label` | `PERM` | SALES:view | INVENTORY:view | `INVENTORY` | [src/shipping/shipping.controller.ts:322](../src/shipping/shipping.controller.ts:322) |
| `POST` | `/shipping/delivery/:deliveryId/push-ghtk` | `PERM` | SALES:create | INVENTORY:create | `INVENTORY` | [src/shipping/shipping.controller.ts:279](../src/shipping/shipping.controller.ts:279) |
| `POST` | `/shipping/delivery/:deliveryId/push-lalamove` | `PERM` | SALES:create | INVENTORY:create | `INVENTORY` | [src/shipping/shipping.controller.ts:427](../src/shipping/shipping.controller.ts:427) |
| `POST` | `/shipping/delivery/:deliveryId/sync-carrier` | `PERM` | SALES:create | INVENTORY:create | `INVENTORY` | [src/shipping/shipping.controller.ts:442](../src/shipping/shipping.controller.ts:442) |
| `POST` | `/shipping/delivery/:deliveryId/sync-lalamove` | `PERM` | SALES:create | INVENTORY:create | `INVENTORY` | [src/shipping/shipping.controller.ts:436](../src/shipping/shipping.controller.ts:436) |
| `GET` | `/shipping/delivery/:deliveryId/tracking` | `PERM` | SALES:view | INVENTORY:view | `INVENTORY` | [src/shipping/shipping.controller.ts:294](../src/shipping/shipping.controller.ts:294) |
| `POST` | `/shipping/ghtk/estimate-fee` | `PERM` | SALES:view | INVENTORY:view | `INVENTORY` | [src/shipping/shipping.controller.ts:273](../src/shipping/shipping.controller.ts:273) |
| `POST` | `/shipping/ghtk/parse-address` | `PERM` | SALES:view | INVENTORY:view | `INVENTORY` | [src/shipping/shipping.controller.ts:261](../src/shipping/shipping.controller.ts:261) |
| `GET` | `/shipping/ghtk/pick-addresses` | `PERM` | SALES:view | INVENTORY:view | `INVENTORY` | [src/shipping/shipping.controller.ts:267](../src/shipping/shipping.controller.ts:267) |
| `GET` | `/shipping/lalamove/config` | `PERM` | SYSTEM:view | `INVENTORY` | [src/shipping/shipping.controller.ts:369](../src/shipping/shipping.controller.ts:369) |
| `POST` | `/shipping/lalamove/config` | `PERM` | SYSTEM:create | `INVENTORY` | [src/shipping/shipping.controller.ts:391](../src/shipping/shipping.controller.ts:391) |
| `POST` | `/shipping/lalamove/estimate-fee` | `PERM` | SALES:view | INVENTORY:view | `INVENTORY` | [src/shipping/shipping.controller.ts:421](../src/shipping/shipping.controller.ts:421) |
| `POST` | `/shipping/lalamove/geocode` | `PERM` | SALES:view | INVENTORY:view | `INVENTORY` | [src/shipping/shipping.controller.ts:409](../src/shipping/shipping.controller.ts:409) |
| `POST` | `/shipping/lalamove/quotation` | `PERM` | SALES:view | INVENTORY:view | `INVENTORY` | [src/shipping/shipping.controller.ts:415](../src/shipping/shipping.controller.ts:415) |
| `POST` | `/shipping/lalamove/test-connection` | `PERM` | SYSTEM:view | `INVENTORY` | [src/shipping/shipping.controller.ts:397](../src/shipping/shipping.controller.ts:397) |
| `GET` | `/shipping/lalamove/vehicles` | `PERM` | SALES:view | INVENTORY:view | `INVENTORY` | [src/shipping/shipping.controller.ts:403](../src/shipping/shipping.controller.ts:403) |
| `POST` | `/shipping/test-connection` | `PERM` | SYSTEM:view | `INVENTORY` | [src/shipping/shipping.controller.ts:255](../src/shipping/shipping.controller.ts:255) |
| `POST` | `/shipping/webhook/ghtk` | `PUBLIC` | - | `INVENTORY` | [src/shipping/shipping.controller.ts:358](../src/shipping/shipping.controller.ts:358) |
| `GET` | `/shipping/webhook/lalamove` | `PUBLIC` | - | `INVENTORY` | [src/shipping/shipping.controller.ts:509](../src/shipping/shipping.controller.ts:509) |
| `POST` | `/shipping/webhook/lalamove` | `PUBLIC` | - | `INVENTORY` | [src/shipping/shipping.controller.ts:516](../src/shipping/shipping.controller.ts:516) |
| `GET` | `/suppliers` | `PERM` | INVENTORY:view | PURCHASE:view | `CORE` | [src/suppliers/suppliers.controller.ts:24](../src/suppliers/suppliers.controller.ts:24) |
| `POST` | `/suppliers` | `PERM` | INVENTORY:create | PURCHASE:create | `CORE` | [src/suppliers/suppliers.controller.ts:18](../src/suppliers/suppliers.controller.ts:18) |
| `DELETE` | `/suppliers/:id` | `PERM` | INVENTORY:delete | PURCHASE:delete | `CORE` | [src/suppliers/suppliers.controller.ts:50](../src/suppliers/suppliers.controller.ts:50) |
| `GET` | `/suppliers/:id` | `PERM` | INVENTORY:view | PURCHASE:view | `CORE` | [src/suppliers/suppliers.controller.ts:30](../src/suppliers/suppliers.controller.ts:30) |
| `PUT` | `/suppliers/:id` | `PERM` | INVENTORY:update | PURCHASE:update | `CORE` | [src/suppliers/suppliers.controller.ts:44](../src/suppliers/suppliers.controller.ts:44) |
| `POST` | `/suppliers/:id/material-price` | `PERM` | INVENTORY:create | PURCHASE:create | `CORE` | [src/suppliers/suppliers.controller.ts:58](../src/suppliers/suppliers.controller.ts:58) |
| `GET` | `/suppliers/:id/transactions` | `PERM` | INVENTORY:view | PURCHASE:view | `CORE` | [src/suppliers/suppliers.controller.ts:37](../src/suppliers/suppliers.controller.ts:37) |
| `POST` | `/suppliers/check-price` | `PERM` | INVENTORY:view | PURCHASE:view | `CORE` | [src/suppliers/suppliers.controller.ts:77](../src/suppliers/suppliers.controller.ts:77) |
| `DELETE` | `/suppliers/material-price/:id` | `PERM` | INVENTORY:delete | PURCHASE:delete | `CORE` | [src/suppliers/suppliers.controller.ts:64](../src/suppliers/suppliers.controller.ts:64) |
| `POST` | `/suppliers/price` | `PERM` | INVENTORY:create | PURCHASE:create | `CORE` | [src/suppliers/suppliers.controller.ts:71](../src/suppliers/suppliers.controller.ts:71) |
| `GET` | `/system/about-config` | `PERM` | CMS:view | `CORE` | [src/system/system.controller.ts:146](../src/system/system.controller.ts:146) |
| `POST` | `/system/about-config` | `PERM` | CMS:create | `CORE` | [src/system/system.controller.ts:150](../src/system/system.controller.ts:150) |
| `GET` | `/system/api-tokens` | `PERM` | USERS:view | `CORE` | [src/system/system.controller.ts:73](../src/system/system.controller.ts:73) |
| `POST` | `/system/api-tokens` | `PERM` | USERS:create | `CORE` | [src/system/system.controller.ts:81](../src/system/system.controller.ts:81) |
| `DELETE` | `/system/api-tokens/:id` | `PERM` | USERS:delete | `CORE` | [src/system/system.controller.ts:89](../src/system/system.controller.ts:89) |
| `GET` | `/system/company` | `PUBLIC` | - | `CORE` | [src/system/system.controller.ts:32](../src/system/system.controller.ts:32) |
| `POST` | `/system/company` | `PERM` | SYSTEM:create | `CORE` | [src/system/system.controller.ts:38](../src/system/system.controller.ts:38) |
| `POST` | `/system/config` | `PERM` | SYSTEM:update | `CORE` | [src/system/system.controller.ts:104](../src/system/system.controller.ts:104) |
| `GET` | `/system/config/:key` | `PUBLIC` | - | `CORE` | [src/system/system.controller.ts:97](../src/system/system.controller.ts:97) |
| `GET` | `/system/dashboard/stats` | `PERM` | DASHBOARD:view | `CORE` | [src/system/dashboard.controller.ts:21](../src/system/dashboard.controller.ts:21) |
| `GET` | `/system/easyinvoice` | `PERM` | SYSTEM:view | `CORE` | [src/system/system.controller.ts:51](../src/system/system.controller.ts:51) |
| `POST` | `/system/easyinvoice` | `PERM` | SYSTEM:create | `CORE` | [src/system/system.controller.ts:57](../src/system/system.controller.ts:57) |
| `GET` | `/system/email-templates` | `PERM` | SYSTEM:view | `CORE` | [src/system/system.controller.ts:124](../src/system/system.controller.ts:124) |
| `POST` | `/system/email-templates` | `PERM` | SYSTEM:create | `CORE` | [src/system/system.controller.ts:128](../src/system/system.controller.ts:128) |
| `DELETE` | `/system/email-templates/:id` | `PERM` | SYSTEM:delete | `CORE` | [src/system/system.controller.ts:132](../src/system/system.controller.ts:132) |
| `GET` | `/system/home-config` | `PERM` | CMS:view | `CORE` | [src/system/system.controller.ts:137](../src/system/system.controller.ts:137) |
| `POST` | `/system/home-config` | `PERM` | CMS:create | `CORE` | [src/system/system.controller.ts:141](../src/system/system.controller.ts:141) |
| `GET` | `/system/logs` | `PERM` | USERS:view | `CORE` | [src/system/system.controller.ts:63](../src/system/system.controller.ts:63) |
| `GET` | `/system/seller-info` | `AUTH` | AUTH | `CORE` | [src/system/system.controller.ts:44](../src/system/system.controller.ts:44) |
| `GET` | `/system/smtp` | `PERM` | SYSTEM:view | `CORE` | [src/system/system.controller.ts:14](../src/system/system.controller.ts:14) |
| `POST` | `/system/smtp` | `PERM` | SYSTEM:create | `CORE` | [src/system/system.controller.ts:20](../src/system/system.controller.ts:20) |
| `POST` | `/system/smtp/test` | `PERM` | SYSTEM:create | `CORE` | [src/system/system.controller.ts:26](../src/system/system.controller.ts:26) |
| `GET` | `/system/so-project-template` | `PERM` | SYSTEM:view | `CORE` | [src/system/system.controller.ts:155](../src/system/system.controller.ts:155) |
| `POST` | `/system/so-project-template` | `PERM` | SYSTEM:create | `CORE` | [src/system/system.controller.ts:159](../src/system/system.controller.ts:159) |
| `GET` | `/system/subscription` | `AUTH` | AUTH | `CORE` | [src/system/system-subscription.controller.ts:36](../src/system/system-subscription.controller.ts:36) |
| `GET` | `/system/templates` | `PERM` | SYSTEM:view | SALES:view | `CORE` | [src/system/system.controller.ts:111](../src/system/system.controller.ts:111) |
| `POST` | `/system/templates` | `PERM` | SYSTEM:create | `CORE` | [src/system/system.controller.ts:115](../src/system/system.controller.ts:115) |
| `DELETE` | `/system/templates/:id` | `PERM` | SYSTEM:delete | `CORE` | [src/system/system.controller.ts:119](../src/system/system.controller.ts:119) |
| `GET` | `/tasks` | `AUTH` | AUTH | `CORE` | [src/tasks/tasks.controller.ts:24](../src/tasks/tasks.controller.ts:24) |
| `POST` | `/tasks` | `AUTH` | AUTH | `CORE` | [src/tasks/tasks.controller.ts:42](../src/tasks/tasks.controller.ts:42) |
| `DELETE` | `/tasks/:id` | `AUTH` | AUTH | `CORE` | [src/tasks/tasks.controller.ts:54](../src/tasks/tasks.controller.ts:54) |
| `PUT` | `/tasks/:id` | `AUTH` | AUTH | `CORE` | [src/tasks/tasks.controller.ts:48](../src/tasks/tasks.controller.ts:48) |
| `GET` | `/tasks/:id/logs` | `AUTH` | AUTH | `CORE` | [src/tasks/tasks.controller.ts:72](../src/tasks/tasks.controller.ts:72) |
| `POST` | `/tasks/:id/start-timer` | `AUTH` | AUTH | `CORE` | [src/tasks/tasks.controller.ts:60](../src/tasks/tasks.controller.ts:60) |
| `POST` | `/tasks/:id/stop-timer` | `AUTH` | AUTH | `CORE` | [src/tasks/tasks.controller.ts:66](../src/tasks/tasks.controller.ts:66) |
| `GET` | `/test` | `PUBLIC` | - | `CORE` | [src/app.controller.ts:16](../src/app.controller.ts:16) |
| `POST` | `/upload/boms` | `PERM` | INVENTORY:create | PRODUCT:create | `CORE` | [src/upload/upload.controller.ts:162](../src/upload/upload.controller.ts:162) |
| `POST` | `/upload/combos` | `PERM` | PRODUCT:create | `CORE` | [src/upload/upload.controller.ts:170](../src/upload/upload.controller.ts:170) |
| `POST` | `/upload/customers` | `PERM` | SALES:create | `CORE` | [src/upload/upload.controller.ts:179](../src/upload/upload.controller.ts:179) |
| `POST` | `/upload/file` | `AUTH` | AUTH | `CORE` | [src/upload/upload.controller.ts:206](../src/upload/upload.controller.ts:206) |
| `DELETE` | `/upload/files/:filename` | `PERM` | CMS:delete | `CORE` | [src/upload/upload.controller.ts:307](../src/upload/upload.controller.ts:307) |
| `GET` | `/upload/files/:filename` | `PUBLIC` | - | `CORE` | [src/upload/upload.controller.ts:301](../src/upload/upload.controller.ts:301) |
| `GET` | `/upload/files/b2b/:filename` | `PUBLIC` | - | `CORE` | [src/upload/upload.controller.ts:268](../src/upload/upload.controller.ts:268) |
| `GET` | `/upload/files/original/:filename` | `PUBLIC` | - | `CORE` | [src/upload/upload.controller.ts:262](../src/upload/upload.controller.ts:262) |
| `POST` | `/upload/image` | `AUTH` | AUTH | `CORE` | [src/upload/upload.controller.ts:136](../src/upload/upload.controller.ts:136) |
| `GET` | `/upload/list` | `PERM` | CMS:view | `CORE` | [src/upload/upload.controller.ts:26](../src/upload/upload.controller.ts:26) |
| `POST` | `/upload/materials` | `PERM` | INVENTORY:create | PRODUCT:create | `CORE` | [src/upload/upload.controller.ts:125](../src/upload/upload.controller.ts:125) |
| `POST` | `/upload/products` | `PERM` | PRODUCT:create | `CORE` | [src/upload/upload.controller.ts:144](../src/upload/upload.controller.ts:144) |
| `POST` | `/upload/sales` | `PERM` | SALES:create | `CORE` | [src/upload/upload.controller.ts:197](../src/upload/upload.controller.ts:197) |
| `POST` | `/upload/suppliers` | `PERM` | INVENTORY:create | `CORE` | [src/upload/upload.controller.ts:188](../src/upload/upload.controller.ts:188) |
| `GET` | `/upload/template/:type` | `AUTH` | AUTH | `CORE` | [src/upload/upload.controller.ts:274](../src/upload/upload.controller.ts:274) |
| `GET` | `/upload/usage` | `PERM` | CMS:view | `CORE` | [src/upload/upload.controller.ts:33](../src/upload/upload.controller.ts:33) |
| `GET` | `/upload/watermark/b2b/config` | `PUBLIC` | - | `CORE` | [src/upload/upload.controller.ts:244](../src/upload/upload.controller.ts:244) |
| `POST` | `/upload/watermark/b2b/config` | `PERM` | CMS:create | `CORE` | [src/upload/upload.controller.ts:250](../src/upload/upload.controller.ts:250) |
| `POST` | `/upload/watermark/b2b/image` | `PERM` | CMS:create | `CORE` | [src/upload/upload.controller.ts:236](../src/upload/upload.controller.ts:236) |
| `GET` | `/upload/watermark/config` | `PERM` | CMS:view | `CORE` | [src/upload/upload.controller.ts:223](../src/upload/upload.controller.ts:223) |
| `POST` | `/upload/watermark/config` | `PERM` | CMS:create | `CORE` | [src/upload/upload.controller.ts:229](../src/upload/upload.controller.ts:229) |
| `POST` | `/upload/watermark/image` | `PERM` | CMS:create | `CORE` | [src/upload/upload.controller.ts:215](../src/upload/upload.controller.ts:215) |
| `POST` | `/upload/watermark/regenerate` | `PERM` | CMS:create | `CORE` | [src/upload/upload.controller.ts:256](../src/upload/upload.controller.ts:256) |
| `GET` | `/users` | `AUTH` | AUTH | `CORE` | [src/users/users.controller.ts:37](../src/users/users.controller.ts:37) |
| `POST` | `/users` | `PERM` | USERS:create | `CORE` | [src/users/users.controller.ts:69](../src/users/users.controller.ts:69) |
| `DELETE` | `/users/:id` | `PERM` | USERS:delete | `CORE` | [src/users/users.controller.ts:83](../src/users/users.controller.ts:83) |
| `PUT` | `/users/:id` | `PERM` | USERS:update | `CORE` | [src/users/users.controller.ts:76](../src/users/users.controller.ts:76) |
| `POST` | `/users/:id/change-password` | `AUTH` | AUTH | `CORE` | [src/users/users.controller.ts:90](../src/users/users.controller.ts:90) |
| `GET` | `/users/groups` | `PERM` | USERS:view | `CORE` | [src/users/users.controller.ts:102](../src/users/users.controller.ts:102) |
| `POST` | `/users/groups` | `PERM` | USERS:create | `CORE` | [src/users/users.controller.ts:116](../src/users/users.controller.ts:116) |
| `GET` | `/users/groups/:id` | `PERM` | USERS:view | `CORE` | [src/users/users.controller.ts:109](../src/users/users.controller.ts:109) |
| `POST` | `/users/groups/:id/permissions` | `PERM` | USERS:create | `CORE` | [src/users/users.controller.ts:124](../src/users/users.controller.ts:124) |
| `POST` | `/users/groups/:id/update` | `PERM` | USERS:create | `CORE` | [src/users/users.controller.ts:137](../src/users/users.controller.ts:137) |
| `GET` | `/users/online` | `AUTH` | AUTH | `CORE` | [src/users/users.controller.ts:54](../src/users/users.controller.ts:54) |
