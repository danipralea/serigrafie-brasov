import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import {
  BillingPeriod,
  BillingPeriodPreset,
  formatMoney,
  getBillingPeriod,
  getInvoiceClientLabel,
  getInvoiceClientSecondaryLabel,
  planCumulativeInvoices
} from '../utils/invoicing';
import { createDraftInvoices } from '../services/invoicingService';
import { showError, showSuccess } from '../services/notificationService';
import { formatDate } from '../utils/dateUtils';

interface CumulateInvoicesModalProps {
  open: boolean;
  onClose: () => void;
  /** Every order the page knows about, hydrated with sub-orders. */
  orders: any[];
  onDone?: (invoiceIds: string[]) => void;
}

const PRESETS: BillingPeriodPreset[] = ['this-week', 'last-week', 'this-month', 'last-month', 'all'];

function toDateInput(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * The periodic billing run.
 *
 * Picks every finished, not-yet-invoiced order in a period and groups it into
 * one draft per client. Nothing is issued here - the run only prepares drafts,
 * which a person still reviews and issues.
 */
export default function CumulateInvoicesModal({
  open,
  onClose,
  orders,
  onDone
}: CumulateInvoicesModalProps) {
  const { t } = useTranslation();
  const { currentUser, userProfile } = useAuth();
  const [preset, setPreset] = useState<BillingPeriodPreset>('last-week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);

  const period = useMemo<BillingPeriod>(() => {
    if (useCustom && customStart && customEnd) {
      const start = new Date(`${customStart}T00:00:00`);
      const end = new Date(`${customEnd}T23:59:59.999`);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) return { start, end };
    }
    return getBillingPeriod(preset);
  }, [preset, useCustom, customStart, customEnd]);

  const groups = useMemo(
    () => planCumulativeInvoices(orders, preset === 'all' && !useCustom ? null : period),
    [orders, period, preset, useCustom]
  );

  // A fresh plan starts with every client selected.
  useEffect(() => {
    setExcluded(new Set());
  }, [open, preset, useCustom, customStart, customEnd]);

  useEffect(() => {
    if (!open) return;
    const defaults = getBillingPeriod('last-week');
    setCustomStart(current => current || toDateInput(defaults.start));
    setCustomEnd(current => current || toDateInput(defaults.end));
  }, [open]);

  if (!open) return null;

  const selectedGroups = groups.filter(group => !excluded.has(getInvoiceClientLabel(group.client)));
  const selectedOrderCount = selectedGroups.reduce((sum, group) => sum + group.orderCount, 0);
  const selectedTotal = selectedGroups.reduce((sum, group) => sum + group.subtotal, 0);

  function toggleGroup(label: string) {
    setExcluded(previous => {
      const next = new Set(previous);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  async function handleRun() {
    if (!currentUser || selectedGroups.length === 0) return;

    setRunning(true);
    try {
      const { created, failed } = await createDraftInvoices(selectedGroups, {
        actor: {
          uid: currentUser.uid,
          name: userProfile?.displayName || currentUser.displayName || currentUser.email
        },
        period: preset === 'all' && !useCustom ? null : period
      });

      if (created.length > 0) {
        showSuccess(t('invoices.cumulate.success', { count: created.length }));
        onDone?.(created);
      }
      if (failed.length > 0) {
        showError(t('invoices.cumulate.partialError', { count: failed.length }));
      }
      if (failed.length === 0) onClose();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error running cumulative billing:', error);
      }
      showError(t('invoices.cumulate.error'));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div
      data-testid="cumulate-invoices-modal"
      className="fixed inset-0 bg-slate-900/75 dark:bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-lg max-w-3xl w-full max-h-[88vh] flex flex-col border border-slate-200 dark:border-slate-700"
        onClick={event => event.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {t('invoices.cumulate.title')}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('invoices.cumulate.subtitle')}
          </p>
        </div>

        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(option => (
              <button
                key={option}
                data-testid={`cumulate-preset-${option}`}
                onClick={() => {
                  setPreset(option);
                  setUseCustom(false);
                }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  !useCustom && preset === option
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {t(`invoices.cumulate.presets.${option}`)}
              </button>
            ))}
            <button
              onClick={() => setUseCustom(true)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                useCustom
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {t('invoices.cumulate.presets.custom')}
            </button>
          </div>

          {useCustom && (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  {t('invoices.cumulate.from')}
                </label>
                <input
                  type="date"
                  value={customStart}
                  onChange={event => setCustomStart(event.target.value)}
                  className="h-10 px-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  {t('invoices.cumulate.to')}
                </label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={event => setCustomEnd(event.target.value)}
                  className="h-10 px-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {!(preset === 'all' && !useCustom) && (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              {t('invoices.cumulate.periodLabel', {
                from: formatDate(period.start),
                to: formatDate(period.end)
              })}
            </p>
          )}
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1">
          {groups.length === 0 ? (
            <div className="py-10 text-center">
              <svg className="mx-auto h-10 w-10 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
                {t('invoices.cumulate.emptyTitle')}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t('invoices.cumulate.emptyDesc')}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {groups.map(group => {
                const label = getInvoiceClientLabel(group.client) || t('invoices.unknownClient');
                const isSelected = !excluded.has(label);

                return (
                  <li key={label}>
                    <label
                      data-testid={`cumulate-group-${label}`}
                      className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-blue-300 dark:border-blue-700 bg-blue-50/60 dark:bg-blue-900/20'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleGroup(label)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="font-medium text-slate-900 dark:text-white truncate">{label}</p>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums shrink-0">
                            {formatMoney(group.subtotal)}
                          </p>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {getInvoiceClientSecondaryLabel(group.client)
                            ? `${getInvoiceClientSecondaryLabel(group.client)} - `
                            : ''}
                          {t('invoices.orderCount', { count: group.orderCount })}
                        </p>
                        {group.unpricedOrderIds.length > 0 && (
                          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                            {t('invoices.cumulate.unpricedWarning', {
                              count: group.unpricedOrderIds.length
                            })}
                          </p>
                        )}
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t('invoices.cumulate.summary', {
              invoices: selectedGroups.length,
              orders: selectedOrderCount,
              total: formatMoney(selectedTotal)
            })}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={running}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              data-testid="cumulate-run-button"
              onClick={handleRun}
              disabled={running || selectedGroups.length === 0}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {running
                ? t('invoices.cumulate.running')
                : t('invoices.cumulate.run', { count: selectedGroups.length })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
