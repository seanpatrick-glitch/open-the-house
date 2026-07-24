// Migration: copy assignedTo -> primaryAssigneeUid on all task documents
// Run once: node scripts/migrate-assigned-to.js
// Safe to re-run — only writes to documents where primaryAssigneeUid is missing
// Does NOT delete assignedTo — remove that field separately after confirming migration

const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./service-account.json');

admin.initializeApp({
  credential: admin.cert(serviceAccount),
});

const db = getFirestore();

async function migrate() {
  console.log('Starting assignedTo -> primaryAssigneeUid migration...');

  const snapshot = await db.collection('tasks').get();
  const docs = snapshot.docs.filter(d => {
    const data = d.data();
    return data.primaryAssigneeUid === undefined && data.assignedTo !== undefined;
  });

  console.log(`Found ${snapshot.docs.length} total task documents.`);
  console.log(`Found ${docs.length} documents needing migration (have assignedTo, missing primaryAssigneeUid).`);

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
        primaryAssigneeUid: data.assignedTo,
        currentAssigneeUid: data.assignedTo,
        handoffPending:     false,
        contributorUids:    [],
      });
    });
    await batch.commit();
    batched += chunk.length;
    console.log(`Updated ${batched} / ${docs.length} documents...`);
  }

  console.log('assignedTo -> primaryAssigneeUid migration complete.');
  console.log('assignedTo field preserved. Remove it manually after confirming migration.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
