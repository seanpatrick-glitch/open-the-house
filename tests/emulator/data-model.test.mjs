// Data model rules test: runs the real firestore.rules and functions/index.js
// in the Firebase emulators (auth, firestore, functions) and checks who can
// read and write places, productions, events and tasks, mirroring the writes
// and queries the app makes. Covers Phase 1 of the data model migration
// (2026-09-28): productions live at organizations/{orgId}/productions, the old
// places/{placeId}/productions path is closed, the org's activeProdId holds a
// bare productionId that every dashboard resolves, and resetOrganization
// clears productions at the new path. Also Phase 3 item 2 (2026-09-29): a
// production needs only a name, lists its places in placeIds, and has three
// independent, nullable dates.
//
// Run from the repo root:  npm run test:roles  (runs role-flows.test.mjs, then this)
// Needs: Java 11+ (Firestore emulator), and `npm install` in both the repo
// root and functions/. Uses the demo-oth demo project, so it never touches
// the real Firebase project.
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const REPO = fileURLToPath(new URL('../../', import.meta.url))
const requireRoot = createRequire(`${REPO}package.json`)
const requireFns = createRequire(`${REPO}functions/package.json`)

const { initializeApp } = requireRoot('firebase/app')
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = requireRoot('firebase/auth')
const {
  getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  collection, query, where, orderBy, serverTimestamp, Timestamp, arrayUnion, arrayRemove,
} = requireRoot('firebase/firestore')
const { getFunctions, connectFunctionsEmulator, httpsCallable } = requireRoot('firebase/functions')
const admin = requireFns('firebase-admin')
// The dashboards' own reader for activeProdId.
const { getActiveProductionId } = await import(new URL('../../src/models/org.js', import.meta.url).href)
// The readers' own helper for a production's places, older records included.
const { getPlaceIds } = await import(new URL('../../src/models/productions.js', import.meta.url).href)

const PROJECT = 'demo-oth'
admin.initializeApp({ projectId: PROJECT })
const adb = admin.firestore()

let appCount = 0
async function signUp(email) {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'fake-key', authDomain: `${PROJECT}.firebaseapp.com` }, `d${appCount++}`)
  const auth = getAuth(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  const db = getFirestore(app)
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  const fns = getFunctions(app)
  connectFunctionsEmulator(fns, '127.0.0.1', 5001)
  const cred = await createUserWithEmailAndPassword(auth, email, 'password123')
  const call = (name, data) => httpsCallable(fns, name)(data)
  return { uid: cred.user.uid, email, db, call }
}

const results = []
async function test(name, fn) {
  try {
    await fn()
    results.push(['PASS', name])
  } catch (err) {
    results.push(['FAIL', name, err.message])
  }
}
async function expectDenied(promise) {
  await assert.rejects(promise, (e) => /permission|PERMISSION_DENIED/i.test(e.code + e.message))
}
const day = (y, m, d) => Timestamp.fromDate(new Date(y, m - 1, d))

