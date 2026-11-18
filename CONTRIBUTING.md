# Contributing to ERP4U

Thank you for your interest in contributing to **ERP4U**! We are committed to building an open, transparent, and collaborative manufacturing ERP ecosystem.

---

## 🚀 Independent Development & Workflow

Từ tháng 11/2026, **ERP4U** phát triển hoàn toàn độc lập (đã ngưng cơ chế đồng bộ tự động từ upstream). Mọi đóng góp mã nguồn, tính năng mới hoặc bản sửa lỗi đều được thực hiện trực tiếp trên repository này thông qua Pull Request vào nhánh `main` và bắt buộc trải qua quy trình review nghiêm ngặt trước khi merge.

---

## 🤝 How to Contribute

### 1. Reporting Bugs
- Check the [Issues tracker](https://github.com/residoken-wq/erp4u-demo/issues) first to see if the issue is already reported.
- If not, open a new issue using our **Bug Report Template**.
- Include clear reproduction steps, environment details (Node version, OS, Docker), and error logs.

### 2. Suggesting Enhancements
- Open a feature request issue using the **Feature Request Template**.
- Explain the business context and use case for the manufacturing/ERP workflow.

### 3. Submitting Code (Pull Requests)
1. Fork the repository and create your branch from `main`.
2. Follow the standard branching naming convention:
   - `feat/feature-name`
   - `fix/bug-description`
   - `docs/update-description`
3. Ensure all TypeScript types compile without errors (`npm run build` or `npx tsc --noEmit`).
4. Ensure code formatting is clean (`npm run format`).
5. Open a Pull Request with a clear title and description referencing the relevant issue.

---

## 📐 Coding Guidelines

- **Architecture**: Modular NestJS architecture for backend, feature-based folders for frontend.
- **Data Security**: Always use `EncryptionTransformer` for any new PII or sensitive business fields.
- **SQL & TypeORM**: Use TypeORM QueryBuilder or Repositories with parameterized queries to prevent SQL injection.
- **Commits**: Follow Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).

---

## ✍️ Contributor License Agreement (CLA)

ERP4U hoạt động theo mô hình **open-core**: phần core mã nguồn mở được phát hành theo giấy phép AGPLv3, trong khi các phiên bản thương mại (như ERP4U Cloud / Enterprise) tích hợp thêm các tính năng chuyên sâu.

Để bảo đảm quyền phân phối và phát hành hợp pháp cho cả cộng đồng mã nguồn mở và khách hàng thương mại, tất cả những người đóng góp (contributors) cần ký **Thỏa thuận Cấp phép Người đóng góp (CLA)** trước khi Pull Request được sáp nhập:

- **Văn bản thỏa thuận:** Xem toàn văn tại [CLA.md](CLA.md) (bản dịch tham khảo tại [docs/CLA.vi.md](docs/CLA.vi.md)).
- **Cách ký CLA:** Khi bạn mở một Pull Request, bot CLA Assistant sẽ tự động kiểm tra. Nếu bạn chưa ký, bot sẽ để lại hướng dẫn. Bạn chỉ cần phản hồi một bình luận (comment) ngay trên PR với nội dung chính xác:
  ```
  I have read the CLA Document and I hereby sign the CLA
  ```
- **Tần suất ký:** Bạn **chỉ cần ký một lần duy nhất** cho toàn bộ các đóng góp từ tài khoản GitHub của bạn trên kho lưu trữ này.

---

## 📜 Code of Conduct

All contributors are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md).
