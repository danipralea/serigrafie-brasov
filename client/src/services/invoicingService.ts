/**
 * Cumulative invoicing - Firestore layer.
 *
 * Every mutation here keeps two documents in step: the invoice, and the orders
 * it contains (`invoiceId` / `invoiceNumber` / `invoiceStatus` on the order).
 * That link is written inside a transaction so an order can never end up on two
 * invoices, and an invoice can never point at an order that does not point back.
 *
 * The pure rules - what is billable, how lines and totals are built - live in
 * `utils/invoicing.ts`. This module only talks to the database.
 */

import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy as firestoreOrderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  deleteField,
  where,
  Timestamp,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../firebase';
import { InvoiceDoc, InvoiceStatus, InvoiceSettings, OrderStatus } from '../types';
import {
  BillingPeriod,
  DEFAULT_CURRENCY,
  DEFAULT_INVOICE_SERIES,
  DEFAULT_VAT_RATE,
  InvoiceLine,
  buildInvoiceClient,
  buildLinesFromOrder,
  buildOrderRef,
  computeTotals,
  formatInvoiceNumber,
  isSingleClientSelection,
  mergeClients
} from '../utils/invoicing';

const INVOICES = 'invoices';
const SETTINGS_DOC = doc(db, 'settings', 'invoicing');

/** Firestore caps a transaction at 500 writes; stay well inside that. */
const MAX_ORDERS_PER_OPERATION = 150;

export type InvoicingErrorCode =
  | 'not-found'
  | 'not-a-draft'
  | 'empty-invoice'
  | 'mixed-clients'
  | 'order-already-invoiced'
  | 'order-not-billable'
  | 'too-many-orders'
  | 'already-issued';

/** A rejection the UI is expected to explain to the user, not a crash. */
export class InvoicingError extends Error {
  code: InvoicingErrorCode;
  details?: any;

  constructor(code: InvoicingErrorCode, details?: any) {
    super(code);
    this.name = 'InvoicingError';
    this.code = code;
    this.details = details;
  }
}

export interface InvoiceActor {
  uid: string;
  name?: string | null;
}

function now(): Timestamp {
  return Timestamp.now();
}

function toTimestamp(date: Date | null | undefined): Timestamp | null {
  return date ? Timestamp.fromDate(date) : null;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const FALLBACK_SETTINGS: InvoiceSettings = {
  series: DEFAULT_INVOICE_SERIES,
  nextSequence: 1,
  sequenceYear: new Date().getFullYear(),
  vatRate: DEFAULT_VAT_RATE,
  currency: DEFAULT_CURRENCY,
  paymentTermDays: 30
};

/** Invoicing settings, falling back to sane defaults when unset. */
export async function getInvoiceSettings(): Promise<InvoiceSettings> {
  try {
    const snapshot = await getDoc(SETTINGS_DOC);
    if (!snapshot.exists()) return { ...FALLBACK_SETTINGS };
    return { ...FALLBACK_SETTINGS, ...(snapshot.data() as Partial<InvoiceSettings>) };
  } catch {
    return { ...FALLBACK_SETTINGS };
  }
}

export async function saveInvoiceSettings(patch: Partial<InvoiceSettings>): Promise<void> {
  await setDoc(SETTINGS_DOC, patch, { merge: true });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Live list of every invoice, newest first. */
export function subscribeToInvoices(
  onChange: (invoices: any[]) => void,
  onError?: (error: any) => void
): Unsubscribe {
  const q = query(collection(db, INVOICES), firestoreOrderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    snapshot => onChange(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))),
    error => onError?.(error)
  );
}

/** Live view of a single invoice, so an open modal follows other people's edits. */
export function subscribeToInvoice(
  invoiceId: string,
  onChange: (invoice: any | null) => void,
  onError?: (error: any) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, INVOICES, invoiceId),
    snapshot => onChange(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    error => onError?.(error)
  );
}