// ── seed: org A with one of each role, org B as the outsider ──
const orgA = 'dataOrgA', orgB = 'dataOrgB'
const ownerA = await signUp('data-owner-a@example.com')   // admin
const sam = await signUp('data-sam@example.com')          // secondaryAdmin
const dana = await signUp('data-dana@example.com')        // departmentHead, Lighting
const dave = await signUp('data-dave@example.com')        // departmentHead, Sound
const cory = await signUp('data-cory@example.com')        // base-level (MemberView)
const ownerB = await signUp('data-owner-b@example.com')   // admin of org B only
await adb.doc(`organizations/${orgA}`).set({ name: 'Data Org A', ownerId: ownerA.uid })
await adb.doc(`organizations/${orgB}`).set({ name: 'Data Org B', ownerId: ownerB.uid })
const seedRole = (who, orgId, role) => adb.doc(`users/${who.uid}`).set({ email: who.email, organizations: { [orgId]: { role } } })
await seedRole(ownerA, orgA, 'admin')
await seedRole(sam, orgA, 'secondaryAdmin')
await seedRole(dana, orgA, 'departmentHead')
await seedRole(dave, orgA, 'departmentHead')
await seedRole(cory, orgA, 'orgCollaborator')
await seedRole(ownerB, orgB, 'admin')
await adb.doc('departments/dataLights').set({ orgId: orgA, name: 'Lighting', departmentHeadUid: dana.uid })
await adb.doc('departments/dataSound').set({ orgId: orgA, name: 'Sound', departmentHeadUid: dave.uid })
// Headed by Dana but in org B: only the department's orgId stops her using it in org A.
await adb.doc('departments/dataBCrew').set({ orgId: orgB, name: 'B Crew', departmentHeadUid: dana.uid })
// Two places and one production seeded directly, so each section below has
// something to point at and a failure in one section can't cascade into another.
// Hamlet has the shape productions had before 2026-09-29 (one placeId).
const placeMain = 'dataMainStage', placeStudio = 'dataStudio', hamlet = 'dataHamlet'
await adb.doc(`organizations/${orgA}/places/${placeMain}`).set({ name: 'Main Stage', orgId: orgA })
await adb.doc(`organizations/${orgA}/places/${placeStudio}`).set({ name: 'Studio', orgId: orgA })
await adb.doc(`organizations/${orgA}/productions/${hamlet}`).set({
  name: 'Hamlet', displayLabel: 'Production', placeId: placeStudio, orgId: orgA, scope: 'single',
  startDate: new Date(2027, 0, 15), endDate: new Date(2027, 0, 31), status: 'planning',
  activeModules: { volunteerScheduling: false }, createdAt: new Date(), createdBy: ownerA.uid,
  openDate: new Date(2027, 0, 15), closeDate: new Date(2027, 0, 31), venueId: placeStudio,
})

// ── places ──
await test('places: admin adds a place (CreatePlaceForm), with a null placeType', async () => {
  const ref = await addDoc(collection(ownerA.db, 'organizations', orgA, 'places'), {
    name: 'Rehearsal Room', orgId: orgA, placeType: null, createdAt: serverTimestamp(), createdBy: ownerA.uid,
  })
  assert.equal((await adb.doc(`organizations/${orgA}/places/${ref.id}`).get()).data().placeType, null)
})
await test('places: secondary admin adds and renames a place', async () => {
  const ref = await addDoc(collection(sam.db, 'organizations', orgA, 'places'), {
    name: 'Loading Dock', orgId: orgA, createdAt: serverTimestamp(), createdBy: sam.uid,
  })
  await updateDoc(ref, { name: 'Scene Shop' })
})
await test('places: every member lists the org\'s places (PlacesView)', async () => {
  for (const who of [ownerA, dana, cory]) {
    const snap = await getDocs(collection(who.db, 'organizations', orgA, 'places'))
    assert.deepEqual(snap.docs.map(d => d.data().name).sort(), ['Main Stage', 'Rehearsal Room', 'Scene Shop', 'Studio'])
  }
})
await test('places: Department Heads and base-level members cannot add, edit or delete places', async () => {
  for (const who of [dana, cory]) {
    await expectDenied(addDoc(collection(who.db, 'organizations', orgA, 'places'), { name: 'x', orgId: orgA }))
    await expectDenied(updateDoc(doc(who.db, 'organizations', orgA, 'places', placeMain), { name: 'x' }))
    await expectDenied(deleteDoc(doc(who.db, 'organizations', orgA, 'places', placeMain)))
  }
})
await test('places: another org\'s admin cannot read or add places', async () => {
  await expectDenied(getDocs(collection(ownerB.db, 'organizations', orgA, 'places')))
  await expectDenied(getDoc(doc(ownerB.db, 'organizations', orgA, 'places', placeMain)))
  await expectDenied(addDoc(collection(ownerB.db, 'organizations', orgA, 'places'), { name: 'x', orgId: orgA }))
})

