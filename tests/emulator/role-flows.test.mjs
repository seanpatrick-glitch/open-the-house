// Role and membership regression test: runs the real firestore.rules and
// functions/index.js in the Firebase emulators (auth, firestore, functions)
// and checks every path behind the 2026-09-25 DH misrouting fix — invites
// for new and existing members, a second org keeping the first, promotions
// and stale invites, person-record links keeping access, one-org revokes, and
// that no client can write a role.
//
// Run from the repo root:  npm run test:roles
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
const { getFirestore, connectFirestoreEmulator, doc, setDoc, updateDoc, addDoc, collection, serverTimestamp } = requireRoot('firebase/firestore')
const { getFunctions, connectFunctionsEmulator, httpsCallable } = requireRoot('firebase/functions')
const admin = requireFns('firebase-admin')

const PROJECT = 'demo-oth'
admin.initializeApp({ projectId: PROJECT })
const adb = admin.firestore()
const { Timestamp } = requireFns('firebase-admin/firestore')

let appCount = 0
async function signUp(email) {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'fake-key', authDomain: `${PROJECT}.firebaseapp.com` }, `u${appCount++}`)
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
async function expectCode(promise, code) {
  await assert.rejects(promise, (e) => e.code === `functions/${code}` || (assert.fail(`expected ${code}, got ${e.code}: ${e.message}`)))
}
const userDoc = async (uid) => (await adb.doc(`users/${uid}`).get()).data()
const future = () => Timestamp.fromMillis(Date.now() + 7 * 864e5)

// ── seed: two orgs, their owners, a secondary admin, departments ──
const ownerA = await signUp('owner-a@example.com')
const ownerB = await signUp('owner-b@example.com')
const sam = await signUp('sam@example.com')
const orgA = 'orgA', orgB = 'orgB'
await adb.doc(`organizations/${orgA}`).set({ name: 'Org A', ownerId: ownerA.uid })
await adb.doc(`organizations/${orgB}`).set({ name: 'Org B', ownerId: ownerB.uid })
await adb.doc(`users/${ownerA.uid}`).set({ email: ownerA.email, organizations: { [orgA]: { role: 'admin' } } })
await adb.doc(`users/${ownerB.uid}`).set({ email: ownerB.email, organizations: { [orgB]: { role: 'admin' } } })
await adb.doc(`users/${sam.uid}`).set({ email: sam.email, organizations: { [orgA]: { role: 'secondaryAdmin' } } })
await adb.doc('departments/deptA1').set({ orgId: orgA, name: 'Front of House', departmentHeadUid: null })
await adb.doc('departments/deptA2').set({ orgId: orgA, name: 'Lighting', departmentHeadUid: null })
const invite = (orgId, id, data) => adb.doc(`organizations/${orgId}/pendingInvites/${id}`).set({
  inviteId: id, orgId, level: 'organization', scopeId: orgId, status: 'pending', expiresAt: future(), departmentId: null, ...data,
})

// ── rules ──
await test('signup: owner can create own users doc as admin of an org they own', async () => {
  const founder = await signUp('founder@example.com')
  const orgRef = await addDoc(collection(founder.db, 'organizations'), { name: 'New Org', ownerId: founder.uid, createdAt: serverTimestamp() })
  await setDoc(doc(founder.db, 'users', founder.uid), { email: founder.email, organizations: { [orgRef.id]: { role: 'admin' } } })
})
await test('signup: cannot create users doc claiming admin of someone else\'s org', async () => {
  const sneaky = await signUp('sneaky@example.com')
  await expectDenied(setDoc(doc(sneaky.db, 'users', sneaky.uid), { email: sneaky.email, organizations: { [orgA]: { role: 'admin' } } }))
})

// ── acceptInvite: brand-new member ──
const alice = await signUp('Alice@Example.com')
await invite(orgA, 'invA-collab', { email: 'alice@example.com', role: 'orgCollaborator' })
await test('acceptInvite: new member joins with the invite role (email match is case-insensitive)', async () => {
  const res = await alice.call('acceptInvite', { orgId: orgA, inviteId: 'invA-collab', displayName: 'Alice' })
  assert.equal(res.data.role, 'orgCollaborator')
  assert.equal((await userDoc(alice.uid)).organizations[orgA].role, 'orgCollaborator')
  assert.equal((await adb.doc(`organizations/${orgA}/members/${alice.uid}`).get()).data().role, 'orgCollaborator')
  assert.equal((await adb.doc(`organizations/${orgA}/pendingInvites/invA-collab`).get()).data().status, 'accepted')
})
await test('rules: member cannot promote themselves to admin', async () => {
  await expectDenied(updateDoc(doc(alice.db, 'users', alice.uid), { [`organizations.${orgA}.role`]: 'admin' }))
})
await test('rules: member can still edit their own display name', async () => {
  await updateDoc(doc(alice.db, 'users', alice.uid), { displayName: 'Alice A.' })
})
await test('rules: invitee cannot edit their own pending invite', async () => {
  await invite(orgA, 'invA-tamper', { email: 'alice@example.com', role: 'orgCollaborator' })
  await expectDenied(updateDoc(doc(alice.db, 'organizations', orgA, 'pendingInvites', 'invA-tamper'), { role: 'admin' }))
  await adb.doc(`organizations/${orgA}/pendingInvites/invA-tamper`).delete()
})
await test('rules: accepting an already-used invite is refused', async () => {
  await expectCode(alice.call('acceptInvite', { orgId: orgA, inviteId: 'invA-collab' }), 'failed-precondition')
})

