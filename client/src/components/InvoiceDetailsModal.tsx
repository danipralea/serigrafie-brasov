import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth, hasAdminAccess } from '../contexts/AuthContext';
import { InvoiceStatus } from '../types';
import { useCollapsedItems } from '../hooks/useCollapsedItems';
import {
  InvoiceLine,
  computeTotals,
  formatMoney,
  getClientGroupKey,
  getInvoiceClientLabel,
  getInvoiceClientSecondaryLabel,
  getOrderNumber,
  getOrderTotal,
  getUnpricedLines
} from '../utils/invoicing';
import {
  addOrdersToInvoice,
  cancelInvoice,
  deleteDraftInvoice,
  fetchOrdersWithSubOrders,
  issueInvoice,
  markInvoicePaid,
  removeOrderFromInvoice,
  subscribeToInvoice,
  syncDraftFromOrders,
  updateDraftInvoice
} from '../services/invoicingService';
import { buildCumulativeInvoiceData, downloadInvoice, sendInvoiceToClient } from '../services/invoiceService';
import { showError, showSuccess } from '../services/notificationService';
import { formatPositioning, normalizePositioning } from '../utils/positioning';
import { formatDate } from '../utils/dateUtils';
import ConfirmDialog from './ConfirmDialog';
import InvoiceStatusBadge from './InvoiceStatusBadge';

interface InvoiceDetailsModalProps {
  invoiceId: string | null;
  onClose: () => void;
  /** Finished orders that are not on any invoice yet, for the add panel. */
  billableOrders: any[];
}

const VAT_RATES = [21, 19, 11, 9, 5, 0];

/**
 * The working surface of one invoice.
 *
 * A draft is editable: orders come and go, amounts can be corrected by hand and
 * the VAT rate is a choice. Once issued the document is read-only - the numbers
 * it carries have already been reported.
 */
