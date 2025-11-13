import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/react/20/solid';
import { db } from '../firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { showSuccess, showError } from '../services/notificationService';
import { Supplier, SupplierOrder, SupplierOrderItem } from '../types';
import { useAuth } from '../contexts/AuthContext';
import ProductTypeAutocomplete from './ProductTypeAutocomplete';
import SupplierAutocomplete from './SupplierAutocomplete';

interface AddSupplierOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderAdded: () => void;
  suppliers: Supplier[];
}

interface ProductTypeOption {
  id: string;
  name: string;
  description?: string;
  isCustom?: boolean;
}

export default function AddSupplierOrderModal({ isOpen, onClose, onOrderAdded, suppliers }: AddSupplierOrderModalProps) {
  const { t } = useTranslation();
  const { currentUser, userProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  // Form fields - Pre-fill with test data on localhost
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    window.location.hostname === 'localhost'
      ? {
          id: 'test-supplier-id',
          name: 'Test Supplier SRL',
          email: 'test@supplier.com',
          phone: '+40712345678',
          contactPersonName: 'Ion Popescu',
          contactPersonEmail: 'ion@supplier.com',
          contactPersonPhone: '+40723456789',
          createdAt: null,
          updatedAt: null,
          createdBy: '',
        }
      : null
  );

  // Order items - Pre-fill with test data on localhost
  const [items, setItems] = useState<SupplierOrderItem[]>(
    window.location.hostname === 'localhost'
      ? [
          {
            id: crypto.randomUUID(),
            productType: { id: 'test-product', name: 'Căni ceramice', isCustom: false },
            quantity: '100',
            client: 'Test Client SRL',
            description: 'Test description for localhost development',
          },
        ]
      : [
          {
            id: crypto.randomUUID(),
            productType: null,
            quantity: '',
            client: '',
            description: '',
          },
        ]
  );

  function resetForm() {
    setSelectedSupplier(null);
    setItems([
      {
        id: crypto.randomUUID(),
        productType: null,
        quantity: '',
        client: '',
        description: '',
      },
    ]);
  }

  function handleItemChange(id: string, field: string, value: any) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  function handleAddItem() {
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        productType: null,
        quantity: '',
        client: '',
        description: '',
      },
    ]);
  }

  function handleRemoveItem(id: string) {
    if (items.length > 1) {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }
  }

  function validateForm(): boolean {
    if (!selectedSupplier) {
      showError(t('suppliers.orderModal.errorSupplierRequired'));
      return false;
    }

    if (items.length === 0) {
      showError(t('suppliers.orderModal.errorAtLeastOneItem'));
      return false;
    }

    for (const item of items) {
      if (!item.productType) {
        showError(t('suppliers.orderModal.errorProductTypeRequired'));
        return false;
      }

      if (!item.quantity || parseInt(item.quantity) <= 0) {
        showError(t('suppliers.orderModal.errorQuantityRequired'));
        return false;
      }

      if (!item.client.trim()) {
        showError(t('suppliers.orderModal.errorClientRequired'));
        return false;
      }
    }

    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setLoading(true);

      const orderData: Omit<SupplierOrder, 'id'> = {
        supplierId: selectedSupplier!.id!,
        supplierName: selectedSupplier!.name,
        items: items.map((item) => ({
          id: item.id,
          productType: item.productType,
          quantity: item.quantity,
          client: item.client.trim(),
          description: item.description.trim(),
        })),
        status: 'active',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: currentUser?.uid,
      };

      await addDoc(collection(db, 'supplierOrders'), orderData);

      showSuccess(t('suppliers.orderModal.createSuccess'));
      resetForm();
      onOrderAdded();
      onClose();
    } catch (error) {
      console.error('Error creating supplier order:', error);
      showError(t('suppliers.orderModal.errorFailed'));
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (!loading) {
      resetForm();
      onClose();
    }
  }

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-4xl w-full bg-white dark:bg-slate-800 rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 z-10">
            <DialogTitle className="text-xl font-semibold text-slate-900 dark:text-white">
              {t('suppliers.orderModal.title')}
            </DialogTitle>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Supplier Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('suppliers.orderModal.supplier')} <span className="text-red-500">*</span>
              </label>

              <SupplierAutocomplete
                selectedSupplier={selectedSupplier}
                onSelectSupplier={setSelectedSupplier}
              />

              {selectedSupplier && (
                <div className="mt-3 relative p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md">
                  <button
                    type="button"
                    onClick={() => setSelectedSupplier(null)}
                    className="absolute top-2 right-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                  <div className="text-sm text-blue-900 dark:text-blue-200 pr-6">
                    <strong>{selectedSupplier.name}</strong>
                    {selectedSupplier.email && (
                      <>
                        {' '}• {selectedSupplier.email}
                      </>
                    )}
                    {selectedSupplier.phone && (
                      <>
                        {' '}• {selectedSupplier.phone}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Order Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wide">
                  {t('suppliers.orderModal.orderItems')} <span className="text-red-500">*</span>
                </h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={loading}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  <PlusIcon className="w-4 h-4" />
                  {t('suppliers.orderModal.addItem')}
                </button>
              </div>

              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="border border-slate-300 dark:border-slate-600 rounded-lg p-4 bg-slate-50 dark:bg-slate-700/50 space-y-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {t('suppliers.orderDetails.item')} #{index + 1}
                    </h4>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={loading}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-1 rounded transition-colors disabled:opacity-50"
                        title={t('suppliers.orderModal.removeItem')}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Product Type */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {t('suppliers.orderModal.productType')} <span className="text-red-500">*</span>
                      </label>
                      <ProductTypeAutocomplete
                        selectedProductType={item.productType}
                        onSelectProductType={(value: ProductTypeOption | null) =>
                          handleItemChange(item.id, 'productType', value)
                        }
                      />
                    </div>

                    {/* Quantity */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {t('suppliers.orderModal.quantity')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                        placeholder={t('suppliers.orderModal.quantityPlaceholder')}
                        min="1"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                        disabled={loading}
                      />
                    </div>
                  </div>

                  {/* Client */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {t('suppliers.orderModal.client')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={item.client}
                      onChange={(e) => handleItemChange(item.id, 'client', e.target.value)}
                      placeholder={t('suppliers.orderModal.clientPlaceholder')}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                      disabled={loading}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {t('suppliers.orderModal.description')}
                    </label>
                    <textarea
                      value={item.description}
                      onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                      placeholder={t('suppliers.orderModal.descriptionPlaceholder')}
                      rows={2}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-none"
                      disabled={loading}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {t('suppliers.orderModal.cancel')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
              >
                {loading && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {loading ? t('suppliers.orderModal.creating') : t('suppliers.orderModal.create')}
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