// ── multi-org (path C) ──
await invite(orgB, 'invB-prod', { email: 'alice@example.com', role: 'productionCollaborator' })
await test('acceptInvite: joining a second org keeps the first', async () => {
  await alice.call('acceptInvite', { orgId: orgB, inviteId: 'invB-prod' })
  const orgs = (await userDoc(alice.uid)).organizations
  assert.equal(orgs[orgA].role, 'orgCollaborator')
  assert.equal(orgs[orgB].role, 'productionCollaborator')
})

// ── promoting an existing member (path B) ──
await invite(orgA, 'invA-stale', { email: 'alice@example.com', role: 'orgCollaborator' })
await test('setMemberRole: admin promotes existing member to DH; department and member doc follow; stale invite superseded', async () => {
  const res = await ownerA.call('setMemberRole', { orgId: orgA, uid: alice.uid, role: 'departmentHead', departmentId: 'deptA1' })
  assert.equal(res.data.supersededInvites, 1)
  assert.equal((await userDoc(alice.uid)).organizations[orgA].role, 'departmentHead')
  assert.equal((await userDoc(alice.uid)).organizations[orgB].role, 'productionCollaborator')
  const member = (await adb.doc(`organizations/${orgA}/members/${alice.uid}`).get()).data()
  assert.equal(member.role, 'departmentHead'); assert.equal(member.departmentId, 'deptA1')
  assert.equal((await adb.doc('departments/deptA1').get()).data().departmentHeadUid, alice.uid)
  assert.equal((await adb.doc(`organizations/${orgA}/pendingInvites/invA-stale`).get()).data().status, 'superseded')
})
await test('stale invite can no longer undo the promotion', async () => {
  await expectCode(alice.call('acceptInvite', { orgId: orgA, inviteId: 'invA-stale' }), 'failed-precondition')
  assert.equal((await userDoc(alice.uid)).organizations[orgA].role, 'departmentHead')
})
await test('setMemberRole: moving a DH to another department clears the old department', async () => {
  await ownerA.call('setMemberRole', { orgId: orgA, uid: alice.uid, role: 'departmentHead', departmentId: 'deptA2' })
  assert.equal((await adb.doc('departments/deptA1').get()).data().departmentHeadUid, null)
  assert.equal((await adb.doc('departments/deptA2').get()).data().departmentHeadUid, alice.uid)
})
await test('setMemberRole: non-admin is refused', async () => {
  await expectCode(alice.call('setMemberRole', { orgId: orgA, uid: sam.uid, role: 'orgCollaborator' }), 'permission-denied')
})
await test('setMemberRole: owner\'s access cannot be changed, even by a secondary admin', async () => {
  await expectCode(sam.call('setMemberRole', { orgId: orgA, uid: ownerA.uid, role: 'orgCollaborator' }), 'failed-precondition')
})
await test('setMemberRole: cannot change your own access', async () => {
  await expectCode(sam.call('setMemberRole', { orgId: orgA, uid: sam.uid, role: 'admin' }), 'failed-precondition')
})
await test('setMemberRole: Department Head requires a department in this org', async () => {
  await expectCode(ownerA.call('setMemberRole', { orgId: orgA, uid: alice.uid, role: 'departmentHead' }), 'invalid-argument')
  await adb.doc('departments/deptB1').set({ orgId: orgB, name: 'B dept' })
  await expectCode(ownerA.call('setMemberRole', { orgId: orgA, uid: alice.uid, role: 'departmentHead', departmentId: 'deptB1' }), 'invalid-argument')
})

