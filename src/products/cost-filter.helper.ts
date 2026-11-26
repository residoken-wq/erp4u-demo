/**
 * Recursively strips cost-related fields (cost_price, profit_margin, cost_per_unit)
 * from products, combos, boms, materials, and nested child entities.
 */
export function stripCostPrice<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => stripCostPrice(item)) as unknown as T;
  }

  if (typeof data === 'object') {
    if (data instanceof Date || (typeof Buffer !== 'undefined' && Buffer.isBuffer(data))) {
      return data;
    }

    const costKeys = ['cost_price', 'profit_margin', 'cost_per_unit'];
    for (const key of costKeys) {
      if (key in (data as any)) {
        delete (data as any)[key];
      }
    }

    for (const key of Object.keys(data)) {
      const val = (data as any)[key];
      if (val && typeof val === 'object') {
        (data as any)[key] = stripCostPrice(val);
      }
    }
  }

  return data;
}
