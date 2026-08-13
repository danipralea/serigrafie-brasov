import { db } from '../firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  deleteField,
  Timestamp
} from 'firebase/firestore';

/**
 * Orders are never hard-deleted from the UI. Deleting moves the order to the
 * trash (a `deletedAt` marker on the order document) so it can be restored.
 * Only an explicit "delete permanently" from the trash removes the data.
 */

export interface TrashActor {
  uid: string;
  name?: string | null;
}

export function isOrderInTrash(order: any): boolean {
  return Boolean(order?.deletedAt);
}

export async function moveOrderToTrash(orderId: string, actor: TrashActor): Promise<void> {
  const orderRef = doc(db, 'orders', orderId);
  await updateDoc(orderRef, {
    deletedAt: Timestamp.now(),
    deletedBy: actor.uid,
    deletedByName: actor.name || '',
    updatedAt: Timestamp.now()
  });
}

export async function restoreOrderFromTrash(orderId: string): Promise<void> {
  const orderRef = doc(db, 'orders', orderId);
  await updateDoc(orderRef, {
    deletedAt: deleteField(),
    deletedBy: deleteField(),
    deletedByName: deleteField(),
    updatedAt: Timestamp.now()
  });
}

export async function deleteOrderPermanently(orderId: string): Promise<void> {
  // Sub-orders
  const subOrdersRef = collection(db, 'orders', orderId, 'subOrders');
  const subOrdersSnapshot = await getDocs(subOrdersRef);
  await Promise.all(subOrdersSnapshot.docs.map(subDoc => deleteDoc(subDoc.ref)));

  // Updates / comments
  const updatesRef = collection(db, 'orderUpdates');
  const updatesSnapshot = await getDocs(query(updatesRef, where('orderId', '==', orderId)));
  await Promise.all(updatesSnapshot.docs.map(updateDocSnap => deleteDoc(updateDocSnap.ref)));

  // Notifications
  const notificationsRef = collection(db, 'notifications');
  const notificationsSnapshot = await getDocs(query(notificationsRef, where('orderId', '==', orderId)));
  await Promise.all(notificationsSnapshot.docs.map(notifDoc => deleteDoc(notifDoc.ref)));

  // The order itself
  await deleteDoc(doc(db, 'orders', orderId));
}
