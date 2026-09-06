/**
 * Cumulative invoicing - pure domain logic.
 *
 * An invoice gathers one or more finished orders of the *same client* into a
 * single fiscal document. Everything in this module is free of Firestore so it
 * can be unit tested, reused by the UI and, later, by a scheduled Cloud
 * Function that drafts invoices automatically.
 *
 * Two lifecycles matter:
 *
 *   draft   - a working set. Lines are recomputed from the live orders every
 *             time the draft changes, so edits to an order are reflected.
 *   issued  - frozen. Lines, client details and totals are snapshots taken at
 *             the moment the invoice got its number. Later order edits must
 *             never change a document that has already left the building.
 */

import { OrderStatus } from '../types';
import {
  PositionEntry,
  getPositioningTotalCost,
  normalizePositioning
} from './positioning';

export const DEFAULT_VAT_RATE = 21;
export const DEFAULT_INVOICE_SERIES = 'SB';
export const DEFAULT_CURRENCY = 'RON';

/** Statuses an order must reach before it can be put on an invoice. */
export const BILLABLE_ORDER_STATUSES: string[] = [
  OrderStatus.COMPLETED,
  OrderStatus.DELIVERED
];

export interface InvoiceLine {
  orderId: string;
  subOrderId: string;
  productType: string;
  quantity: number | null;
  description: string;
  positioning: PositionEntry[];
  /** Line total. Derived from the positions unless overridden by hand. */
  amount: number | null;
  /** True when `amount` was typed by a user instead of being derived. */
  amountOverridden?: boolean;
}

/** The bit of an order an invoice keeps, so it renders without extra reads. */
export interface InvoiceOrderRef {
  id: string;
  number: string;
  name: string;
  /** Order creation date in millis - Firestore Timestamps do not survive JSON. */
  createdAtMillis: number | null;
  total: number | null;
}

export interface InvoiceTotals {
  subtotal: number;
  vatAmount: number;
  total: number;
}

/** Client details, snapshotted onto the invoice. */
export interface InvoiceClient {
  clientId: string;
  clientName: string;
  clientCompany: string;
  clientCui: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
}

export interface BillingPeriod {
  /** Inclusive start, at 00:00 local time. */
  start: Date;
  /** Inclusive end, at 23:59:59.999 local time. */
  end: Date;
}

export type BillingPeriodPreset = 'this-week' | 'last-week' | 'this-month' | 'last-month' | 'all';

/** A client's worth of orders, ready to become one draft invoice. */
export interface InvoicePlanGroup {
  client: InvoiceClient;
  orders: any[];
  orderCount: number;
  subtotal: number;
  /** Orders in the group that carry no priced position at all. */
  unpricedOrderIds: string[];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clean(value: any): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Short, human-readable order reference (`#A1B2C3D4`). */
export function getOrderNumber(order: any): string {
  const id = clean(order?.id);
  return id ? id.substring(0, 8).toUpperCase() : '';
}

/** Money for display. Never returns `NaN`, shows a dash for unknown amounts. */
export function formatMoney(value: number | null | undefined, currency = DEFAULT_CURRENCY): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '---';
  return `${value.toFixed(2)} ${currency}`;
}

/** Positions of a sub-order, upgraded from any legacy shape. */
function subOrderPositions(subOrder: any): PositionEntry[] {
  return normalizePositioning(subOrder?.positioning, subOrder);
}

/** What a single sub-order is worth, or null when nothing on it is priced. */
export function getSubOrderAmount(subOrder: any): number | null {
  return getPositioningTotalCost(subOrderPositions(subOrder));
}

/** What a whole order is worth, or null when no item on it is priced. */
export function getOrderTotal(order: any): number | null {
  const amounts = (order?.subOrders || [])
    .map(getSubOrderAmount)
    .filter((amount: number | null): amount is number => amount !== null);
  if (amounts.length === 0) return null;
  return round2(amounts.reduce((sum: number, amount: number) => sum + amount, 0));
}

/** Invoice lines for one order - one line per sub-order. */
export function buildLinesFromOrder(order: any): InvoiceLine[] {
  return (order?.subOrders || []).map((subOrder: any) => ({
    orderId: clean(order?.id),
    subOrderId: clean(subOrder?.id),
    productType: clean(subOrder?.productTypeName) || clean(subOrder?.productType) || '-',
    quantity: typeof subOrder?.quantity === 'number' ? subOrder.quantity : null,
    description: clean(subOrder?.description),
    positioning: subOrderPositions(subOrder),
    amount: getSubOrderAmount(subOrder)
  }));
}

