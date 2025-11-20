import { useState, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { PhotoIcon, TrashIcon } from '@heroicons/react/24/solid';
import ProductTypeAutocomplete from './ProductTypeAutocomplete';
import { uploadFile } from '../services/storageService';
import { useAuth, hasTeamAccess } from '../contexts/AuthContext';

interface ProductTypeOption {
  id: string;
  name: string;
  description?: string;
  isCustom?: boolean;
}

export interface SubOrderData {
  id: string;
  productType: ProductTypeOption | null;
  quantity: string;
  length: string;
  width: string;
  cmp: string;
  description: string;
  designFile: string;
  designFilePath?: string;
  deliveryTime: string;
  notes: string;
  departmentId?: string;
  departmentName?: string;
  departmentManagerName?: string;
  status?: string;
}

interface Department {
  id: string;
  name: string;
  managerId: string;
  managerName?: string;
}

interface SubOrderItemProps {
  subOrder: SubOrderData;
  index: number;
  onChange: (id: string, field: string, value: any) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
  departments?: Department[];
}

function SubOrderItem({ subOrder, index, onChange, onRemove, canRemove, departments = [] }: SubOrderItemProps) {
  const { t } = useTranslation();
  const { currentUser, userProfile } = useAuth();
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState('');

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError(t('placeOrder.fileSizeError'));
      return;
    }

    try {
      setUploadingFile(true);
      setUploadError('');

      const result = await uploadFile(file, 'designs', currentUser.uid);

      onChange(subOrder.id, 'designFile', result.url);
      onChange(subOrder.id, 'designFilePath', result.path);
    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadError(t('placeOrder.uploadError'));
    } finally {
      setUploadingFile(false);
    }
  }

  function handleChange(field: string, value: any) {
    onChange(subOrder.id, field, value);
  }

  return (
    <div className="border border-gray-300 dark:border-slate-600 rounded-lg p-4 bg-gray-50 dark:bg-slate-700/50">
      {/* Header with index and remove button */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
          {t('order.subOrderItem')} #{index + 1}
        </h4>
        {canRemove && (
          <button
            data-testid={`sub-order-remove-button-${index}`}
            type="button"
            onClick={() => onRemove(subOrder.id)}
            className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
            title={t('order.removeSubOrder')}
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Product Type */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
            {t('placeOrder.productType')} *
          </label>
          <ProductTypeAutocomplete
            selectedProductType={subOrder.productType}
            onSelectProductType={(pt) => handleChange('productType', pt)}
            userProfile={userProfile}
          />
        </div>

        {/* Department Selection - Only for Team Members */}
        {hasTeamAccess(userProfile) && departments.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              {t('order.department')} {t('common.optional')}
            </label>
            <select
              value={subOrder.departmentId || ''}
              onChange={(e) => {
                const selectedDept = departments.find(d => d.id === e.target.value);
                handleChange('departmentId', e.target.value || undefined);
                handleChange('departmentName', selectedDept?.name || undefined);
                handleChange('departmentManagerName', selectedDept?.managerName || undefined);
              }}
              className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors"
            >
              <option value="">{t('order.selectDepartment')}</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name} {dept.managerName && `(${dept.managerName})`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Quantity, Length, Width, CMP in grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              {t('placeOrder.quantity')} *
            </label>
            <input
              data-testid={`sub-order-quantity-${index}`}
              type="number"
              value={subOrder.quantity}
              onChange={(e) => handleChange('quantity', e.target.value)}
              min="1"
              placeholder="0"
              className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              {t('placeOrder.length')}
            </label>
            <input
              type="number"
              value={subOrder.length}
              onChange={(e) => handleChange('length', e.target.value)}
              step="0.01"
              placeholder="0.00"
              className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              {t('placeOrder.width')}
            </label>
            <input
              type="number"
              value={subOrder.width}
              onChange={(e) => handleChange('width', e.target.value)}
              step="0.01"
              placeholder="0.00"
              className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              {t('placeOrder.cmp')}
            </label>
            <input
              type="number"
              value={subOrder.cmp}
              onChange={(e) => handleChange('cmp', e.target.value)}
              step="0.01"
              placeholder="0.00"
              className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
            {t('placeOrder.description')}
          </label>
          <textarea
            data-testid={`sub-order-description-${index}`}
            value={subOrder.description}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={3}
            placeholder={t('placeOrder.descriptionPlaceholder')}
            className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors"
          />
        </div>

        {/* Design File Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
            {t('placeOrder.designFile')}
          </label>

          {subOrder.designFile ? (
            <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <PhotoIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <a
                  href={subOrder.designFile}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate"
                >
                  {t('placeOrder.viewFile')}
                </a>
              </div>
              <button
                type="button"
                onClick={() => {
                  handleChange('designFile', '');
                  handleChange('designFilePath', '');
                }}
                className="ml-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div>
              <label
                htmlFor={`file-upload-${subOrder.id}`}
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg cursor-pointer bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <PhotoIcon className="w-10 h-10 mb-2 text-gray-400 dark:text-gray-500" />
                  <p className="mb-1 text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-semibold">{uploadingFile ? t('placeOrder.uploading') : t('placeOrder.clickToUpload')}</span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('placeOrder.fileTypes')}</p>
                </div>
                <input
                  id={`file-upload-${subOrder.id}`}
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploadingFile}
                  accept="image/*,.pdf"
                />
              </label>

              {/* URL input as alternative */}
              <div className="mt-2">
                <input
                  type="url"
                  value={subOrder.designFile}
                  onChange={(e) => handleChange('designFile', e.target.value)}
                  placeholder={t('placeOrder.designFileUrl')}
                  className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors"
                />
              </div>
            </div>
          )}

          {uploadError && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{uploadError}</p>
          )}
        </div>

        {/* Delivery Time */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
            {t('placeOrder.deliveryTime')} *
          </label>
          <input
            data-testid={`sub-order-delivery-time-${index}`}
            type="datetime-local"
            value={subOrder.deliveryTime}
            onChange={(e) => handleChange('deliveryTime', e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            className="block w-full sm:max-w-md rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors [color-scheme:light] dark:[color-scheme:dark]"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
            {t('placeOrder.notes')}
          </label>
          <textarea
            value={subOrder.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            rows={2}
            placeholder={t('placeOrder.notesPlaceholder')}
            className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors"
          />
        </div>
      </div>
    </div>
  );
}

// Wrap with React.memo to prevent unnecessary re-renders
export default memo(SubOrderItem);