export default function InvoiceDetailsModal({
  invoiceId,
  onClose,
  billableOrders
}: InvoiceDetailsModalProps) {
  const { t } = useTranslation();
  const { currentUser, userProfile } = useAuth();
  const { isCollapsed, toggle: toggleCollapsed } = useCollapsedItems();

  const [invoice, setInvoice] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [confirm, setConfirm] = useState<'issue' | 'cancel' | 'delete' | null>(null);

  // Local edits to a draft, saved explicitly.
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [vatRate, setVatRate] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [dirty, setDirty] = useState(false);

  const isDraft = invoice?.status === InvoiceStatus.DRAFT;
  const canDownload = Boolean(invoice);

  // Live invoice - another team member's edit shows up straight away.
  useEffect(() => {
    if (!invoiceId) {
      setInvoice(null);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToInvoice(
      invoiceId,
      next => {
        setInvoice(next);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsubscribe();
  }, [invoiceId]);

  // Reset the editing buffer whenever a different invoice is opened.
  useEffect(() => {
    setDirty(false);
    setShowAddPanel(false);
  }, [invoiceId]);

  // A draft is rebuilt from its live orders on open, so edits made to an order
  // after it joined the invoice are reflected before anyone issues it.
  useEffect(() => {
    let cancelled = false;
    if (!invoice?.id) return;

    (async () => {
      const loaded = await fetchOrdersWithSubOrders(invoice.orderIds || []);
      if (cancelled) return;
      setOrders(loaded);

      if (invoice.status === InvoiceStatus.DRAFT && !dirty) {
        try {
          await syncDraftFromOrders(invoice, loaded);
        } catch {
          // A failed resync is not fatal - the stored lines stay valid.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // Deliberately keyed on the order set, not the whole invoice, so saving
    // edits does not trigger another fetch-and-resync round.
  }, [invoice?.id, (invoice?.orderIds || []).join(',')]);

  // Adopt server state into the editing buffer while there is nothing unsaved.
  useEffect(() => {
    if (!invoice || dirty) return;
    setLines(invoice.lines || []);
    setVatRate(invoice.vatRate ?? 0);
    setNotes(invoice.notes || '');
  }, [invoice, dirty]);

  const totals = useMemo(() => computeTotals(lines, vatRate), [lines, vatRate]);
  const unpricedCount = useMemo(() => getUnpricedLines(lines).length, [lines]);

  /** Finished orders of this client that could still join the invoice. */
  const addableOrders = useMemo(() => {
    if (!invoice) return [];
    const invoiceKey = getClientGroupKey(invoice);
    const alreadyOn = new Set(invoice.orderIds || []);
    return (billableOrders || []).filter(
      order => !alreadyOn.has(order.id) && getClientGroupKey(order) === invoiceKey
    );
  }, [invoice, billableOrders]);

  if (!invoiceId) return null;

  const actor = {
    uid: currentUser?.uid || '',
    name: userProfile?.displayName || currentUser?.displayName || currentUser?.email
  };

  function updateLineAmount(index: number, raw: string) {
    const parsed = raw.trim() === '' ? null : Number(raw);
    setLines(previous =>
      previous.map((line, position) =>
        position === index
          ? {
              ...line,
              amount: parsed !== null && Number.isFinite(parsed) ? parsed : null,
              amountOverridden: true
            }
          : line
      )
    );
    setDirty(true);
  }

  async function handleSaveDraft() {
    if (!invoice) return;
    setBusy(true);
    try {
      await updateDraftInvoice(invoice, { lines, vatRate, notes });
      setDirty(false);
      showSuccess(t('invoices.details.saved'));
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error saving invoice:', error);
      showError(t('invoices.details.saveError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleAddOrder(order: any) {
    if (!invoice) return;
    setBusy(true);
    try {
      await addOrdersToInvoice(invoice.id, [order], orders);
      showSuccess(t('invoices.details.orderAdded'));
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error adding order:', error);
      showError(t('invoices.details.orderAddError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveOrder(orderId: string) {
    if (!invoice) return;
    setBusy(true);
    try {
      await removeOrderFromInvoice(invoice.id, orderId, orders);
      setDirty(false);
      showSuccess(t('invoices.details.orderRemoved'));
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error removing order:', error);
      showError(t('invoices.details.orderRemoveError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleIssue() {
    if (!invoice) return;
    setBusy(true);
    try {
      if (dirty) await updateDraftInvoice(invoice, { lines, vatRate, notes });
      const number = await issueInvoice({ ...invoice, lines, vatRate, notes }, actor);
      setDirty(false);
      showSuccess(t('invoices.details.issued', { number }));
    } catch (error: any) {
      if (import.meta.env.DEV) console.error('Error issuing invoice:', error);
      showError(
        error?.code === 'empty-invoice'
          ? t('invoices.details.issueEmptyError')
          : t('invoices.details.issueError')
      );
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  async function handleCancel() {
    if (!invoice) return;
    setBusy(true);
    try {
      await cancelInvoice(invoice, actor);
      showSuccess(t('invoices.details.cancelled'));
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error cancelling invoice:', error);
      showError(t('invoices.details.cancelError'));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  async function handleDelete() {
    if (!invoice) return;
    setBusy(true);
    try {
      await deleteDraftInvoice(invoice);
      showSuccess(t('invoices.details.deleted'));
      onClose();
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error deleting draft:', error);
      showError(t('invoices.details.deleteError'));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  async function handleTogglePaid() {
    if (!invoice) return;
    setBusy(true);
    try {
      await markInvoicePaid(invoice, invoice.status !== InvoiceStatus.PAID);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error updating payment state:', error);
      showError(t('invoices.details.paidError'));
    } finally {
      setBusy(false);
    }
  }

  function handleDownload() {
    if (!invoice) return;
    try {
      // A draft downloads with whatever is on screen, including unsaved edits.
      downloadInvoice(
        buildCumulativeInvoiceData(isDraft ? { ...invoice, lines, vatRate, notes, ...totals } : invoice)
      );
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error downloading invoice:', error);
      showError(t('invoices.details.downloadError'));
    }
  }

  async function handleSend() {
    if (!invoice) return;
    setBusy(true);
    try {
      await sendInvoiceToClient(buildCumulativeInvoiceData(invoice));
      showSuccess(t('invoices.details.sent'));
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error sending invoice:', error);
      showError(t('invoices.details.sendError'));
    } finally {
      setBusy(false);
    }
  }

  const orderRefs: any[] = invoice?.orders || [];

  return (
    <>
      <div
        data-testid="invoice-details-modal"
        className="fixed inset-0 bg-slate-900/75 dark:bg-black/80 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <div
          className="bg-white dark:bg-slate-800 rounded-lg max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-700"
          onClick={event => event.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {invoice?.number || t('invoices.details.draftTitle')}
                </h3>
                {invoice && <InvoiceStatusBadge status={invoice.status} size="md" />}
              </div>
              {invoice && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 truncate">
                  {getInvoiceClientLabel(invoice) || t('invoices.unknownClient')}
                  {getInvoiceClientSecondaryLabel(invoice)
                    ? ` - ${getInvoiceClientSecondaryLabel(invoice)}`
                    : ''}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label={t('common.close')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="px-6 py-4 overflow-y-auto flex-1 space-y-6">
            {loading || !invoice ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
              </div>
            ) : (
              <>
                {/* Meta */}
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">{t('invoices.details.created')}</dt>
                    <dd className="text-slate-900 dark:text-white">{formatDate(invoice.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">{t('invoices.details.period')}</dt>
                    <dd className="text-slate-900 dark:text-white">
                      {invoice.periodStart && invoice.periodEnd
                        ? `${formatDate(invoice.periodStart)} - ${formatDate(invoice.periodEnd)}`
                        : t('invoices.details.noPeriod')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">{t('invoices.details.issuedAt')}</dt>
                    <dd className="text-slate-900 dark:text-white">
                      {invoice.issuedAt ? formatDate(invoice.issuedAt) : '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">{t('invoices.details.dueDate')}</dt>
                    <dd className="text-slate-900 dark:text-white">
                      {invoice.dueDate ? formatDate(invoice.dueDate) : '-'}
                    </dd>
                  </div>
                </dl>

                {/* Client card */}
                <div className="rounded-lg bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-700 p-4 text-sm">
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                    {t('invoices.details.client')}
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-slate-600 dark:text-slate-300">
                    <p>{invoice.clientName || '-'}</p>
                    {invoice.clientCompany && <p>{invoice.clientCompany}</p>}
                    {invoice.clientCui && <p>CUI: {invoice.clientCui}</p>}
                    {invoice.clientEmail && <p>{invoice.clientEmail}</p>}
                    {invoice.clientPhone && <p>{invoice.clientPhone}</p>}
                  </div>
                  {!invoice.clientCui && (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                      {t('invoices.details.missingCui')}
                    </p>
                  )}
                </div>

                {/* Orders */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-slate-900 dark:text-white">
                      {t('invoices.details.orders')}{' '}
                      <span className="text-slate-400 font-normal">({orderRefs.length})</span>
                    </h4>
                    {isDraft && (
                      <button
                        data-testid="invoice-add-orders-toggle"
                        onClick={() => setShowAddPanel(value => !value)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        {t('invoices.details.addOrders')}
                      </button>
                    )}
                  </div>

                  {isDraft && showAddPanel && (
                    <div className="mb-3 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 p-3">
                      {addableOrders.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {t('invoices.details.noAddableOrders')}
                        </p>
                      ) : (
                        <ul className="space-y-1 max-h-52 overflow-y-auto">
                          {addableOrders.map(order => (
                            <li
                              key={order.id}
                              className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                            >
                              <span className="text-sm text-slate-700 dark:text-slate-200 truncate">
                                <span className="font-mono text-xs">#{getOrderNumber(order)}</span>
                                {order.orderName ? ` - ${order.orderName}` : ''}
                                <span className="text-xs text-slate-400 ml-2">
                                  {formatDate(order.createdAt)}
                                </span>
                              </span>
                              <span className="flex items-center gap-2 shrink-0">
                                <span className="text-sm tabular-nums text-slate-600 dark:text-slate-300">
                                  {formatMoney(getOrderTotal(order))}
                                </span>
                                <button
                                  data-testid={`invoice-add-order-${order.id}`}
                                  onClick={() => handleAddOrder(order)}
                                  disabled={busy}
                                  className="px-2 py-1 rounded-md text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                >
                                  {t('invoices.details.add')}
                                </button>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {orderRefs.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
                      {t('invoices.details.emptyOrders')}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {orderRefs.map(orderRef => {
                        const orderLines = lines
                          .map((line, index) => ({ line, index }))
                          .filter(entry => entry.line.orderId === orderRef.id);
                        const orderTotal = orderLines.reduce(
                          (sum, entry) => sum + (entry.line.amount ?? 0),
                          0
                        );
                        const collapsed = isCollapsed(orderRef.id);

                        return (
                          <li
                            key={orderRef.id}
                            data-testid={`invoice-order-${orderRef.id}`}
                            className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden"
                          >
                            <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 dark:bg-slate-700/40">
                              <button
                                onClick={() => toggleCollapsed(orderRef.id)}
                                aria-expanded={!collapsed}
                                className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                              >
                                <svg
                                  className={`w-4 h-4 transition-transform ${collapsed ? '-rotate-90' : ''}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                                    #{orderRef.number}
                                  </span>
                                  {orderRef.name ? ` ${orderRef.name}` : ''}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {orderRef.createdAtMillis ? formatDate(new Date(orderRef.createdAtMillis)) : ''}
                                  {' - '}
                                  {t('invoices.lineCount', { count: orderLines.length })}
                                </p>
                              </div>
                              <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                                {formatMoney(orderTotal)}
                              </span>
                              {isDraft && (
                                <button
                                  data-testid={`invoice-remove-order-${orderRef.id}`}
                                  onClick={() => handleRemoveOrder(orderRef.id)}
                                  disabled={busy}
                                  title={t('invoices.details.removeOrder')}
                                  className="p-1.5 rounded-md text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>

                            {!collapsed && (
                              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                {orderLines.length === 0 && (
                                  <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                                    {t('invoices.details.noLines')}
                                  </p>
                                )}
                                {orderLines.map(({ line, index }) => {
                                  const positioning = formatPositioning(
                                    normalizePositioning(line.positioning)
                                  );

                                  return (
                                    <div
                                      key={`${line.orderId}-${line.subOrderId}-${index}`}
                                      className="px-4 py-2.5 flex items-start gap-3"
                                    >
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm text-slate-900 dark:text-white">
                                          {line.productType}
                                          {line.quantity !== null && line.quantity !== undefined && (
                                            <span className="text-slate-500 dark:text-slate-400">
                                              {' '}
                                              x{line.quantity}
                                            </span>
                                          )}
                                        </p>
                                        {positioning && (
                                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            {positioning}
                                          </p>
                                        )}
                                        {line.description && (
                                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            {line.description}
                                          </p>
                                        )}
                                      </div>
                                      {isDraft ? (
                                        <div className="shrink-0 flex items-center gap-1">
                                          <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            data-testid={`invoice-line-amount-${index}`}
                                            value={line.amount ?? ''}
                                            onChange={event => updateLineAmount(index, event.target.value)}
                                            placeholder="0.00"
                                            className={`w-28 h-9 px-2 text-right tabular-nums bg-white dark:bg-slate-700 border rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                              line.amount === null || line.amount === undefined
                                                ? 'border-amber-400 dark:border-amber-600'
                                                : 'border-slate-300 dark:border-slate-600'
                                            }`}
                                          />
                                          <span className="text-xs text-slate-400">
                                            {invoice.currency || 'RON'}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="shrink-0 text-sm tabular-nums text-slate-900 dark:text-white">
                                          {formatMoney(line.amount, invoice.currency)}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
                    {t('invoices.details.notes')}
                  </label>
                  {isDraft ? (
                    <textarea
                      data-testid="invoice-notes"
                      value={notes}
                      onChange={event => {
                        setNotes(event.target.value);
                        setDirty(true);
                      }}
                      rows={2}
                      placeholder={t('invoices.details.notesPlaceholder')}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {invoice.notes || t('invoices.details.noNotes')}
                    </p>
                  )}
                </div>

                {/* Totals */}
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                  {unpricedCount > 0 && (
                    <p className="mb-3 text-sm text-amber-600 dark:text-amber-400">
                      {t('invoices.details.unpricedLines', { count: unpricedCount })}
                    </p>
                  )}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300">
                        {t('invoices.details.subtotal')}
                      </span>
                      <span className="tabular-nums text-slate-900 dark:text-white">
                        {formatMoney(totals.subtotal, invoice.currency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        {t('invoices.details.vat')}
                        {isDraft ? (
                          <select
                            data-testid="invoice-vat-rate"
                            value={vatRate}
                            onChange={event => {
                              setVatRate(Number(event.target.value));
                              setDirty(true);
                            }}
                            className="h-8 px-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {VAT_RATES.map(rate => (
                              <option key={rate} value={rate}>
                                {rate}%
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-slate-400">({invoice.vatRate ?? 0}%)</span>
                        )}
                      </span>
                      <span className="tabular-nums text-slate-900 dark:text-white">
                        {formatMoney(totals.vatAmount, invoice.currency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {t('invoices.details.total')}
                      </span>
                      <span
                        data-testid="invoice-total"
                        className="text-lg font-bold tabular-nums text-slate-900 dark:text-white"
                      >
                        {formatMoney(totals.total, invoice.currency)}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          {invoice && (
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {canDownload && (
                  <button
                    data-testid="invoice-download"
                    onClick={handleDownload}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {t('invoices.details.download')}
                  </button>
                )}
                {!isDraft && invoice.status !== InvoiceStatus.CANCELLED && (
                  <button
                    onClick={handleSend}
                    disabled={busy}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                  >
                    {t('invoices.details.send')}
                  </button>
                )}
                {(invoice.status === InvoiceStatus.ISSUED || invoice.status === InvoiceStatus.PAID) && (
                  <button
                    data-testid="invoice-toggle-paid"
                    onClick={handleTogglePaid}
                    disabled={busy}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                      invoice.status === InvoiceStatus.PAID
                        ? 'text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                        : 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50'
                    }`}
                  >
                    {invoice.status === InvoiceStatus.PAID
                      ? t('invoices.details.markUnpaid')
                      : t('invoices.details.markPaid')}
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {isDraft && (
                  <>
                    <button
                      data-testid="invoice-delete-draft"
                      onClick={() => setConfirm('delete')}
                      disabled={busy}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
                    >
                      {t('invoices.details.deleteDraft')}
                    </button>
                    <button
                      data-testid="invoice-save-draft"
                      onClick={handleSaveDraft}
                      disabled={busy || !dirty}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40"
                    >
                      {t('invoices.details.save')}
                    </button>
                    <button
                      data-testid="invoice-issue"
                      onClick={() => setConfirm('issue')}
                      disabled={busy || orderRefs.length === 0}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {t('invoices.details.issue')}
                    </button>
                  </>
                )}
                {invoice.status !== InvoiceStatus.DRAFT &&
                  invoice.status !== InvoiceStatus.CANCELLED &&
                  hasAdminAccess(userProfile) && (
                    <button
                      data-testid="invoice-cancel"
                      onClick={() => setConfirm('cancel')}
                      disabled={busy}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
                    >
                      {t('invoices.details.cancelInvoice')}
                    </button>
                  )}
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirm === 'issue'}
        onClose={() => setConfirm(null)}
        onConfirm={handleIssue}
        title={t('invoices.details.issue')}
        message={t('invoices.details.issueConfirm', {
          orders: t('invoices.orderCount', { count: orderRefs.length }),
          total: formatMoney(totals.total, invoice?.currency)
        })}
        confirmText={t('invoices.details.issue')}
        cancelText={t('common.cancel')}
        type="info"
      />

      <ConfirmDialog
        isOpen={confirm === 'cancel'}
        onClose={() => setConfirm(null)}
        onConfirm={handleCancel}
        title={t('invoices.details.cancelInvoice')}
        message={t('invoices.details.cancelConfirm')}
        confirmText={t('invoices.details.cancelInvoice')}
        cancelText={t('common.cancel')}
        type="danger"
      />

      <ConfirmDialog
        isOpen={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={handleDelete}
        title={t('invoices.details.deleteDraft')}
        message={t('invoices.details.deleteConfirm')}
        confirmText={t('invoices.details.deleteDraft')}
        cancelText={t('common.cancel')}
        type="danger"
      />
    </>
  );
}