/** The order reference an invoice stores alongside its lines. */
export function buildOrderRef(order: any): InvoiceOrderRef {
  return {
    id: clean(order?.id),
    number: getOrderNumber(order),
    name: clean(order?.orderName),
    createdAtMillis: order?.createdAt?.toMillis?.() ?? null,
    total: getOrderTotal(order)
  };
}

/** Client snapshot taken from an order. */
export function buildInvoiceClient(order: any): InvoiceClient {
  return {
    clientId: clean(order?.clientId),
    clientName: clean(order?.clientName) || clean(order?.userName) || clean(order?.userEmail),
    clientCompany: clean(order?.clientCompany),
    clientCui: clean(order?.clientCui),
    clientEmail: clean(order?.clientEmail) || clean(order?.userEmail),
    clientPhone: clean(order?.clientPhone) || clean(order?.contactPhone),
    clientAddress: clean(order?.clientAddress)
  };
}

/** Label an invoice's client is recognised by: company first, person second. */
export function getInvoiceClientLabel(client: Partial<InvoiceClient> | null | undefined): string {
  if (!client) return '';
  return clean(client.clientCompany) || clean(client.clientName);
}

/** Secondary label - only shown when a company took the primary slot. */
export function getInvoiceClientSecondaryLabel(
  client: Partial<InvoiceClient> | null | undefined
): string {
  if (!client) return '';
  return clean(client.clientCompany) ? clean(client.clientName) : '';
}

/**
 * Totals for a set of lines. Unpriced lines count as zero rather than
 * poisoning the sum - the UI warns about them separately.
 */
export function computeTotals(lines: InvoiceLine[], vatRate: number): InvoiceTotals {
  const subtotal = round2(
    (lines || []).reduce((sum, line) => sum + (Number.isFinite(line?.amount as number) ? (line.amount as number) : 0), 0)
  );
  const rate = Number.isFinite(vatRate) && vatRate > 0 ? vatRate : 0;
  const vatAmount = round2((subtotal * rate) / 100);
  return { subtotal, vatAmount, total: round2(subtotal + vatAmount) };
}

/** Lines with no amount at all - these need a price before issuing. */
export function getUnpricedLines(lines: InvoiceLine[]): InvoiceLine[] {
  return (lines || []).filter(line => line?.amount === null || line?.amount === undefined);
}

/** An order sitting in the trash can never be billed. */
function isTrashed(order: any): boolean {
  return Boolean(order?.deletedAt);
}

/** True when the order is already attached to a draft or issued invoice. */
export function isOrderInvoiced(order: any): boolean {
  return Boolean(clean(order?.invoiceId)) || order?.status === OrderStatus.INVOICED;
}

/**
 * An order can join an invoice when it is finished, alive, and not already on
 * another one. Orders with no client id are billable too - they fall back to
 * grouping by their client label.
 */
export function isOrderBillable(order: any): boolean {
  if (!order || isTrashed(order)) return false;
  if (isOrderInvoiced(order)) return false;
  return BILLABLE_ORDER_STATUSES.includes(order.status);
}

/**
 * Grouping key for an order's client. Falls back to the client label so two
 * orders typed for the same walk-in client still land on one invoice.
 */
export function getClientGroupKey(order: any): string {
  const id = clean(order?.clientId);
  if (id) return `id:${id}`;
  const label = getInvoiceClientLabel(buildInvoiceClient(order)).toLowerCase();
  return label ? `name:${label}` : 'unknown';
}

/** True when every order in the list belongs to the same client. */
export function isSingleClientSelection(orders: any[]): boolean {
  if (!orders || orders.length === 0) return false;
  const first = getClientGroupKey(orders[0]);
  return orders.every(order => getClientGroupKey(order) === first);
}

/** Local midnight at the start of the day. */
function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Local end of the day, inclusive. */
function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

/** Monday of the week the date falls in - Romanian weeks start on Monday. */
function startOfWeek(date: Date): Date {
  const copy = startOfDay(date);
  const dayIndex = (copy.getDay() + 6) % 7; // Monday = 0
  copy.setDate(copy.getDate() - dayIndex);
  return copy;
}

