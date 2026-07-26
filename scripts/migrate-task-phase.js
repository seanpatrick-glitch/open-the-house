const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./service-account.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
  console.log('Starting task phase migration...');

  const snap = await db.collection('tasks').get();
  const docs = snap.docs.filter(d => d.data().phase === undefined);

  console.log(`Found ${snap.docs.length} total task documents.`);
  console.log(`Found ${docs.length} documents missing the phase field.`);

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
      batch.update(doc.ref, { phase: 'planning' });
    });
    await batch.commit();
    batched += chunk.length;
    console.log(`Updated ${batched} / ${docs.length} documents...`);
  }

  console.log('Phase field migration complete.');
  process.exit(0);
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
