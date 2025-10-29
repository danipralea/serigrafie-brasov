import { useState, useEffect } from 'react';
import NotificationContainer, { Notification } from './NotificationContainer';
import { subscribe, dismissNotification } from '../services/notificationService';

export default function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const unsubscribe = subscribe(setNotifications);
    return unsubscribe;
  }, []);

  return (
    <>
      {children}
      <NotificationContainer
        notifications={notifications}
        onDismiss={dismissNotification}
      />
    </>
  );
}