// ── productions: organizations/{orgId}/productions ──
// CreateProductionForm's record, field for field. Only name is required;
// placeIds and the three dates are null when left empty.
const productionRecord = (who, name, { placeIds = null, firstRehearsal = null, openDate = null, closeDate = null } = {}) => ({
  name, displayLabel: 'Production', placeIds, orgId: orgA, status: 'planning',
  firstRehearsal, openDate, closeDate,
  activeModules: { volunteerScheduling: false }, productionTeam: [], cast: [],
  createdAt: serverTimestamp(), createdBy: who.uid,
})
let tempest, twelfth, minifest
await test('productions: admin creates one at organizations/{orgId}/productions, not under its place (CreateProductionForm)', async () => {
  const ref = await addDoc(collection(ownerA.db, 'organizations', orgA, 'productions'),
    productionRecord(ownerA, 'The Tempest', { placeIds: [placeMain], openDate: day(2026, 11, 6), closeDate: day(2026, 11, 22) }))
  tempest = ref.id
  const saved = (await adb.doc(`organizations/${orgA}/productions/${tempest}`).get()).data()
  assert.equal(saved.name, 'The Tempest')
  assert.deepEqual(saved.placeIds, [placeMain]); assert.equal(saved.orgId, orgA)
  assert.equal(saved.firstRehearsal, null)
  assert.equal((await adb.collection(`organizations/${orgA}/places/${placeMain}/productions`).get()).size, 0)
})
await test('productions: admin creates one with only a title; places and dates are stored as null', async () => {
  const ref = await addDoc(collection(ownerA.db, 'organizations', orgA, 'productions'),
    productionRecord(ownerA, '2027 Winter Minifest'))
  minifest = ref.id
  const saved = (await adb.doc(`organizations/${orgA}/productions/${minifest}`).get()).data()
  assert.equal(saved.name, '2027 Winter Minifest')
  for (const key of ['placeIds', 'firstRehearsal', 'openDate', 'closeDate']) assert.equal(saved[key], null, key)
  assert.deepEqual(getPlaceIds(saved), [])
})
await test('productions: a place added mid-form is written to places first, then its ID goes in placeIds', async () => {
  const place = await addDoc(collection(sam.db, 'organizations', orgA, 'places'), {
    name: 'Fringe Tent', orgId: orgA, placeType: null, createdAt: serverTimestamp(), createdBy: sam.uid,
  })
  const ref = await addDoc(collection(sam.db, 'organizations', orgA, 'productions'),
    productionRecord(sam, 'Twelfth Night', {
      placeIds: [placeStudio, place.id], firstRehearsal: day(2026, 9, 14), openDate: day(2026, 10, 9), closeDate: day(2026, 10, 25),
    }))
  twelfth = ref.id
  const saved = (await adb.doc(`organizations/${orgA}/productions/${twelfth}`).get()).data()
  assert.deepEqual(saved.placeIds, [placeStudio, place.id])
  assert.equal((await adb.doc(`organizations/${orgA}/places/${place.id}`).get()).data().name, 'Fringe Tent')
  await deleteDoc(place)
})
await test('productions: secondary admin toggles an Active Module (ProductionDashboard)', async () => {
  await updateDoc(doc(sam.db, 'organizations', orgA, 'productions', twelfth), { 'activeModules.volunteerScheduling': true })
  assert.equal((await adb.doc(`organizations/${orgA}/productions/${twelfth}`).get()).data().activeModules.volunteerScheduling, true)
})
await test('productions: admin adds and removes places and sets or clears dates from the detail view (ProductionPlacesPanel, ProductionDatesPanel)', async () => {
  const ref = doc(ownerA.db, 'organizations', orgA, 'productions', minifest)
  // arrayUnion onto the null placeIds a title-only production starts with.
  await updateDoc(ref, { placeIds: arrayUnion(placeMain) })
  await updateDoc(ref, { placeIds: arrayUnion(placeStudio) })
  await updateDoc(ref, { placeIds: arrayRemove(placeMain) })
  assert.deepEqual((await adb.doc(`organizations/${orgA}/productions/${minifest}`).get()).data().placeIds, [placeStudio])
  await updateDoc(ref, { firstRehearsal: null, openDate: day(2027, 2, 5), closeDate: null })
  const saved = (await adb.doc(`organizations/${orgA}/productions/${minifest}`).get()).data()
  assert.equal(saved.openDate.toMillis(), day(2027, 2, 5).toMillis()); assert.equal(saved.closeDate, null)
  // Dateless again, for the ordering check below.
  await updateDoc(ref, { firstRehearsal: null, openDate: null, closeDate: null })
})
await test('productions: the first place change on an older record writes the whole list, keeping its placeId', async () => {
  const hamletData = (await getDoc(doc(ownerA.db, 'organizations', orgA, 'productions', hamlet))).data()
  assert.deepEqual(getPlaceIds(hamletData), [placeStudio])
  await updateDoc(doc(ownerA.db, 'organizations', orgA, 'productions', hamlet), { placeIds: [...getPlaceIds(hamletData), placeMain] })
  const saved = (await adb.doc(`organizations/${orgA}/productions/${hamlet}`).get()).data()
  assert.deepEqual(getPlaceIds(saved), [placeStudio, placeMain])
  // Back to the seeded shape for the sections below.
  await adb.doc(`organizations/${orgA}/productions/${hamlet}`).update({ placeIds: admin.firestore.FieldValue.delete() })
})
await test('productions: admin deletes one', async () => {
  const ref = await addDoc(collection(ownerA.db, 'organizations', orgA, 'productions'),
    productionRecord(ownerA, 'Scratch'))
  await deleteDoc(ref)
  assert.equal((await adb.doc(`organizations/${orgA}/productions/${ref.id}`).get()).exists, false)
})
await test('productions: every member lists them (ProductionsView), filters by place (PlacesView) and orders by opening (CreateTaskForm), dateless ones included', async () => {
  for (const who of [ownerA, dana, cory]) {
    const prods = collection(who.db, 'organizations', orgA, 'productions')
    const all = (await getDocs(prods)).docs.map(d => ({ id: d.id, ...d.data() }))
    assert.deepEqual(all.map(p => p.id).sort(), [hamlet, tempest, twelfth, minifest].sort())
    assert.deepEqual(all.filter(p => getPlaceIds(p).includes(placeStudio)).map(p => p.id).sort(), [hamlet, twelfth, minifest].sort())
    // A null openDate sorts first; a missing field would drop the doc entirely.
    assert.deepEqual((await getDocs(query(prods, orderBy('openDate', 'asc')))).docs.map(d => d.data().name),
      ['2027 Winter Minifest', 'Twelfth Night', 'The Tempest', 'Hamlet'])
  }
})
await test('productions: Department Heads and base-level members can read but not create, edit or delete', async () => {
  for (const who of [dana, cory]) {
    assert.equal((await getDoc(doc(who.db, 'organizations', orgA, 'productions', hamlet))).data().name, 'Hamlet')
    await expectDenied(addDoc(collection(who.db, 'organizations', orgA, 'productions'), productionRecord(who, 'x')))
    await expectDenied(updateDoc(doc(who.db, 'organizations', orgA, 'productions', hamlet), { 'activeModules.volunteerScheduling': true }))
    await expectDenied(updateDoc(doc(who.db, 'organizations', orgA, 'productions', hamlet), { placeIds: arrayUnion(placeMain) }))
    await expectDenied(updateDoc(doc(who.db, 'organizations', orgA, 'productions', hamlet), { openDate: day(2027, 1, 1) }))
    await expectDenied(deleteDoc(doc(who.db, 'organizations', orgA, 'productions', hamlet)))
  }
})
await test('productions: another org\'s admin cannot read, list or add them, even when a doc\'s orgId field names their org', async () => {
  await expectDenied(getDocs(collection(ownerB.db, 'organizations', orgA, 'productions')))
  await expectDenied(getDoc(doc(ownerB.db, 'organizations', orgA, 'productions', hamlet)))
  await expectDenied(addDoc(collection(ownerB.db, 'organizations', orgA, 'productions'),
    { ...productionRecord(ownerB, 'x'), orgId: orgB }))
  // The collectionGroup read rule removed in the move let members of whatever
  // org a production's orgId field named read it, wherever it was stored.
  const mislabeled = adb.doc(`organizations/${orgA}/productions/mislabeled`)
  await mislabeled.set({ name: 'Mislabeled', orgId: orgB, placeId: placeMain })
  try {
    await expectDenied(getDoc(doc(ownerB.db, 'organizations', orgA, 'productions', 'mislabeled')))
  } finally {
    await mislabeled.delete()
  }
})
await test('productions: the old places/{placeId}/productions path is closed to reads and writes', async () => {
  await expectDenied(addDoc(collection(ownerA.db, 'organizations', orgA, 'places', placeMain, 'productions'),
    productionRecord(ownerA, 'Old path', { placeIds: [placeMain] })))
  const legacy = adb.doc(`organizations/${orgA}/places/${placeMain}/productions/legacy`)
  await legacy.set({ name: 'Legacy', orgId: orgA, placeId: placeMain })
  try {
    await expectDenied(getDoc(doc(ownerA.db, 'organizations', orgA, 'places', placeMain, 'productions', 'legacy')))
  } finally {
    await legacy.delete()
  }
})

