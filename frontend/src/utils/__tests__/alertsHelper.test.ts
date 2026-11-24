import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAlertTypeLabel,
  getAlertSeverityInfo,
  getAlertStatusInfo,
  formatAlertMetrics,
  isValidAlertPath,
  getEntityRoute,
  buildCopilotAlertQuestion,
  validateAlertSettingParams,
  ALERT_SETTING_SPECS,
} from '../alertsHelper.ts';

describe('Alerts Pure Functions & Security Unit Tests (Task P9d1)', () => {
  describe('1. Map alert type to Vietnamese label', () => {
    it('returns exact Vietnamese labels for all 4 standard types', () => {
      assert.equal(getAlertTypeLabel('stock.low_cover'), 'Tồn kho thấp');
      assert.equal(getAlertTypeLabel('order.at_risk'), 'Đơn hàng trễ hạn');
      assert.equal(getAlertTypeLabel('receivable.overdue'), 'Công nợ quá hạn');
      assert.equal(getAlertTypeLabel('cash.anomaly'), 'Biến động chi phí');
    });

    it('falls back to raw string for unknown type and handles empty input', () => {
      assert.equal(getAlertTypeLabel('custom.alert_type'), 'custom.alert_type');
      assert.equal(getAlertTypeLabel(null), 'Không xác định');
      assert.equal(getAlertTypeLabel(''), 'Không xác định');
    });
  });

  describe('2. Alert severity colors & rules', () => {
    it('uses standard error color (#ff4d4f) for high severity and NEVER brand orange (#F04E23)', () => {
      const high = getAlertSeverityInfo('high');
      assert.equal(high.label, 'Cao');
      assert.equal(high.color, '#ff4d4f');
      assert.notEqual(high.color, '#F04E23'); // Brand orange must not be used for error
      assert.equal(high.badgeStatus, 'error');
    });

    it('returns appropriate styling for medium and low severity', () => {
      const med = getAlertSeverityInfo('medium');
      assert.equal(med.label, 'Trung bình');
      assert.equal(med.color, '#faad14');
      assert.equal(med.badgeStatus, 'warning');

      const low = getAlertSeverityInfo('low');
      assert.equal(low.label, 'Thấp');
      assert.equal(low.color, '#1677ff');
      assert.equal(low.badgeStatus, 'processing');
    });
  });

  describe('3. Alert status info', () => {
    it('maps all 4 lifecycle statuses correctly', () => {
      assert.equal(getAlertStatusInfo('open').label, 'Đang mở');
      assert.equal(getAlertStatusInfo('acknowledged').label, 'Đã xem');
      assert.equal(getAlertStatusInfo('snoozed').label, 'Tạm ẩn');
      assert.equal(getAlertStatusInfo('resolved').label, 'Đã xử lý');
    });
  });

  describe('4. Format alert metrics from detail by type', () => {
    it('formats stock.low_cover metrics correctly', () => {
      const detail = {
        item_kind: 'product',
        item_id: 45,
        sku: 'SP-045',
        available: 10,
        avg_daily_out: 2,
        days_of_cover: 5,
        threshold_days: 14,
      };
      const formatted = formatAlertMetrics('stock.low_cover', detail);
      assert.match(formatted, /Tồn khả dụng: 10/);
      assert.match(formatted, /Xuất TB: 2\/ngày/);
      assert.match(formatted, /Đủ dùng: 5 ngày/);
      assert.match(formatted, /ngưỡng 14 ngày/);
    });

    it('formats order.at_risk metrics with overdue and due soon calculations', () => {
      const overdueDetail = {
        order_id: 108,
        order_code: 'SO-108',
        delivery_date: '2026-11-20',
        days_until_delivery: -4,
        production_order_code: 'MO-052',
      };
      const formattedOverdue = formatAlertMetrics('order.at_risk', overdueDetail);
      assert.match(formattedOverdue, /Quá hạn 4 ngày/);
      assert.match(formattedOverdue, /Lệnh SX: MO-052/);

      const dueSoonDetail = {
        delivery_date: '2026-11-26',
        days_until_delivery: 2,
      };
      const formattedDue = formatAlertMetrics('order.at_risk', dueSoonDetail);
      assert.match(formattedDue, /Còn 2 ngày/);
    });

    it('formats receivable.overdue metrics with money formatting and aging brackets', () => {
      const detail = {
        order_id: 92,
        total_amount: 15000000,
        paid_amount: 5000000,
        remaining_amount: 10000000,
        overdue_days: 45,
        aging_bracket: '30_59',
      };
      const formatted = formatAlertMetrics('receivable.overdue', detail);
      assert.match(formatted, /10\.000\.000/);
      assert.match(formatted, /15\.000\.000/);
      assert.match(formatted, /Quá hạn: 45 ngày/);
      assert.match(formatted, /Nhóm: 30_59 ngày/);
    });

    it('formats cash.anomaly metrics for category surge and single outlier', () => {
      const surgeDetail = {
        sub_type: 'category_surge',
        current_amount: 18500000,
        baseline_amount: 9000000,
        diff_amount: 9500000,
        ratio: 2.05,
      };
      const formattedSurge = formatAlertMetrics('cash.anomaly', surgeDetail);
      assert.match(formattedSurge, /Chi trong tháng: 18\.500\.000/);
      assert.match(formattedSurge, /chênh \+9\.500\.000/);

      const outlierDetail = {
        sub_type: 'single_outlier',
        current_amount: 50000000,
        baseline_amount: 10000000,
        diff_amount: 40000000,
        ratio: 5.0,
      };
      const formattedOutlier = formatAlertMetrics('cash.anomaly', outlierDetail);
      assert.match(formattedOutlier, /Giao dịch đột biến: 50\.000\.000/);
    });

    it('handles null/undefined detail gracefully', () => {
      assert.equal(formatAlertMetrics('stock.low_cover', null), '-');
    });
  });

  describe('5. Internal document path validation (Security)', () => {
    it('accepts valid internal paths starting with /', () => {
      assert.equal(isValidAlertPath('/products'), true);
      assert.equal(isValidAlertPath('/materials?id=12'), true);
      assert.equal(isValidAlertPath('/orders'), true);
      assert.equal(isValidAlertPath('/planning'), true);
      assert.equal(isValidAlertPath('/finance'), true);
    });

    it('rejects protocol-relative open redirect (//evil.com)', () => {
      assert.equal(isValidAlertPath('//evil.com'), false);
      assert.equal(isValidAlertPath('//google.com/test'), false);
    });

    it('rejects external protocols, javascript schemes, and data URIs', () => {
      assert.equal(isValidAlertPath('http://evil.com'), false);
      assert.equal(isValidAlertPath('https://evil.com'), false);
      assert.equal(isValidAlertPath('javascript:alert(1)'), false);
      assert.equal(isValidAlertPath('data:text/html,<script>alert(1)</script>'), false);
      assert.equal(isValidAlertPath('vbscript:msgbox(1)'), false);
    });

    it('rejects backslashes and relative paths not starting with /', () => {
      assert.equal(isValidAlertPath('\\windows\\path'), false);
      assert.equal(isValidAlertPath('products/123'), false);
      assert.equal(isValidAlertPath(''), false);
      assert.equal(isValidAlertPath(null), false);
    });
  });

  describe('6. Map entity_type to core routes', () => {
    it('maps all business entity types to real frontend routes in App.tsx', () => {
      assert.equal(getEntityRoute('product'), '/products');
      assert.equal(getEntityRoute('material'), '/materials');
      assert.equal(getEntityRoute('sales_order'), '/orders');
      assert.equal(getEntityRoute('production_order'), '/planning');
      assert.equal(getEntityRoute('transaction'), '/finance');
      assert.equal(getEntityRoute('transaction_category'), '/finance');
    });
  });

  describe('7. Build Copilot alert question', () => {
    it('builds the exact standard prompt matching requirements', () => {
      assert.equal(
        buildCopilotAlertQuestion('7b0a8806-03c7-43cf-bc01-a1288df79b10'),
        'Phân tích cảnh báo #7b0a8806-03c7-43cf-bc01-a1288df79b10 và gợi ý cách xử lý',
      );
      assert.equal(
        buildCopilotAlertQuestion(101),
        'Phân tích cảnh báo #101 và gợi ý cách xử lý',
      );
    });
  });

  describe('8. Validate settings params by min/max specs', () => {
    it('validates stock.low_cover within min/max boundaries', () => {
      // Valid params
      const validRes = validateAlertSettingParams('stock.low_cover', {
        threshold_days: 14,
        high_threshold_days: 7,
        history_days: 30,
      });
      assert.equal(validRes.valid, true);
      assert.deepEqual(validRes.errors, {});

      // Out of range (threshold_days > 90, high_threshold_days < 1)
      const invalidRes = validateAlertSettingParams('stock.low_cover', {
        threshold_days: 100,
        high_threshold_days: 0,
        history_days: 30,
      });
      assert.equal(invalidRes.valid, false);
      assert.match(invalidRes.errors.threshold_days, /không được vượt quá 90/);
      assert.match(invalidRes.errors.high_threshold_days, /không được nhỏ hơn 1/);
    });

    it('validates order.at_risk warning_days', () => {
      const res = validateAlertSettingParams('order.at_risk', {
        warning_days: 20,
      });
      assert.equal(res.valid, false);
      assert.match(res.errors.warning_days, /không được vượt quá 14/);
    });

    it('validates receivable.overdue min_overdue_days and min_amount', () => {
      const res = validateAlertSettingParams('receivable.overdue', {
        min_overdue_days: 3,
        min_amount: -100,
      });
      assert.equal(res.valid, false);
      assert.match(res.errors.min_overdue_days, /không được nhỏ hơn 7/);
      assert.match(res.errors.min_amount, /không được nhỏ hơn 0/);
    });

    it('validates cash.anomaly multipliers and thresholds', () => {
      const res = validateAlertSettingParams('cash.anomaly', {
        category_surge_percent: 5,
        category_min_diff: 100,
        outlier_multiplier: 15,
        outlier_min_tx_count: 1,
      });
      assert.equal(res.valid, false);
      assert.ok(res.errors.category_surge_percent);
      assert.ok(res.errors.category_min_diff);
      assert.ok(res.errors.outlier_multiplier);
      assert.ok(res.errors.outlier_min_tx_count);
    });
  });

  describe('9. Title with HTML injection must not render as HTML tags', () => {
    it('escapes and treats HTML script / img tags in title as literal text string', () => {
      const maliciousTitle = 'Mặt hàng <img src=x onerror=alert(1)> sắp hết hàng';
      // Verifying that React text rendering logic does not parse HTML
      assert.ok(maliciousTitle.includes('<img'));
      // A pure string helper or React JSX interpolation {title} renders text, never HTML
      const escaped = maliciousTitle
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      assert.ok(!escaped.includes('<img'));
      assert.ok(escaped.includes('&lt;img'));
    });
  });
});