/**
 * The date range a billing preset covers. `all` returns a period that starts
 * at the epoch, so callers can treat every preset the same way.
 */
export function getBillingPeriod(preset: BillingPeriodPreset, reference: Date = new Date()): BillingPeriod {
  switch (preset) {
    case 'this-week': {
      const start = startOfWeek(reference);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { start, end: endOfDay(end) };
    }
    case 'last-week': {
      const thisWeek = startOfWeek(reference);
      const start = new Date(thisWeek);
      start.setDate(start.getDate() - 7);
      const end = new Date(thisWeek);
      end.setDate(end.getDate() - 1);
      return { start, end: endOfDay(end) };
    }
    case 'this-month': {
      const start = startOfDay(new Date(reference.getFullYear(), reference.getMonth(), 1));
      const end = endOfDay(new Date(reference.getFullYear(), reference.getMonth() + 1, 0));
      return { start, end };
    }
    case 'last-month': {
      const start = startOfDay(new Date(reference.getFullYear(), reference.getMonth() - 1, 1));
      const end = endOfDay(new Date(reference.getFullYear(), reference.getMonth(), 0));
      return { start, end };
    }
    case 'all':
    default:
      return { start: new Date(0), end: endOfDay(reference) };
  }
}

/** Date an order counts against for billing: when it was placed. */
export function getOrderBillingDate(order: any): Date | null {
  const date = order?.createdAt?.toDate?.();
  return date instanceof Date && !isNaN(date.getTime()) ? date : null;
}

/** True when the order falls inside the period (a null period matches all). */
export function isOrderInPeriod(order: any, period?: BillingPeriod | null): boolean {
  if (!period) return true;
  const date = getOrderBillingDate(order);
  if (!date) return false;
  return date >= period.start && date <= period.end;
}

/**
 * The heart of cumulative billing: take every order, keep the billable ones in
 * the period, and group them per client into one draft each.
 *
 * Pure on purpose - the weekly run in the UI and any future scheduled job
 * share this exact planning step, so they can never drift apart.
 */
export function planCumulativeInvoices(orders: any[], period?: BillingPeriod | null): InvoicePlanGroup[] {
  const groups = new Map<string, InvoicePlanGroup>();

  (orders || [])
    .filter(order => isOrderBillable(order) && isOrderInPeriod(order, period))
    .forEach(order => {
      const key = getClientGroupKey(order);
      const existing = groups.get(key);
      const orderTotal = getOrderTotal(order);

      if (existing) {
        existing.orders.push(order);
        existing.orderCount++;
        existing.subtotal = round2(existing.subtotal + (orderTotal ?? 0));
        if (orderTotal === null) existing.unpricedOrderIds.push(clean(order.id));
        // A later order may carry client details the first one was missing.
        existing.client = mergeClients(existing.client, buildInvoiceClient(order));
        return;
      }

      groups.set(key, {
        client: buildInvoiceClient(order),
        orders: [order],
        orderCount: 1,
        subtotal: orderTotal ?? 0,
        unpricedOrderIds: orderTotal === null ? [clean(order.id)] : []
      });
    });

  return Array.from(groups.values()).sort((a, b) =>
    getInvoiceClientLabel(a.client).localeCompare(getInvoiceClientLabel(b.client))
  );
}

/** Fills blanks in a client snapshot from another one. Never overwrites. */
export function mergeClients(base: InvoiceClient, extra: InvoiceClient): InvoiceClient {
  return {
    clientId: base.clientId || extra.clientId,
    clientName: base.clientName || extra.clientName,
    clientCompany: base.clientCompany || extra.clientCompany,
    clientCui: base.clientCui || extra.clientCui,
    clientEmail: base.clientEmail || extra.clientEmail,
    clientPhone: base.clientPhone || extra.clientPhone,
    clientAddress: base.clientAddress || extra.clientAddress
  };
}

/**
 * Invoice number in the `SB-2026-0007` form: series, year of issue, then a
 * sequence that restarts every year. Zero padding keeps them sortable.
 */
export function formatInvoiceNumber(series: string, year: number, sequence: number): string {
  const prefix = clean(series) || DEFAULT_INVOICE_SERIES;
  return `${prefix}-${year}-${String(sequence).padStart(4, '0')}`;
}
