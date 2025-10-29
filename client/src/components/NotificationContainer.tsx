import { useState, useEffect } from 'react';
import { Transition } from '@headlessui/react';
import { CheckCircleIcon, XCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { XMarkIcon } from '@heroicons/react/20/solid';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

interface NotificationContainerProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}

export default function NotificationContainer({ notifications, onDismiss }: NotificationContainerProps) {
  return (
    <div
      aria-live="assertive"
      className="pointer-events-none fixed inset-0 flex items-end px-4 py-6 sm:items-start sm:p-6 z-50"
    >
      <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onDismiss={onDismiss}
          />
        ))}
      </div>
    </div>
  );
}

interface NotificationItemProps {
  notification: Notification;
  onDismiss: (id: string) => void;
}

function NotificationItem({ notification, onDismiss }: NotificationItemProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Show animation
    setShow(true);

    // Auto-dismiss after duration
    const duration = notification.duration ?? 5000;
    if (duration > 0) {
      const timer = setTimeout(() => {
        setShow(false);
        setTimeout(() => onDismiss(notification.id), 300);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [notification.id, notification.duration, onDismiss]);

  const handleDismiss = () => {
    setShow(false);
    setTimeout(() => onDismiss(notification.id), 300);
  };

  const icons = {
    success: CheckCircleIcon,
    error: XCircleIcon,
    info: InformationCircleIcon,
  };

  const iconColors = {
    success: 'text-green-400',
    error: 'text-red-400',
    info: 'text-blue-400',
  };

  const Icon = icons[notification.type];

  return (
    <Transition show={show}>
      <div className="pointer-events-auto w-full max-w-sm rounded-lg bg-white shadow-lg outline-1 outline-black/5 transition data-closed:opacity-0 data-enter:transform data-enter:duration-300 data-enter:ease-out data-closed:data-enter:translate-y-2 data-leave:duration-100 data-leave:ease-in data-closed:data-enter:sm:translate-x-2 data-closed:data-enter:sm:translate-y-0 dark:bg-slate-800 dark:-outline-offset-1 dark:outline-white/10">
        <div className="p-4">
          <div className="flex items-start">
            <div className="shrink-0">
              <Icon aria-hidden="true" className={`size-6 ${iconColors[notification.type]}`} />
            </div>
            <div className="ml-3 w-0 flex-1 pt-0.5">
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {notification.title}
              </p>
              {notification.message && (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {notification.message}
                </p>
              )}
            </div>
            <div className="ml-4 flex shrink-0">
              <button
                type="button"
                onClick={handleDismiss}
                className="inline-flex rounded-md text-slate-400 hover:text-slate-500 focus:outline-2 focus:outline-offset-2 focus:outline-blue-500 dark:hover:text-white dark:focus:outline-blue-500 transition-colors"
              >
                <span className="sr-only">Close</span>
                <XMarkIcon aria-hidden="true" className="size-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  );
}
