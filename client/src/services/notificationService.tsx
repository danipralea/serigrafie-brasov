import type { Notification } from '../components/NotificationContainer';

// Global notification store
let listeners: Array<(notifications: Notification[]) => void> = [];
let notifications: Notification[] = [];
let notificationId = 0;

function emit() {
  listeners.forEach((listener) => listener(notifications));
}

export function subscribe(listener: (notifications: Notification[]) => void) {
  listeners.push(listener);
  listener(notifications);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function addNotification(notification: Omit<Notification, 'id'>) {
  const id = `notification-${notificationId++}`;
  notifications = [...notifications, { ...notification, id }];
  emit();
  return id;
}

export function dismissNotification(id: string) {
  notifications = notifications.filter((n) => n.id !== id);
  emit();
}

/**
 * Show a success toast notification
 */
export function showSuccess(message: string, options: { message?: string; duration?: number } = {}) {
  return addNotification({
    type: 'success',
    title: message,
    message: options.message,
    duration: options.duration ?? 5000,
  });
}

/**
 * Show an error toast notification
 */
export function showError(message: string, options: { message?: string; duration?: number } = {}) {
  return addNotification({
    type: 'error',
    title: message,
    message: options.message,
    duration: options.duration ?? 5000,
  });
}

/**
 * Show an info toast notification
 */
export function showInfo(message: string, options: { message?: string; duration?: number } = {}) {
  return addNotification({
    type: 'info',
    title: message,
    message: options.message,
    duration: options.duration ?? 5000,
  });
}

/**
 * Show a loading toast notification (converted to info type)
 */
export function showLoading(message: string) {
  return addNotification({
    type: 'info',
    title: message,
    duration: 0, // Don't auto-dismiss loading notifications
  });
}

/**
 * Dismiss a specific toast
 */
export function dismissToast(toastId: string) {
  dismissNotification(toastId);
}

/**
 * Show a clickable notification for a new order
 */
export function showOrderNotification(order: any, onClickFunction: (order: any) => void) {
  // For now, just show a simple notification
  // TODO: Implement custom clickable notification component if needed
  return showInfo('Comandă nouă plasată', {
    message: `#${order.id.substring(0, 8).toUpperCase()} - ${order.productType}`,
    duration: 10000,
  });
}

/**
 * Show a clickable notification for an order update
 */
export function showUpdateNotification(update: any, order: any, onClickFunction: (order: any) => void) {
  // For now, just show a simple notification
  // TODO: Implement custom clickable notification component if needed
  const truncatedText = update.text.length > 50
    ? `${update.text.substring(0, 50)}...`
    : update.text;

  return showInfo('Actualizare comandă', {
    message: `${update.userName}: ${truncatedText}`,
    duration: 8000,
  });
}
