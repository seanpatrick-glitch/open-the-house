// Migration: backfill departmentId/level/phase/primaryAssigneeUid/
// currentAssigneeUid/contributorUids/promotedToOrg on task documents still
// carrying the pre-Aug-16-field-parity-fix shape (legacy `department` field,
// no departmentId). Known instance: qePHsVa9yoZbTog0DVgu ("post cast list"),
// a Template-created task from before TemplatesPanel.jsx was fixed to write
// the current field set. Scans all tasks rather than hard-coding that one id,
// in case other docs share the same stale shape.
// Run once: node scripts/migrate-task-department-fields.js
// Safe to re-run — only touches fields that are actually missing, never
// overwrites a value a document already has.

const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./service-account.json');

admin.initializeApp({
  credential: admin.cert(serviceAccount),
});

const db = getFirestore();

const TASK_LEVELS = { ORG: 'org', DEPARTMENT: 'department' };
const TASK_PHASES = { PLANNING: 'planning' };

async function migrate() {
  console.log('Scanning tasks for legacy department field without departmentId...');

  const snapshot = await db.collection('tasks').get();
  const docs = snapshot.docs.filter(d => {
    const data = d.data();
    return data.department !== undefined && data.departmentId === undefined;
  });

  console.log(`Found ${snapshot.docs.length} total task documents.`);
  console.log(`Found ${docs.length} documents needing migration.`);

  if (docs.length === 0) {
    console.log('Nothing to migrate. Exiting.');
    process.exit(0);
  }

  for (const doc of docs) {
    const data = doc.data();
    const departmentId = data.department || null;
    const update = {
      departmentId,
      level: departmentId ? TASK_LEVELS.DEPARTMENT : TASK_LEVELS.ORG,
    };
    if (data.phase === undefined) update.phase = TASK_PHASES.PLANNING;
    if (data.primaryAssigneeUid === undefined) update.primaryAssigneeUid = null;
    if (data.currentAssigneeUid === undefined) update.currentAssigneeUid = null;
    if (data.contributorUids === undefined) update.contributorUids = [];
    if (data.promotedToOrg === undefined) update.promotedToOrg = false;

    await doc.ref.update(update);
    console.log(`Updated tasks/${doc.id} (${data.title || 'untitled'}):`, update);
  }

  console.log('\nMigration complete.');
  console.log('Legacy department/assignedToDepartment fields preserved, not removed.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
