import toast from 'react-hot-toast';

/**
 * Show a success toast notification
 */
export function showSuccess(message, options = {}) {
  return toast.success(message, options);
}

/**
 * Show an error toast notification
 */
export function showError(message, options = {}) {
  return toast.error(message, options);
}

/**
 * Show a loading toast notification
 */
export function showLoading(message) {
  return toast.loading(message);
}

/**
 * Dismiss a specific toast
 */
export function dismissToast(toastId) {
  toast.dismiss(toastId);
}

/**
 * Show a clickable notification for a new order
 */
export function showOrderNotification(order, onClickFunction) {
  return toast.custom(
    (t) => (
      <div
        className={`${
          t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 cursor-pointer hover:shadow-xl transition-shadow`}
        onClick={() => {
          onClickFunction(order);
          toast.dismiss(t.id);
        }}
      >
        <div className="flex-1 w-0 p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0 pt-0.5">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <svg
                  className="h-6 w-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-gray-900">
                Comandă nouă plasată
              </p>
              <p className="mt-1 text-sm text-gray-500">
                #{order.id.substring(0, 8).toUpperCase()} - {order.productType}
              </p>
              <p className="mt-1 text-xs text-blue-600">
                Click pentru a vizualiza detalii
              </p>
            </div>
          </div>
        </div>
        <div className="flex border-l border-gray-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toast.dismiss(t.id);
            }}
            className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-gray-700 hover:text-gray-500 focus:outline-none"
          >
            ✕
          </button>
        </div>
      </div>
    ),
    {
      duration: 10000,
      position: 'top-right',
    }
  );
}

/**
 * Show a clickable notification for an order update
 */
export function showUpdateNotification(update, order, onClickFunction) {
  return toast.custom(
    (t) => (
      <div
        className={`${
          t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 cursor-pointer hover:shadow-xl transition-shadow`}
        onClick={() => {
          onClickFunction(order);
          toast.dismiss(t.id);
        }}
      >
        <div className="flex-1 w-0 p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0 pt-0.5">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                  />
                </svg>
              </div>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-gray-900">
                Actualizare comandă
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {update.userName}: {update.text.substring(0, 50)}
                {update.text.length > 50 ? '...' : ''}
              </p>
              <p className="mt-1 text-xs text-green-600">
                Click pentru a vizualiza comanda
              </p>
            </div>
          </div>
        </div>
        <div className="flex border-l border-gray-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toast.dismiss(t.id);
            }}
            className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-gray-700 hover:text-gray-500 focus:outline-none"
          >
            ✕
          </button>
        </div>
      </div>
    ),
    {
      duration: 8000,
      position: 'top-right',
    }
  );
}