// ── active production: organizations/{orgId}.activeProdId ──
await test('activeProdId: admin sets it to the bare productionId (Settings, onboarding ProductionStep)', async () => {
  await updateDoc(doc(ownerA.db, 'organizations', orgA), { activeProdId: tempest })
  assert.equal((await adb.doc(`organizations/${orgA}`).get()).data().activeProdId, tempest)
})
await test('activeProdId: the Admin, Department Head and Member dashboards each resolve it to the production', async () => {
  for (const who of [ownerA, dana, cory]) {
    const id = getActiveProductionId((await getDoc(doc(who.db, 'organizations', orgA))).data())
    assert.equal(id, tempest)
    const prod = (await getDoc(doc(who.db, 'organizations', orgA, 'productions', id))).data()
    assert.equal(prod.name, 'The Tempest')
    assert.equal(prod.openDate.toMillis(), day(2026, 11, 6).toMillis())
  }
})
await test('activeProdId: a leftover "{placeId}/{productionId}" value reads as no active production instead of throwing', async () => {
  await adb.doc(`organizations/${orgA}`).update({ activeProdId: `${placeMain}/${tempest}` })
  try {
    const org = (await getDoc(doc(cory.db, 'organizations', orgA))).data()
    // What the dashboards would hit if they built the path from the raw value.
    assert.throws(() => doc(cory.db, 'organizations', orgA, 'productions', org.activeProdId))
    assert.equal(getActiveProductionId(org), null)
    assert.equal(getActiveProductionId({ activeProdId: null }), null)
  } finally {
    await adb.doc(`organizations/${orgA}`).update({ activeProdId: tempest })
  }
})
await test('activeProdId: Department Heads and base-level members cannot change it', async () => {
  await expectDenied(updateDoc(doc(dana.db, 'organizations', orgA), { activeProdId: hamlet }))
  await expectDenied(updateDoc(doc(cory.db, 'organizations', orgA), { activeProdId: hamlet }))
})

