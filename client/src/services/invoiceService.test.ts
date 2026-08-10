import { describe, it, expect } from 'vitest';
import { buildInvoiceData, generateInvoicePDF } from './invoiceService';

const order = {
  id: 'abcdef1234567890',
  orderName: 'Comanda test',
  clientName: 'Ion Popescu',
  clientCompany: 'ACME SRL',
  clientEmail: 'ion@example.com',
  createdAt: { toDate: () => new Date('2026-08-01') },
  updatedAt: { toDate: () => new Date('2026-08-05') },
  subOrders: [
    {
      id: 's1',
      productTypeName: 'Tricou',
      quantity: 20,
      description: 'Tricouri albe',
      positioning: [{ name: 'Piept', quantity: 20, length: 10, width: 10, cmp: 3 }]
    },
    {
      id: 's2',
      productTypeName: 'Cana',
      quantity: 5,
      positioning: ['Fata'],
      length: 5,
      width: 5,
      cmp: 2
    }
  ]
};

describe('invoice', () => {
  it('generates a PDF for a multi-item order', () => {
    const data = buildInvoiceData(order);
    expect(data.items).toHaveLength(2);
    expect(data.items[0].positioning?.[0].name).toBe('Piept');
    const out = generateInvoicePDF(data).output('arraybuffer');
    expect(out.byteLength).toBeGreaterThan(1000);
  });

  it('does not throw on an order with no items and no quantities', () => {
    const data = buildInvoiceData({ id: 'x1', subOrders: [] });
    expect(() => generateInvoicePDF(data).output('arraybuffer')).not.toThrow();
  });

  it('does not throw when a sub-order has no quantity or product', () => {
    const data = buildInvoiceData({ id: 'x2', subOrders: [{ id: 'a' }] });
    expect(() => generateInvoicePDF(data).output('arraybuffer')).not.toThrow();
  });

  it('paginates long orders', () => {
    const many = { id: 'y1', subOrders: Array.from({ length: 40 }, (_, i) => ({
      id: `s${i}`,
      productTypeName: `Produs ${i}`,
      quantity: i + 1,
      description: 'x'.repeat(200),
      positioning: [{ name: 'Piept', quantity: i + 1, length: 10, width: 10, cmp: 1 }]
    })) };
    const doc = generateInvoicePDF(buildInvoiceData(many));
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });
});
