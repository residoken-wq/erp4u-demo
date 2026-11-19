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

export const PACKAGE_LABELS: Record<PackageKey, string> = {
  [PackageKey.CORE]: 'Cơ bản (Core)',
  [PackageKey.SALES]: 'Bán hàng & CRM',
  [PackageKey.INVENTORY]: 'Kho & Mua hàng',
  [PackageKey.PRODUCTION]: 'Sản xuất',
  [PackageKey.DESIGN]: 'Thiết kế in/thêu',
  [PackageKey.FINANCE]: 'Tài chính',
  [PackageKey.HR]: 'Nhân sự',
  [PackageKey.PROJECTS]: 'Dự án',
  [PackageKey.MARKETING]: 'Marketing & Omnichannel',
  [PackageKey.WEBSITE]: 'Website & CMS',
  [PackageKey.AI]: 'AI Assistant',
};

export function getPackageLabel(pkg?: string | null): string {
  if (!pkg) return 'tính năng mở rộng';
  const upper = pkg.toUpperCase() as PackageKey;
  return PACKAGE_LABELS[upper] || pkg;
}

/**
 * Single source of truth mapping frontend routes/menu paths to backend PackageKey (matches P6a controllers).
 */
export const ROUTE_PACKAGES: Record<string, PackageKey> = {
  // CORE
  '/': PackageKey.CORE,
  '/upload': PackageKey.CORE,
  '/products': PackageKey.CORE,
  '/combos': PackageKey.CORE,
  '/categories': PackageKey.CORE,
  '/packing-specs': PackageKey.CORE,
  '/suppliers': PackageKey.CORE,
  '/customers': PackageKey.CORE,
  '/workspace': PackageKey.CORE,
  '/help': PackageKey.CORE,
  '/docs': PackageKey.CORE,
  '/profile': PackageKey.CORE,
  '/users': PackageKey.CORE,
  '/users/groups': PackageKey.CORE,
  '/announcements': PackageKey.CORE,
  '/system/logs': PackageKey.CORE,
  '/system/rbac': PackageKey.CORE,
  '/system/settings': PackageKey.CORE,

  // SALES
  '/sales': PackageKey.SALES,
  '/sales/pos': PackageKey.SALES,
  '/sales/strategy': PackageKey.SALES,
  '/sales/bod': PackageKey.SALES,
  '/sales/bod-follow-up': PackageKey.SALES,
  '/orders': PackageKey.SALES,
  '/sales/pricelist': PackageKey.SALES,
  '/sales/promotions': PackageKey.SALES,

  // INVENTORY
  '/materials': PackageKey.INVENTORY,
  '/manufacturers': PackageKey.INVENTORY,
  '/inventory': PackageKey.INVENTORY,
  '/inventory/samples': PackageKey.INVENTORY,
  '/inventory/deliveries': PackageKey.INVENTORY,
  '/purchasing': PackageKey.INVENTORY,

  // PRODUCTION
  '/planning': PackageKey.PRODUCTION,
  '/print-production': PackageKey.PRODUCTION,
  '/routes': PackageKey.PRODUCTION,
  '/processes': PackageKey.PRODUCTION,
  '/qc': PackageKey.PRODUCTION,
  '/production-dashboard': PackageKey.PRODUCTION,

  // DESIGN
  '/designs': PackageKey.DESIGN,

  // FINANCE
  '/finance': PackageKey.FINANCE,

  // HR
  '/hr': PackageKey.HR,

  // PROJECTS
  '/projects': PackageKey.PROJECTS,
  '/projects/:id': PackageKey.PROJECTS,
  '/workspace/discussions/:id': PackageKey.PROJECTS,

  // MARKETING
  '/social/channels': PackageKey.MARKETING,
  '/social/orders': PackageKey.MARKETING,
  '/marketing': PackageKey.MARKETING,

  // WEBSITE
  '/website-products': PackageKey.WEBSITE,

  // AI
  '/chatbot/inbox': PackageKey.AI,
  '/chatbot/inbox/:id': PackageKey.AI,
  '/chatbot/requests': PackageKey.AI,
  '/chatbot/requests/:id': PackageKey.AI,
  '/ai-dashboard': PackageKey.AI,
};

export function getRoutePackage(path: string): PackageKey {
  return ROUTE_PACKAGES[path] ?? PackageKey.CORE;
}
