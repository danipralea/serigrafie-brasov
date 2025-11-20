import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth, hasTeamAccess } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/20/solid';
import { Supplier } from '../types';
import { showSuccess, showError } from '../services/notificationService';

interface SupplierAutocompleteProps {
  selectedSupplier: Supplier | null;
  onSelectSupplier: (supplier: Supplier | null) => void;
  error?: string;
}

export default function SupplierAutocomplete({ selectedSupplier, onSelectSupplier, error }: SupplierAutocompleteProps) {
  const { t } = useTranslation();
  const { currentUser, userProfile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // New supplier form state
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    email: '',
    phone: '',
    contactPersonName: '',
    contactPersonEmail: '',
    contactPersonPhone: ''
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    // Filter suppliers based on search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const filtered = suppliers.filter(supplier =>
        supplier.name?.toLowerCase().includes(query) ||
        supplier.email?.toLowerCase().includes(query) ||
        supplier.phone?.toLowerCase().includes(query) ||
        supplier.contactPerson?.name?.toLowerCase().includes(query)
      );
      setFilteredSuppliers(filtered);
      setShowDropdown(true);
    } else {
      setFilteredSuppliers([]);
      setShowDropdown(false);
    }
  }, [searchQuery, suppliers]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function fetchSuppliers() {
    try {
      const suppliersRef = collection(db, 'suppliers');
      const snapshot = await getDocs(query(suppliersRef));
      const suppliersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Supplier));
      setSuppliers(suppliersData);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  }

  function handleSelectSupplier(supplier: Supplier) {
    onSelectSupplier(supplier);
    setSearchQuery('');
    setShowDropdown(false);
  }

  function handleClearSelection() {
    onSelectSupplier(null);
    setSearchQuery('');
    setShowDropdown(false);
  }

  function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async function handleAddNewSupplier() {
    // Validation
    if (!newSupplier.name.trim()) {
      showError(t('suppliers.addModal.errorName'));
      return;
    }

    if (!newSupplier.phone.trim()) {
      showError(t('suppliers.addModal.errorPhone'));
      return;
    }

    if (newSupplier.email && !validateEmail(newSupplier.email)) {
      showError(t('suppliers.addModal.errorEmail'));
      return;
    }

    if (newSupplier.contactPersonEmail && !validateEmail(newSupplier.contactPersonEmail)) {
      showError(t('suppliers.addModal.errorContactPersonEmail'));
      return;
    }

    // Check permissions - only team members can add suppliers
    if (!hasTeamAccess(userProfile)) {
      showError(t('common.permissionDenied'));
      return;
    }

    try {
      setLoading(true);

      const contactPerson =
        newSupplier.contactPersonName || newSupplier.contactPersonEmail || newSupplier.contactPersonPhone
          ? {
              name: newSupplier.contactPersonName,
              email: newSupplier.contactPersonEmail,
              phone: newSupplier.contactPersonPhone,
            }
          : undefined;

      const supplierData: Omit<Supplier, 'id'> = {
        name: newSupplier.name.trim(),
        email: newSupplier.email.trim(),
        phone: newSupplier.phone.trim(),
        contactPerson,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const supplierDoc = await addDoc(collection(db, 'suppliers'), supplierData);

      const addedSupplier: Supplier = {
        id: supplierDoc.id,
        ...supplierData
      };

      // Add to local state
      setSuppliers([...suppliers, addedSupplier]);

      // Select the newly added supplier
      onSelectSupplier(addedSupplier);
      setSearchQuery('');

      // Reset form
      setNewSupplier({
        name: '',
        email: '',
        phone: '',
        contactPersonName: '',
        contactPersonEmail: '',
        contactPersonPhone: ''
      });
      setShowAddForm(false);
      setShowDropdown(false);

      showSuccess(t('suppliers.addModal.addSuccess'));
    } catch (error) {
      console.error('Error adding supplier:', error);
      showError(t('suppliers.addModal.errorFailed'));
    } finally {
      setLoading(false);
    }
  }

  const canAddSupplier = hasTeamAccess(userProfile);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => searchQuery && setShowDropdown(true)}
          placeholder={t('suppliers.orderModal.supplierPlaceholder')}
          className={`block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-base text-gray-900 dark:text-white outline-1 -outline-offset-1 ${
            error
              ? 'outline-red-500 dark:outline-red-500'
              : 'outline-gray-300 dark:outline-slate-600'
          } placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors`}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={handleClearSelection}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Dropdown with matching suppliers */}
      {showDropdown && filteredSuppliers.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredSuppliers.map((supplier) => (
            <button
              key={supplier.id}
              type="button"
              onClick={() => handleSelectSupplier(supplier)}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
            >
              <div className="font-medium text-gray-900 dark:text-white">{supplier.name}</div>
              {supplier.email && (
                <div className="text-sm text-gray-500 dark:text-gray-400">{supplier.email}</div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Divider */}
      {canAddSupplier && (
        <>
          <div className="flex items-center my-3">
            <div className="flex-1 border-t border-gray-300 dark:border-slate-600"></div>
            <span className="px-3 text-sm text-gray-500 dark:text-gray-400">{t('common.or')}</span>
            <div className="flex-1 border-t border-gray-300 dark:border-slate-600"></div>
          </div>

          {/* Add New Supplier Toggle */}
          <button
            type="button"
            onClick={() => {
              setShowAddForm(!showAddForm);
              if (!showAddForm) {
                // Clear search when opening add form
                setSearchQuery('');
                onSelectSupplier(null);
              }
            }}
            className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
          >
            <span>{t('suppliers.addSupplier')}</span>
            {showAddForm ? (
              <ChevronUpIcon className="w-5 h-5" />
            ) : (
              <ChevronDownIcon className="w-5 h-5" />
            )}
          </button>

          {/* Add New Supplier Form */}
          {showAddForm && (
            <div className="mt-3 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-md border border-gray-300 dark:border-slate-600">
              <div className="space-y-3">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('suppliers.addModal.name')} *
                  </label>
                  <input
                    type="text"
                    value={newSupplier.name}
                    onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                    placeholder={t('suppliers.addModal.namePlaceholder')}
                    className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors"
                    required
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('suppliers.addModal.email')}
                  </label>
                  <input
                    type="email"
                    value={newSupplier.email}
                    onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                    placeholder={t('suppliers.addModal.emailPlaceholder')}
                    className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('suppliers.addModal.phone')} *
                  </label>
                  <input
                    type="tel"
                    value={newSupplier.phone}
                    onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                    placeholder={t('suppliers.addModal.phonePlaceholder')}
                    className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors"
                  />
                </div>

                {/* Contact Person Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('suppliers.addModal.contactPersonName')}
                  </label>
                  <input
                    type="text"
                    value={newSupplier.contactPersonName}
                    onChange={(e) => setNewSupplier({ ...newSupplier, contactPersonName: e.target.value })}
                    placeholder={t('suppliers.addModal.contactPersonNamePlaceholder')}
                    className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors"
                  />
                </div>

                {/* Contact Person Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('suppliers.addModal.contactPersonEmail')}
                  </label>
                  <input
                    type="email"
                    value={newSupplier.contactPersonEmail}
                    onChange={(e) => setNewSupplier({ ...newSupplier, contactPersonEmail: e.target.value })}
                    placeholder={t('suppliers.addModal.contactPersonEmailPlaceholder')}
                    className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors"
                  />
                </div>

                {/* Contact Person Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('suppliers.addModal.contactPersonPhone')}
                  </label>
                  <input
                    type="tel"
                    value={newSupplier.contactPersonPhone}
                    onChange={(e) => setNewSupplier({ ...newSupplier, contactPersonPhone: e.target.value })}
                    placeholder={t('suppliers.addModal.contactPersonPhonePlaceholder')}
                    className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setNewSupplier({
                        name: '',
                        email: '',
                        phone: '',
                        contactPersonName: '',
                        contactPersonEmail: '',
                        contactPersonPhone: ''
                      });
                    }}
                    className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleAddNewSupplier}
                    disabled={loading}
                    className="flex-1 px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                  >
                    {loading ? t('suppliers.addModal.adding') : t('suppliers.addModal.add')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
