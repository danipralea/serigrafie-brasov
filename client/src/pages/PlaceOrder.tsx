import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { ProductType, OrderStatus } from '../types';
import { showSuccess, showError } from '../services/notificationService';
import AuthModal from '../components/AuthModal';
import Navigation from '../components/Navigation';
import { PhotoIcon } from '@heroicons/react/24/solid';
import { ChevronDownIcon } from '@heroicons/react/16/solid';

export default function PlaceOrder() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [formData, setFormData] = useState({
    productType: ProductType.MUGS,
    quantity: '',
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
      navigate('/dashboard');
    } catch (err) {
      console.error('Error creating order:', err);
      setError('Failed to create order. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      {/* Navigation Bar */}
      <Navigation variant="landing" />

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Team Member Restriction */}
        {currentUser && userProfile?.isTeamMember ? (
          <div className="max-w-2xl">
            <h2 className="text-base/7 font-semibold text-slate-900 dark:text-white transition-colors">
              {t('placeOrder.teamMemberRestriction')}
            </h2>
            <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 rounded-lg p-6 transition-colors">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm">{t('placeOrder.teamMemberMessage')}</p>
                </div>
              </div>
            </div>
            <div className="mt-6">
              <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 rounded-lg shadow-sm hover:opacity-90 transition-opacity"
              >
                {t('dashboard.title')}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-12 sm:space-y-16">
              <div>
                <h2 className="text-base/7 font-semibold text-slate-900 dark:text-white transition-colors">
                  {t('placeOrder.title')}
                </h2>
                <p className="mt-1 max-w-2xl text-sm/6 text-slate-600 dark:text-slate-300 transition-colors">
                  {t('placeOrder.subtitle')}
                </p>

                {error && (
                  <div className="mt-6 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 rounded-lg p-4 text-sm transition-colors">
                    {error}
                  </div>
                )}

              <div className="mt-10 space-y-8 border-b border-slate-200 dark:border-slate-700 pb-12 sm:space-y-0 sm:divide-y sm:divide-slate-200 dark:sm:divide-slate-700 sm:border-t sm:border-t-slate-200 dark:sm:border-t-slate-700 sm:pb-0 transition-colors">
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
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-x-6">
            <button
              type="button"
              onClick={() => navigate(currentUser ? '/dashboard' : '/')}
              className="text-sm/6 font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
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
        )}
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