// ── events ──
// CreateEventForm's record for a one-off event.
const eventRecord = (who, data) => ({
  orgId: orgA, title: 'Event', description: null, location: null, startTime: null, endTime: null,
  scope: 'org', departmentId: null, production: null, productionName: null,
  createdBy: who.uid, createdAt: serverTimestamp(),
  startDate: day(2026, 11, 1), endDate: day(2026, 11, 1),
  recurrence: { enabled: false, frequency: null, endDate: null }, recurrenceGroupId: null,
  ...data,
})
let kickoff, focusCall
await test('events: admin creates an org-wide event and a show date for a production (CreateEventForm, ShowDatesPanel)', async () => {
  kickoff = (await addDoc(collection(ownerA.db, 'events'), eventRecord(ownerA, { title: 'Season kickoff' }))).id
  await addDoc(collection(ownerA.db, 'events'),
    eventRecord(ownerA, { title: 'Opening night', scope: 'production', production: hamlet, productionName: 'Hamlet' }))
})
await test('events: secondary admin edits and deletes events', async () => {
  const ref = await addDoc(collection(sam.db, 'events'), eventRecord(sam, { title: 'Board call' }))
  await updateDoc(ref, { location: 'Video call' })
  await deleteDoc(ref)
})
await test('events: a Department Head creates, edits and deletes events for their own department', async () => {
  const ref = await addDoc(collection(dana.db, 'events'), eventRecord(dana, { title: 'Focus call', scope: 'department', departmentId: 'dataLights' }))
  focusCall = ref.id
  await updateDoc(ref, { location: 'Booth' })
  await deleteDoc(await addDoc(collection(dana.db, 'events'), eventRecord(dana, { scope: 'department', departmentId: 'dataLights' })))
})
await test('events: a Department Head cannot write org-wide, show date or other departments\' events', async () => {
  await expectDenied(addDoc(collection(dana.db, 'events'), eventRecord(dana, { scope: 'org' })))
  await expectDenied(addDoc(collection(dana.db, 'events'),
    eventRecord(dana, { scope: 'production', production: hamlet, productionName: 'Hamlet' })))
  await expectDenied(addDoc(collection(dana.db, 'events'), eventRecord(dana, { scope: 'department', departmentId: 'dataSound' })))
  await expectDenied(addDoc(collection(dana.db, 'events'), eventRecord(dana, { scope: 'department', departmentId: 'dataBCrew' })))
  await expectDenied(updateDoc(doc(dana.db, 'events', kickoff), { title: 'x' }))
  await expectDenied(updateDoc(doc(dave.db, 'events', focusCall), { title: 'x' }))
})
await test('events: base-level members read the org calendar (TimelineView) but cannot write', async () => {
  const snap = await getDocs(query(collection(cory.db, 'events'), where('orgId', '==', orgA), orderBy('startDate', 'asc')))
  assert.deepEqual(snap.docs.map(d => d.data().title).sort(), ['Focus call', 'Opening night', 'Season kickoff'])
  await expectDenied(addDoc(collection(cory.db, 'events'), eventRecord(cory, {})))
  await expectDenied(updateDoc(doc(cory.db, 'events', kickoff), { title: 'x' }))
})
await test('events: another org\'s admin cannot read them or add one to this org', async () => {
  await expectDenied(getDocs(query(collection(ownerB.db, 'events'), where('orgId', '==', orgA))))
  await expectDenied(getDoc(doc(ownerB.db, 'events', kickoff)))
  await expectDenied(addDoc(collection(ownerB.db, 'events'), eventRecord(ownerB, {})))
})

