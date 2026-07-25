const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const serviceAccount = require('./service-account.json');

initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth();

const UID_TO_DELETE = '48P1P9Tgs8YIb8HVWWUDmdD9yLv2'; // sean@openhouse.com — no Firestore user doc

async function run() {
  try {
    await auth.deleteUser(UID_TO_DELETE);
    console.log(`Deleted Auth account: ${UID_TO_DELETE}`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.log(`Auth account not found (already deleted): ${UID_TO_DELETE}`);
    } else {
      console.error(`Failed to delete Auth account ${UID_TO_DELETE}:`, err.message);
      process.exit(1);
    }
  }
  process.exit(0);
}

run();
