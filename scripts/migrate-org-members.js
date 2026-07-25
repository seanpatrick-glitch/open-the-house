const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const serviceAccount = require('./service-account.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
  console.log('Starting orgMembers migration...');

  const usersSnap = await db.collection('users').get();
  console.log(`Found ${usersSnap.docs.length} user documents.`);

  let written = 0;

  for (const userDoc of usersSnap.docs) {
    const uid  = userDoc.id;
    const data = userDoc.data();
    const orgs = data.organizations ?? {};

    for (const [orgId, membership] of Object.entries(orgs)) {
      const memberRef = db
        .collection('organizations')
        .doc(orgId)
        .collection('members')
        .doc(uid);

      await memberRef.set({
        uid,
        email:           data.email || '',
        displayName:     data.name || data.email || '',
        role:            membership.role || 'person',
        provisionalAdmin: data.provisionalAdmin ?? false,
        departmentId:    membership.departmentId ?? null,
        joinedAt:        membership.joinedAt ?? data.createdAt ?? null,
        invitedBy:       membership.invitedBy ?? null,
        accountStatus:   data.accountState ?? 'confirmed',
      });

      console.log(`Wrote members/${uid} for org ${orgId}`);
      written++;
    }
  }

  console.log(`\nMigration complete. Wrote ${written} member documents.`);
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
