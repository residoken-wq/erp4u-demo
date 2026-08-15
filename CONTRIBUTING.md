# Contributing to ERP4U

Thank you for your interest in contributing to **ERP4U**! We are committed to building an open, transparent, and collaborative manufacturing ERP ecosystem.

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

## 📜 Code of Conduct

All contributors are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md).