// ── person-record link keeps an existing member's role ──
await test('acceptInvite (person token): existing DH links a People record and keeps DH access', async () => {
  await adb.doc(`organizations/${orgA}/people/pAlice`).set({ accountUid: null, accountStatus: 'invited', fieldValues: { email: 'alice@example.com' } })
  await adb.doc(`organizations/${orgA}/personInviteTokens/tokAlice`).set({ orgId: orgA, personId: 'pAlice', email: 'alice@example.com', accepted: false, expiresAt: future() })
  const res = await alice.call('acceptInvite', { orgId: orgA, tokenId: 'tokAlice' })
  assert.equal(res.data.role, 'departmentHead')
  assert.equal((await userDoc(alice.uid)).organizations[orgA].role, 'departmentHead')
  const person = (await adb.doc(`organizations/${orgA}/people/pAlice`).get()).data()
  assert.equal(person.accountUid, alice.uid); assert.equal(person.accountStatus, 'active')
})
await test('acceptInvite (person token): brand-new account joins as person', async () => {
  const pat = await signUp('pat@example.com')
  await adb.doc(`organizations/${orgA}/people/pPat`).set({ accountUid: null, accountStatus: 'invited' })
  await adb.doc(`organizations/${orgA}/personInviteTokens/tokPat`).set({ orgId: orgA, personId: 'pPat', email: 'pat@example.com', accepted: false, expiresAt: future() })
  await pat.call('acceptInvite', { orgId: orgA, tokenId: 'tokPat', displayName: 'Pat' })
  assert.equal((await userDoc(pat.uid)).organizations[orgA].role, 'person')
  assert.equal((await adb.doc(`organizations/${orgA}/members/${pat.uid}`).get()).data().personClass, true)
})
await test('rules: a signed-in user can no longer link themselves to someone else\'s People record', async () => {
  await adb.doc(`organizations/${orgA}/people/pOpen`).set({ accountUid: null, accountStatus: null })
  await expectDenied(updateDoc(doc(alice.db, 'organizations', orgA, 'people', 'pOpen'), { accountUid: alice.uid, accountStatus: 'active' }))
})

// ── DH invite for a new account ──
await test('acceptInvite: Department Head invite sets the department head', async () => {
  const bob = await signUp('bob@example.com')
  await adb.doc('departments/deptA3').set({ orgId: orgA, name: 'Sound', departmentHeadUid: null, departmentHeadEmail: 'bob@example.com' })
  await invite(orgA, 'deptA3', { email: 'bob@example.com', role: 'departmentHead', departmentId: 'deptA3', level: 'department', scopeId: 'deptA3' })
  await bob.call('acceptInvite', { orgId: orgA, inviteId: 'deptA3' })
  assert.equal((await userDoc(bob.uid)).organizations[orgA].role, 'departmentHead')
  const dept = (await adb.doc('departments/deptA3').get()).data()
  assert.equal(dept.departmentHeadUid, bob.uid); assert.equal(dept.departmentHeadEmail, null)
})

// ── guards ──
await test('acceptInvite: org owner cannot be demoted by an invite', async () => {
  await invite(orgA, 'invA-owner', { email: 'owner-a@example.com', role: 'orgCollaborator' })
  await expectCode(ownerA.call('acceptInvite', { orgId: orgA, inviteId: 'invA-owner' }), 'failed-precondition')
  assert.equal((await userDoc(ownerA.uid)).organizations[orgA].role, 'admin')
})
await test('acceptInvite: wrong email is refused', async () => {
  await invite(orgB, 'invB-other', { email: 'someone-else@example.com', role: 'orgCollaborator' })
  await expectCode(alice.call('acceptInvite', { orgId: orgB, inviteId: 'invB-other' }), 'permission-denied')
})
await test('acceptInvite: expired invite is refused', async () => {
  await invite(orgB, 'invB-expired', { email: 'alice@example.com', role: 'orgCollaborator', expiresAt: Timestamp.fromMillis(Date.now() - 1000) })
  await expectCode(alice.call('acceptInvite', { orgId: orgB, inviteId: 'invB-expired' }), 'failed-precondition')
})

// ── revoke one org only ──
await test('revokeMember: removes one org, keeps the other', async () => {
  await ownerB.call('revokeMember', { orgId: orgB, uid: alice.uid })
  const orgs = (await userDoc(alice.uid)).organizations
  assert.equal(orgs[orgB], undefined)
  assert.equal(orgs[orgA].role, 'departmentHead')
  assert.equal((await adb.doc(`organizations/${orgB}/members/${alice.uid}`).get()).exists, false)
})
await test('rules: removed member cannot re-create their own members doc', async () => {
  await expectDenied(setDoc(doc(alice.db, 'organizations', orgB, 'members', alice.uid), { role: 'admin' }))
})
await test('revokeMember: removing a DH clears their department', async () => {
  await ownerA.call('revokeMember', { orgId: orgA, uid: alice.uid })
  assert.equal((await adb.doc('departments/deptA2').get()).data().departmentHeadUid, null)
  assert.deepEqual((await userDoc(alice.uid)).organizations, {})
})
await test('revokeMember: owner cannot be removed', async () => {
  await expectCode(sam.call('revokeMember', { orgId: orgA, uid: ownerA.uid }), 'failed-precondition')
})

for (const r of results) console.log(r.join(' | '))
const failed = results.filter((r) => r[0] === 'FAIL').length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
