import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth, hasTeamAccess } from '../contexts/AuthContext';
import { InvoiceStatus, OrderStatus } from '../types';
import { useOrders } from '../hooks/useOrders';
import AppShell from '../components/AppShell';
import Pagination from '../components/Pagination';
import InvoiceStatusBadge from '../components/InvoiceStatusBadge';
import InvoiceDetailsModal from '../components/InvoiceDetailsModal';
import CumulateInvoicesModal from '../components/CumulateInvoicesModal';
import { subscribeToInvoices } from '../services/invoicingService';
import {
  formatMoney,
  getInvoiceClientLabel,
  getInvoiceClientSecondaryLabel,
  isOrderBillable
} from '../utils/invoicing';
import { formatDate } from '../utils/dateUtils';

const INVOICES_PER_PAGE = 20;

type InvoiceTab = 'draft' | 'issued' | 'paid' | 'cancelled';

const TABS: InvoiceTab[] = ['draft', 'issued', 'paid', 'cancelled'];

/**
 * Invoices workspace.
 *
 * Drafts accumulate orders until someone issues them. The page keeps a live
 * list of both invoices and the finished orders that are still unbilled, so
 * the gap between "work done" and "money asked for" is always visible.
 */
export default function Invoices() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<InvoiceTab>('draft');
  const [searchQuery, setSearchQuery] = useState('');
  const [monthFilter, setMonthFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);
  const [showCumulate, setShowCumulate] = useState(false);

  // Only finished orders matter here, which keeps this page off the full
  // orders collection even when the archive grows.
  const { orders } = useOrders({
    statuses: [OrderStatus.COMPLETED, OrderStatus.DELIVERED],
    enabled: hasTeamAccess(userProfile)
  });

  useEffect(() => {
    if (userProfile && !hasTeamAccess(userProfile)) {
      navigate('/dashboard');
    }
  }, [userProfile, navigate]);

  useEffect(() => {
    if (!currentUser || !hasTeamAccess(userProfile)) return;

    setLoading(true);
    const unsubscribe = subscribeToInvoices(
      next => {
        setInvoices(next);
        setLoading(false);
      },
      error => {
        if (import.meta.env.DEV) console.error('Error loading invoices:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser, userProfile]);

  const billableOrders = useMemo(() => orders.filter(isOrderBillable), [orders]);

  const uninvoicedValue = useMemo(
    () =>
      Math.round(
        billableOrders.reduce((sum, order) => {
          const total = (order.subOrders || []).reduce((itemSum: number, subOrder: any) => {
            const positions = subOrder?.positioning;
            if (!Array.isArray(positions)) return itemSum;
            return (
              itemSum +
              positions.reduce((positionSum: number, position: any) => {
                const quantity = Number(position?.quantity);
                const unit = Number(position?.cmp);
                return positionSum + (Number.isFinite(quantity) && Number.isFinite(unit) ? quantity * unit : 0);
              }, 0)
            );
          }, 0);
          return sum + total;
        }, 0) * 100
      ) / 100,
    [billableOrders]
  );

  const monthOptions = useMemo(() => {
    const locale = i18n.language?.startsWith('en') ? 'en-GB' : 'ro-RO';
    const keys = new Set<string>();

    invoices.forEach(invoice => {
      const date = invoice.createdAt?.toDate?.();
      if (!date) return;
      keys.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    });

    return Array.from(keys)
      .sort((a, b) => b.localeCompare(a))
      .map(key => {
        const [year, month] = key.split('-');
        const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(locale, {
          month: 'long',
          year: 'numeric'
        });
        return { key, label: label.charAt(0).toUpperCase() + label.slice(1) };
      });
  }, [invoices, i18n.language]);

  /** Every filter except the tab, so the tab counts match what a tab shows. */
  const matchesFilters = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return (invoice: any) => {
      if (monthFilter !== 'all') {
        const date = invoice.createdAt?.toDate?.();
        if (!date) return false;
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (key !== monthFilter) return false;
      }

      if (!query) return true;

      return Boolean(
        invoice.number?.toLowerCase().includes(query) ||
          invoice.clientName?.toLowerCase().includes(query) ||
          invoice.clientCompany?.toLowerCase().includes(query) ||
          invoice.clientCui?.toLowerCase().includes(query) ||
          invoice.clientEmail?.toLowerCase().includes(query) ||
          (invoice.orders || []).some(
            (orderRef: any) =>
              orderRef?.number?.toLowerCase().includes(query) ||
              orderRef?.name?.toLowerCase().includes(query)
          )
      );
    };
  }, [searchQuery, monthFilter]);

  const tabCounts = useMemo(() => {
    const counts: Record<InvoiceTab, number> = { draft: 0, issued: 0, paid: 0, cancelled: 0 };
    invoices.filter(matchesFilters).forEach(invoice => {
      const status = invoice.status as InvoiceTab;
      if (status in counts) counts[status]++;
    });
    return counts;
  }, [invoices, matchesFilters]);

  const filteredInvoices = useMemo(
    () => invoices.filter(invoice => invoice.status === activeTab && matchesFilters(invoice)),
    [invoices, activeTab, matchesFilters]
  );

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / INVOICES_PER_PAGE));

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, monthFilter]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const visibleInvoices = useMemo(
    () =>
      filteredInvoices.slice((currentPage - 1) * INVOICES_PER_PAGE, currentPage * INVOICES_PER_PAGE),
    [filteredInvoices, currentPage]
  );

  const stats = useMemo(() => {
    const drafts = invoices.filter(invoice => invoice.status === InvoiceStatus.DRAFT);
    const issued = invoices.filter(invoice => invoice.status === InvoiceStatus.ISSUED);
    const sum = (list: any[]) =>
      Math.round(list.reduce((total, invoice) => total + (invoice.total || 0), 0) * 100) / 100;

    return {
      draftCount: drafts.length,
      draftValue: sum(drafts),
      unpaidCount: issued.length,
      unpaidValue: sum(issued)
    };
  }, [invoices]);

  return (
    <AppShell title={t('invoices.title')}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <button
            data-testid="invoices-stat-uninvoiced"
            onClick={() => setShowCumulate(true)}
            className="text-left bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
          >
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
              {t('invoices.stats.uninvoiced')}
            </p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {billableOrders.length}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
              {formatMoney(uninvoicedValue)}
            </p>
          </button>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 border border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">{t('invoices.stats.drafts')}</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.draftCount}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
              {formatMoney(stats.draftValue)}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 border border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">{t('invoices.stats.unpaid')}</p>
            <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{stats.unpaidCount}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
              {formatMoney(stats.unpaidValue)}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 mb-6 border border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('invoices.filters.search')}
              </label>
              <input
                data-testid="invoices-search"
                type="text"
                placeholder={t('invoices.filters.searchPlaceholder')}
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('dashboard.filters.month')}
              </label>
              <select
                data-testid="invoices-month-filter"
                value={monthFilter}
                onChange={event => setMonthFilter(event.target.value)}
                className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">{t('dashboard.filters.allMonths')}</option>
                {monthOptions.map(month => (
                  <option key={month.key} value={month.key}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 mb-6">
          <div className="flex border-b border-slate-200 dark:border-slate-700">
            {TABS.map(tab => (
              <button
                key={tab}
                data-testid={`invoices-tab-${tab}`}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-3 sm:px-6 py-4 text-sm font-medium transition-colors relative ${
                  activeTab === tab
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {t(`invoices.status.${tab}`)}
                <span
                  className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    activeTab === tab
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {tabCounts[tab]}
                </span>
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center gap-2">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
              {t('invoices.listTitle')} ({filteredInvoices.length})
            </h2>
            <button
              data-testid="invoices-cumulate-button"
              onClick={() => setShowCumulate(true)}
              className="px-3 sm:px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-medium text-sm hover:opacity-90 transition-opacity flex items-center gap-2 shrink-0"
            >
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className="whitespace-nowrap">{t('invoices.cumulate.action')}</span>
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-12 text-center">
              <svg
                className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
                {t('invoices.empty.title')}
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t(`invoices.empty.${activeTab}`)}
              </p>
              {activeTab === 'draft' && billableOrders.length > 0 && (
                <button
                  onClick={() => setShowCumulate(true)}
                  className="mt-6 inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:opacity-90 transition-opacity"
                >
                  {t('invoices.cumulate.action')}
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table data-testid="invoices-table" className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t('invoices.table.number')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t('invoices.table.client')}
                    </th>
                    <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t('invoices.table.period')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t('invoices.table.orders')}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t('invoices.table.total')}
                    </th>
                    <th className="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t('invoices.table.status')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                  {visibleInvoices.map(invoice => (
                    <tr
                      key={invoice.id}
                      data-testid={`invoice-row-${invoice.id}`}
                      onClick={() => setOpenInvoiceId(invoice.id)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 text-sm">
                        <div className="font-mono text-slate-900 dark:text-white">
                          {invoice.number || t('invoices.details.draftTitle')}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(invoice.issuedAt || invoice.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {getInvoiceClientLabel(invoice) || t('invoices.unknownClient')}
                        </div>
                        {getInvoiceClientSecondaryLabel(invoice) && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {getInvoiceClientSecondaryLabel(invoice)}
                          </div>
                        )}
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {invoice.periodStart && invoice.periodEnd
                          ? `${formatDate(invoice.periodStart)} - ${formatDate(invoice.periodEnd)}`
                          : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {t('invoices.orderCount', { count: (invoice.orderIds || []).length })}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-semibold tabular-nums text-slate-900 dark:text-white whitespace-nowrap">
                        {formatMoney(invoice.total, invoice.currency)}
                      </td>
                      <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap">
                        <InvoiceStatusBadge status={invoice.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination
            testId="invoices-pagination"
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredInvoices.length}
            pageSize={INVOICES_PER_PAGE}
            onChange={page => setCurrentPage(Math.min(Math.max(page, 1), totalPages))}
          />
        </div>
      </div>

      <InvoiceDetailsModal
        invoiceId={openInvoiceId}
        onClose={() => setOpenInvoiceId(null)}
        billableOrders={billableOrders}
      />

      <CumulateInvoicesModal
        open={showCumulate}
        onClose={() => setShowCumulate(false)}
        orders={orders}
        onDone={ids => {
          setActiveTab('draft');
          if (ids.length === 1) setOpenInvoiceId(ids[0]);
        }}
      />
    </AppShell>
  );
}
