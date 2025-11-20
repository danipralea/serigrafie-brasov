import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth, hasTeamAccess } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/20/solid';
import { ProductType } from '../types';
import { showError } from '../services/notificationService';

interface ProductTypeOption {
  id: string;
  name: string;
  description?: string;
  isCustom?: boolean;
}

interface ProductTypeAutocompleteProps {
  selectedProductType: ProductTypeOption | null;
  onSelectProductType: (productType: ProductTypeOption | null) => void;
  error?: string;
}

export default function ProductTypeAutocomplete({
  selectedProductType,
  onSelectProductType,
  error
}: ProductTypeAutocompleteProps) {
  const { t } = useTranslation();
  const { currentUser, userProfile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [productTypes, setProductTypes] = useState<ProductTypeOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // New product type form state
  const [newProductType, setNewProductType] = useState({
    name: '',
    description: ''
  });

  // Default product types
  const defaultProductTypes: ProductTypeOption[] = [
    { id: ProductType.MUGS, name: t('productType.mugs'), isCustom: false },
    { id: ProductType.T_SHIRTS, name: t('productType.tshirts'), isCustom: false },
    { id: ProductType.HOODIES, name: t('productType.hoodies'), isCustom: false },
    { id: ProductType.BAGS, name: t('productType.bags'), isCustom: false },
    { id: ProductType.CAPS, name: t('productType.caps'), isCustom: false },
    { id: ProductType.OTHER, name: t('productType.other'), isCustom: false }
  ];

  useEffect(() => {
    fetchCustomProductTypes();
  }, []);

  // Helper function to remove Romanian diacritics for search
  function removeDiacritics(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove combining diacritical marks
      .replace(/ă/g, 'a')
      .replace(/â/g, 'a')
      .replace(/î/g, 'i')
      .replace(/ș/g, 's')
      .replace(/ț/g, 't');
  }

  // Memoize filtered product types to avoid React warning about changing dependency array size
  const filteredProductTypes = useMemo(() => {
    if (searchQuery && searchQuery !== selectedProductType?.name) {
      const normalizedQuery = removeDiacritics(searchQuery);
      return productTypes.filter(pt => {
        const normalizedName = removeDiacritics(pt.name || '');
        const normalizedDesc = removeDiacritics(pt.description || '');
        return normalizedName.includes(normalizedQuery) || normalizedDesc.includes(normalizedQuery);
      });
    }
    return productTypes;
  }, [searchQuery, productTypes, selectedProductType]);

  // Update dropdown visibility based on search query and selected product
  useEffect(() => {
    if (searchQuery && searchQuery !== selectedProductType?.name) {
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
  }, [searchQuery, selectedProductType]);

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

  async function fetchCustomProductTypes() {
    try {
      const productTypesRef = collection(db, 'productTypes');
      const snapshot = await getDocs(query(productTypesRef));
      const customTypes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        isCustom: true
      } as ProductTypeOption));

      // Combine default and custom types
      setProductTypes([...defaultProductTypes, ...customTypes]);
    } catch (error) {
      console.error('Error fetching product types:', error);
      // Fallback to default types only
      setProductTypes(defaultProductTypes);
    }
  }

  function handleSelectProductType(productType: ProductTypeOption) {
    onSelectProductType(productType);
    setSearchQuery(productType.name);
    setShowDropdown(false);
  }

  async function handleBlur() {
    // Only create custom product type if:
    // 1. User typed something
    // 2. Nothing is selected yet
    // 3. There are NO matching results in the dropdown (filteredProductTypes is empty)
    if (searchQuery.trim() && !selectedProductType && filteredProductTypes.length === 0) {
      const customName = searchQuery.trim();

      // Save to Firestore so it's available for future orders
      try {
        if (!currentUser) {
          throw new Error('User not authenticated');
        }

        const productTypesRef = collection(db, 'productTypes');
        const productTypeDoc = await addDoc(productTypesRef, {
          name: customName,
          description: '',
          userId: currentUser.uid,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });

        const newProductType: ProductTypeOption = {
          id: productTypeDoc.id,
          name: customName,
          isCustom: true
        };

        // Add to local state
        setProductTypes([...productTypes, newProductType]);

        // Select the newly created product type
        onSelectProductType(newProductType);
      } catch (error) {
        console.error('Error saving custom product type:', error);
        // Fallback to temporary custom product type if save fails
        const customProductType: ProductTypeOption = {
          id: `custom-${Date.now()}`,
          name: customName,
          isCustom: true
        };
        onSelectProductType(customProductType);
      }
    }
    setShowDropdown(false);
  }

  function handleClearSelection() {
    onSelectProductType(null);
    setSearchQuery('');
    setShowDropdown(false);
  }

  async function handleAddNewProductType() {
    if (!newProductType.name.trim()) {
      showError(t('productType.errorName'));
      return;
    }

    if (!currentUser) {
      showError(t('common.errorNotAuthenticated'));
      return;
    }

    try {
      setLoading(true);
      const productTypesRef = collection(db, 'productTypes');

      const productTypeDoc = await addDoc(productTypesRef, {
        name: newProductType.name,
        description: newProductType.description,
        userId: currentUser.uid,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      const addedProductType: ProductTypeOption = {
        id: productTypeDoc.id,
        name: newProductType.name,
        description: newProductType.description,
        isCustom: true
      };

      // Add to local state
      setProductTypes([...productTypes, addedProductType]);

      // Select the newly added product type
      onSelectProductType(addedProductType);
      setSearchQuery(addedProductType.name);

      // Reset form
      setNewProductType({
        name: '',
        description: ''
      });
      setShowAddForm(false);
      setShowDropdown(false);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error adding product type:', error);
      }
      showError(t('productType.errorFailed'));
    } finally {
      setLoading(false);
    }
  }

  const canAddProductType = hasTeamAccess(userProfile);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Search Input */}
      <div className="relative">
        <input
          data-testid="product-type-input"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => {
            // Only show dropdown if search query doesn't match selected product
            if (searchQuery && searchQuery !== selectedProductType?.name) {
              setShowDropdown(true);
            }
          }}
          onBlur={handleBlur}
          placeholder={t('order.productTypePlaceholder')}
          className={`block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-base text-gray-900 dark:text-white outline-1 -outline-offset-1 ${
            error
              ? 'outline-red-500 dark:outline-red-500'
              : 'outline-gray-300 dark:outline-slate-600'
          } placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors`}
        />
        {selectedProductType && (
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

      {/* Dropdown with product types */}
      {showDropdown && filteredProductTypes.length > 0 && (
        <div data-testid="product-type-dropdown" className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredProductTypes.map((productType) => (
            <button
              key={productType.id}
              data-testid={`product-type-option-${productType.id}`}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent blur from firing before click
                handleSelectProductType(productType);
              }}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900 dark:text-white">{productType.name}</span>
                {productType.isCustom && (
                  <span className="text-xs text-blue-600 dark:text-blue-400">{t('common.custom')}</span>
                )}
              </div>
              {productType.description && (
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {productType.description}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Add New Product Type - Only for Admins/Team Members */}
      {canAddProductType && (
        <>
          <div className="flex items-center my-3">
            <div className="flex-1 border-t border-gray-300 dark:border-slate-600"></div>
            <span className="px-3 text-sm text-gray-500 dark:text-gray-400">{t('common.or')}</span>
            <div className="flex-1 border-t border-gray-300 dark:border-slate-600"></div>
          </div>

          {/* Only show Add button for Team Members */}
          {hasTeamAccess(userProfile) && (
            <>
              <button
                type="button"
                onClick={() => setShowAddForm(!showAddForm)}
                className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
              >
                <span>{t('order.addNewProductType')}</span>
                {showAddForm ? (
                  <ChevronUpIcon className="w-5 h-5" />
                ) : (
                  <ChevronDownIcon className="w-5 h-5" />
                )}
              </button>

              {showAddForm && (
                <div className="mt-3 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-md border border-gray-300 dark:border-slate-600">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('productType.name')} *
                      </label>
                      <input
                        type="text"
                        value={newProductType.name}
                        onChange={(e) => setNewProductType({ ...newProductType, name: e.target.value })}
                        placeholder={t('productType.namePlaceholder')}
                        className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('productType.description')}
                      </label>
                      <input
                        type="text"
                        value={newProductType.description}
                        onChange={(e) => setNewProductType({ ...newProductType, description: e.target.value })}
                        placeholder={t('productType.descriptionPlaceholder')}
                        className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddForm(false);
                          setNewProductType({ name: '', description: '' });
                        }}
                        className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        type="button"
                        onClick={handleAddNewProductType}
                        disabled={loading}
                        className="flex-1 px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                      >
                        {loading ? t('productType.adding') : t('productType.add')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
