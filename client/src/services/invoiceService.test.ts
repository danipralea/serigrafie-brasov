import { describe, it, expect } from 'vitest';
import { buildCumulativeInvoiceData, buildInvoiceData, generateInvoicePDF } from './invoiceService';

const order = {
  id: 'abcdef1234567890',
  orderName: 'Comanda test',
  clientName: 'Ion Popescu',
  clientCompany: 'ACME SRL',
  clientCui: 'RO12345678',
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

  it('carries the client CUI onto the invoice', () => {
    const data = buildInvoiceData(order);
    expect(data.clientCui).toBe('RO12345678');
    expect(buildInvoiceData({ id: 'z1', subOrders: [] }).clientCui).toBe('');
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

  it('renders a cumulative invoice grouped by order', () => {
    const invoice = {
      id: 'inv-1',
      number: 'SB-2026-0007',
      status: 'issued',
      clientName: 'Ion Popescu',
      clientCompany: 'ACME SRL',
      clientCui: 'RO12345678',
      currency: 'RON',
      vatRate: 21,
      subtotal: 100,
      vatAmount: 21,
      total: 121,
      notes: 'Plata prin transfer bancar',
      createdAt: { toDate: () => new Date('2026-09-01') },
      issuedAt: { toDate: () => new Date('2026-09-07') },
      periodStart: { toDate: () => new Date('2026-08-31') },
      periodEnd: { toDate: () => new Date('2026-09-06') },
      orders: [
        { id: 'o1', number: 'AAAA1111', name: 'Comanda 1', createdAtMillis: Date.parse('2026-09-01'), total: 60 },
        { id: 'o2', number: 'BBBB2222', name: '', createdAtMillis: Date.parse('2026-09-03'), total: 40 }
      ],
      lines: [
        { orderId: 'o1', subOrderId: 's1', productType: 'Tricou', quantity: 20, description: '', positioning: [], amount: 60 },
        { orderId: 'o2', subOrderId: 's2', productType: 'Cana', quantity: 10, description: '', positioning: [], amount: 40 },
        { orderId: 'gone', subOrderId: 's3', productType: 'Sapca', quantity: 1, description: '', positioning: [], amount: null }
      ]
    };

    const data = buildCumulativeInvoiceData(invoice);
    expect(data.groups).toHaveLength(3);
    expect(data.groups?.[0].title).toBe('#AAAA1111 - Comanda 1');
    expect(data.invoiceNumber).toBe('SB-2026-0007');
    expect(data.amount).toBe(121);

    const out = generateInvoicePDF(data).output('arraybuffer');
    expect(out.byteLength).toBeGreaterThan(1000);
  });

  it('does not throw on an invoice with no lines', () => {
    const data = buildCumulativeInvoiceData({ id: 'inv-2', orders: [], lines: [] });
    expect(() => generateInvoicePDF(data).output('arraybuffer')).not.toThrow();
  });
});
