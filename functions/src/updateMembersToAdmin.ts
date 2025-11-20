/**
 * Update specific users from 'member' to 'admin' role
 */

import * as functions from 'firebase-functions';
import { db } from './admin';

export const updateMembersToAdmin = functions.https.onRequest(async (req, res) => {
  try {
    // Users to update from member to admin
    const emailsToUpdate = [
      'office@serigrafiebrasov.ro',
      'uv@serigrafiebrasov.ro',
      'danut@parhelionsoftware.com',
      'grafica@serigrafiebrasov.ro',
      'nelu@serigrafiebrasov.ro'
    ];

    const usersSnapshot = await db.collection('users').get();
    const batch = db.batch();
    let updatedCount = 0;

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();

      if (userData.email && emailsToUpdate.includes(userData.email.toLowerCase())) {
        if (userData.role === 'member' || userData.role === 'user') {
          batch.update(doc.ref, { role: 'admin' });
          console.log(`Updating ${userData.email} from '${userData.role}' to 'admin'`);
          updatedCount++;
        }
      }
    }

    if (updatedCount > 0) {
      await batch.commit();
      res.status(200).json({
        success: true,
        message: `Updated ${updatedCount} users from 'member' to 'admin'`,
        updatedCount
      });
    } else {
      res.status(200).json({
        success: true,
        message: 'No users needed updating',
        updatedCount: 0
      });
    }

  } catch (error: any) {
    console.error('Error updating users:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
