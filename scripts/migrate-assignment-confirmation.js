const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./service-account.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
  console.log('Starting assignment confirmation field migration...');

  const snap = await db.collectionGroup('people').get();
  const docs = snap.docs.filter(d => {
    const assignments = d.data().assignments ?? [];
    return assignments.some(a => a.confirmed === undefined);
  });

  console.log(`Found ${snap.docs.length} total people documents.`);
  console.log(`Found ${docs.length} documents with assignments missing the confirmed field.`);

  if (docs.length === 0) {
    console.log('Nothing to migrate. Exiting.');
    process.exit(0);
  }

  let updated = 0;

  for (const docSnap of docs) {
    const assignments = docSnap.data().assignments ?? [];
    const updatedAssignments = assignments.map(a => ({
      ...a,
      confirmed:   a.confirmed   ?? false,
      confirmedAt: a.confirmedAt ?? null,
    }));
    await docSnap.ref.update({ assignments: updatedAssignments });
    updated++;
    console.log(`Updated ${updated} / ${docs.length} documents...`);
  }

  console.log('Assignment confirmation migration complete.');
  process.exit(0);
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
