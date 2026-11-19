export enum PackageKey {
  CORE = 'CORE',
  SALES = 'SALES',
  INVENTORY = 'INVENTORY',
  PRODUCTION = 'PRODUCTION',
  DESIGN = 'DESIGN',
  FINANCE = 'FINANCE',
  HR = 'HR',
  PROJECTS = 'PROJECTS',
  MARKETING = 'MARKETING',
  WEBSITE = 'WEBSITE',
  AI = 'AI',
}

/**
 * Package dependencies:
 * - PRODUCTION => INVENTORY
 * - DESIGN => SALES
 * - MARKETING => SALES
 * - WEBSITE => SALES
 */
export const PACKAGE_DEPENDENCIES: Record<PackageKey, PackageKey[]> = {
  [PackageKey.CORE]: [],
  [PackageKey.SALES]: [],
  [PackageKey.INVENTORY]: [],
  [PackageKey.PRODUCTION]: [PackageKey.INVENTORY],
  [PackageKey.DESIGN]: [PackageKey.SALES],
  [PackageKey.FINANCE]: [],
  [PackageKey.HR]: [],
  [PackageKey.PROJECTS]: [],
  [PackageKey.MARKETING]: [PackageKey.SALES],
  [PackageKey.WEBSITE]: [PackageKey.SALES],
  [PackageKey.AI]: [],
};

/**
 * Mapping of packages to backend modules (as specified in P6/P8 architecture plan)
 */
export const PACKAGE_MODULES: Record<PackageKey, string[]> = {
  [PackageKey.CORE]: [
    'auth',
    'users',
    'system',
    'common',
    'categories',
    'customers',
    'suppliers',
    'products',
    'notifications',
    'announcements',
    'tasks',
    'upload',
    'utils',
    'public',
  ],
  [PackageKey.SALES]: ['sales'],
  [PackageKey.INVENTORY]: ['inventory', 'purchasing', 'materials', 'shipping'],
  [PackageKey.PRODUCTION]: ['bom', 'processes', 'planning', 'production', 'qc'],
  [PackageKey.DESIGN]: ['designs'],
  [PackageKey.FINANCE]: ['finance'],
  [PackageKey.HR]: ['hr'],
  [PackageKey.PROJECTS]: ['projects', 'discussions'],
  [PackageKey.MARKETING]: [
    'marketing',
    'social',
    'tiktok',
    'zns',
    'analytics',
  ],
  [PackageKey.WEBSITE]: ['website'],
  [PackageKey.AI]: ['ai', 'chatbot'],
};
