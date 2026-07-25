const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const serviceAccount = require('./service-account.json');

initializeApp({ credential: cert(serviceAccount) });
const db   = getFirestore();
const auth = getAuth();

const KEEP_UID = 'LMbMFFznY8RwGFCk15HvJNIRaam1';

async function run() {
  const snap = await db.collection('users').get();
  const toDelete = snap.docs.filter(d => d.id !== KEEP_UID);

  console.log(`Keeping: ${KEEP_UID}`);
  console.log(`Deleting ${toDelete.length} user documents and auth accounts:\n`);
  toDelete.forEach(d => console.log(`  ${d.id} | ${d.data().email}`));

  for (const userDoc of toDelete) {
    const uid = userDoc.id;

    // Delete Firestore user document
    try {
      await db.collection('users').doc(uid).delete();
      console.log(`Deleted Firestore doc: ${uid}`);
    } catch (err) {
      console.error(`Failed to delete Firestore doc ${uid}:`, err.message);
    }

    // Delete Firebase Auth account
    try {
      await auth.deleteUser(uid);
      console.log(`Deleted Auth account: ${uid}`);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        console.log(`Auth account not found (skipping): ${uid}`);
      } else {
        console.error(`Failed to delete Auth account ${uid}:`, err.message);
      }
    }
  }

  // Delete test org documents (orgs with no remaining members)
  const testOrgIds = ['5TVL7eQv2u5srGE2dnmx', 'FQbhNsKPy8aR09m8BHam', 'AyVWGEICvOTKciIt0p8F'];
  for (const orgId of testOrgIds) {
    try {
      await db.collection('organizations').doc(orgId).delete();
      console.log(`Deleted test org: ${orgId}`);
    } catch (err) {
      console.error(`Failed to delete org ${orgId}:`, err.message);
    }
  }

  console.log('\nCleanup complete.');
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
