const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./service-account.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
  const snap = await db.collection('users').get();
  snap.docs.forEach(d => {
    const data = d.data();
    const orgs = Object.keys(data.organizations ?? {});
    console.log(`${d.id} | ${data.email} | orgs: ${orgs.join(', ')}`);
  });
  console.log(`\nTotal: ${snap.docs.length} users`);
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
