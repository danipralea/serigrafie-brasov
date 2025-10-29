import { useEffect } from 'react';

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmă',
  cancelText = 'Anulează',
  type = 'warning', // warning, danger, info
  inline = false // if true, positions relative to parent instead of fullscreen
}) {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getColors = () => {
    switch (type) {
      case 'danger':
        return {
          icon: 'text-red-600 dark:text-red-400',
          iconBg: 'bg-red-100 dark:bg-red-900/30',
          confirmBtn: 'bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800',
          border: 'border-red-200 dark:border-red-800'
        };
      case 'info':
        return {
          icon: 'text-blue-600 dark:text-blue-400',
          iconBg: 'bg-blue-100 dark:bg-blue-900/30',
          confirmBtn: 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800',
          border: 'border-blue-200 dark:border-blue-800'
        };
      default: // warning
        return {
          icon: 'text-orange-600 dark:text-orange-400',
          iconBg: 'bg-orange-100 dark:bg-orange-900/30',
          confirmBtn: 'bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-800',
          border: 'border-orange-200 dark:border-orange-800'
        };
    }
  };

  const colors = getColors();

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <>
      {/* Blurred Background Overlay */}
      <div
        className={`${inline ? 'absolute' : 'fixed'} inset-0 bg-black bg-opacity-50 dark:bg-black/70 backdrop-blur-sm z-50 transition-opacity`}
        onClick={onClose}
      />

      {/* Dialog */}
      <div className={`${inline ? 'absolute' : 'fixed'} inset-0 z-50 flex items-center justify-center p-4 pointer-events-none`}>
        <div
          className={`bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full pointer-events-auto transform transition-all border-2 ${colors.border}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with Icon */}
          <div className="p-6">
            <div className="flex items-start space-x-4">
              <div className={`${colors.iconBg} rounded-full p-3 flex-shrink-0`}>
                {type === 'danger' ? (
                  <svg className={`w-6 h-6 ${colors.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ) : type === 'info' ? (
                  <svg className={`w-6 h-6 ${colors.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className={`w-6 h-6 ${colors.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-slate-300">
                  {message}
                </p>
              </div>
            </div>
          </div>

          {/* Footer with Actions */}
          <div className="bg-gray-50 dark:bg-slate-700 px-6 py-4 flex gap-3 justify-end rounded-b-lg">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-slate-300 font-medium hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              className={`px-4 py-2 rounded-lg text-white font-medium transition-colors ${colors.confirmBtn}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
