import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { showSuccess, showError } from '../services/notificationService';
import { Department } from '../types';

interface AddDepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDepartmentAdded: () => void;
  teamMembers: Array<{ id: string; email: string; displayName?: string }>;
}

export default function AddDepartmentModal({ isOpen, onClose, onDepartmentAdded, teamMembers }: AddDepartmentModalProps) {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [departmentName, setDepartmentName] = useState('');
  const [managerId, setManagerId] = useState('');

  function resetForm() {
    setDepartmentName('');
    setManagerId('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!departmentName.trim()) {
      showError(t('departments.modal.errorNameRequired'));
      return;
    }

    if (!managerId) {
      showError(t('departments.modal.errorManagerRequired'));
      return;
    }

    try {
      setLoading(true);

      const manager = teamMembers.find(m => m.id === managerId);
      const departmentData: Omit<Department, 'id'> = {
        name: departmentName.trim(),
        managerId,
        managerName: manager?.displayName || manager?.email || '',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: currentUser?.uid,
      };

      await addDoc(collection(db, 'departments'), departmentData);

      showSuccess(t('departments.modal.addSuccess'));
      resetForm();
      onDepartmentAdded();
      onClose();
    } catch (error) {
      console.error('Error adding department:', error);
      showError(t('departments.modal.errorFailed'));
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
        <DialogPanel className="mx-auto max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-xl">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <DialogTitle className="text-xl font-semibold text-slate-900 dark:text-white">
              {t('departments.modal.title')}
            </DialogTitle>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Department Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('departments.modal.name')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={departmentName}
                onChange={(e) => setDepartmentName(e.target.value)}
                placeholder={t('departments.modal.namePlaceholder')}
                className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                disabled={loading}
                required
              />
            </div>

            {/* Manager Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('departments.modal.manager')} <span className="text-red-500">*</span>
              </label>
              <select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                disabled={loading}
                required
              >
                <option value="">{t('departments.modal.selectManager')}</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName || member.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {t('common.cancel')}
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
                {loading ? t('departments.modal.adding') : t('departments.modal.add')}
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
