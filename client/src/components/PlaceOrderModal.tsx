import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { ProductType, OrderStatus } from '../types';
import { showSuccess } from '../services/notificationService';
import AuthModal from './AuthModal';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { PhotoIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { ChevronDownIcon } from '@heroicons/react/16/solid';

interface PlaceOrderModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PlaceOrderModal({ open, onClose, onSuccess }: PlaceOrderModalProps) {
  const { currentUser } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [formData, setFormData] = useState({
    productType: ProductType.MUGS,
    quantity: '',
    length: '',
    width: '',
    cmp: '',
    description: '',
    designFile: '',
    deadline: '',
    contactPhone: '',
    notes: ''
  });

  // Clear error when user authenticates and submit order if pending
  useEffect(() => {
    if (currentUser && pendingSubmit) {
      setError('');
      setPendingSubmit(false);
      submitOrder();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, pendingSubmit]);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!formData.quantity || !formData.description) {
      setError(t('placeOrder.errorRequired'));
      return;
    }

    // Check if user is authenticated
    if (!currentUser) {
      setShowAuthModal(true);
      setPendingSubmit(true); // Mark that we want to submit after auth
      return;
    }

    await submitOrder();
  }

  function handleAuthSuccess() {
    setShowAuthModal(false);
    setError(''); // Clear any previous errors
    // The useEffect will handle submitting when currentUser updates
  }

  async function submitOrder() {
    if (!currentUser) {
      setError('Please authenticate to submit order');
      return;
    }

    try {
      setError('');
      setLoading(true);

      const ordersRef = collection(db, 'orders');
      const orderDoc = await addDoc(ordersRef, {
        ...formData,
        quantity: parseInt(formData.quantity),
        length: formData.length ? parseFloat(formData.length) : null,
        width: formData.width ? parseFloat(formData.width) : null,
        cmp: formData.cmp ? parseFloat(formData.cmp) : null,
        userId: currentUser.uid,
        userEmail: currentUser.email,
        userName: currentUser.displayName || currentUser.email,
        status: OrderStatus.PENDING_CONFIRMATION,
        confirmedByClient: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Create notification
      const notificationsRef = collection(db, 'notifications');
      await addDoc(notificationsRef, {
        userId: currentUser.uid,
        type: 'order_created',
        title: 'Comandă nouă creată',
        message: `Comanda #${orderDoc.id.substring(0, 8).toUpperCase()} a fost plasată cu succes`,
        orderId: orderDoc.id,
        read: false,
        createdAt: Timestamp.now()
      });

      showSuccess('Comandă creată cu succes!');

      // Reset form
      setFormData({
        productType: ProductType.MUGS,
        quantity: '',
        length: '',
        width: '',
        cmp: '',
        description: '',
        designFile: '',
        deadline: '',
        contactPhone: '',
        notes: ''
      });

      // Call success and close callbacks
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error creating order:', err);
      setError('Failed to create order. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (!loading) {
      onClose();
    }
  }

  return (
    <>
      <Dialog open={open} onClose={handleClose} className="relative z-50">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" aria-hidden="true" />

        {/* Full-screen container to center the panel */}
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="mx-auto max-w-4xl w-full bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex justify-between items-center z-10">
              <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-white">
                {t('placeOrder.title')}
              </DialogTitle>
              <button
                onClick={handleClose}
                disabled={loading}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors disabled:opacity-50"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              <p className="mb-6 text-sm/6 text-slate-600 dark:text-slate-300 transition-colors">
                {t('placeOrder.subtitle')}
              </p>

              {error && (
                <div className="mb-6 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 rounded-lg p-4 text-sm transition-colors">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="space-y-8 border-b border-slate-200 dark:border-slate-700 pb-12 sm:space-y-0 sm:divide-y sm:divide-slate-200 dark:sm:divide-slate-700 sm:border-t sm:border-t-slate-200 dark:sm:border-t-slate-700 sm:pb-0 transition-colors">
                  {/* Product Type */}
                  <div className="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:py-6">
                    <label htmlFor="productType" className="block text-sm/6 font-medium text-slate-900 dark:text-slate-100 sm:pt-1.5 transition-colors">
                      {t('placeOrder.productType')} *
                    </label>
                    <div className="mt-2 sm:col-span-2 sm:mt-0">
                      <div className="grid grid-cols-1 sm:max-w-md">
                        <select
                          id="productType"
                          name="productType"
                          value={formData.productType}
                          onChange={handleChange}
                          required
                          className="col-start-1 row-start-1 w-full appearance-none rounded-md bg-white dark:bg-slate-700 py-1.5 pr-8 pl-3 text-base text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 sm:text-sm/6 transition-colors"
                        >
                          <option value={ProductType.MUGS}>{t('placeOrder.products.mugs')}</option>
                          <option value={ProductType.T_SHIRTS}>{t('placeOrder.products.tshirts')}</option>
                          <option value={ProductType.HOODIES}>{t('placeOrder.products.hoodies')}</option>
                          <option value={ProductType.BAGS}>{t('placeOrder.products.bags')}</option>
                          <option value={ProductType.CAPS}>{t('placeOrder.products.caps')}</option>
                          <option value={ProductType.OTHER}>{t('placeOrder.products.other')}</option>
                        </select>
                        <ChevronDownIcon
                          aria-hidden="true"
                          className="pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end text-gray-500 dark:text-slate-400 sm:size-4 transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Quantity */}
                  <div className="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:py-6">
                    <label htmlFor="quantity" className="block text-sm/6 font-medium text-slate-900 dark:text-slate-100 sm:pt-1.5 transition-colors">
                      {t('placeOrder.quantity')} *
                    </label>
                    <div className="mt-2 sm:col-span-2 sm:mt-0">
                      <input
                        type="number"
                        id="quantity"
                        name="quantity"
                        min="1"
                        value={formData.quantity}
                        onChange={handleChange}
                        required
                        placeholder={t('placeOrder.quantityPlaceholder')}
                        className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-1.5 text-base text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 sm:max-w-xs sm:text-sm/6 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Length */}
                  <div className="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:py-6">
                    <label htmlFor="length" className="block text-sm/6 font-medium text-slate-900 dark:text-slate-100 sm:pt-1.5 transition-colors">
                      {t('placeOrder.length')}
                    </label>
                    <div className="mt-2 sm:col-span-2 sm:mt-0">
                      <input
                        type="number"
                        id="length"
                        name="length"
                        min="0"
                        step="0.01"
                        value={formData.length}
                        onChange={handleChange}
                        placeholder={t('placeOrder.lengthPlaceholder')}
                        className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-1.5 text-base text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 sm:max-w-xs sm:text-sm/6 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Width */}
                  <div className="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:py-6">
                    <label htmlFor="width" className="block text-sm/6 font-medium text-slate-900 dark:text-slate-100 sm:pt-1.5 transition-colors">
                      {t('placeOrder.width')}
                    </label>
                    <div className="mt-2 sm:col-span-2 sm:mt-0">
                      <input
                        type="number"
                        id="width"
                        name="width"
                        min="0"
                        step="0.01"
                        value={formData.width}
                        onChange={handleChange}
                        placeholder={t('placeOrder.widthPlaceholder')}
                        className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-1.5 text-base text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 sm:max-w-xs sm:text-sm/6 transition-colors"
                      />
                    </div>
                  </div>

                  {/* CMP (Cost/Price per unit) */}
                  <div className="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:py-6">
                    <label htmlFor="cmp" className="block text-sm/6 font-medium text-slate-900 dark:text-slate-100 sm:pt-1.5 transition-colors">
                      {t('placeOrder.cmp')}
                    </label>
                    <div className="mt-2 sm:col-span-2 sm:mt-0">
                      <input
                        type="number"
                        id="cmp"
                        name="cmp"
                        min="0"
                        step="0.01"
                        value={formData.cmp}
                        onChange={handleChange}
                        placeholder={t('placeOrder.cmpPlaceholder')}
                        className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-1.5 text-base text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 sm:max-w-xs sm:text-sm/6 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:py-6">
                    <label htmlFor="description" className="block text-sm/6 font-medium text-slate-900 dark:text-slate-100 sm:pt-1.5 transition-colors">
                      {t('placeOrder.description')} *
                    </label>
                    <div className="mt-2 sm:col-span-2 sm:mt-0">
                      <textarea
                        id="description"
                        name="description"
                        rows={4}
                        value={formData.description}
                        onChange={handleChange}
                        required
                        placeholder={t('placeOrder.descriptionPlaceholder')}
                        className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-1.5 text-base text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 sm:max-w-2xl sm:text-sm/6 transition-colors"
                      />
                      <p className="mt-3 text-sm/6 text-slate-600 dark:text-slate-300 transition-colors">{t('placeOrder.descriptionHelp')}</p>
                    </div>
                  </div>

                  {/* Design File */}
                  <div className="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:py-6">
                    <label htmlFor="designFile" className="block text-sm/6 font-medium text-slate-900 dark:text-slate-100 sm:pt-1.5 transition-colors">
                      {t('placeOrder.designFile')}
                    </label>
                    <div className="mt-2 sm:col-span-2 sm:mt-0">
                      <div className="flex max-w-2xl justify-center rounded-lg border border-dashed border-slate-300 dark:border-slate-600 px-6 py-10 transition-colors">
                        <div className="text-center">
                          <PhotoIcon aria-hidden="true" className="mx-auto size-12 text-slate-300 dark:text-slate-600 transition-colors" />
                          <div className="mt-4 flex text-sm/6 text-slate-600 dark:text-slate-300 transition-colors">
                            <label
                              htmlFor="file-upload"
                              className="relative cursor-pointer rounded-md bg-transparent font-semibold text-blue-600 dark:text-blue-400 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue-500 hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
                            >
                              <span>{t('placeOrder.uploadFile')}</span>
                              <input id="file-upload" name="file-upload" type="file" className="sr-only" />
                            </label>
                            <p className="pl-1">{t('placeOrder.dragDrop')}</p>
                          </div>
                          <p className="text-xs/5 text-slate-600 dark:text-slate-400 transition-colors">{t('placeOrder.fileTypes')}</p>
                          <div className="mt-4">
                            <input
                              type="url"
                              id="designFile"
                              name="designFile"
                              value={formData.designFile}
                              onChange={handleChange}
                              placeholder={t('placeOrder.designFileUrl')}
                              className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-1.5 text-sm text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Deadline */}
                  <div className="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:py-6">
                    <label htmlFor="deadline" className="block text-sm/6 font-medium text-slate-900 dark:text-slate-100 sm:pt-1.5 transition-colors">
                      {t('placeOrder.deadline')}
                    </label>
                    <div className="mt-2 sm:col-span-2 sm:mt-0">
                      <input
                        type="date"
                        id="deadline"
                        name="deadline"
                        value={formData.deadline}
                        onChange={handleChange}
                        min={new Date().toISOString().split('T')[0]}
                        className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-1.5 text-base text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 sm:max-w-xs sm:text-sm/6 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Contact Phone */}
                  <div className="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:py-6">
                    <label htmlFor="contactPhone" className="block text-sm/6 font-medium text-slate-900 dark:text-slate-100 sm:pt-1.5 transition-colors">
                      {t('placeOrder.contactPhone')}
                    </label>
                    <div className="mt-2 sm:col-span-2 sm:mt-0">
                      <input
                        type="tel"
                        id="contactPhone"
                        name="contactPhone"
                        value={formData.contactPhone}
                        onChange={handleChange}
                        placeholder="+40 xxx xxx xxx"
                        className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-1.5 text-base text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 sm:max-w-md sm:text-sm/6 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Additional Notes */}
                  <div className="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:py-6">
                    <label htmlFor="notes" className="block text-sm/6 font-medium text-slate-900 dark:text-slate-100 sm:pt-1.5 transition-colors">
                      {t('placeOrder.notes')}
                    </label>
                    <div className="mt-2 sm:col-span-2 sm:mt-0">
                      <textarea
                        id="notes"
                        name="notes"
                        rows={3}
                        value={formData.notes}
                        onChange={handleChange}
                        placeholder={t('placeOrder.notesPlaceholder')}
                        className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-1.5 text-base text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 sm:max-w-2xl sm:text-sm/6 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-x-6">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={loading}
                    className="text-sm/6 font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-50"
                  >
                    {t('placeOrder.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex justify-center rounded-md bg-gradient-to-r from-blue-600 to-cyan-500 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                  >
                    {loading ? t('placeOrder.submitting') : t('placeOrder.submit')}
                  </button>
                </div>
              </form>
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      {/* Authentication Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />
    </>
  );
}