/** Orders by id, each hydrated with its sub-orders. Reads in chunks of ten. */
export async function fetchOrdersWithSubOrders(orderIds: string[]): Promise<any[]> {
  const ids = Array.from(new Set((orderIds || []).filter(Boolean)));
  if (ids.length === 0) return [];

  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += 10) {
    chunks.push(ids.slice(index, index + 10));
  }

  const results = await Promise.all(
    chunks.map(chunk =>
      getDocs(query(collection(db, 'orders'), where(documentId(), 'in', chunk)))
    )
  );

  const orders = results.flatMap(snapshot =>
    snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
  );

  return Promise.all(
    orders.map(async (order: any) => {
      try {
        const subOrdersSnapshot = await getDocs(collection(db, 'orders', order.id, 'subOrders'));
        return {
          ...order,
          subOrders: subOrdersSnapshot.docs.map(subDoc => ({ id: subDoc.id, ...subDoc.data() }))
        };
      } catch {
        return { ...order, subOrders: [] };
      }
    })
  );
}

// ---------------------------------------------------------------------------
// Shared write helpers
// ---------------------------------------------------------------------------

/** The order fields that mirror the invoice link. */
function orderLinkPatch(invoiceId: string, invoice: { number?: string | null; status: string }) {
  return {
    invoiceId,
    invoiceNumber: invoice.number || '',
    invoiceStatus: invoice.status,
    updatedAt: now()
  };
}

function orderUnlinkPatch() {
  return {
    invoiceId: deleteField(),
    invoiceNumber: deleteField(),
    invoiceStatus: deleteField(),
    updatedAt: now()
  };
}

/** Lines, order refs and totals for a set of hydrated orders. */
function composeInvoiceBody(orders: any[], vatRate: number) {
  const sorted = [...orders].sort(
    (a, b) => (a?.createdAt?.toMillis?.() ?? 0) - (b?.createdAt?.toMillis?.() ?? 0)
  );
  const lines = sorted.flatMap(buildLinesFromOrder);
  const totals = computeTotals(lines, vatRate);

  return {
    orderIds: sorted.map(order => order.id),
    orders: sorted.map(buildOrderRef),
    lines,
    ...totals
  };
}

/** Client snapshot for a set of orders, filling blanks from later orders. */
function composeInvoiceClient(orders: any[]) {
  return orders
    .map(buildInvoiceClient)
    .reduce((merged, client) => mergeClients(merged, client));
}

function assertDraft(invoice: any) {
  if (!invoice) throw new InvoicingError('not-found');
  if (invoice.status !== InvoiceStatus.DRAFT) throw new InvoicingError('not-a-draft');
}

function assertSize(orders: any[]) {
  if (orders.length > MAX_ORDERS_PER_OPERATION) {
    throw new InvoicingError('too-many-orders', { max: MAX_ORDERS_PER_OPERATION });
  }
}

// ---------------------------------------------------------------------------
// Draft lifecycle
// ---------------------------------------------------------------------------

export interface CreateDraftOptions {
  orders: any[];
  actor: InvoiceActor;
  period?: BillingPeriod | null;
  vatRate?: number;
  currency?: string;
  notes?: string;
}

/**
 * Creates a draft invoice holding the given orders. All orders must belong to
 * the same client and none of them may already sit on another invoice.
 */
export async function createDraftInvoice(options: CreateDraftOptions): Promise<string> {
  const { orders, actor, period, notes } = options;

  if (!orders || orders.length === 0) throw new InvoicingError('empty-invoice');
  if (!isSingleClientSelection(orders)) throw new InvoicingError('mixed-clients');
  assertSize(orders);

  const settings = await getInvoiceSettings();
  const vatRate = options.vatRate ?? settings.vatRate;
  const currency = options.currency ?? settings.currency;
  const invoiceRef = doc(collection(db, INVOICES));
  const timestamp = now();

  await runTransaction(db, async transaction => {
    // Reads first - Firestore transactions forbid a read after a write.
    const orderSnapshots = await Promise.all(
      orders.map(order => transaction.get(doc(db, 'orders', order.id)))
    );

    orderSnapshots.forEach((snapshot, index) => {
      if (!snapshot.exists()) throw new InvoicingError('not-found', { orderId: orders[index].id });
      const data = snapshot.data();
      if (data.invoiceId) {
        throw new InvoicingError('order-already-invoiced', {
          orderId: snapshot.id,
          invoiceId: data.invoiceId
        });
      }
    });

    const body = composeInvoiceBody(orders, vatRate);

    const document: Omit<InvoiceDoc, 'id'> = {
      number: null,
      series: settings.series,
      sequence: null,
      status: InvoiceStatus.DRAFT,
      ...composeInvoiceClient(orders),
      ...body,
      periodStart: toTimestamp(period?.start),
      periodEnd: toTimestamp(period?.end),
      dueDate: null,
      currency,
      vatRate,
      notes: notes || '',
      createdAt: timestamp,
      createdBy: actor.uid,
      createdByName: actor.name || '',
      updatedAt: timestamp,
      issuedAt: null,
      issuedBy: null,
      issuedByName: null,
      paidAt: null,
      cancelledAt: null,
      cancelledBy: null
    };

    transaction.set(invoiceRef, document);

    orders.forEach(order => {
      transaction.update(
        doc(db, 'orders', order.id),
        orderLinkPatch(invoiceRef.id, { number: null, status: InvoiceStatus.DRAFT })
      );
    });
  });

  return invoiceRef.id;
}

