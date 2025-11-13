import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { TrashIcon } from '@heroicons/react/20/solid';
import { SupplierOrder } from '../types';
import { formatDate } from '../utils/dateUtils';

interface ViewSupplierOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: SupplierOrder | null;
  onDelete: (orderId: string) => void;
}

export default function ViewSupplierOrderModal({ isOpen, onClose, order, onDelete }: ViewSupplierOrderModalProps) {
  const { t } = useTranslation();

  if (!order) return null;

  function handleDelete() {
    if (order.id) {
      onDelete(order.id);
      onClose();
    }
  }

  function getStatusColor(status: string) {
    const colors: { [key: string]: string } = {
      'active': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
      'finalised': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    };
    return colors[status] || 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300';
  }

  function getStatusLabel(status: string) {
    return status === 'active' ? t('suppliers.activeOrders') : t('suppliers.finalisedOrders');
  }

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-3xl w-full bg-white dark:bg-slate-800 rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 z-10">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-semibold text-slate-900 dark:text-white">
                {t('suppliers.orderDetails.title')}
              </DialogTitle>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Supplier Info */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 uppercase tracking-wide">
                {t('suppliers.orderDetails.supplier')}
              </h4>
              <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                <p className="text-lg font-medium text-slate-900 dark:text-white">{order.supplierName}</p>
              </div>
            </div>

            {/* Status */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 uppercase tracking-wide">
                {t('dashboard.orderModal.status')}
              </h4>
              <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                <span className={`px-3 py-1.5 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                  {getStatusLabel(order.status)}
                </span>
              </div>
            </div>

            {/* Order Items */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 uppercase tracking-wide">
                {t('suppliers.orderDetails.items')}
              </h4>
              <div className="space-y-3">
                {order.items.map((item, index) => (
                  <div key={item.id} className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-sm font-semibold text-slate-900 dark:text-white">
                        {t('suppliers.orderDetails.item')} #{index + 1}
                      </h5>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">{t('suppliers.orderModal.productType')}:</span>
                        <span className="text-slate-900 dark:text-white font-medium">{item.productType?.name || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">{t('suppliers.orderModal.quantity')}:</span>
                        <span className="text-slate-900 dark:text-white font-medium">{item.quantity}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">{t('suppliers.orderModal.client')}:</span>
                        <span className="text-slate-900 dark:text-white font-medium">{item.client}</span>
                      </div>
                      {item.description && (
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-600">
                          <span className="text-slate-600 dark:text-slate-400">{t('suppliers.orderModal.description')}:</span>
                          <p className="text-slate-900 dark:text-white mt-1">{item.description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Metadata */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 uppercase tracking-wide">
                {t('suppliers.orderDetails.orderInfo')}
              </h4>
              <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">{t('suppliers.orderDetails.createdAt')}:</span>
                  <span className="text-slate-900 dark:text-white font-medium">{formatDate(order.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">{t('suppliers.orderDetails.updatedAt')}:</span>
                  <span className="text-slate-900 dark:text-white font-medium">{formatDate(order.updatedAt)}</span>
                </div>
              </div>
            </div>

            {/* Delete Button */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 rounded-lg transition-colors"
              >
                <TrashIcon className="h-4 w-4" />
                {t('suppliers.deleteOrder')}
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-6 py-4">
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
