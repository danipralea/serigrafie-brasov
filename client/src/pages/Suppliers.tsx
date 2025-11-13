import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, getDocs, deleteDoc, doc, orderBy, updateDoc, Timestamp } from 'firebase/firestore';
import { ChevronDownIcon } from '@heroicons/react/16/solid';
import { EllipsisVerticalIcon, TrashIcon, CheckIcon } from '@heroicons/react/20/solid';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import AppShell from '../components/AppShell';
import AddSupplierModal from '../components/AddSupplierModal';
import EditSupplierModal from '../components/EditSupplierModal';
import AddSupplierOrderModal from '../components/AddSupplierOrderModal';
import ViewSupplierOrderModal from '../components/ViewSupplierOrderModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { Supplier, SupplierOrder } from '../types';
import { formatDate } from '../utils/dateUtils';
import { showSuccess, showError } from '../services/notificationService';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function Suppliers() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // State for suppliers
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);

  // State for supplier orders
  const [supplierOrders, setSupplierOrders] = useState<SupplierOrder[]>([]);
  const [filteredSupplierOrders, setFilteredSupplierOrders] = useState<SupplierOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Modal states
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [showEditSupplierModal, setShowEditSupplierModal] = useState(false);
  const [showAddOrderModal, setShowAddOrderModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [showViewOrderModal, setShowViewOrderModal] = useState(false);
  const [selectedViewOrder, setSelectedViewOrder] = useState<SupplierOrder | null>(null);

  // Delete dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);

  // Delete supplier order dialog
  const [showDeleteOrderDialog, setShowDeleteOrderDialog] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Active tab state (orders = Supplier Orders, suppliers = Suppliers list)
  const [activeTab, setActiveTab] = useState<'orders' | 'suppliers'>('orders');

  // Order status filter (active/finalised)
  const [orderStatusFilter, setOrderStatusFilter] = useState<'active' | 'finalised'>('active');

  useEffect(() => {
    // Only admins and team owners can access this page
    if (!userProfile?.isAdmin && userProfile?.isTeamMember) {
      navigate('/dashboard');
      return;
    }
    fetchSuppliers();
    fetchSupplierOrders();
  }, [currentUser, userProfile, navigate]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [suppliers, searchQuery, sortBy]);

  useEffect(() => {
    applyOrderFilters();
  }, [supplierOrders, searchQuery, orderStatusFilter]);

  async function fetchSuppliers() {
    try {
      setLoadingSuppliers(true);
      const suppliersRef = collection(db, 'suppliers');
      const q = query(suppliersRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const suppliersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Supplier[];
      setSuppliers(suppliersData);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    } finally {
      setLoadingSuppliers(false);
    }
  }

  async function fetchSupplierOrders() {
    try {
      setLoadingOrders(true);
      const ordersRef = collection(db, 'supplierOrders');
      const q = query(ordersRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SupplierOrder[];
      setSupplierOrders(ordersData);
    } catch (error) {
      console.error('Error fetching supplier orders:', error);
    } finally {
      setLoadingOrders(false);
    }
  }

  function applyFiltersAndSort() {
    let filtered = [...suppliers];

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(supplier =>
        supplier.name?.toLowerCase().includes(query) ||
        supplier.email?.toLowerCase().includes(query) ||
        supplier.phone?.toLowerCase().includes(query) ||
        supplier.contactPerson?.name?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    switch (sortBy) {
      case 'date-desc':
        filtered.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
        break;
      case 'date-asc':
        filtered.sort((a, b) => a.createdAt?.toMillis() - b.createdAt?.toMillis());
        break;
      case 'name-asc':
        filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'name-desc':
        filtered.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
        break;
      default:
        break;
    }

    setFilteredSuppliers(filtered);
  }

  function applyOrderFilters() {
    let filtered = [...supplierOrders];

    // Apply status filter
    filtered = filtered.filter(order => order.status === orderStatusFilter);

    // Apply search (filter by supplier name or client)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order =>
        order.supplierName?.toLowerCase().includes(query) ||
        order.items?.some(item => item.client?.toLowerCase().includes(query))
      );
    }

    setFilteredSupplierOrders(filtered);
  }

  function openEditModal(supplier: Supplier) {
    setSelectedSupplier(supplier);
    setShowEditSupplierModal(true);
  }

  function promptDeleteSupplier(supplierId: string) {
    setSelectedSupplierId(supplierId);
    setShowDeleteDialog(true);
  }

  async function handleDeleteSupplier() {
    if (!selectedSupplierId) return;

    try {
      const supplierRef = doc(db, 'suppliers', selectedSupplierId);
      await deleteDoc(supplierRef);
      await fetchSuppliers();
    } catch (error) {
      console.error('Error deleting supplier:', error);
      alert(t('suppliers.deleteError'));
    } finally {
      setShowDeleteDialog(false);
      setSelectedSupplierId(null);
    }
  }

  function promptDeleteOrder(orderId: string) {
    setSelectedOrderId(orderId);
    setShowDeleteOrderDialog(true);
  }

  async function handleDeleteSupplierOrder() {
    if (!selectedOrderId) return;

    try {
      const orderRef = doc(db, 'supplierOrders', selectedOrderId);
      await deleteDoc(orderRef);
      await fetchSupplierOrders();
      showSuccess(t('suppliers.deleteOrderSuccess'));
    } catch (error) {
      console.error('Error deleting supplier order:', error);
      showError(t('suppliers.deleteOrderError'));
    } finally {
      setShowDeleteOrderDialog(false);
      setSelectedOrderId(null);
    }
  }

  async function handleFinaliseOrder(orderId: string) {
    try {
      const orderRef = doc(db, 'supplierOrders', orderId);
      await updateDoc(orderRef, {
        status: 'finalised',
        updatedAt: Timestamp.now()
      });
      await fetchSupplierOrders();
      showSuccess(t('suppliers.finaliseOrderSuccess'));
    } catch (error) {
      console.error('Error finalising supplier order:', error);
      showError(t('suppliers.finaliseOrderError'));
    }
  }

  function handleViewOrder(order: SupplierOrder) {
    setSelectedViewOrder(order);
    setShowViewOrderModal(true);
  }

  function handleDeleteFromModal(orderId: string) {
    promptDeleteOrder(orderId);
  }

  function getInitials(name?: string) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  return (
    <AppShell title={t('suppliers.title')}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{t('suppliers.title')}</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">{t('suppliers.subtitle')}</p>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          {/* Mobile dropdown */}
          <div className="grid grid-cols-1 sm:hidden">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as 'orders' | 'suppliers')}
              aria-label="Select a tab"
              className="col-start-1 row-start-1 w-full appearance-none rounded-md bg-white dark:bg-white/5 py-2 pr-8 pl-3 text-base text-gray-900 dark:text-gray-100 outline-1 -outline-offset-1 outline-gray-300 dark:outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-600 dark:focus:outline-blue-500"
            >
              <option value="orders">{t('nav.orders')}</option>
              <option value="suppliers">{t('nav.suppliers')}</option>
            </select>
            <ChevronDownIcon
              aria-hidden="true"
              className="pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end fill-gray-500 dark:fill-gray-400"
            />
          </div>
          {/* Desktop tabs */}
          <div className="hidden sm:block">
            <div className="border-b border-gray-200 dark:border-white/10">
              <nav aria-label="Tabs" className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('orders')}
                  aria-current={activeTab === 'orders' ? 'page' : undefined}
                  className={classNames(
                    activeTab === 'orders'
                      ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-white/20 dark:hover:text-gray-200',
                    'border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap'
                  )}
                >
                  {t('nav.orders')}
                </button>
                <button
                  onClick={() => setActiveTab('suppliers')}
                  aria-current={activeTab === 'suppliers' ? 'page' : undefined}
                  className={classNames(
                    activeTab === 'suppliers'
                      ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-white/20 dark:hover:text-gray-200',
                    'border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap'
                  )}
                >
                  {t('nav.suppliers')}
                </button>
              </nav>
            </div>
          </div>
        </div>

        {/* Add Button - Orders Tab */}
        {activeTab === 'orders' && (
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowAddOrderModal(true)}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-medium transition-opacity hover:opacity-90 flex items-center gap-2 focus:outline-none"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="whitespace-nowrap text-sm sm:text-base">{t('suppliers.addSupplierOrder')}</span>
            </button>
          </div>
        )}

        {/* Add Button - Suppliers Tab */}
        {activeTab === 'suppliers' && (
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowAddSupplierModal(true)}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-medium transition-opacity hover:opacity-90 flex items-center gap-2 focus:outline-none"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="whitespace-nowrap text-sm sm:text-base">{t('suppliers.addSupplier')}</span>
            </button>
          </div>
        )}

        {/* Filters and Search */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 mb-6 border border-slate-200 dark:border-slate-700 transition-colors">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('suppliers.search')}
              </label>
              <input
                type="text"
                placeholder={t('suppliers.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              />
            </div>

            {/* Sort */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('suppliers.sortBy')}
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                <option value="date-desc">{t('suppliers.dateNewest')}</option>
                <option value="date-asc">{t('suppliers.dateOldest')}</option>
                <option value="name-asc">{t('suppliers.nameAZ')}</option>
                <option value="name-desc">{t('suppliers.nameZA')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Suppliers Section */}
        {activeTab === 'suppliers' && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 transition-colors mb-8">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('suppliers.allSuppliers')} ({filteredSuppliers.length})
            </h3>
          </div>

          {loadingSuppliers ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
            </div>
          ) : filteredSuppliers.length === 0 ? (
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
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
                {t('suppliers.noSuppliers')}
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {suppliers.length === 0 ? t('suppliers.noSuppliersDesc') : t('suppliers.adjustFilters')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
              {filteredSuppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                  onClick={() => openEditModal(supplier)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold">
                        {getInitials(supplier.name)}
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900 dark:text-white">
                          {supplier.name}
                        </h4>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        promptDeleteSupplier(supplier.id!);
                      }}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-1 rounded transition-colors"
                      title={t('suppliers.deleteSupplier')}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-2 text-sm">
                    {supplier.email && (
                      <div className="flex items-center text-slate-600 dark:text-slate-400">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="truncate">{supplier.email}</span>
                      </div>
                    )}
                    {supplier.phone && (
                      <div className="flex items-center text-slate-600 dark:text-slate-400">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span>{supplier.phone}</span>
                      </div>
                    )}
                    {supplier.contactPerson && supplier.contactPerson.name && (
                      <div className="flex items-center text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="text-xs">{supplier.contactPerson.name}</span>
                      </div>
                    )}
                    <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {t('suppliers.added')} {formatDate(supplier.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Supplier Orders Section */}
        {activeTab === 'orders' && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('suppliers.supplierOrders')} ({filteredSupplierOrders.length})
            </h3>
          </div>

          {/* Status Filter Tabs */}
          <div className="border-b border-slate-200 dark:border-slate-700">
            <nav className="-mb-px flex" aria-label="Tabs">
              <button
                onClick={() => setOrderStatusFilter('active')}
                className={classNames(
                  orderStatusFilter === 'active'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-700 dark:hover:text-slate-300',
                  'flex-1 whitespace-nowrap border-b-2 py-4 px-1 text-center text-sm font-medium transition-colors'
                )}
              >
                {t('suppliers.activeOrders')}
              </button>
              <button
                onClick={() => setOrderStatusFilter('finalised')}
                className={classNames(
                  orderStatusFilter === 'finalised'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-700 dark:hover:text-slate-300',
                  'flex-1 whitespace-nowrap border-b-2 py-4 px-1 text-center text-sm font-medium transition-colors'
                )}
              >
                {t('suppliers.finalisedOrders')}
              </button>
            </nav>
          </div>

          {loadingOrders ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
            </div>
          ) : filteredSupplierOrders.length === 0 ? (
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
                {t('suppliers.noSupplierOrders')}
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {supplierOrders.length === 0 ? t('suppliers.noSupplierOrdersDesc') : t('suppliers.adjustFilters')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-700/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t('suppliers.orderDetails.supplier')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t('suppliers.orderDetails.items')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t('suppliers.orderDetails.createdAt')}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t('common.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredSupplierOrders.map((order) => (
                    <tr key={order.id} onClick={() => handleViewOrder(order)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          {order.supplierName}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-900 dark:text-white">
                          {order.items.length} {t('suppliers.orderDetails.items').toLowerCase()}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {order.items.slice(0, 2).map((item, idx) => (
                            <div key={idx}>
                              {item.quantity} × {item.productType?.name || '-'} ({item.client})
                            </div>
                          ))}
                          {order.items.length > 2 && (
                            <div className="text-blue-600 dark:text-blue-400">
                              +{order.items.length - 2} {t('dashboard.table.item').toLowerCase()}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm" onClick={(e) => e.stopPropagation()}>
                        <Menu as="div" className="relative inline-block text-left">
                          <MenuButton className="flex items-center rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none">
                            <span className="sr-only">{t('common.actions')}</span>
                            <EllipsisVerticalIcon className="h-5 w-5" />
                          </MenuButton>

                          <MenuItems anchor="bottom end" className="z-[100] mt-2 w-48 origin-top-right rounded-md bg-white dark:bg-slate-800 shadow-lg ring-1 ring-black dark:ring-slate-700 ring-opacity-5 focus:outline-none">
                            <div className="py-1">
                              {order.status !== 'finalised' && (
                                <MenuItem>
                                  {({ focus }) => (
                                    <button
                                      onClick={() => handleFinaliseOrder(order.id!)}
                                      className={classNames(
                                        focus ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'text-green-600 dark:text-green-400',
                                        'group flex w-full items-center px-4 py-2 text-sm transition-colors'
                                      )}
                                    >
                                      <CheckIcon className="mr-3 h-4 w-4" />
                                      {t('suppliers.finaliseOrder')}
                                    </button>
                                  )}
                                </MenuItem>
                              )}
                              <MenuItem>
                                {({ focus }) => (
                                  <button
                                    onClick={() => promptDeleteOrder(order.id!)}
                                    className={classNames(
                                      focus ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' : 'text-red-600 dark:text-red-400',
                                      'group flex w-full items-center px-4 py-2 text-sm transition-colors'
                                    )}
                                  >
                                    <TrashIcon className="mr-3 h-4 w-4" />
                                    {t('common.delete')}
                                  </button>
                                )}
                              </MenuItem>
                            </div>
                          </MenuItems>
                        </Menu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}

        {/* Add Supplier Modal */}
        <AddSupplierModal
          isOpen={showAddSupplierModal}
          onClose={() => setShowAddSupplierModal(false)}
          onSupplierAdded={fetchSuppliers}
        />

        {/* Edit Supplier Modal */}
        <EditSupplierModal
          isOpen={showEditSupplierModal}
          onClose={() => {
            setShowEditSupplierModal(false);
            setSelectedSupplier(null);
          }}
          onSupplierUpdated={fetchSuppliers}
          supplier={selectedSupplier}
        />

        {/* Add Supplier Order Modal */}
        <AddSupplierOrderModal
          isOpen={showAddOrderModal}
          onClose={() => setShowAddOrderModal(false)}
          onOrderAdded={fetchSupplierOrders}
          suppliers={suppliers}
        />

        {/* Delete Supplier Dialog */}
        <ConfirmDialog
          isOpen={showDeleteDialog}
          onClose={() => {
            setShowDeleteDialog(false);
            setSelectedSupplierId(null);
          }}
          onConfirm={handleDeleteSupplier}
          title={t('suppliers.deleteDialog.title')}
          message={t('suppliers.deleteDialog.message')}
          confirmText={t('suppliers.deleteDialog.confirm')}
          cancelText={t('suppliers.deleteDialog.cancel')}
          type="danger"
        />

        {/* Delete Supplier Order Dialog */}
        <ConfirmDialog
          isOpen={showDeleteOrderDialog}
          onClose={() => {
            setShowDeleteOrderDialog(false);
            setSelectedOrderId(null);
          }}
          onConfirm={handleDeleteSupplierOrder}
          title={t('suppliers.deleteOrderDialog.title')}
          message={t('suppliers.deleteOrderDialog.message')}
          confirmText={t('suppliers.deleteOrderDialog.confirm')}
          cancelText={t('suppliers.deleteOrderDialog.cancel')}
          type="danger"
        />

        {/* View Supplier Order Modal */}
        <ViewSupplierOrderModal
          isOpen={showViewOrderModal}
          onClose={() => {
            setShowViewOrderModal(false);
            setSelectedViewOrder(null);
          }}
          order={selectedViewOrder}
          onDelete={handleDeleteFromModal}
        />
      </div>
    </AppShell>
  );
}