/**
 * Creates one draft per client for a planned cumulative run. Each draft is
 * written independently, so one failure does not lose the rest; the caller gets
 * both the successes and the failures.
 */
export async function createDraftInvoices(
  groups: { orders: any[] }[],
  options: Omit<CreateDraftOptions, 'orders'>
): Promise<{ created: string[]; failed: { orders: any[]; error: any }[] }> {
  const created: string[] = [];
  const failed: { orders: any[]; error: any }[] = [];

  for (const group of groups) {
    try {
      created.push(await createDraftInvoice({ ...options, orders: group.orders }));
    } catch (error) {
      failed.push({ orders: group.orders, error });
    }
  }

  return { created, failed };
}

/** Adds more orders to an existing draft. */
export async function addOrdersToInvoice(
  invoiceId: string,
  ordersToAdd: any[],
  currentOrders: any[]
): Promise<void> {
  if (!ordersToAdd || ordersToAdd.length === 0) return;
  assertSize([...ordersToAdd, ...currentOrders]);

  await runTransaction(db, async transaction => {
    const invoiceSnapshot = await transaction.get(doc(db, INVOICES, invoiceId));
    if (!invoiceSnapshot.exists()) throw new InvoicingError('not-found');
    const invoice = invoiceSnapshot.data();
    assertDraft(invoice);

    const orderSnapshots = await Promise.all(
      ordersToAdd.map(order => transaction.get(doc(db, 'orders', order.id)))
    );

    orderSnapshots.forEach((snapshot, index) => {
      if (!snapshot.exists()) throw new InvoicingError('not-found', { orderId: ordersToAdd[index].id });
      const data = snapshot.data();
      if (data.invoiceId && data.invoiceId !== invoiceId) {
        throw new InvoicingError('order-already-invoiced', { orderId: snapshot.id });
      }
    });

    const existing = (currentOrders || []).filter(
      order => !ordersToAdd.some(added => added.id === order.id)
    );
    const merged = [...existing, ...ordersToAdd];

    if (!isSingleClientSelection(merged)) throw new InvoicingError('mixed-clients');

    transaction.update(doc(db, INVOICES, invoiceId), {
      ...composeInvoiceBody(merged, invoice.vatRate ?? DEFAULT_VAT_RATE),
      ...composeInvoiceClient(merged),
      updatedAt: now()
    });

    ordersToAdd.forEach(order => {
      transaction.update(
        doc(db, 'orders', order.id),
        orderLinkPatch(invoiceId, { number: null, status: InvoiceStatus.DRAFT })
      );
    });
  });
}

/** Takes one order off a draft, freeing it up for another invoice. */
export async function removeOrderFromInvoice(
  invoiceId: string,
  orderId: string,
  currentOrders: any[]
): Promise<void> {
  await runTransaction(db, async transaction => {
    const invoiceSnapshot = await transaction.get(doc(db, INVOICES, invoiceId));
    if (!invoiceSnapshot.exists()) throw new InvoicingError('not-found');
    const invoice = invoiceSnapshot.data();
    assertDraft(invoice);

    const remaining = (currentOrders || []).filter(order => order.id !== orderId);

    transaction.update(doc(db, INVOICES, invoiceId), {
      ...(remaining.length > 0
        ? composeInvoiceBody(remaining, invoice.vatRate ?? DEFAULT_VAT_RATE)
        : { orderIds: [], orders: [], lines: [], subtotal: 0, vatAmount: 0, total: 0 }),
      updatedAt: now()
    });

    transaction.update(doc(db, 'orders', orderId), orderUnlinkPatch());
  });
}

