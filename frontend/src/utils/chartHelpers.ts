/**
 * Chart helper utilities for @ant-design/plots v2
 */

export interface FunnelStageItem {
    stage: string;
    count: number;
}

export interface FunnelKpiData {
    funnelStages?: {
        new?: number;
        qualified?: number;
        contacted?: number;
        sample_approved?: number;
        negotiation?: number;
        won?: number;
        [key: string]: any;
    };
    [key: string]: any;
}

/**
 * Builds funnel stage records safely from KPI analytics data.
 * Guarantees all 6 stages are present with valid non-negative counts.
 */
export const buildFunnelStages = (kpi?: FunnelKpiData | null): FunnelStageItem[] => {
    const funnel = kpi?.funnelStages || {};
    const safeCount = (v: any): number => {
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 ? n : 0;
    };

    return [
        { stage: 'Lead Mới', count: safeCount(funnel.new) },
        { stage: 'Tiềm Năng', count: safeCount(funnel.qualified) },
        { stage: 'Đã Liên Hệ', count: safeCount(funnel.contacted) },
        { stage: 'Duyệt Mẫu SX', count: safeCount(funnel.sample_approved) },
        { stage: 'Đàm Phán / BG', count: safeCount(funnel.negotiation) },
        { stage: 'Thành Công (WON)', count: safeCount(funnel.won) },
    ];
};

/**
 * Formats label for Funnel chart item.
 * Never outputs the strings "undefined" or "NaN".
 */
export const formatFunnelLabel = (d: any): string => {
    if (!d || typeof d !== 'object') {
        return '';
    }
    const stage = d.stage != null && d.stage !== '' ? String(d.stage) : 'Không xác định';
    const rawCount = Number(d.count);
    const count = Number.isFinite(rawCount) && rawCount >= 0 ? rawCount : 0;
    return `${stage}\n${count}`;
};

/**
 * Formats compact VND currency (e.g. 106.0tr, 1.2 tỷ, 500K).
 */
export const formatVND = (v: number | string | undefined | null): string => {
    const num = Number(v);
    if (!Number.isFinite(num) || num === 0) return '0';
    const abs = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    if (abs >= 1000000000) return `${sign}${(abs / 1000000000).toFixed(1)} tỷ`;
    if (abs >= 1000000) return `${sign}${(abs / 1000000).toFixed(1)}tr`;
    if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(0)}K`;
    return `${sign}${abs.toLocaleString('vi-VN')}`;
};

/**
 * Formats full VND currency with symbol (e.g. 106.000.000₫).
 */
export const formatFullVND = (v: number | string | undefined | null): string => {
    const num = Number(v);
    const safeNum = Number.isFinite(num) ? num : 0;
    return `${safeNum.toLocaleString('vi-VN')}₫`;
};

/**
 * Formats revenue tooltip item with value in VN currency.
 */
export const formatRevenueTooltipItem = (d: any) => ({
    name: d?.type != null ? String(d.type) : 'Doanh thu',
    value: formatVND(d?.value),
});
