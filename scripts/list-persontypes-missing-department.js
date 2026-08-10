// Read-only report: personType documents with no departmentId set.
// Run once: node scripts/list-persontypes-missing-department.js
// No writes. Sean uses the output to know which types still need
// manual department assignment in Settings (e.g. during Phase 0 setup).

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./service-account.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
  console.log('Scanning personTypes for missing departmentId...\n');

  const orgsSnap = await db.collection('organizations').get();
  let missing = 0;

  for (const orgDoc of orgsSnap.docs) {
    const orgId = orgDoc.id;
    const typesSnap = await db
      .collection('organizations')
      .doc(orgId)
      .collection('personTypes')
      .where('departmentId', '==', null)
      .get();

    typesSnap.docs.forEach(d => {
      console.log(`PersonType needs department: ${d.data().label} (${d.id}) — org ${orgId}`);
      missing++;
    });
  }

  console.log(`\nDone. ${missing} person type(s) still need a department assigned.`);
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
