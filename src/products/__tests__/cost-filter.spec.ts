import { stripCostPrice } from '../cost-filter.helper';

describe('stripCostPrice helper (P12b2-r3)', () => {
  it('should remove cost_price and profit_margin from a product object', () => {
    const product = {
      id: 1,
      sku: 'SKU-01',
      name: 'Product 1',
      cost_price: 50000,
      profit_margin: 20,
      base_price: 70000,
      quantity_in_stock: 10,
    };

    const result = stripCostPrice(product);

    expect(result).not.toHaveProperty('cost_price');
    expect(result).not.toHaveProperty('profit_margin');
    expect('cost_price' in result).toBe(false);
    expect('profit_margin' in result).toBe(false);
    expect(result.id).toBe(1);
    expect(result.sku).toBe('SKU-01');
    expect(result.base_price).toBe(70000);
    expect(result.quantity_in_stock).toBe(10);
  });

  it('should remove cost fields from an array of products', () => {
    const list = [
      { id: 1, sku: 'A', cost_price: 1000, profit_margin: 10 },
      { id: 2, sku: 'B', cost_price: 2000, profit_margin: 15 },
    ];

    const result = stripCostPrice(list);

    expect(result).toHaveLength(2);
    expect('cost_price' in result[0]).toBe(false);
    expect('profit_margin' in result[0]).toBe(false);
    expect('cost_price' in result[1]).toBe(false);
    expect('profit_margin' in result[1]).toBe(false);
  });

  it('should recursively remove cost fields from nested combo_components and boms', () => {
    const complexProduct = {
      id: 10,
      sku: 'COMBO-01',
      cost_price: 120000,
      profit_margin: 25,
      combo_components: [
        {
          child_id: 11,
          quantity: 2,
          cost_price: 40000,
          child_product: {
            id: 11,
            sku: 'CHILD-01',
            cost_price: 40000,
            profit_margin: 15,
          },
        },
      ],
      boms: [
        {
          id: 101,
          quantity: 1.5,
          material: {
            id: 50,
            code: 'NPL-01',
            cost_per_unit: 15000,
            cost_price: 15000,
          },
        },
      ],
    };

    const result = stripCostPrice(complexProduct);

    expect('cost_price' in result).toBe(false);
    expect('profit_margin' in result).toBe(false);
    expect('cost_price' in result.combo_components[0]).toBe(false);
    expect('cost_price' in result.combo_components[0].child_product).toBe(false);
    expect('profit_margin' in result.combo_components[0].child_product).toBe(false);
    expect('cost_per_unit' in result.boms[0].material).toBe(false);
    expect('cost_price' in result.boms[0].material).toBe(false);
    expect(result.combo_components[0].quantity).toBe(2);
    expect(result.boms[0].quantity).toBe(1.5);
  });

  it('should handle null, undefined, and non-object values safely', () => {
    expect(stripCostPrice(null)).toBeNull();
    expect(stripCostPrice(undefined)).toBeUndefined();
    expect(stripCostPrice('hello')).toBe('hello');
    expect(stripCostPrice(123)).toBe(123);
  });
});
