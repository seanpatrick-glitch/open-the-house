// Migration: add level: 'org' to all existing task documents missing the field
// Run once: node scripts/migrate-task-level.js
// Safe to re-run — only writes to documents where level is missing

const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./service-account.json');

admin.initializeApp({
  credential: admin.cert(serviceAccount),
});

const db = getFirestore();

async function migrate() {
  console.log('Starting level field migration...');

  const snapshot = await db.collection('tasks').get();
  const docs = snapshot.docs.filter(d => d.data().level === undefined);

  console.log(`Found ${snapshot.docs.length} total task documents.`);
  console.log(`Found ${docs.length} documents missing the level field.`);

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
      batch.update(doc.ref, { level: 'org' });
    });
    await batch.commit();
    batched += chunk.length;
    console.log(`Updated ${batched} / ${docs.length} documents...`);
  }

  console.log('level field migration complete.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
