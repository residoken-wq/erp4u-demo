import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    buildFunnelStages,
    formatFunnelLabel,
    formatVND,
    formatFullVND,
    formatRevenueTooltipItem,
} from '../chartHelpers.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Chart Helpers & Plots v2 Migration Unit Tests (Task UI3)', () => {
    describe('1. buildFunnelStages pure helper', () => {
        it('builds 6 stages correctly with complete KPI data', () => {
            const kpi = {
                funnelStages: {
                    new: 100,
                    qualified: 50,
                    contacted: 40,
                    sample_approved: 20,
                    negotiation: 10,
                    won: 5,
                },
            };
            const stages = buildFunnelStages(kpi);
            assert.equal(stages.length, 6);
            assert.deepEqual(stages, [
                { stage: 'Lead Mới', count: 100 },
                { stage: 'Tiềm Năng', count: 50 },
                { stage: 'Đã Liên Hệ', count: 40 },
                { stage: 'Duyệt Mẫu SX', count: 20 },
                { stage: 'Đàm Phán / BG', count: 10 },
                { stage: 'Thành Công (WON)', count: 5 },
            ]);
        });

        it('handles empty or missing funnelStages by defaulting counts to 0', () => {
            const emptyCases = [{}, { funnelStages: {} }, null, undefined];
            for (const c of emptyCases) {
                const stages = buildFunnelStages(c);
                assert.equal(stages.length, 6);
                for (const s of stages) {
                    assert.equal(s.count, 0);
                    assert.equal(typeof s.count, 'number');
                    assert.ok(!Number.isNaN(s.count));
                }
            }
        });

        it('safely parses string numbers and sanitizes invalid / negative values', () => {
            const kpi = {
                funnelStages: {
                    new: '42' as any,
                    qualified: -5,
                    contacted: 'invalid' as any,
                    sample_approved: null as any,
                    negotiation: undefined as any,
                    won: NaN as any,
                },
            };
            const stages = buildFunnelStages(kpi);
            assert.equal(stages[0].count, 42);
            assert.equal(stages[1].count, 0); // negative clamped to 0
            assert.equal(stages[2].count, 0); // invalid string -> 0
            assert.equal(stages[3].count, 0); // null -> 0
            assert.equal(stages[4].count, 0); // undefined -> 0
            assert.equal(stages[5].count, 0); // NaN -> 0
        });
    });

    describe('2. formatFunnelLabel pure helper', () => {
        it('formats label with complete stage and count', () => {
            const label = formatFunnelLabel({ stage: 'Lead Mới', count: 25 });
            assert.equal(label, 'Lead Mới\n25');
        });

        it('formats label with 0 count without undefined or NaN', () => {
            const label = formatFunnelLabel({ stage: 'Thành Công (WON)', count: 0 });
            assert.equal(label, 'Thành Công (WON)\n0');
            assert.ok(!label.includes('undefined'));
            assert.ok(!label.includes('NaN'));
        });

        it('never returns "undefined" or "NaN" with partial or empty data', () => {
            const testCases = [
                {},
                { stage: undefined, count: undefined },
                { stage: null, count: null },
                { stage: '', count: NaN },
                { count: 10 },
                { stage: 'Lead Mới' },
            ];

            for (const tc of testCases) {
                const result = formatFunnelLabel(tc);
                assert.ok(!result.includes('undefined'), `Failed on ${JSON.stringify(tc)}: contained 'undefined'`);
                assert.ok(!result.includes('NaN'), `Failed on ${JSON.stringify(tc)}: contained 'NaN'`);
            }
        });

        it('returns empty string for null or non-object inputs', () => {
            assert.equal(formatFunnelLabel(null), '');
            assert.equal(formatFunnelLabel(undefined), '');
            assert.equal(formatFunnelLabel('foo'), '');
            assert.equal(formatFunnelLabel(123), '');
        });
    });

    describe('3. Currency & Revenue Tooltip Formatting', () => {
        it('formats compact VND currency correctly', () => {
            assert.equal(formatVND(106000000), '106.0tr');
            assert.equal(formatVND(1500000000), '1.5 tỷ');
            assert.equal(formatVND(500000), '500K');
            assert.equal(formatVND(0), '0');
            assert.equal(formatVND(null), '0');
            assert.equal(formatVND(undefined), '0');
            assert.equal(formatVND(NaN), '0');
        });

        it('formats full VND currency with symbol', () => {
            assert.equal(formatFullVND(106000000), '106.000.000₫');
            assert.equal(formatFullVND(0), '0₫');
            assert.equal(formatFullVND(null), '0₫');
        });

        it('formats revenue tooltip item with proper series name and formatted value', () => {
            const item = formatRevenueTooltipItem({ type: 'Doanh thu thực', value: 106000000 });
            assert.equal(item.name, 'Doanh thu thực');
            assert.equal(item.value, '106.0tr');
        });
    });

    describe('4. Scan Test: No v1 API patterns in files importing @ant-design/plots', () => {
        const srcDir = path.resolve(__dirname, '../../');
        const filesToCheck = [
            'pages/BodDashboard.tsx',
            'pages/SalesStrategyDashboard.tsx',
            'components/finance/CashFlowDashboard.tsx',
            'pages/FinancePage.tsx',
            'components/planning/PfoSummaryDashboard.tsx',
        ];

        it('verifies that no file uses "formatter: (datum" v1 signature', () => {
            for (const relPath of filesToCheck) {
                const fullPath = path.join(srcDir, relPath);
                if (fs.existsSync(fullPath)) {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    assert.ok(
                        !content.includes('formatter: (datum'),
                        `File ${relPath} still contains v1 "formatter: (datum" pattern!`,
                    );
                }
            }
        });

        it('verifies that no file uses "conversionTag" prop', () => {
            for (const relPath of filesToCheck) {
                const fullPath = path.join(srcDir, relPath);
                if (fs.existsSync(fullPath)) {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    assert.ok(
                        !content.includes('conversionTag'),
                        `File ${relPath} still contains obsolete "conversionTag" prop!`,
                    );
                }
            }
        });
    });
});
