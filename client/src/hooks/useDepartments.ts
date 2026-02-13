import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth, hasTeamAccess } from '../contexts/AuthContext';
import { Department } from '../types';

interface UseDepartmentsOptions {
  isOwn?: boolean;
}

export function useDepartments(options: UseDepartmentsOptions = {}) {
  const { isOwn = false } = options;
  const { currentUser, userProfile } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDepartments = useCallback(async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      const departmentsRef = collection(db, 'departments');

      let snap;
      if (isOwn) {
        let ownerId = currentUser.uid;
        if (hasTeamAccess(userProfile) && userProfile?.teamOwnerId) {
          ownerId = userProfile.teamOwnerId;
        }
        const q = query(departmentsRef, where('createdBy', '==', ownerId));
        snap = await getDocs(q);
      } else {
        snap = await getDocs(departmentsRef);
      }

      setDepartments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
    } catch {
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser, userProfile, isOwn]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  return { departments, loading, refetch: fetchDepartments };
}
