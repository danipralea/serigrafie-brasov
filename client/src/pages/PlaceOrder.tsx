import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, Timestamp, writeBatch, doc } from 'firebase/firestore';
import { OrderStatus } from '../types';
import { showSuccess } from '../services/notificationService';
import AuthModal from '../components/AuthModal';
import AppShell from '../components/AppShell';
import Navigation from '../components/Navigation';
import SubOrderItem, { SubOrderData } from '../components/SubOrderItem';
import { PlusIcon } from '@heroicons/react/20/solid';

export default function PlaceOrder() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [contactPhone, setContactPhone] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Sub-orders state
  const [subOrders, setSubOrders] = useState<SubOrderData[]>([
    {
      id: crypto.randomUUID(),
      productType: null,
      quantity: '',
      length: '',
      width: '',
      cmp: '',
      description: '',
      designFile: '',
      deliveryTime: '',
      notes: ''
    }
  ]);

  // Clear error when user authenticates and submit order if pending
  useEffect(() => {
    if (currentUser && pendingSubmit) {
      setError('');
      setPendingSubmit(false);
      submitOrder();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, pendingSubmit]);

  // Pre-fill contact phone with user's phone number if available
  useEffect(() => {
    if (currentUser?.phoneNumber && !contactPhone) {
      setContactPhone(currentUser.phoneNumber);
    }
  }, [currentUser, contactPhone]);

  // Scroll to top when error is set
  useEffect(() => {
    if (error && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [error]);

  function handleSubOrderChange(id: string, field: string, value: any) {
    setSubOrders(prev =>
      prev.map(so => (so.id === id ? { ...so, [field]: value } : so))
    );
  }

  function handleAddSubOrder() {
    setSubOrders(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        productType: null,
        quantity: '',
        length: '',
        width: '',
        cmp: '',
        description: '',
        designFile: '',
        deliveryTime: '',
        notes: ''
      }
    ]);
  }

  function handleRemoveSubOrder(id: string) {
    setSubOrders(prev => prev.filter(so => so.id !== id));
  }

  function validateForm(): boolean {
    // Validate at least one sub-order
    if (subOrders.length === 0) {
      setError(t('order.errorAtLeastOneSubOrder'));
      return false;
    }

    // Validate each sub-order
    for (let i = 0; i < subOrders.length; i++) {
      const so = subOrders[i];

      if (!so.productType) {
        setError(`${t('order.subOrderItem')} #${i + 1}: ${t('order.errorProductTypeRequired')}`);
        return false;
      }

      if (!so.quantity || parseInt(so.quantity) <= 0) {
        setError(`${t('order.subOrderItem')} #${i + 1}: ${t('order.errorQuantityRequired')}`);
        return false;
      }

      if (!so.deliveryTime || !so.deliveryTime.trim()) {
        setError(`${t('order.subOrderItem')} #${i + 1}: ${t('order.errorDeliveryTimeRequired')}`);
        return false;
      }
    }

    setError('');
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) return;

    // Check if user is authenticated
    if (!currentUser) {
      setShowAuthModal(true);
      setPendingSubmit(true);
      return;
    }

    await submitOrder();
  }

  function handleAuthSuccess() {
    setShowAuthModal(false);
    setError('');
  }

  async function submitOrder() {
    if (!currentUser) {
      setError('Please authenticate to submit order');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Use batch write for atomic operations
      const batch = writeBatch(db);
      const timestamp = Timestamp.now();

      // Create parent order reference
      const ordersRef = collection(db, 'orders');
      const orderRef = doc(ordersRef);

      // Regular client - use their own info
      // Prioritize userProfile data over Firebase Auth displayName
      const clientName = userProfile?.name || currentUser.displayName || currentUser.email || '';

      const orderData = {
        clientId: currentUser.uid,
        clientName: clientName,
        clientEmail: currentUser.email || '',
        clientPhone: contactPhone || '',
        clientCompany: '',
        userId: currentUser.uid,
        userName: clientName,
        userEmail: currentUser.email,
        status: OrderStatus.PENDING_CONFIRMATION,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      batch.set(orderRef, orderData);

      // Create sub-orders in subcollection
      subOrders.forEach((so) => {
        const subOrderRef = doc(collection(db, 'orders', orderRef.id, 'subOrders'));
        const subOrderData = {
          productType: so.productType?.id || '',
          productTypeName: so.productType?.name || '',
          productTypeCustom: so.productType?.isCustom || false,
          quantity: parseInt(so.quantity),
          length: so.length ? parseFloat(so.length) : null,
          width: so.width ? parseFloat(so.width) : null,
          cmp: so.cmp ? parseFloat(so.cmp) : null,
          description: so.description,
          designFile: so.designFile || '',
          designFilePath: so.designFilePath || '',
          deliveryTime: so.deliveryTime || null,
          notes: so.notes || '',
          status: OrderStatus.PENDING,
          createdAt: timestamp,
          updatedAt: timestamp
        };
        batch.set(subOrderRef, subOrderData);
      });

      // Create initial order update
      const updateRef = doc(collection(db, 'orderUpdates'));
      batch.set(updateRef, {
        orderId: orderRef.id,
        userId: currentUser.uid,
        userName: clientName,
        userEmail: currentUser.email,
        text: t('dashboard.orderModal.orderCreatedByClient'),
        isSystem: true,
        createdAt: timestamp
      });

      // Commit all writes atomically
      await batch.commit();

      showSuccess(t('placeOrder.orderCreated'));
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Error creating order:', err);

      // Provide human-readable error messages
      let errorMessage = t('placeOrder.orderFailed');

      if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
        errorMessage = t('placeOrder.errorPermissionDenied');
      } else if (err?.code === 'unavailable' || err?.message?.includes('network')) {
        errorMessage = t('placeOrder.errorNetworkIssue');
      } else if (err?.message) {
        errorMessage = `${t('placeOrder.orderFailed')}: ${err.message}`;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  // If user is authenticated, use AppShell for consistent navigation
  if (currentUser) {
    return (
      <AppShell title={t('placeOrder.title')}>
        <div ref={scrollContainerRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="mb-6 text-sm text-slate-600 dark:text-slate-300 transition-colors">
            {t('placeOrder.subtitle')}
          </p>

          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 rounded-lg p-4 text-sm transition-colors">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Contact Phone */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                {t('order.contactPhone')}
              </label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder={t('placeOrder.phonePlaceholder')}
                className="block w-full sm:max-w-md rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors"
              />
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 dark:border-slate-700 my-6"></div>

            {/* Sub-Orders Section */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  {t('order.orderItems')}
                </h3>
                <button
                  type="button"
                  onClick={handleAddSubOrder}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-md transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  {t('order.addItem')}
                </button>
              </div>

              <div className="space-y-4">
                {subOrders.map((subOrder, index) => (
                  <SubOrderItem
                    key={subOrder.id}
                    subOrder={subOrder}
                    index={index}
                    onChange={handleSubOrderChange}
                    onRemove={handleRemoveSubOrder}
                    canRemove={subOrders.length > 1}
                  />
                ))}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-x-6">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                {t('placeOrder.cancel')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex justify-center rounded-md bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {loading ? t('placeOrder.submitting') : t('placeOrder.submit')}
              </button>
            </div>
          </form>
        </div>
      </AppShell>
    );
  }

  // For unauthenticated users
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      {/* Navigation Bar */}
      <Navigation variant="landing" />

      {/* Main Content */}
      <main ref={scrollContainerRef} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white transition-colors">
            {t('placeOrder.title')}
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 transition-colors">
            {t('placeOrder.subtitle')}
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 rounded-lg p-4 text-sm transition-colors">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Contact Phone */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              {t('order.contactPhone')}
            </label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder={t('placeOrder.phonePlaceholder')}
              className="block w-full sm:max-w-md rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors"
            />
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 dark:border-slate-700 my-6"></div>

          {/* Sub-Orders Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {t('order.orderItems')}
              </h3>
              <button
                type="button"
                onClick={handleAddSubOrder}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-md transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                {t('order.addItem')}
              </button>
            </div>

            <div className="space-y-4">
              {subOrders.map((subOrder, index) => (
                <SubOrderItem
                  key={subOrder.id}
                  subOrder={subOrder}
                  index={index}
                  onChange={handleSubOrderChange}
                  onRemove={handleRemoveSubOrder}
                  canRemove={subOrders.length > 1}
                />
              ))}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-x-6">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              {t('placeOrder.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex justify-center rounded-md bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {loading ? t('placeOrder.submitting') : t('placeOrder.submit')}
            </button>
          </div>
        </form>
      </main>

      {/* Authentication Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
