import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth, hasTeamAccess, hasAdminAccess } from '../contexts/AuthContext';
import { OrderStatus } from '../types';
import { formatPositioning, normalizePositioning } from '../utils/positioning';
import { getOrderClientPrimaryName, getOrderClientSecondaryName } from '../utils/clientDisplay';
import { useDepartments } from '../hooks/useDepartments';
import { useOrders } from '../hooks/useOrders';
import PlaceOrderModal from '../components/PlaceOrderModal';
import ConfirmDialog from '../components/ConfirmDialog';
import AppShell from '../components/AppShell';
import OrderDetailsModal from '../components/OrderDetailsModal';
import AddToInvoiceModal from '../components/AddToInvoiceModal';
import Pagination from '../components/Pagination';
import { exportOrdersToExcel } from '../services/reportService';
import { showSuccess, showError } from '../services/notificationService';
import { isOrderInTrash, restoreOrderFromTrash, deleteOrderPermanently } from '../services/orderTrashService';
import { subscribeToInvoices } from '../services/invoicingService';
import { formatMoney, getClientGroupKey, getOrderTotal, isOrderBillable } from '../utils/invoicing';
import { formatDate } from '../utils/dateUtils';

export default function Dashboard() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  // Orders (with their sub-orders) come from the shared listener.
  const { orders, loading } = useOrders();
  const [showPlaceOrderModal, setShowPlaceOrderModal] = useState(false);
  const [initialOrderData, setInitialOrderData] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);

  // Invoicing: bulk selection of finished orders, plus the invoices they can
  // be added to.
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [showAddToInvoice, setShowAddToInvoice] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);

  // Tab and filter states
  const [activeTab, setActiveTab] = useState('current'); // 'current', 'past', 'invoiced' or 'trash'
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all'); // 'all' or 'YYYY-MM'
  const { departments } = useDepartments();
  const [sortBy, setSortBy] = useState('delivery-asc');
  const [searchQuery, setSearchQuery] = useState('');

  // Trash actions
  const [orderToRestore, setOrderToRestore] = useState<any>(null);
  const [orderToPurge, setOrderToPurge] = useState<any>(null);

  // Pagination - past orders is the only list that grows without bound
  const ORDERS_PER_PAGE = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const tableRef = useRef<any>(null);

  // Helper function to get earliest delivery time from sub-orders
  const getEarliestDeliveryTime = useCallback((subOrders) => {
    if (!subOrders || subOrders.length === 0) return null;

    const times = subOrders
      .map(so => so.deliveryTime)
      .filter(dt => dt); // Filter out null/undefined

    if (times.length === 0) return null;

    return times.reduce((earliest, current) => {
      return new Date(current) < new Date(earliest) ? current : earliest;
    });
  }, []);

  const openOrderDetails = useCallback((order) => {
    setSelectedOrder(order);
    setShowOrderModal(true);
  }, []);

  // Invoices are only needed to offer an existing draft as a destination.
  useEffect(() => {
    if (!currentUser || !hasTeamAccess(userProfile)) return;

    const unsubscribe = subscribeToInvoices(setInvoices, (error) => {
      if (import.meta.env.DEV) {
        console.error('Error loading invoices:', error);
      }
    });

    return () => unsubscribe();
  }, [currentUser, userProfile]);

  // Check if we need to open a specific order from notification
  useEffect(() => {
    if (location.state?.openOrderId && orders.length > 0) {
      const orderToOpen = orders.find(o => o.id === location.state.openOrderId);
      if (orderToOpen) {
        openOrderDetails(orderToOpen);
        // Clear the state so it doesn't reopen on refresh
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [location.state, orders, openOrderDetails, navigate, location.pathname]);

  // Handle Escape key to close order details modal
  useEffect(() => {
    function handleEscapeKey(event) {
      if (event.key === 'Escape' && selectedOrder) {
        setSelectedOrder(null);
      }
    }

    if (selectedOrder) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => document.removeEventListener('keydown', handleEscapeKey);
    }
  }, [selectedOrder]);

  // Deleted orders live in the trash until they are purged from there
  const activeOrders = useMemo(() => orders.filter(order => !isOrderInTrash(order)), [orders]);
  const trashedOrders = useMemo(() => orders.filter(order => isOrderInTrash(order)), [orders]);

  // Months that actually have orders, newest first
  const monthOptions = useMemo(() => {
    const locale = i18n.language?.startsWith('en') ? 'en-GB' : 'ro-RO';
    const keys = new Set<string>();

    orders.forEach(order => {
      const date = order.createdAt?.toDate?.();
      if (!date) return;
      keys.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    });

    return Array.from(keys)
      .sort((a, b) => b.localeCompare(a))
      .map(key => {
        const [year, month] = key.split('-');
        const label = new Date(Number(year), Number(month) - 1, 1)
          .toLocaleDateString(locale, { month: 'long', year: 'numeric' });
        return { key, label: label.charAt(0).toUpperCase() + label.slice(1) };
      });
  }, [orders, i18n.language]);

  // Every filter except the tab itself - so tab counts stay consistent with the list
  const matchesFilters = useCallback((order: any) => {
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;

    if (departmentFilter !== 'all' &&
        !order.subOrders?.some((so: any) => so.departmentId === departmentFilter)) {
      return false;
    }

    if (monthFilter !== 'all') {
      const date = order.createdAt?.toDate?.();
      if (!date) return false;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (key !== monthFilter) return false;
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();

      // Search in parent order fields
      const orderMatches =
        order.id.toLowerCase().includes(query) ||
        order.orderName?.toLowerCase().includes(query) ||
        order.clientName?.toLowerCase().includes(query) ||
        order.clientEmail?.toLowerCase().includes(query) ||
        order.clientPhone?.toLowerCase().includes(query) ||
        order.clientCompany?.toLowerCase().includes(query) ||
        order.userName?.toLowerCase().includes(query) ||
        order.userEmail?.toLowerCase().includes(query) ||
        order.status?.toLowerCase().includes(query);

      // Search in sub-order fields
      const subOrderMatches = order.subOrders?.some((so: any) =>
        so.productType?.toLowerCase().includes(query) ||
        so.productTypeName?.toLowerCase().includes(query) ||
        so.quantity?.toString().includes(query) ||
        formatPositioning(normalizePositioning(so.positioning, so)).toLowerCase().includes(query) ||
        so.description?.toLowerCase().includes(query) ||
        so.designFile?.toLowerCase().includes(query) ||
        so.notes?.toLowerCase().includes(query) ||
        so.status?.toLowerCase().includes(query)
      );

      if (!orderMatches && !subOrderMatches) return false;
    }

    return true;
  }, [statusFilter, departmentFilter, monthFilter, searchQuery]);

  // Tabs are mutually exclusive, every status belongs to exactly one
  function getTabForOrder(order: any) {
    if (
      order.status === OrderStatus.PENDING_CONFIRMATION ||
      order.status === OrderStatus.PENDING ||
      order.status === OrderStatus.IN_PROGRESS
    ) {
      return 'current';
    }
    if (order.status === OrderStatus.INVOICED) return 'invoiced';
    return 'past';
  }

  // Order counts per tab, with the current filters applied
  const tabCounts = useMemo(() => {
    const counts = { current: 0, past: 0, invoiced: 0, trash: 0 };

    activeOrders.forEach(order => {
      if (!matchesFilters(order)) return;
      counts[getTabForOrder(order)]++;
    });

    counts.trash = trashedOrders.filter(matchesFilters).length;

    return counts;
  }, [activeOrders, trashedOrders, matchesFilters]);

  // Use useMemo to calculate filtered orders - eliminates unnecessary state and useEffect
  const filteredOrders = useMemo(() => {
    let filtered = activeTab === 'trash'
      ? trashedOrders.filter(matchesFilters)
      : activeOrders.filter(order => getTabForOrder(order) === activeTab && matchesFilters(order));

    // Apply sorting - use earliest delivery time from sub-orders
    switch (sortBy) {
      case 'delivery-asc':
        filtered.sort((a, b) => {
          const aEarliest = getEarliestDeliveryTime(a.subOrders);
          const bEarliest = getEarliestDeliveryTime(b.subOrders);
          if (!aEarliest) return 1;
          if (!bEarliest) return -1;
          return new Date(aEarliest).getTime() - new Date(bEarliest).getTime();
        });
        break;
      case 'delivery-desc':
        filtered.sort((a, b) => {
          const aEarliest = getEarliestDeliveryTime(a.subOrders);
          const bEarliest = getEarliestDeliveryTime(b.subOrders);
          if (!aEarliest) return 1;
          if (!bEarliest) return -1;
          return new Date(bEarliest).getTime() - new Date(aEarliest).getTime();
        });
        break;
      case 'date-desc':
        filtered.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
        break;
      case 'date-asc':
        filtered.sort((a, b) => a.createdAt?.toMillis() - b.createdAt?.toMillis());
        break;
      case 'quantity-desc':
        filtered.sort((a, b) => {
          const aTotal = (a.subOrders || []).reduce((sum, so) => sum + (so.quantity || 0), 0);
          const bTotal = (b.subOrders || []).reduce((sum, so) => sum + (so.quantity || 0), 0);
          return bTotal - aTotal;
        });
        break;
      case 'quantity-asc':
        filtered.sort((a, b) => {
          const aTotal = (a.subOrders || []).reduce((sum, so) => sum + (so.quantity || 0), 0);
          const bTotal = (b.subOrders || []).reduce((sum, so) => sum + (so.quantity || 0), 0);
          return aTotal - bTotal;
        });
        break;
      case 'status':
        filtered.sort((a, b) => a.status.localeCompare(b.status));
        break;
      default:
        break;
    }

    return filtered;
  }, [activeOrders, trashedOrders, activeTab, matchesFilters, sortBy, getEarliestDeliveryTime]);

  const isPaginated = activeTab === 'past' || activeTab === 'trash';
  const totalPages = isPaginated
    ? Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE))
    : 1;

  // Back to the first page whenever the visible set changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, statusFilter, departmentFilter, monthFilter, sortBy, searchQuery]);

  // Keep the page in range when orders disappear underneath us
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const visibleOrders = useMemo(() => {
    if (!isPaginated) return filteredOrders;
    const start = (currentPage - 1) * ORDERS_PER_PAGE;
    return filteredOrders.slice(start, start + ORDERS_PER_PAGE);
  }, [filteredOrders, isPaginated, currentPage]);

  function goToPage(page: number) {
    const target = Math.min(Math.max(page, 1), totalPages);
    if (target === currentPage) return;
    setCurrentPage(target);
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // --- Invoicing selection -------------------------------------------------
  // Only the past tab can hold billable work, so the checkbox column appears
  // there and nowhere else. Rows that cannot be billed keep a disabled box with
  // an explanation rather than disappearing.
  const canSelectOrders = hasTeamAccess(userProfile) && activeTab === 'past';

  const selectableVisibleOrders = useMemo(
    () => (canSelectOrders ? visibleOrders.filter(isOrderBillable) : []),
    [canSelectOrders, visibleOrders]
  );

  const selectedOrders = useMemo(
    () => activeOrders.filter(order => selectedOrderIds.includes(order.id)),
    [activeOrders, selectedOrderIds]
  );

  const selectionTotal = useMemo(() => {
    const totals = selectedOrders
      .map(getOrderTotal)
      .filter((value): value is number => value !== null);
    if (totals.length === 0) return null;
    return Math.round(totals.reduce((sum, value) => sum + value, 0) * 100) / 100;
  }, [selectedOrders]);

  const selectedClientCount = useMemo(
    () => new Set(selectedOrders.map(getClientGroupKey)).size,
    [selectedOrders]
  );

  const allVisibleSelected =
    selectableVisibleOrders.length > 0 &&
    selectableVisibleOrders.every(order => selectedOrderIds.includes(order.id));

  // Selecting across a filter change would hide what is about to be invoiced.
  useEffect(() => {
    setSelectedOrderIds([]);
  }, [activeTab, statusFilter, departmentFilter, monthFilter, searchQuery]);

  function toggleOrderSelection(orderId: string) {
    setSelectedOrderIds(previous =>
      previous.includes(orderId)
        ? previous.filter(id => id !== orderId)
        : [...previous, orderId]
    );
  }

  function toggleSelectAllVisible() {
    const visibleIds = selectableVisibleOrders.map(order => order.id);
    setSelectedOrderIds(previous =>
      allVisibleSelected
        ? previous.filter(id => !visibleIds.includes(id))
        : [...new Set([...previous, ...visibleIds])]
    );
  }

  function handleReorder(e, order) {
    e.stopPropagation(); // Prevent row click from opening order details
    setInitialOrderData(order);
    setShowPlaceOrderModal(true);
  }

  async function restoreOrder() {
    if (!orderToRestore) return;

    try {
      await restoreOrderFromTrash(orderToRestore.id);
      setOrderToRestore(null);
      showSuccess(t('dashboard.trash.restored'));
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error('Error restoring order:', error);
      }
      showError(t('dashboard.trash.restoreError'));
      throw error;
    }
  }

  async function purgeOrder() {
    if (!orderToPurge) return;

    try {
      await deleteOrderPermanently(orderToPurge.id);
      setOrderToPurge(null);
      showSuccess(t('dashboard.trash.deletedPermanently'));
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error('Error deleting order permanently:', error);
      }
      let errorMessage = t('dashboard.orderModal.deleteError');
      if (error?.code === 'permission-denied') {
        errorMessage = t('dashboard.orderModal.deletePermissionError');
      }
      showError(errorMessage);
      throw error;
    }
  }

  function getStatusColor(status) {
    switch (status) {
      case OrderStatus.PENDING_CONFIRMATION:
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300';
      case OrderStatus.PENDING:
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
      case OrderStatus.IN_PROGRESS:
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
      case OrderStatus.COMPLETED:
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      case OrderStatus.DELIVERED:
        return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300';
      case OrderStatus.INVOICED:
        return 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300';
      case OrderStatus.CANCELLED:
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      default:
        return 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-300';
    }
  }

  function getStatusLabel(status) {
    switch (status) {
      case OrderStatus.PENDING_CONFIRMATION:
        return t('dashboard.orderModal.statuses.pendingConfirmation');
      case OrderStatus.PENDING:
        return t('dashboard.orderModal.statuses.confirmed');
      case OrderStatus.IN_PROGRESS:
        return t('dashboard.orderModal.statuses.inProduction');
      case OrderStatus.COMPLETED:
        return t('dashboard.orderModal.statuses.completed');
      case OrderStatus.DELIVERED:
        return t('dashboard.orderModal.statuses.delivered');
      case OrderStatus.INVOICED:
        return t('dashboard.orderModal.statuses.invoiced');
      case OrderStatus.CANCELLED:
        return t('dashboard.orderModal.statuses.cancelled');
      default:
        return status;
    }
  }

  function getOrderStats() {
    return {
      total: activeOrders.length,
      pending: activeOrders.filter(o => o.status === OrderStatus.PENDING).length,
      in_progress: activeOrders.filter(o => o.status === OrderStatus.IN_PROGRESS).length,
      completed: activeOrders.filter(o => o.status === OrderStatus.COMPLETED).length
    };
  }

  const stats = getOrderStats();

  return (
    <AppShell title={t('dashboard.title')}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards - Only for team members */}
        {hasTeamAccess(userProfile) && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 border border-slate-200 dark:border-slate-700 transition-colors">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">{t('dashboard.stats.total')}</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 border border-slate-200 dark:border-slate-700 transition-colors">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">{t('dashboard.stats.pending')}</p>
              <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-500">{stats.pending}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 border border-slate-200 dark:border-slate-700 transition-colors">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">{t('dashboard.stats.inProgress')}</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-500">{stats.in_progress}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 border border-slate-200 dark:border-slate-700 transition-colors">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">{t('dashboard.stats.completed')}</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-500">{stats.completed}</p>
            </div>
          </div>
        )}

        {/* Filters and Search - Only for team members */}
        {hasTeamAccess(userProfile) && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 mb-6 border border-slate-200 dark:border-slate-700 transition-colors">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('dashboard.filters.search')}</label>
              <input
                type="text"
                placeholder={t('dashboard.filters.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('dashboard.filters.status')}</label>
              <select
                data-testid="status-filter-dropdown"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                <option value="all">{t('dashboard.filters.allStatuses')}</option>
                <option value={OrderStatus.PENDING}>{getStatusLabel(OrderStatus.PENDING)}</option>
                <option value={OrderStatus.IN_PROGRESS}>{getStatusLabel(OrderStatus.IN_PROGRESS)}</option>
                <option value={OrderStatus.COMPLETED}>{getStatusLabel(OrderStatus.COMPLETED)}</option>
                <option value={OrderStatus.DELIVERED}>{getStatusLabel(OrderStatus.DELIVERED)}</option>
                <option value={OrderStatus.INVOICED}>{getStatusLabel(OrderStatus.INVOICED)}</option>
                <option value={OrderStatus.CANCELLED}>{getStatusLabel(OrderStatus.CANCELLED)}</option>
              </select>
            </div>

            {/* Department Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('dashboard.filters.department')}</label>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                <option value="all">{t('dashboard.filters.allDepartments')}</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>

            {/* Month Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('dashboard.filters.month')}</label>
              <select
                data-testid="month-filter-dropdown"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                <option value="all">{t('dashboard.filters.allMonths')}</option>
                {monthOptions.map(month => (
                  <option key={month.key} value={month.key}>{month.label}</option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('dashboard.filters.sortBy')}</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                <option value="delivery-asc">{t('dashboard.filters.deliveryEarliest')}</option>
                <option value="delivery-desc">{t('dashboard.filters.deliveryLatest')}</option>
                <option value="date-desc">{t('dashboard.filters.dateNewest')}</option>
                <option value="date-asc">{t('dashboard.filters.dateOldest')}</option>
                <option value="quantity-desc">{t('dashboard.filters.quantityHigh')}</option>
                <option value="quantity-asc">{t('dashboard.filters.quantityLow')}</option>
                <option value="status">{t('dashboard.filters.byStatus')}</option>
              </select>
            </div>
          </div>
        </div>
        )}

        {/* Tab Bar - Current vs Past Orders */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 transition-colors mb-6">
          <div className="flex border-b border-slate-200 dark:border-slate-700">
            <button
              data-testid="tab-past-orders"
              onClick={() => setActiveTab('past')}
              className={`flex-1 px-3 sm:px-6 py-4 text-sm font-medium transition-colors relative ${
                activeTab === 'past'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {t('dashboard.tabs.pastOrders')}
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === 'past'
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}>
                {tabCounts.past}
              </span>
              {activeTab === 'past' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>
              )}
            </button>
            <button
              data-testid="tab-current-orders"
              onClick={() => setActiveTab('current')}
              className={`flex-1 px-3 sm:px-6 py-4 text-sm font-medium transition-colors relative ${
                activeTab === 'current'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {t('dashboard.tabs.currentOrders')}
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === 'current'
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}>
                {tabCounts.current}
              </span>
              {activeTab === 'current' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>
              )}
            </button>
            <button
              data-testid="tab-invoiced-orders"
              onClick={() => setActiveTab('invoiced')}
              className={`flex-1 px-3 sm:px-6 py-4 text-sm font-medium transition-colors relative ${
                activeTab === 'invoiced'
                  ? 'text-red-600 dark:text-red-400 font-semibold'
                  : 'text-red-500/80 dark:text-red-400/70 hover:text-red-600 dark:hover:text-red-300'
              }`}
            >
              {t('dashboard.tabs.invoicedOrders')}
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === 'invoiced'
                  ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-600/90 dark:text-red-300/80'
              }`}>
                {tabCounts.invoiced}
              </span>
              {activeTab === 'invoiced' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600 dark:bg-red-400"></div>
              )}
            </button>
            {hasAdminAccess(userProfile) && (
              <button
                data-testid="tab-trash-orders"
                onClick={() => setActiveTab('trash')}
                title={t('dashboard.tabs.trash')}
                className={`flex-1 px-3 sm:px-6 py-4 text-sm font-medium transition-colors relative flex items-center justify-center gap-2 ${
                  activeTab === 'trash'
                    ? 'text-slate-900 dark:text-white'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="hidden sm:inline">{t('dashboard.tabs.trash')}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  activeTab === 'trash'
                    ? 'bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}>
                  {tabCounts.trash}
                </span>
                {activeTab === 'trash' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-700 dark:bg-slate-300"></div>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Orders Table */}
        <div ref={tableRef} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 transition-colors scroll-mt-4">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center gap-2">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white whitespace-nowrap">
              {t(hasTeamAccess(userProfile) ? 'dashboard.table.orders' : 'dashboard.table.yourOrders')} ({filteredOrders.length})
            </h2>
            <div className="flex items-center gap-2">
              {hasAdminAccess(userProfile) && activeTab !== 'trash' && (
                <button
                  onClick={() => {
                    if (filteredOrders.length === 0) {
                      showError(t('dashboard.orderModal.export.noOrdersToExport'));
                      return;
                    }
                    try {
                      exportOrdersToExcel(filteredOrders, t);
                      showSuccess(t('dashboard.orderModal.export.exportSuccess', { count: filteredOrders.length }));
                    } catch (error) {
                      showError(t('dashboard.orderModal.export.exportError'));
                    }
                  }}
                  disabled={filteredOrders.length === 0}
                  title={t('dashboard.orderModal.export.exportToExcel')}
                  className="px-3 sm:px-4 py-2 rounded-lg bg-green-600 text-white font-medium text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 focus:outline-none shrink-0"
                >
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="hidden sm:inline whitespace-nowrap">{t('dashboard.orderModal.export.exportToExcel')}</span>
                  {filteredOrders.length > 0 && (
                    <span className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">{filteredOrders.length}</span>
                  )}
                </button>
              )}
              <button
                data-testid="dashboard-add-order-button"
                onClick={() => setShowPlaceOrderModal(true)}
                title={t('dashboard.addOrderTitle')}
                className="px-3 sm:px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-medium transition-opacity hover:opacity-90 flex items-center gap-2 focus:outline-none shrink-0"
              >
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="whitespace-nowrap text-sm sm:text-base">{t('dashboard.addOrder')}</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredOrders.length === 0 ? (
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
                {activeTab === 'trash' ? t('dashboard.trash.empty') : t('dashboard.table.noOrders')}
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {activeTab === 'trash'
                  ? t('dashboard.trash.emptyDesc')
                  : orders.length === 0
                    ? t('dashboard.table.noOrdersDesc')
                    : t('dashboard.table.adjustFilters')}
              </p>
              {orders.length === 0 && activeTab !== 'trash' && (
                <div className="mt-6">
                  <button
                    onClick={() => setShowPlaceOrderModal(true)}
                    className="inline-flex items-center px-4 py-2 shadow-sm text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:opacity-90 transition-opacity focus:outline-none"
                  >
                    {t('nav.placeOrder')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table data-testid="dashboard-orders-table" className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 table-fixed">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    {canSelectOrders && (
                      <th className="w-12 px-4 py-3">
                        <input
                          type="checkbox"
                          data-testid="orders-select-all"
                          aria-label={t('dashboard.invoicing.selectAll')}
                          checked={allVisibleSelected}
                          disabled={selectableVisibleOrders.length === 0}
                          onChange={toggleSelectAllVisible}
                          className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                        />
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t('dashboard.table.client')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t('order.orderName')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t('dashboard.table.items')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t('dashboard.table.delivery')}
                    </th>
                    <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t('dashboard.table.status')}
                    </th>
                    <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t('dashboard.table.date')}
                    </th>
                    {((activeTab === 'past' && !hasTeamAccess(userProfile)) || activeTab === 'trash') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {t('dashboard.table.actions')}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                  {visibleOrders.map((order) => {
                    const totalItems = (order.subOrders || []).length;
                    const totalQuantity = (order.subOrders || []).reduce((sum, so) => sum + (so.quantity || 0), 0);
                    const earliestDelivery = getEarliestDeliveryTime(order.subOrders);
                    const isBillable = isOrderBillable(order);
                    const isSelected = selectedOrderIds.includes(order.id);

                    return (
                      <tr
                        key={order.id}
                        data-testid={`order-row-${order.id}`}
                        onClick={() => openOrderDetails(order)}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50/70 dark:bg-blue-900/20' : ''
                        }`}
                      >
                        {canSelectOrders && (
                          <td className="w-12 px-4 py-4" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              data-testid={`order-select-${order.id}`}
                              aria-label={t('dashboard.invoicing.selectOrder')}
                              checked={isSelected}
                              disabled={!isBillable}
                              title={isBillable ? undefined : t('dashboard.invoicing.notBillable')}
                              onChange={() => toggleOrderSelection(order.id)}
                              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 disabled:opacity-30 disabled:cursor-not-allowed"
                            />
                          </td>
                        )}
                        <td className="px-6 py-4 text-sm">
                          <div className="font-medium text-slate-900 dark:text-white">{getOrderClientPrimaryName(order) || '-'}</div>
                          {getOrderClientSecondaryName(order) && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">{getOrderClientSecondaryName(order)}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="text-slate-900 dark:text-white">{order.orderName || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                          <div>{totalItems} {totalItems === 1 ? t('dashboard.table.item') : t('dashboard.table.items')}</div>
                          <div className="text-xs text-slate-400 dark:text-slate-500">{totalQuantity} {t('dashboard.table.pcs')}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                          {earliestDelivery ? (
                            <>
                              <div>{formatDate(new Date(earliestDelivery))}</div>
                              <div className="text-xs text-slate-400 dark:text-slate-500">
                                {new Date(earliestDelivery).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </>
                          ) : '-'}
                        </td>
                        <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status)}`}>
                            {getStatusLabel(order.status)}
                          </span>
                          {order.invoiceId && (
                            <button
                              data-testid={`order-invoice-chip-${order.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate('/invoices');
                              }}
                              title={t('dashboard.invoicing.openInvoice')}
                              className="mt-1 block text-xs font-mono text-indigo-600 dark:text-indigo-400 hover:underline"
                            >
                              {order.invoiceNumber || t('invoices.details.draftTitle')}
                            </button>
                          )}
                        </td>
                        <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                          {(() => {
                            const date = order.createdAt?.toDate();
                            if (!date) return '';
                            const dateStr = formatDate(date);
                            const timeStr = date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
                            return `${dateStr} - ${timeStr}`;
                          })()}
                          {activeTab === 'trash' && order.deletedAt?.toDate && (
                            <div className="text-xs text-red-500 dark:text-red-400">
                              {t('dashboard.trash.deletedOn', {
                                date: formatDate(order.deletedAt.toDate()),
                                user: order.deletedByName || '-'
                              })}
                            </div>
                          )}
                        </td>
                        {activeTab === 'trash' && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2">
                              <button
                                data-testid={`order-restore-button-${order.id}`}
                                onClick={() => setOrderToRestore(order)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors focus:outline-none"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                {t('dashboard.trash.restore')}
                              </button>
                              <button
                                data-testid={`order-purge-button-${order.id}`}
                                onClick={() => setOrderToPurge(order)}
                                title={t('dashboard.trash.deletePermanently')}
                                className="inline-flex items-center px-2 py-1.5 text-sm font-medium rounded-md text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors focus:outline-none"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        )}
                        {activeTab === 'past' && !hasTeamAccess(userProfile) && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}>
                            <button
                              data-testid={`order-reorder-button-${order.id}`}
                              onClick={(e) => handleReorder(e, order)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors focus:outline-none"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              {t('dashboard.table.reorder')}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {isPaginated && !loading && (
            <Pagination
              testId="orders-pagination"
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredOrders.length}
              pageSize={ORDERS_PER_PAGE}
              onChange={goToPage}
            />
          )}
        </div>

      {/* Bulk invoicing bar - only while orders are selected */}
      {canSelectOrders && selectedOrders.length > 0 && (
        <div
          data-testid="orders-selection-bar"
          className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 pointer-events-none"
        >
          <div className="pointer-events-auto mx-auto max-w-3xl rounded-xl bg-slate-900 dark:bg-slate-700 text-white shadow-lg px-4 sm:px-5 py-3 flex flex-col sm:flex-row items-center gap-3">
            <div className="flex-1 text-center sm:text-left">
              <p className="text-sm font-medium">
                {t('dashboard.invoicing.selectedCount', { count: selectedOrders.length })}
                <span className="ml-2 tabular-nums text-slate-300">{formatMoney(selectionTotal)}</span>
              </p>
              {selectedClientCount > 1 && (
                <p className="text-xs text-amber-300 mt-0.5">
                  {t('dashboard.invoicing.multipleClients', { count: selectedClientCount })}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                data-testid="orders-clear-selection"
                onClick={() => setSelectedOrderIds([])}
                className="px-3 py-2 rounded-lg text-sm font-medium text-slate-200 hover:bg-white/10 transition-colors"
              >
                {t('dashboard.invoicing.clearSelection')}
              </button>
              <button
                data-testid="orders-add-to-invoice"
                onClick={() => setShowAddToInvoice(true)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:opacity-90 transition-opacity"
              >
                {t('dashboard.invoicing.addToInvoice')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add selected orders to an invoice */}
      <AddToInvoiceModal
        open={showAddToInvoice}
        onClose={() => setShowAddToInvoice(false)}
        orders={selectedOrders}
        invoices={invoices}
        onDone={() => {
          setSelectedOrderIds([]);
          setShowAddToInvoice(false);
        }}
      />

      {/* Order Details Modal */}
      <OrderDetailsModal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        order={selectedOrder}
      />

      {/* Place Order Modal */}
      <PlaceOrderModal
        open={showPlaceOrderModal}
        onClose={() => {
          setShowPlaceOrderModal(false);
          setInitialOrderData(null);
        }}
        onSuccess={() => {
          setShowPlaceOrderModal(false);
          setInitialOrderData(null);
          // Order will appear automatically via real-time listener
        }}
      />

      {/* Restore from Trash Dialog */}
      {orderToRestore && (
        <ConfirmDialog
          isOpen={!!orderToRestore}
          onClose={() => setOrderToRestore(null)}
          onConfirm={restoreOrder}
          title={t('dashboard.trash.restore')}
          message={t('dashboard.trash.restoreConfirm')}
          confirmText={t('dashboard.trash.restore')}
          cancelText={t('orderDetails.cancel')}
          type="info"
        />
      )}

      {/* Permanent Delete Dialog */}
      {orderToPurge && (
        <ConfirmDialog
          isOpen={!!orderToPurge}
          onClose={() => setOrderToPurge(null)}
          onConfirm={purgeOrder}
          title={t('dashboard.trash.deletePermanently')}
          message={t('dashboard.trash.deletePermanentlyConfirm')}
          confirmText={t('dashboard.trash.deletePermanently')}
          cancelText={t('orderDetails.cancel')}
          type="danger"
        />
      )}
      </div>
    </AppShell>
  );
}
