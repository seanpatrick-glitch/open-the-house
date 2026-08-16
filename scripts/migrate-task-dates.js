// Migration: copy startDate -> assignedOnDate and dueDate -> dueByDate on all task documents
// Run once: node scripts/migrate-task-dates.js
// Safe to re-run — only writes to documents where dueByDate is missing
// Does NOT delete startDate/dueDate — remove those fields separately after confirming migration

const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./service-account.json');

admin.initializeApp({
  credential: admin.cert(serviceAccount),
});

const db = getFirestore();

async function migrate() {
  console.log('Starting startDate/dueDate -> assignedOnDate/dueByDate migration...');

  const snapshot = await db.collection('tasks').get();
  const docs = snapshot.docs.filter(d => d.data().dueByDate === undefined);

  console.log(`Found ${snapshot.docs.length} total task documents.`);
  console.log(`Found ${docs.length} documents needing migration (missing dueByDate).`);

  if (docs.length === 0) {
    console.log('Nothing to migrate. Exiting.');
    process.exit(0);
  }

  const BATCH_SIZE = 400;
  let batched = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + BATCH_SIZE);
    chunk.forEach(doc => {
      const data = doc.data();
      batch.update(doc.ref, {
        assignedOnDate: data.startDate ?? null,
        dueByDate:      data.dueDate ?? null,
      });
    });
    await batch.commit();
    batched += chunk.length;
    console.log(`Updated ${batched} / ${docs.length} documents...`);
  }

  console.log('startDate/dueDate -> assignedOnDate/dueByDate migration complete.');
  console.log('startDate and dueDate fields preserved. Remove them manually after confirming migration.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
