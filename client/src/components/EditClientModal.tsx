import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { showSuccess, showError } from '../services/notificationService';

export default function EditClientModal({ isOpen, onClose, onClientUpdated, client }) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    address: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Populate form when client changes and reset edit mode
  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name || '',
        email: client.email || '',
        phone: client.phone || '',
        company: client.company || '',
        address: client.address || '',
        notes: client.notes || ''
      });
      setIsEditing(false);
    }
  }, [client, isOpen]);

  // Handle Escape key to close modal
  useEffect(() => {
    function handleEscapeKey(event) {
      if (event.key === 'Escape' && isOpen) {
        handleClose();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => document.removeEventListener('keydown', handleEscapeKey);
    }
  }, [isOpen]);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError(t('clients.editModal.errorName'));
      return;
    }

    // Validate email if provided
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError(t('clients.editModal.errorEmail'));
      return;
    }

    try {
      setError('');
      setLoading(true);

      const clientRef = doc(db, 'clients', client.id);
      await updateDoc(clientRef, {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        company: formData.company.trim(),
        address: formData.address.trim(),
        notes: formData.notes.trim(),
        updatedAt: Timestamp.now()
      });

      showSuccess(t('clients.editModal.updateSuccess'));

      if (onClientUpdated) {
        onClientUpdated();
      }

      setIsEditing(false);
    } catch (err) {
      console.error('Error updating client:', err);
      setError(t('clients.editModal.errorFailed'));
      showError(t('clients.editModal.errorFailed'));
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setError('');
    setIsEditing(false);
    onClose();
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setError('');
    // Reset form data to original client data
    if (client) {
      setFormData({
        name: client.name || '',
        email: client.email || '',
        phone: client.phone || '',
        company: client.company || '',
        address: client.address || '',
        notes: client.notes || ''
      });
    }
  }

  if (!isOpen || !client) return null;

  return (
    <>
      {/* Blurred Background Overlay */}
      <div
        className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white dark:bg-slate-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto transform transition-all shadow-xl border border-slate-200 dark:border-slate-700"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                {isEditing ? t('clients.editModal.title') : t('clients.viewModal.title')}
              </h3>
              <button
                onClick={handleClose}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-lg p-3 text-sm">
                {error}
              </div>
            )}

            {!isEditing ? (
              /* View Mode */
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                    {t('clients.viewModal.name')}
                  </label>
                  <p className="text-base text-slate-900 dark:text-white">
                    {client.name || '-'}
                  </p>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                    {t('clients.viewModal.email')}
                  </label>
                  <p className="text-base text-slate-900 dark:text-white">
                    {client.email || '-'}
                  </p>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                    {t('clients.viewModal.phone')}
                  </label>
                  <p className="text-base text-slate-900 dark:text-white">
                    {client.phone || '-'}
                  </p>
                </div>

                {/* Company */}
                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                    {t('clients.viewModal.company')}
                  </label>
                  <p className="text-base text-slate-900 dark:text-white">
                    {client.company || '-'}
                  </p>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                    {t('clients.viewModal.address')}
                  </label>
                  <p className="text-base text-slate-900 dark:text-white">
                    {client.address || '-'}
                  </p>
                </div>

                {/* Notes */}
                {client.notes && (
                  <div>
                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                      {t('clients.viewModal.notes')}
                    </label>
                    <p className="text-base text-slate-900 dark:text-white whitespace-pre-wrap">
                      {client.notes}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    {t('common.close')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-medium transition-opacity hover:opacity-90"
                  >
                    {t('clients.viewModal.edit')}
                  </button>
                </div>
              </div>
            ) : (
              /* Edit Mode */
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name - Required */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('clients.editModal.name')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder={t('clients.editModal.namePlaceholder')}
                    required
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('clients.editModal.email')}
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder={t('clients.editModal.emailPlaceholder')}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('clients.editModal.phone')}
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder={t('clients.editModal.phonePlaceholder')}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                </div>

                {/* Company */}
                <div>
                  <label htmlFor="company" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('clients.editModal.company')}
                  </label>
                  <input
                    type="text"
                    id="company"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    placeholder={t('clients.editModal.companyPlaceholder')}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                </div>

                {/* Address */}
                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('clients.editModal.address')}
                  </label>
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder={t('clients.editModal.addressPlaceholder')}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('clients.editModal.notes')}
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder={t('clients.editModal.notesPlaceholder')}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    {t('clients.editModal.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {loading ? t('clients.editModal.saving') : t('clients.editModal.save')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