/**
 * Rebuilds a draft's lines from the live orders. Called when a draft is opened,
 * so edits made to an order after it was added show up on the invoice.
 * Returns true when something actually changed.
 */
export async function syncDraftFromOrders(invoice: any, orders: any[]): Promise<boolean> {
  if (!invoice || invoice.status !== InvoiceStatus.DRAFT) return false;

  const vatRate = invoice.vatRate ?? DEFAULT_VAT_RATE;
  const body = composeInvoiceBody(orders, vatRate);
  const overrides = new Map<string, InvoiceLine>(
    (invoice.lines || [])
      .filter((line: InvoiceLine) => line?.amountOverridden)
      .map((line: InvoiceLine) => [`${line.orderId}:${line.subOrderId}`, line])
  );

  // Hand-typed amounts survive a resync; derived ones are recomputed.
  const lines = body.lines.map(line => {
    const override = overrides.get(`${line.orderId}:${line.subOrderId}`);
    return override ? { ...line, amount: override.amount, amountOverridden: true } : line;
  });
  const totals = computeTotals(lines, vatRate);
  const next = { ...body, lines, ...totals };

  if (JSON.stringify(next) === JSON.stringify({
    orderIds: invoice.orderIds || [],
    orders: invoice.orders || [],
    lines: invoice.lines || [],
    subtotal: invoice.subtotal ?? 0,
    vatAmount: invoice.vatAmount ?? 0,
    total: invoice.total ?? 0
  })) {
    return false;
  }

  await updateDoc(doc(db, INVOICES, invoice.id), { ...next, updatedAt: now() });
  return true;
}

/** Notes, VAT rate, due date and per-line amount overrides on a draft. */
export async function updateDraftInvoice(
  invoice: any,
  patch: { notes?: string; vatRate?: number; dueDate?: Date | null; lines?: InvoiceLine[] }
): Promise<void> {
  assertDraft(invoice);

  const lines = patch.lines ?? invoice.lines ?? [];
  const vatRate = patch.vatRate ?? invoice.vatRate ?? DEFAULT_VAT_RATE;
  const totals = computeTotals(lines, vatRate);

  await updateDoc(doc(db, INVOICES, invoice.id), {
    ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    ...(patch.dueDate !== undefined ? { dueDate: toTimestamp(patch.dueDate) } : {}),
    lines,
    vatRate,
    ...totals,
    updatedAt: now()
  });
}

// ---------------------------------------------------------------------------
// Issue / pay / cancel
// ---------------------------------------------------------------------------

/**
 * Turns a draft into a fiscal document: allocates the next number in the
 * series, freezes the lines, and marks every order on it as invoiced.
 *
 * The number comes from a counter guarded by the same transaction, so two
 * people issuing at once cannot get the same one, and no number is burned when
 * the write fails.
 */
