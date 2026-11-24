import { describe, it } from 'node:test';
import assert from 'node:assert';
import { brandColors, brandChartPalette } from '../brand.ts';

/**
 * WCAG 2.1 Contrast Calculation Utilities
 * Relative Luminance: https://www.w3.org/WAI/GL/wiki/Relative_luminance
 * Contrast Ratio: (L1 + 0.05) / (L2 + 0.05)
 */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const fullHex = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(fullHex, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function getRelativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

describe('Conix Brand Guidelines - WCAG AA Contrast Ratios (Task UI1)', () => {
  it('1. Chữ trắng trên nền Navy (white on navy) >= 4.5:1', () => {
    const ratio = getContrastRatio(brandColors.white, brandColors.navy);
    assert(ratio >= 4.5, `White on Navy ratio ${ratio} must be >= 4.5`);
    assert.strictEqual(ratio >= 12.0, true, `Expected ~12:1, got ${ratio}:1`);
  });

  it('2. Chữ Navy trên nền trắng (navy on white) >= 4.5:1', () => {
    const ratio = getContrastRatio(brandColors.navy, brandColors.white);
    assert(ratio >= 4.5, `Navy on White ratio ${ratio} must be >= 4.5`);
    assert.strictEqual(ratio >= 12.0, true, `Expected ~12:1, got ${ratio}:1`);
  });

  it('3. Chữ Navy trên nền layout kem rất nhạt (navy on creamLayout) >= 4.5:1', () => {
    const ratio = getContrastRatio(brandColors.navy, brandColors.creamLayout);
    assert(ratio >= 4.5, `Navy on creamLayout ratio ${ratio} must be >= 4.5`);
    assert.strictEqual(ratio >= 11.0, true, `Expected ~11.4:1, got ${ratio}:1`);
  });

  it('4. Chữ Navy trên nền kem thương hiệu (navy on brand cream) >= 4.5:1', () => {
    const ratio = getContrastRatio(brandColors.navy, brandColors.cream);
    assert(ratio >= 4.5, `Navy on Cream ratio ${ratio} must be >= 4.5`);
    assert.strictEqual(ratio >= 11.0, true, `Expected ~11.1:1, got ${ratio}:1`);
  });

  it('5. Chữ menu trên nền navy sider >= 4.5:1', () => {
    // Menu items text uses white or high-contrast rgba on navy
    const ratio = getContrastRatio(brandColors.white, brandColors.navy);
    assert(ratio >= 4.5, `Menu text on navy sider ratio ${ratio} must be >= 4.5`);
  });

  it('6. Cam đậm (orangeDark) cho chữ nhỏ trên nền trắng >= 4.5:1', () => {
    const ratio = getContrastRatio(brandColors.orangeDark, brandColors.white);
    assert(ratio >= 4.5, `orangeDark on White ratio ${ratio} must be >= 4.5 (WCAG AA small text)`);
    assert.strictEqual(ratio >= 5.0, true, `Expected >= 5:1, got ${ratio}:1`);
  });

  it('7. Nút CTA cam với chữ trắng (white on orange) >= 3.0:1 (chỉ dùng cho chữ lớn hoặc chữ đậm)', () => {
    const ratio = getContrastRatio(brandColors.white, brandColors.orange);
    assert(ratio >= 3.0, `White on Orange ratio ${ratio} must be >= 3.0 (WCAG AA large/bold text)`);
    // Ghi chú quy tắc: Cam #F04E23 trên trắng chỉ đạt 3.61:1, không dùng cho chữ nhỏ thông thường
    assert(ratio < 4.5, `Orange on white is expected to be under 4.5:1 (got ${ratio})`);
  });

  it('8. Mint chỉ dùng trên nền navy (mint on navy) >= 4.5:1', () => {
    const ratioNavy = getContrastRatio(brandColors.mint, brandColors.navy);
    assert(ratioNavy >= 4.5, `Mint on Navy ratio ${ratioNavy} must be >= 4.5`);
    assert.strictEqual(ratioNavy >= 9.0, true, `Expected ~9.39:1, got ${ratioNavy}:1`);

    // Kiểm tra rằng Mint KHÔNG đạt trên nền trắng -> chứng minh quy tắc chỉ dùng trên navy
    const ratioWhite = getContrastRatio(brandColors.mint, brandColors.white);
    assert(ratioWhite < 4.5, `Mint on White ratio ${ratioWhite} must be < 4.5:1 (not allowed on light backgrounds)`);
  });

  it('9. Biến thể Dark Mint (mintDark) cho biểu đồ trên nền trắng >= 4.5:1', () => {
    const ratio = getContrastRatio(brandColors.mintDark, brandColors.white);
    assert(ratio >= 4.5, `mintDark on White ratio ${ratio} must be >= 4.5 for charts and UI accents`);
  });

  it('10. Bảng màu biểu đồ (chartPalette) có tối thiểu 6 màu phân biệt, bắt đầu bằng Navy và Orange', () => {
    assert(brandChartPalette.length >= 6, `Chart palette must have at least 6 colors, got ${brandChartPalette.length}`);
    assert.strictEqual(brandChartPalette[0], brandColors.navy, 'First chart color must be Navy');
    assert.strictEqual(brandChartPalette[1], brandColors.orange, 'Second chart color must be Orange');
    assert.strictEqual(brandChartPalette[2], brandColors.mintDark, 'Third chart color must be Dark Mint');
  });
});
