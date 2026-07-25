const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const serviceAccount = require('./service-account.json');

initializeApp({ credential: cert(serviceAccount) });
const db   = getFirestore();
const auth = getAuth();

const KEEP_UID = 'LMbMFFznY8RwGFCk15HvJNIRaam1';
const TEST_ORG_IDS = ['5TVL7eQv2u5srGE2dnmx', 'FQbhNsKPy8aR09m8BHam', 'AyVWGEICvOTKciIt0p8F'];
const TOP_LEVEL_COLLECTIONS_BY_ORGID = ['departments', 'timelines', 'tasks', 'timelineTemplates'];
const ORG_SUBCOLLECTIONS = ['people', 'personTypes', 'signupTokens', 'places', 'invites', 'pendingInvites'];

async function run() {
  let clean = true;

  console.log('=== users collection ===');
  const usersSnap = await db.collection('users').get();
  usersSnap.docs.forEach(d => console.log(`  ${d.id} | ${d.data().email}`));
  const unexpected = usersSnap.docs.filter(d => d.id !== KEEP_UID);
  if (unexpected.length > 0) {
    clean = false;
    console.log(`  ISSUE: ${unexpected.length} unexpected user doc(s) remain`);
  } else {
    console.log('  OK: only the kept user remains');
  }

  console.log('\n=== Firebase Auth accounts ===');
  const listResult = await auth.listUsers(1000);
  listResult.users.forEach(u => console.log(`  ${u.uid} | ${u.email}`));
  const unexpectedAuth = listResult.users.filter(u => u.uid !== KEEP_UID);
  if (unexpectedAuth.length > 0) {
    clean = false;
    console.log(`  ISSUE: ${unexpectedAuth.length} unexpected auth account(s) remain`);
  } else {
    console.log('  OK: only the kept auth account remains');
  }

  for (const orgId of TEST_ORG_IDS) {
    console.log(`\n=== Org ${orgId} ===`);

    const orgDoc = await db.collection('organizations').doc(orgId).get();
    if (orgDoc.exists) {
      clean = false;
      console.log(`  ISSUE: organizations/${orgId} doc still exists`);
    } else {
      console.log(`  OK: organizations/${orgId} doc does not exist`);
    }

    for (const sub of ORG_SUBCOLLECTIONS) {
      const subSnap = await db.collection('organizations').doc(orgId).collection(sub).get();
      if (!subSnap.empty) {
        clean = false;
        console.log(`  ISSUE: organizations/${orgId}/${sub} has ${subSnap.docs.length} remaining doc(s): ${subSnap.docs.map(d => d.id).join(', ')}`);
      } else {
        console.log(`  OK: organizations/${orgId}/${sub} is empty`);
      }
    }

    for (const collectionName of TOP_LEVEL_COLLECTIONS_BY_ORGID) {
      const snap = await db.collection(collectionName).where('orgId', '==', orgId).get();
      if (!snap.empty) {
        clean = false;
        console.log(`  ISSUE: ${collectionName} has ${snap.docs.length} doc(s) referencing this orgId: ${snap.docs.map(d => d.id).join(', ')}`);
      } else {
        console.log(`  OK: ${collectionName} has no docs referencing this orgId`);
      }
    }
  }

  console.log(clean ? '\nAll clear — no orphaned data found.' : '\nISSUES FOUND — see above.');
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