export async function issueInvoice(invoice: any, actor: InvoiceActor): Promise<string> {
  assertDraft(invoice);
  if (!invoice.orderIds || invoice.orderIds.length === 0) throw new InvoicingError('empty-invoice');

  const timestamp = now();
  let allocatedNumber = '';

  await runTransaction(db, async transaction => {
    const invoiceRef = doc(db, INVOICES, invoice.id);
    const invoiceSnapshot = await transaction.get(invoiceRef);
    if (!invoiceSnapshot.exists()) throw new InvoicingError('not-found');
    if (invoiceSnapshot.data().status !== InvoiceStatus.DRAFT) throw new InvoicingError('already-issued');

    const settingsSnapshot = await transaction.get(SETTINGS_DOC);
    const settings: InvoiceSettings = {
      ...FALLBACK_SETTINGS,
      ...(settingsSnapshot.exists() ? (settingsSnapshot.data() as Partial<InvoiceSettings>) : {})
    };

    const orderRefs = invoice.orderIds.map((orderId: string) => doc(db, 'orders', orderId));
    const orderSnapshots = await Promise.all(orderRefs.map((ref: any) => transaction.get(ref)));

    const year = new Date().getFullYear();
    // The sequence restarts on the first invoice of a new year.
    const sequence = settings.sequenceYear === year ? settings.nextSequence : 1;
    allocatedNumber = formatInvoiceNumber(settings.series, year, sequence);

    const paymentTermDays = settings.paymentTermDays ?? FALLBACK_SETTINGS.paymentTermDays;
    const dueDate = invoice.dueDate ?? Timestamp.fromMillis(
      timestamp.toMillis() + paymentTermDays * 24 * 60 * 60 * 1000
    );

    transaction.set(
      SETTINGS_DOC,
      { ...settings, sequenceYear: year, nextSequence: sequence + 1 },
      { merge: true }
    );

    transaction.update(invoiceRef, {
      number: allocatedNumber,
      series: settings.series,
      sequence,
      status: InvoiceStatus.ISSUED,
      dueDate,
      issuedAt: timestamp,
      issuedBy: actor.uid,
      issuedByName: actor.name || '',
      updatedAt: timestamp
    });

    orderSnapshots.forEach((snapshot: any, index: number) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      transaction.update(orderRefs[index], {
        invoiceId: invoice.id,
        invoiceNumber: allocatedNumber,
        invoiceStatus: InvoiceStatus.ISSUED,
        // Remembered so cancelling the invoice can put the order back exactly.
        statusBeforeInvoice: data.statusBeforeInvoice || data.status || OrderStatus.DELIVERED,
        status: OrderStatus.INVOICED,
        updatedAt: timestamp
      });
    });
  });

  return allocatedNumber;
}

export async function markInvoicePaid(invoice: any, paid: boolean): Promise<void> {
  if (!invoice?.id) throw new InvoicingError('not-found');
  await updateDoc(doc(db, INVOICES, invoice.id), {
    status: paid ? InvoiceStatus.PAID : InvoiceStatus.ISSUED,
    paidAt: paid ? now() : null,
    updatedAt: now()
  });
}

/**
 * Cancels an issued invoice. The document is kept - a numbered invoice is never
 * deleted - but its orders are released back to the status they had before.
 */
export async function cancelInvoice(invoice: any, actor: InvoiceActor): Promise<void> {
  if (!invoice?.id) throw new InvoicingError('not-found');

  const timestamp = now();

  await runTransaction(db, async transaction => {
    const invoiceRef = doc(db, INVOICES, invoice.id);
    const invoiceSnapshot = await transaction.get(invoiceRef);
    if (!invoiceSnapshot.exists()) throw new InvoicingError('not-found');

    const orderIds: string[] = invoiceSnapshot.data().orderIds || [];
    const orderRefs = orderIds.map(orderId => doc(db, 'orders', orderId));
    const orderSnapshots = await Promise.all(orderRefs.map(ref => transaction.get(ref)));

    transaction.update(invoiceRef, {
      status: InvoiceStatus.CANCELLED,
      cancelledAt: timestamp,
      cancelledBy: actor.uid,
      updatedAt: timestamp
    });

    orderSnapshots.forEach((snapshot, index) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      transaction.update(orderRefs[index], {
        invoiceId: deleteField(),
        invoiceNumber: deleteField(),
        invoiceStatus: deleteField(),
        statusBeforeInvoice: deleteField(),
        status: data.statusBeforeInvoice || OrderStatus.DELIVERED,
        updatedAt: timestamp
      });
    });
  });
}

/** Deletes a draft outright. Drafts carry no number, so nothing is lost. */
export async function deleteDraftInvoice(invoice: any): Promise<void> {
  assertDraft(invoice);

  await runTransaction(db, async transaction => {
    const invoiceRef = doc(db, INVOICES, invoice.id);
    const invoiceSnapshot = await transaction.get(invoiceRef);
    if (!invoiceSnapshot.exists()) return;
    if (invoiceSnapshot.data().status !== InvoiceStatus.DRAFT) throw new InvoicingError('not-a-draft');

    const orderIds: string[] = invoiceSnapshot.data().orderIds || [];
    const orderRefs = orderIds.map(orderId => doc(db, 'orders', orderId));
    const orderSnapshots = await Promise.all(orderRefs.map(ref => transaction.get(ref)));

    orderSnapshots.forEach((snapshot, index) => {
      if (snapshot.exists()) transaction.update(orderRefs[index], orderUnlinkPatch());
    });

    transaction.delete(invoiceRef);
  });
}
