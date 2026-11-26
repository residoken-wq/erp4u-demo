import { stripCostFields } from '../auth/cost-visibility/cost-filter.util';

/**
 * Recursively strips cost-related fields (cost_price, profit_margin, cost_per_unit)
 * from products, combos, boms, materials, and nested child entities.
 * Kept for backward compatibility with P12b2 routes and tests.
 */
export function stripCostPrice<T>(data: T): T {
  return stripCostFields(data, {
    canViewCost: false,
    canViewPurchaseCost: false,
    costKeys: ['cost_price', 'profit_margin', 'cost_per_unit'],
    purchaseKeys: ['cost_per_unit', 'cost_price'],
  });
}