// ── tasks ──
// CreateTaskForm's record.
const taskRecord = (who, data) => ({
  orgId: orgA, title: 'Task', description: '', dueByDate: day(2026, 11, 1), assignedOnDate: null,
  status: 'not_started', level: 'org', departmentId: null, promotedToOrg: false, visibleToAll: false,
  primaryAssigneeUid: null, currentAssigneeUid: null, handoffPending: false, contributorUids: [],
  phase: 'planning', assignedTo: null, production: null, productionName: null,
  visibleToDepartments: [], dependsOn: [], notifyOnComplete: [], notifyOnOverdue: [],
  createdBy: who.uid, completedAt: null, createdAt: serverTimestamp(),
  ...data,
})
let hallTask, plotTask
await test('tasks: admin creates an org-level task linked to a production (CreateTaskForm)', async () => {
  const ref = await addDoc(collection(ownerA.db, 'tasks'),
    taskRecord(ownerA, { title: 'Book the rehearsal hall', production: hamlet, productionName: 'Hamlet' }))
  hallTask = ref.id
  assert.equal((await adb.doc(`tasks/${hallTask}`).get()).data().production, hamlet)
})
await test('tasks: secondary admin edits and deletes tasks', async () => {
  const ref = await addDoc(collection(sam.db, 'tasks'), taskRecord(sam, { title: 'Order programs' }))
  await updateDoc(ref, { status: 'in_progress' })
  await deleteDoc(ref)
})
await test('tasks: a Department Head creates and edits tasks in their own department', async () => {
  const ref = await addDoc(collection(dana.db, 'tasks'), taskRecord(dana, { title: 'Hang the plot', level: 'department', departmentId: 'dataLights' }))
  plotTask = ref.id
  await updateDoc(ref, { status: 'in_progress' })
})
await test('tasks: a Department Head cannot write org-level tasks or other departments\' tasks', async () => {
  await expectDenied(addDoc(collection(dana.db, 'tasks'), taskRecord(dana, { level: 'org' })))
  await expectDenied(addDoc(collection(dana.db, 'tasks'), taskRecord(dana, { level: 'department', departmentId: 'dataSound' })))
  await expectDenied(addDoc(collection(dana.db, 'tasks'), taskRecord(dana, { level: 'department', departmentId: 'dataBCrew' })))
  await expectDenied(updateDoc(doc(dana.db, 'tasks', hallTask), { status: 'complete' }))
  await expectDenied(updateDoc(doc(dave.db, 'tasks', plotTask), { status: 'complete' }))
})
await test('tasks: base-level members read the org timeline (TimelineView) but cannot write', async () => {
  const snap = await getDocs(query(collection(cory.db, 'tasks'), where('orgId', '==', orgA), orderBy('dueByDate', 'asc')))
  assert.deepEqual(snap.docs.map(d => d.id).sort(), [hallTask, plotTask].sort())
  await expectDenied(addDoc(collection(cory.db, 'tasks'), taskRecord(cory, {})))
  await expectDenied(updateDoc(doc(cory.db, 'tasks', hallTask), { status: 'complete' }))
})
await test('tasks: another org\'s admin cannot read them or add one to this org', async () => {
  await expectDenied(getDocs(query(collection(ownerB.db, 'tasks'), where('orgId', '==', orgA))))
  await expectDenied(getDoc(doc(ownerB.db, 'tasks', hallTask)))
  await expectDenied(addDoc(collection(ownerB.db, 'tasks'), taskRecord(ownerB, {})))
})

