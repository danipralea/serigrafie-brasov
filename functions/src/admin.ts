/**
 * Firebase Admin SDK initialization
 * Import this in any function that needs Firestore access
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin (only if not already initialized)
if (!admin.apps.length) {
  admin.initializeApp();
}

export { admin };
export const db = admin.firestore();
export const auth = admin.auth();
