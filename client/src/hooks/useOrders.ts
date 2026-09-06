import { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  onSnapshot,
  orderBy as firestoreOrderBy,
  query,
  where
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth, hasTeamAccess } from '../contexts/AuthContext';

interface UseOrdersOptions {
  /**
   * Only load orders in these statuses. Leaving it out loads everything.
   * A single-field `in` filter, so no composite index is needed.
   */
  statuses?: string[];
  /** Set to false to keep the listener closed (e.g. on a page still gating). */
  enabled?: boolean;
}

/**
 * Live orders, each hydrated with its sub-orders.
 *
 * Team members see every order; a client sees only their own. Sub-orders live
 * in a sub-collection, so they are fetched per order after each snapshot -
 * narrow the set with `statuses` on pages that do not need all of them.
 */
export function useOrders(options: UseOrdersOptions = {}) {
  const { statuses, enabled = true } = options;
  const { currentUser, userProfile } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  // Serialised so a caller passing a fresh array each render does not re-subscribe.
  const statusKey = statuses ? statuses.join(',') : '';

  useEffect(() => {
    // Nothing to listen to yet - do not leave callers waiting on a spinner.
    if (!enabled || !currentUser || !userProfile) {
      setLoading(false);
      return;
    }

    const ordersRef = collection(db, 'orders');
    const statusList = statusKey ? statusKey.split(',') : null;
    const constraints: any[] = [];

    if (!hasTeamAccess(userProfile)) {
      constraints.push(where('userId', '==', currentUser.uid));
    }
    if (statusList) {
      constraints.push(where('status', 'in', statusList));
    }
    // Ordering server-side needs a composite index once a filter is present,
    // so only the unfiltered team query asks Firestore to sort.
    if (constraints.length === 0) {
      constraints.push(firestoreOrderBy('createdAt', 'desc'));
    }

    setLoading(true);
    let cancelled = false;

    const unsubscribe = onSnapshot(
      query(ordersRef, ...constraints),
      async snapshot => {
        const hydrated = await Promise.all(
          snapshot.docs.map(async orderDoc => {
            const orderData: any = { id: orderDoc.id, ...orderDoc.data() };
            try {
              const subOrdersSnapshot = await getDocs(
                collection(db, 'orders', orderDoc.id, 'subOrders')
              );
              return {
                ...orderData,
                subOrders: subOrdersSnapshot.docs.map(subDoc => ({ id: subDoc.id, ...subDoc.data() }))
              };
            } catch {
              return { ...orderData, subOrders: [] };
            }
          })
        );

        if (cancelled) return;

        // Newest first, whichever query produced the snapshot.
        hydrated.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

        setOrders(hydrated);
        setLoading(false);
      },
      listenerError => {
        if (cancelled) return;
        if (import.meta.env.DEV) {
          console.error('Error fetching orders:', listenerError);
        }
        setError(listenerError);
        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [currentUser, userProfile, statusKey, enabled]);

  return { orders, loading, error };
}
