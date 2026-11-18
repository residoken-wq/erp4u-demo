# Security Policy

## 🔒 Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

---

## 🛡️ Data Encryption & Privacy Protection

ERP4U takes enterprise security and privacy seriously:

- **Column-Level PII Encryption**: Sensitive database fields (customer contacts, supplier contacts, phone numbers, tax codes, employee salaries, and addresses) are encrypted at rest using **AES-256-GCM**.
- **Key Management**: Keys must be 32 bytes (256 bits) passed securely through the `ENCRYPTION_KEY` environment variable. Never commit encryption keys to source control.
- **SQL Injection Prevention**: All queries use parameterized inputs via TypeORM.

---

## 🚨 Reporting a Vulnerability

If you discover a security vulnerability within ERP4U, please **do not open a public GitHub issue**. Instead, follow responsible disclosure:

1. Send an email to **security@erp4u.demo** (or contact the maintainers privately).
2. Include a detailed description of the vulnerability, reproduction steps, and potential impact.
3. Our team will acknowledge receipt within 48 hours and provide an estimated timeline for a fix.

Thank you for helping keep ERP4U and its users safe!
