import { describe, it, expect } from 'vitest';
import { OrderStatus } from '../types';
import {
  buildLinesFromOrder,
  computeTotals,
  formatInvoiceNumber,
  getBillingPeriod,
  getClientGroupKey,
  getOrderTotal,
  isOrderBillable,
  isSingleClientSelection,
  planCumulativeInvoices
} from './invoicing';

function timestamp(iso: string) {
  const date = new Date(iso);
  return { toDate: () => date, toMillis: () => date.getTime() };
}

function order(overrides: any = {}) {
  return {
    id: 'order-1',
    status: OrderStatus.DELIVERED,
    clientId: 'client-1',
    clientName: 'Ion Popescu',
    clientCompany: 'ACME SRL',
    createdAt: timestamp('2026-09-02T10:00:00'),
    subOrders: [
      {
        id: 'sub-1',
        productTypeName: 'Tricou',
        quantity: 10,
        positioning: [{ name: 'Piept', quantity: 10, length: 10, width: 10, cmp: 3 }]
      }
    ],
    ...overrides
  };
}

describe('billability', () => {
  it('accepts finished orders that are not on an invoice', () => {
    expect(isOrderBillable(order())).toBe(true);
    expect(isOrderBillable(order({ status: OrderStatus.COMPLETED }))).toBe(true);
  });

  it('rejects unfinished, trashed and already invoiced orders', () => {
    expect(isOrderBillable(order({ status: OrderStatus.IN_PROGRESS }))).toBe(false);
    expect(isOrderBillable(order({ deletedAt: timestamp('2026-09-03T10:00:00') }))).toBe(false);
    expect(isOrderBillable(order({ invoiceId: 'inv-1' }))).toBe(false);
    expect(isOrderBillable(order({ status: OrderStatus.INVOICED }))).toBe(false);
    expect(isOrderBillable(null)).toBe(false);
  });
});

describe('amounts', () => {
  it('derives an order total from the position costs', () => {
    expect(getOrderTotal(order())).toBe(30);
  });

  it('returns null when nothing on the order is priced', () => {
    expect(getOrderTotal(order({ subOrders: [{ id: 'a', positioning: [] }] }))).toBeNull();
  });

  it('upgrades legacy string positions using the item measurements', () => {
    const lines = buildLinesFromOrder(
      order({
        subOrders: [{ id: 'sub-1', productTypeName: 'Cana', quantity: 5, positioning: ['Fata'], cmp: 2 }]
      })
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].positioning[0].name).toBe('Fata');
    expect(lines[0].amount).toBe(10);
  });

  it('adds VAT on top of the line amounts', () => {
    const totals = computeTotals(
      [
        { amount: 100 } as any,
        { amount: 50.5 } as any,
        { amount: null } as any
      ],
      21
    );
    expect(totals.subtotal).toBe(150.5);
    expect(totals.vatAmount).toBe(31.61);
    expect(totals.total).toBe(182.11);
  });

  it('leaves the total untouched at a zero rate', () => {
    expect(computeTotals([{ amount: 40 } as any], 0)).toEqual({
      subtotal: 40,
      vatAmount: 0,
      total: 40
    });
  });
});

describe('client grouping', () => {
  it('groups by client id when there is one', () => {
    expect(getClientGroupKey(order())).toBe('id:client-1');
  });

  it('falls back to the client label for orders with no client id', () => {
    expect(getClientGroupKey(order({ clientId: '', clientCompany: 'Jars' }))).toBe('name:jars');
  });

  it('detects a selection that spans several clients', () => {
    expect(isSingleClientSelection([order(), order({ id: 'order-2' })])).toBe(true);
    expect(isSingleClientSelection([order(), order({ id: 'order-2', clientId: 'client-2' })])).toBe(false);
    expect(isSingleClientSelection([])).toBe(false);
  });
});

describe('billing periods', () => {
  it('runs a week from Monday to Sunday', () => {
    // 2026-09-02 is a Wednesday.
    const period = getBillingPeriod('this-week', new Date('2026-09-02T12:00:00'));
    expect(period.start.getDay()).toBe(1);
    expect(period.end.getDay()).toBe(0);
    expect(period.start.getDate()).toBe(31);
    expect(period.end.getDate()).toBe(6);
  });

  it('covers the whole previous week', () => {
    const period = getBillingPeriod('last-week', new Date('2026-09-02T12:00:00'));
    expect(period.start.getDate()).toBe(24);
    expect(period.end.getDate()).toBe(30);
  });

  it('covers a full calendar month', () => {
    const period = getBillingPeriod('this-month', new Date('2026-09-15T12:00:00'));
    expect(period.start.getDate()).toBe(1);
    expect(period.end.getDate()).toBe(30);
  });
});

describe('cumulative planning', () => {
  const orders = [
    order({ id: 'a' }),
    order({ id: 'b', createdAt: timestamp('2026-09-04T10:00:00') }),
    order({ id: 'c', clientId: 'client-2', clientCompany: 'Jars' }),
    order({ id: 'd', status: OrderStatus.IN_PROGRESS }),
    order({ id: 'e', invoiceId: 'inv-9' }),
    order({ id: 'f', createdAt: timestamp('2026-07-01T10:00:00') })
  ];

  it('makes one group per client out of the billable orders', () => {
    const groups = planCumulativeInvoices(orders, getBillingPeriod('this-month', new Date('2026-09-15T12:00:00')));
    expect(groups).toHaveLength(2);

    const acme = groups.find(group => group.client.clientId === 'client-1');
    expect(acme?.orderCount).toBe(2);
    expect(acme?.subtotal).toBe(60);

    const jars = groups.find(group => group.client.clientId === 'client-2');
    expect(jars?.orderCount).toBe(1);
  });

  it('keeps orders outside the period out of the plan', () => {
    const groups = planCumulativeInvoices(orders, getBillingPeriod('this-month', new Date('2026-07-15T12:00:00')));
    expect(groups).toHaveLength(1);
    expect(groups[0].orderCount).toBe(1);
  });

  it('takes every billable order when no period is given', () => {
    const groups = planCumulativeInvoices(orders, null);
    expect(groups.reduce((sum, group) => sum + group.orderCount, 0)).toBe(4);
  });

  it('flags groups holding an order with no price', () => {
    const groups = planCumulativeInvoices(
      [order({ id: 'g', subOrders: [{ id: 'x', productTypeName: 'Cana' }] })],
      null
    );
    expect(groups[0].unpricedOrderIds).toEqual(['g']);
    expect(groups[0].subtotal).toBe(0);
  });
});

describe('invoice numbers', () => {
  it('pads the sequence and carries the series and year', () => {
    expect(formatInvoiceNumber('SB', 2026, 7)).toBe('SB-2026-0007');
    expect(formatInvoiceNumber('', 2026, 1234)).toBe('SB-2026-1234');
  });
});
