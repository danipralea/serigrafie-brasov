/**
 * Migration Function: Convert isAdmin/isTeamMember to role-based system
 *
 * Call this function via HTTP to migrate all users:
 * https://us-central1-serigrafie-brasov.cloudfunctions.net/migrateToRoles
 *
 * Add ?dryRun=true to preview changes without applying them
 */

import * as functions from 'firebase-functions';
import { admin, db } from './admin';

interface MigrationResult {
  success: boolean;
  migratedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: string[];
  changes: Array<{
    userId: string;
    email: string | null;
    oldFlags: string;
    newRole: string;
  }>;
}

export const migrateToRoles = functions.https.onRequest(async (req, res) => {
  // IMPORTANT: Add authentication check here in production!
  // For security, you should verify the request is from an authorized admin

  const isDryRun = req.query.dryRun === 'true';

  try {
    const usersSnapshot = await db.collection('users').get();

    if (usersSnapshot.empty) {
      res.status(200).json({
        success: true,
        message: 'No users found in database',
        migratedCount: 0
      });
      return;
    }

    const result: MigrationResult = {
      success: true,
      migratedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      errors: [],
      changes: []
    };

    console.log(`Found ${usersSnapshot.size} users to ${isDryRun ? 'preview' : 'migrate'}`);

    // Process all users
    for (const doc of usersSnapshot.docs) {
      try {
        const userData = doc.data();
        const userId = doc.id;

        // Skip if already has role field
        if (userData.role) {
          console.log(`Skipping ${userData.email || userId} - already has role: ${userData.role}`);
          result.skippedCount++;
          continue;
        }

        // Determine new role based on old flags
        let newRole: string;
        if (userData.isAdmin === true) {
          newRole = 'admin';
        } else if (userData.isAdmin === false && userData.isTeamMember === true) {
          newRole = 'member';
        } else {
          newRole = 'user';
        }

        const oldFlags = `isAdmin=${userData.isAdmin}, isTeamMember=${userData.isTeamMember}`;

        result.changes.push({
          userId,
          email: userData.email || null,
          oldFlags,
          newRole
        });

        if (!isDryRun) {
          // Apply the migration
          await doc.ref.update({ role: newRole });
          console.log(`✅ Migrated ${userData.email || userId}: ${oldFlags} → role='${newRole}'`);
        } else {
          console.log(`[DRY RUN] Would migrate ${userData.email || userId}: ${oldFlags} → role='${newRole}'`);
        }

        result.migratedCount++;

      } catch (error: any) {
        console.error(`Error migrating user ${doc.id}:`, error);
        result.errorCount++;
        result.errors.push(`User ${doc.id}: ${error.message}`);
      }
    }

    // Step 2: Remove old fields (only if not dry run)
    if (!isDryRun && result.migratedCount > 0) {
      console.log('Removing old isAdmin and isTeamMember fields...');

      const batch = db.batch();
      let removeCount = 0;

      for (const doc of usersSnapshot.docs) {
        const userData = doc.data();

        if (userData.hasOwnProperty('isAdmin') || userData.hasOwnProperty('isTeamMember')) {
          batch.update(doc.ref, {
            isAdmin: admin.firestore.FieldValue.delete(),
            isTeamMember: admin.firestore.FieldValue.delete()
          });
          removeCount++;
        }
      }

      if (removeCount > 0) {
        await batch.commit();
        console.log(`✅ Removed old fields from ${removeCount} users`);
      }
    }

    // Send response
    res.status(200).json({
      ...result,
      message: isDryRun
        ? `Dry run complete. Preview ${result.migratedCount} changes.`
        : `Migration complete. Migrated ${result.migratedCount} users.`,
      isDryRun
    });

  } catch (error: any) {
    console.error('Migration failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});
