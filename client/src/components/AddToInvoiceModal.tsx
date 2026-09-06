import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { InvoiceStatus } from '../types';
import {
  buildInvoiceClient,
  formatMoney,
  getClientGroupKey,
  getInvoiceClientLabel,
  getInvoiceClientSecondaryLabel,
  getOrderNumber,
  getOrderTotal
} from '../utils/invoicing';
import {
  addOrdersToInvoice,
  createDraftInvoice,
  fetchOrdersWithSubOrders
} from '../services/invoicingService';
import { showError, showSuccess } from '../services/notificationService';
import { formatDate } from '../utils/dateUtils';

interface AddToInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  /** Orders the user picked, already hydrated with their sub-orders. */
  orders: any[];
  /** Every invoice, so open drafts can be offered as a destination. */
  invoices: any[];
  /** Called with the ids of the invoices that were created or extended. */
  onDone?: (invoiceIds: string[]) => void;
}

interface TargetGroup {
  key: string;
  label: string;
  secondaryLabel: string;
  orders: any[];
  total: number | null;
  drafts: any[];
}

const NEW_INVOICE = 'new';

/**
 * Sends a selection of orders to an invoice.
 *
 * An invoice always belongs to one client, so a mixed selection is split into
 * one destination per client. Each client can either extend an open draft or
 * start a new one.
 */
export default function AddToInvoiceModal({
  open,
  onClose,
  orders,
  invoices,
  onDone
}: AddToInvoiceModalProps) {
  const { t } = useTranslation();
  const { currentUser, userProfile } = useAuth();
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const groups = useMemo<TargetGroup[]>(() => {
    const byClient = new Map<string, TargetGroup>();

    (orders || []).forEach(order => {
      const key = getClientGroupKey(order);
      const client = buildInvoiceClient(order);
      const existing = byClient.get(key);

      if (existing) {
        existing.orders.push(order);
        return;
      }

      byClient.set(key, {
        key,
        label: getInvoiceClientLabel(client) || t('invoices.unknownClient'),
        secondaryLabel: getInvoiceClientSecondaryLabel(client),
        orders: [order],
        total: null,
        drafts: (invoices || []).filter(
          invoice => invoice.status === InvoiceStatus.DRAFT && getClientGroupKey(invoice) === key
        )
      });
    });

    return Array.from(byClient.values()).map(group => {
      const totals = group.orders
        .map(getOrderTotal)
        .filter((value): value is number => value !== null);
      return {
        ...group,
        total: totals.length > 0 ? Math.round(totals.reduce((a, b) => a + b, 0) * 100) / 100 : null
      };
    });
  }, [orders, invoices, t]);

  // Default every client to their newest open draft, or to a new invoice.
  useEffect(() => {
    if (!open) return;
    const defaults: Record<string, string> = {};
    groups.forEach(group => {
      defaults[group.key] = group.drafts[0]?.id || NEW_INVOICE;
    });
    setTargets(defaults);
  }, [open, groups]);

  if (!open) return null;

  const totalOrders = (orders || []).length;
  const newInvoiceCount = groups.filter(group => targets[group.key] === NEW_INVOICE).length;

  async function handleConfirm() {
    if (!currentUser || groups.length === 0) return;

    setSaving(true);
    const touched: string[] = [];
    const failures: string[] = [];

    for (const group of groups) {
      const target = targets[group.key] || NEW_INVOICE;

      try {
        if (target === NEW_INVOICE) {
          const invoiceId = await createDraftInvoice({
            orders: group.orders,
            actor: {
              uid: currentUser.uid,
              name: userProfile?.displayName || currentUser.displayName || currentUser.email
            }
          });
          touched.push(invoiceId);
        } else {
          // The draft's current orders have to be re-read so its lines can be
          // rebuilt from live data rather than from the stored snapshot.
          const draft = group.drafts.find(invoice => invoice.id === target);
          const existingOrders = await fetchOrdersWithSubOrders(draft?.orderIds || []);
          await addOrdersToInvoice(target, group.orders, existingOrders);
          touched.push(target);
        }
      } catch (error: any) {
        if (import.meta.env.DEV) {
          console.error('Error adding orders to invoice:', error);
        }
        failures.push(group.label);
      }
    }

    setSaving(false);

    if (touched.length > 0) {
      showSuccess(t('invoices.addToInvoice.success', { count: totalOrders }));
      onDone?.(touched);
    }
    if (failures.length > 0) {
      showError(t('invoices.addToInvoice.partialError', { clients: failures.join(', ') }));
    }
    if (failures.length === 0) onClose();
  }

  return (
    <div
      data-testid="add-to-invoice-modal"
      className="fixed inset-0 bg-slate-900/75 dark:bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-lg max-w-2xl w-full max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-700"
        onClick={event => event.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {t('invoices.addToInvoice.title')}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('invoices.addToInvoice.subtitle', { count: totalOrders })}
          </p>
        </div>

        <div className="px-6 py-4 overflow-y-auto space-y-4">
          {groups.length > 1 && (
            <div className="flex gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2.5">
              <svg className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0l-7.1 12.25A2 2 0 004.99 19z" />
              </svg>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {t('invoices.addToInvoice.multipleClients', { count: groups.length })}
              </p>
            </div>
          )}

          {groups.map(group => (
            <div
              key={group.key}
              data-testid={`add-to-invoice-group-${group.key}`}
              className="rounded-lg border border-slate-200 dark:border-slate-700 p-4"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-white truncate">{group.label}</p>
                  {group.secondaryLabel && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{group.secondaryLabel}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {formatMoney(group.total)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t('invoices.orderCount', { count: group.orders.length })}
                  </p>
                </div>
              </div>

              <ul className="mb-3 space-y-1">
                {group.orders.map(order => (
                  <li
                    key={order.id}
                    className="flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400"
                  >
                    <span className="truncate">
                      <span className="font-mono">#{getOrderNumber(order)}</span>
                      {order.orderName ? ` - ${order.orderName}` : ''}
                    </span>
                    <span className="shrink-0 tabular-nums">{formatMoney(getOrderTotal(order))}</span>
                  </li>
                ))}
              </ul>

              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                {t('invoices.addToInvoice.destination')}
              </label>
              <select
                data-testid={`add-to-invoice-target-${group.key}`}
                value={targets[group.key] || NEW_INVOICE}
                onChange={event =>
                  setTargets(previous => ({ ...previous, [group.key]: event.target.value }))
                }
                className="w-full h-10 px-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={NEW_INVOICE}>{t('invoices.addToInvoice.newDraft')}</option>
                {group.drafts.map(draft => (
                  <option key={draft.id} value={draft.id}>
                    {t('invoices.addToInvoice.existingDraft', {
                      date: formatDate(draft.createdAt),
                      orders: t('invoices.orderCount', { count: (draft.orderIds || []).length }),
                      total: formatMoney(draft.total)
                    })}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {newInvoiceCount > 0
              ? t('invoices.addToInvoice.willCreate', { count: newInvoiceCount })
              : t('invoices.addToInvoice.willExtend')}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              data-testid="add-to-invoice-confirm"
              onClick={handleConfirm}
              disabled={saving || groups.length === 0}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? t('invoices.addToInvoice.saving') : t('invoices.addToInvoice.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