// ── resetOrganization (Settings, Danger Zone) ── last: it wipes org B's departments.
await test('resetOrganization: deletes productions at the new path and anything left under a place, and counts them', async () => {
  await adb.doc(`organizations/${orgB}/places/bHall`).set({ name: 'B Hall', orgId: orgB })
  await adb.doc(`organizations/${orgB}/places/bHall/productions/bLegacy`).set({ name: 'Legacy', orgId: orgB, placeId: 'bHall' })
  await adb.doc(`organizations/${orgB}/productions/bOne`).set({ name: 'B One', orgId: orgB, placeId: 'bHall' })
  await adb.doc(`organizations/${orgB}/productions/bTwo`).set({ name: 'B Two', orgId: orgB, placeId: 'bHall' })
  await adb.doc(`organizations/${orgB}`).update({ activeProdId: 'bOne' })
  const res = await ownerB.call('resetOrganization', { orgId: orgB, confirmName: 'Data Org B' })
  assert.equal(res.data.counts.productions, 2)
  assert.equal(res.data.counts.places, 1)
  assert.equal((await adb.collection(`organizations/${orgB}/productions`).get()).size, 0)
  assert.equal((await adb.collection(`organizations/${orgB}/places`).get()).size, 0)
  assert.equal((await adb.doc(`organizations/${orgB}/places/bHall/productions/bLegacy`).get()).exists, false)
  // Settings survive a reset by design, so activeProdId can outlive its production.
  assert.equal((await adb.doc(`organizations/${orgB}`).get()).data().activeProdId, 'bOne')
})

for (const r of results) console.log(r.join(' | '))
const failed = results.filter((r) => r[0] === 'FAIL').length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
