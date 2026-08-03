import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TrashIcon } from '@heroicons/react/24/solid';
import {
  PositionFormEntry,
  createPositionFormEntry,
  getPositionArea,
  getPositionCost,
  getPositioningTotalCost
} from '../utils/positioning';

interface PositioningEditorProps {
  positions: PositionFormEntry[];
  onChange: (positions: PositionFormEntry[]) => void;
  /** Prefix for data-testid attributes, e.g. "sub-order-0". */
  testIdPrefix?: string;
}

/**
 * Editor for the customisation positions of one order item. Each position
 * holds its own quantity, dimensions and unit cost; area and cost are derived.
 */
export default function PositioningEditor({ positions, onChange, testIdPrefix }: PositioningEditorProps) {
  const { t } = useTranslation();
  const [nameInput, setNameInput] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  const entries = positions || [];
  const totalCost = getPositioningTotalCost(entries);

  function updatePosition(index: number, fields: Partial<PositionFormEntry>) {
    onChange(entries.map((pos, i) => (i === index ? { ...pos, ...fields } : pos)));
  }

  function addPosition() {
    const name = nameInput.trim();
    if (!name) return;
    if (entries.some(pos => pos.name.toLowerCase() === name.toLowerCase())) return;
    onChange([...entries, createPositionFormEntry(name)]);
    setNameInput('');
  }

  const fieldClass =
    'block w-full rounded-md bg-white dark:bg-slate-600 px-3 py-2 text-sm text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-500 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors';
  const labelClass = 'block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1';

  return (
    <div>
      {entries.length === 0 ? (
        <p className="mb-2 text-sm text-gray-500 dark:text-slate-400">{t('placeOrder.positioningEmpty')}</p>
      ) : (
        <div className="space-y-3 mb-3">
          {entries.map((pos, i) => {
            const area = getPositionArea(pos);
            const cost = getPositionCost(pos);

            return (
              <div key={i} className="rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center px-2.5 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-sm font-medium rounded-full">
                    {pos.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => onChange(entries.filter((_, idx) => idx !== i))}
                    className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                    title={t('placeOrder.removePosition')}
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <label className={labelClass}>{t('placeOrder.quantity')}</label>
                    <input
                      data-testid={testIdPrefix ? `${testIdPrefix}-position-${i}-quantity` : undefined}
                      type="number"
                      value={pos.quantity}
                      onChange={(e) => updatePosition(i, { quantity: e.target.value })}
                      min="0"
                      placeholder="0"
                      className={fieldClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>{t('placeOrder.length')}</label>
                    <input
                      type="number"
                      value={pos.length}
                      onChange={(e) => updatePosition(i, { length: e.target.value })}
                      step="0.01"
                      placeholder="0.00"
                      className={fieldClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>{t('placeOrder.width')}</label>
                    <input
                      type="number"
                      value={pos.width}
                      onChange={(e) => updatePosition(i, { width: e.target.value })}
                      step="0.01"
                      placeholder="0.00"
                      className={fieldClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>{t('placeOrder.squareCm')}</label>
                    <input
                      type="text"
                      value={area === null ? '' : area.toFixed(2)}
                      readOnly
                      disabled
                      placeholder="-"
                      className="block w-full rounded-md bg-gray-100 dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>{t('placeOrder.cmp')}</label>
                    <input
                      type="number"
                      value={pos.cmp}
                      onChange={(e) => updatePosition(i, { cmp: e.target.value })}
                      step="0.01"
                      placeholder="0.00"
                      className={fieldClass}
                    />
                  </div>
                </div>

                {cost !== null && (
                  <p className="mt-2 text-xs text-gray-600 dark:text-slate-300">
                    {t('placeOrder.positionCost')}: <span className="font-semibold">{cost.toFixed(2)}</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        <input
          ref={nameInputRef}
          data-testid={testIdPrefix ? `${testIdPrefix}-position-input` : undefined}
          type="text"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addPosition();
            }
          }}
          placeholder={t('placeOrder.positioningPlaceholder')}
          className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors"
        />
        <button
          data-testid={testIdPrefix ? `${testIdPrefix}-position-add-button` : undefined}
          type="button"
          onClick={() => {
            addPosition();
            nameInputRef.current?.focus();
          }}
          className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors flex-shrink-0"
        >
          +
        </button>
      </div>

      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500 dark:text-slate-400">{t('placeOrder.positioningAdd')}</p>
        {totalCost !== null && (
          <p className="text-xs font-semibold text-gray-900 dark:text-white">
            {t('placeOrder.totalCost')}: {totalCost.toFixed(2)}
          </p>
        )}
      </div>
    </div>
  );
}
