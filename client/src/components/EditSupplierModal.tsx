import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { db } from '../firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { showSuccess, showError } from '../services/notificationService';
import { Supplier } from '../types';

interface EditSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSupplierUpdated: () => void;
  supplier: Supplier | null;
}

export default function EditSupplierModal({ isOpen, onClose, onSupplierUpdated, supplier }: EditSupplierModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  // Supplier fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Contact person fields
  const [contactPersonName, setContactPersonName] = useState('');
  const [contactPersonEmail, setContactPersonEmail] = useState('');
  const [contactPersonPhone, setContactPersonPhone] = useState('');

  useEffect(() => {
    if (supplier && isOpen) {
      setName(supplier.name || '');
      setEmail(supplier.email || '');
      setPhone(supplier.phone || '');
      setContactPersonName(supplier.contactPerson?.name || '');
      setContactPersonEmail(supplier.contactPerson?.email || '');
      setContactPersonPhone(supplier.contactPerson?.phone || '');
    }
  }, [supplier, isOpen]);

  function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!supplier?.id) return;

    // Validation
    if (!name.trim()) {
      showError(t('suppliers.addModal.errorName'));
      return;
    }

    if (!phone.trim()) {
      showError(t('suppliers.addModal.errorPhone'));
      return;
    }

    if (email && !validateEmail(email)) {
      showError(t('suppliers.addModal.errorEmail'));
      return;
    }

    if (contactPersonEmail && !validateEmail(contactPersonEmail)) {
      showError(t('suppliers.addModal.errorContactPersonEmail'));
      return;
    }

    try {
      setLoading(true);

      const contactPerson =
        contactPersonName || contactPersonEmail || contactPersonPhone
          ? {
              name: contactPersonName,
              email: contactPersonEmail,
              phone: contactPersonPhone,
            }
          : undefined;

      const supplierRef = doc(db, 'suppliers', supplier.id);
      await updateDoc(supplierRef, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        contactPerson,
        updatedAt: Timestamp.now(),
      });

      showSuccess(t('suppliers.editModal.updateSuccess'));
      onSupplierUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating supplier:', error);
      showError(t('suppliers.addModal.errorFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-2xl w-full bg-white dark:bg-slate-800 rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 z-10">
            <DialogTitle className="text-xl font-semibold text-slate-900 dark:text-white">
              {t('suppliers.editModal.title')}
            </DialogTitle>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Supplier Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wide">
                Informații furnizor / Supplier Information
              </h3>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('suppliers.addModal.name')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('suppliers.addModal.namePlaceholder')}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  disabled={loading}
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('suppliers.addModal.email')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('suppliers.addModal.emailPlaceholder')}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  disabled={loading}
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('suppliers.addModal.phone')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('suppliers.addModal.phonePlaceholder')}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Contact Person */}
            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wide">
                {t('suppliers.addModal.contactPerson')} {t('common.optional')}
              </h3>

              {/* Contact Person Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('suppliers.addModal.contactPersonName')}
                </label>
                <input
                  type="text"
                  value={contactPersonName}
                  onChange={(e) => setContactPersonName(e.target.value)}
                  placeholder={t('suppliers.addModal.contactPersonNamePlaceholder')}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  disabled={loading}
                />
              </div>

              {/* Contact Person Email */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('suppliers.addModal.contactPersonEmail')}
                </label>
                <input
                  type="email"
                  value={contactPersonEmail}
                  onChange={(e) => setContactPersonEmail(e.target.value)}
                  placeholder={t('suppliers.addModal.contactPersonEmailPlaceholder')}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  disabled={loading}
                />
              </div>

              {/* Contact Person Phone */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('suppliers.addModal.contactPersonPhone')}
                </label>
                <input
                  type="tel"
                  value={contactPersonPhone}
                  onChange={(e) => setContactPersonPhone(e.target.value)}
                  placeholder={t('suppliers.addModal.contactPersonPhonePlaceholder')}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {t('suppliers.addModal.cancel')}
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
                {loading ? t('suppliers.editModal.saving') : t('suppliers.editModal.save')}
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
