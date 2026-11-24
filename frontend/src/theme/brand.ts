import type { ThemeConfig } from 'antd';

/**
 * Conix Brand Guidelines (Version 2026-11-23)
 * Principles: Minimalist, Friendly, Luxurious.
 * Single source of truth for ERP4U core frontend brand tokens.
 */

export const brandColors = {
  // --- Core Brand Colors (Brand Guideline 3.1) ---
  cream: '#FFF5E1',      // Main brand background
  orange: '#F04E23',     // Accent / CTA
  navy: '#272F72',       // Bold text, frames, primary UI color
  mint: '#64FAE1',       // Small accent, ONLY on navy background
  black: '#000000',      // Deep text
  white: '#FFFFFF',      // Card & clean table background

  // --- Calculated & Tuned Variants ---
  // Navy variants
  navyHover: '#353F94',   // Lighter navy for hover states
  navyActive: '#1D2459',  // Deep navy for pressed/active states
  navySelected: '#343E8F', // Selected menu item background on dark navy sider
  navyDarker: '#1E2456',  // Submenu dark background
  navySubtle: '#F0F1F8',  // Soft navy background tint

  // Cream variants
  creamLayout: '#FAF8F5', // Very light cream for ERP app layout background (data-dense)
  creamHover: '#FFF9ED',  // Soft cream hover
  creamBorder: '#F2E8D5', // Subtle cream border

  // Orange variants
  orangeHover: '#F26741', // Orange hover for CTA buttons
  orangeActive: '#D63F17',// Orange pressed state
  orangeDark: '#C53B13',  // Dark orange reaching >= 4.5:1 on #FFFFFF for small text (5.24:1)
  orangeSubtle: '#FFF3EE',// Very soft orange tint

  // Mint variants
  mintDark: '#0F766E',    // Dark mint variant with contrast >= 4.5:1 on white (5.47:1) for charts/light bg
  mintSubtle: '#E6FAF5',  // Very soft mint tint
} as const;

/**
 * Chart Palette (>= 6 distinguishable colors)
 * Order: Navy, Orange, Dark Mint (sufficient contrast on white), Warm Amber, Indigo, Rose Plum
 */
export const brandChartPalette: string[] = [
  brandColors.navy,      // 1. Navy (#272F72) - contrast 12.10:1 on white
  brandColors.orange,    // 2. Orange (#F04E23) - contrast 3.61:1 on white
  brandColors.mintDark,  // 3. Dark Mint (#0F766E) - contrast 5.47:1 on white
  '#D97706',             // 4. Warm Amber - distinguishable warm tone
  '#4F46E5',             // 5. Indigo Slate - contrast 5.40:1 on white
  '#E11D48',             // 6. Rose Plum - contrast 4.55:1 on white
  '#0284C7',             // 7. Sky Blue
  '#7C3AED',             // 8. Violet
];

/**
 * Ant Design 5 Theme Configuration
 */
export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: brandColors.navy,
    colorLink: brandColors.navy,
    colorLinkHover: brandColors.navyHover,
    colorLinkActive: brandColors.navyActive,
    colorInfo: brandColors.navy,
    borderRadius: 8,
    colorBgLayout: brandColors.creamLayout,
    colorBgContainer: brandColors.white,
    colorTextHeading: brandColors.navy,
  },
  components: {
    Layout: {
      siderBg: brandColors.navy,
      headerBg: brandColors.white,
      bodyBg: brandColors.creamLayout,
      footerBg: brandColors.creamLayout,
    },
    Menu: {
      darkItemBg: brandColors.navy,
      darkSubMenuItemBg: brandColors.navyDarker,
      darkItemSelectedBg: brandColors.navySelected,
      darkItemSelectedColor: brandColors.white,
      darkItemColor: 'rgba(255, 255, 255, 0.85)',
      darkItemHoverBg: 'rgba(255, 255, 255, 0.08)',
      darkItemHoverColor: brandColors.white,
      itemSelectedColor: brandColors.navy,
      itemSelectedBg: brandColors.cream,
      borderRadius: 6,
    },
    Button: {
      borderRadius: 8,
      colorPrimary: brandColors.navy,
      colorPrimaryHover: brandColors.navyHover,
      colorPrimaryActive: brandColors.navyActive,
    },
    Tabs: {
      colorPrimary: brandColors.navy,
      itemSelectedColor: brandColors.navy,
      inkBarColor: brandColors.orange,
    },
    Table: {
      headerBg: brandColors.creamLayout,
      borderRadius: 8,
    },
    Card: {
      borderRadiusLG: 12,
    },
  },
};
