import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { PlusIcon } from '@heroicons/react/20/solid';
import { db } from '../firebase';
import { collection, Timestamp, writeBatch, doc } from 'firebase/firestore';
import { OrderStatus } from '../types';
import ClientAutocomplete from './ClientAutocomplete';
import SubOrderItem, { SubOrderData } from './SubOrderItem';

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
}

interface PlaceOrderModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (order?: any) => void;
}

export default function PlaceOrderModal({ open, onClose, onSuccess }: PlaceOrderModalProps) {
  const { currentUser, userProfile } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Parent order data
  const [orderName, setOrderName] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [contactPhone, setContactPhone] = useState('');
  const [clientError, setClientError] = useState('');
  const [orderNameError, setOrderNameError] = useState('');

  // Clear errors and pre-fill phone when modal opens
  useEffect(() => {
    if (open) {
      setError('');
      setClientError('');
      setOrderNameError('');

      // Pre-fill contact phone with user's phone number if available
      if (currentUser?.phoneNumber && !contactPhone) {
        setContactPhone(currentUser.phoneNumber);
      }
    }
  }, [open, currentUser, contactPhone]);

  // Scroll to top when error is set
  useEffect(() => {
    if (error && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [error]);

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
    const isAdminOrTeam = userProfile?.isAdmin || userProfile?.isTeamMember;

    // Validate order name (only for admin/team members)
    if (isAdminOrTeam && (!orderName || !orderName.trim())) {
      setOrderNameError(t('order.errorOrderNameRequired'));
      return false;
    }
    setOrderNameError('');

    // Validate client (only for admin/team members)
    if (isAdminOrTeam && !selectedClient) {
      setClientError(t('order.errorClientRequired'));
      return false;
    }
    setClientError('');

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

    if (!validateForm() || !currentUser) return;

    // For regular clients, use their own info as the client
    const isAdminOrTeam = userProfile?.isAdmin || userProfile?.isTeamMember;
    let clientData;

    if (isAdminOrTeam) {
      // Admin/Team must select a client
      if (!selectedClient) return;
      clientData = {
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        clientEmail: selectedClient.email || '',
        clientPhone: selectedClient.phone || contactPhone,
        clientCompany: selectedClient.company || ''
      };
    } else {
      // Regular client - use their own info
      // Use current Firebase Auth displayName (AuthContext syncs this to Firestore)
      const clientName = currentUser.displayName || currentUser.email || '';

      clientData = {
        clientId: currentUser.uid,
        clientName: clientName,
        clientEmail: currentUser.email || '',
        clientPhone: contactPhone || '',
        clientCompany: ''
      };
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

      const isAdminOrTeam = userProfile?.isAdmin || userProfile?.isTeamMember;
      // Use current Firebase Auth displayName (AuthContext syncs this to Firestore)
      const userName = currentUser.displayName || currentUser.email || '';

      const orderData = {
        ...(isAdminOrTeam && orderName.trim() ? { orderName: orderName.trim() } : {}),
        ...clientData,
        userId: currentUser.uid,
        userName: userName,
        userEmail: currentUser.email,
        status: isAdminOrTeam
          ? OrderStatus.PENDING
          : OrderStatus.PENDING_CONFIRMATION,
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
        userName: userName,
        userEmail: currentUser.email,
        text: userProfile?.isAdmin || userProfile?.isTeamMember
          ? t('dashboard.orderModal.orderCreatedByTeam')
          : t('dashboard.orderModal.orderCreatedByClient'),
        isSystem: true,
        createdAt: timestamp
      });

      // Commit all writes atomically
      await batch.commit();

      // Reset form
      setOrderName('');
      setSelectedClient(null);
      setContactPhone('');
      setSubOrders([
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

      onSuccess({ id: orderRef.id, ...orderData });
      onClose();
    } catch (err: any) {
      console.error('Error creating order:', err);

      // Provide human-readable error messages
      let errorMessage = t('placeOrder.orderFailed');

      if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
        errorMessage = t('placeOrder.errorPermissionDenied');
      } else if (err?.code === 'unavailable' || err?.message?.includes('network')) {
        errorMessage = t('placeOrder.errorNetworkIssue');
      } else if (err?.message) {
        // For development - show actual error
        errorMessage = `${t('placeOrder.orderFailed')}: ${err.message}`;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50" aria-hidden="true" />

      <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
        <DialogPanel ref={scrollContainerRef} className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-slate-800 shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-4">
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('order.createNewOrder')}
            </DialogTitle>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                form="order-form"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {loading ? t('placeOrder.submitting') : t('order.createOrder')}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form id="order-form" onSubmit={handleSubmit} className="px-6 py-6">
            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Order Name - Only for Admin/Team Members */}
            {(userProfile?.isAdmin || userProfile?.isTeamMember) && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  {t('order.orderName')} *
                </label>
                <input
                  type="text"
                  value={orderName}
                  onChange={(e) => setOrderName(e.target.value)}
                  placeholder={t('order.orderNamePlaceholder')}
                  className={`block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-1 -outline-offset-1 ${
                    orderNameError
                      ? 'outline-red-500 dark:outline-red-500'
                      : 'outline-gray-300 dark:outline-slate-600'
                  } placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors`}
                />
                {orderNameError && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{orderNameError}</p>
                )}
              </div>
            )}

            {/* Client Section - Only for Admin/Team Members */}
            {(userProfile?.isAdmin || userProfile?.isTeamMember) && (
              <div className="mb-6">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                  {t('order.clientInformation')}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      {t('order.client')} *
                    </label>
                    <ClientAutocomplete
                      selectedClient={selectedClient}
                      onSelectClient={setSelectedClient}
                      error={clientError}
                    />
                  </div>

                  {selectedClient && (
                    <div className="relative p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md">
                      <button
                        type="button"
                        onClick={() => setSelectedClient(null)}
                        className="absolute top-2 right-2 p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800/50 rounded transition-colors"
                        aria-label="Remove client"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                      <div className="text-sm text-blue-900 dark:text-blue-200 pr-6">
                        <strong>{selectedClient.name}</strong>
                        {selectedClient.company && <span className="ml-2">• {selectedClient.company}</span>}
                        {selectedClient.email && (
                          <div className="mt-1 text-blue-700 dark:text-blue-300">
                            {selectedClient.email}
                          </div>
                        )}
                        {selectedClient.phone && (
                          <div className="mt-1 text-blue-700 dark:text-blue-300">
                            {selectedClient.phone}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Optional: Override contact phone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      {t('order.contactPhone')} {t('common.optional')}
                    </label>
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder={t('placeOrder.phonePlaceholder')}
                      className="block w-full sm:max-w-md rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {t('order.contactPhoneHelp')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Contact Phone for Regular Clients */}
            {!userProfile?.isAdmin && !userProfile?.isTeamMember && (
              <div className="mb-6">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                  {t('order.contactPhone')}
                </h3>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder={t('placeOrder.phonePlaceholder')}
                  className="block w-full sm:max-w-md rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors"
                />
              </div>
            )}

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
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                >
                  <PlusIcon className="w-5 h-5" />
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
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
