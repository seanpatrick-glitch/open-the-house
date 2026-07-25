const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./service-account.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Same test orgs deleted by cleanup-test-users.js — this script cleans up
// everything Firestore's non-cascading deletes leave behind:
//   - subcollections nested under organizations/{orgId}
//     (people [+internalData, hours], personTypes, signupTokens,
//      places [+productions], invites, pendingInvites)
//   - top-level docs that merely reference orgId
//     (departments, timelines, tasks [+comments, clarificationFlags,
//      accessRequests], timelineTemplates [+templateTasks])
const TEST_ORG_IDS = ['5TVL7eQv2u5srGE2dnmx', 'FQbhNsKPy8aR09m8BHam', 'AyVWGEICvOTKciIt0p8F'];

const TOP_LEVEL_COLLECTIONS_BY_ORGID = ['departments', 'timelines', 'tasks', 'timelineTemplates'];

async function run() {
  for (const orgId of TEST_ORG_IDS) {
    console.log(`\n--- Org ${orgId} ---`);

    // Wipe the entire organizations/{orgId} subtree (people, personTypes,
    // signupTokens, places+productions, invites, pendingInvites, and the
    // org doc itself if it still exists).
    const orgRef = db.collection('organizations').doc(orgId);
    try {
      await db.recursiveDelete(orgRef);
      console.log(`Recursively deleted organizations/${orgId} and all subcollections`);
    } catch (err) {
      console.error(`Failed recursive delete of organizations/${orgId}:`, err.message);
    }

    // Wipe top-level docs that reference this orgId as a field.
    for (const collectionName of TOP_LEVEL_COLLECTIONS_BY_ORGID) {
      const snap = await db.collection(collectionName).where('orgId', '==', orgId).get();
      if (snap.empty) {
        console.log(`  ${collectionName}: none found`);
        continue;
      }
      console.log(`  ${collectionName}: deleting ${snap.docs.length} doc(s)`);
      for (const doc of snap.docs) {
        try {
          // recursiveDelete also catches tasks/{id}/comments etc. and
          // timelineTemplates/{id}/templateTasks; harmless no-op for
          // collections without subcollections (departments, timelines).
          await db.recursiveDelete(doc.ref);
          console.log(`    Deleted ${collectionName}/${doc.id}`);
        } catch (err) {
          console.error(`    Failed to delete ${collectionName}/${doc.id}:`, err.message);
        }
      }
    }
  }

  console.log('\nOrg data cleanup complete.');
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
