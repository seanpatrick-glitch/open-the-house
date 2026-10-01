// Writes that reach past a single person type document: seeding the defaults
// for a new org, keeping people's denormalized typeLabel in step with a
// rename, and deleting a type without leaving records that point at it.
//
// Type is taxonomy only. Nothing here touches a person's group, intendedRole
// or login role.

import { collection, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { DEFAULT_PERSON_TYPES, newPersonTypeDoc } from '../models/personTypes';

// Firestore caps a batch at 500 writes.
const CHUNK = 400;

async function commitInChunks(writes) {
  for (let i = 0; i < writes.length; i += CHUNK) {
    const batch = writeBatch(db);
    writes.slice(i, i + CHUNK).forEach(write => write(batch));
    await batch.commit();
  }
}

export async function seedDefaultPersonTypes(orgId, createdBy) {
  const types = collection(db, 'organizations', orgId, 'personTypes');
  const batch = writeBatch(db);
  DEFAULT_PERSON_TYPES.forEach(t => {
    batch.set(doc(types), newPersonTypeDoc({ ...t, orgId, createdBy }));
  });
  await batch.commit();
}

export async function getPeopleOfType(orgId, typeId) {
  const snap = await getDocs(query(
    collection(db, 'organizations', orgId, 'people'),
    where('typeId', '==', typeId)
  ));
  return snap.docs;
}

export async function getSignupLinksOfType(orgId, typeId) {
  const snap = await getDocs(query(
    collection(db, 'organizations', orgId, 'signupTokens'),
    where('typeId', '==', typeId)
  ));
  return snap.docs.filter(d => d.data().active === true);
}

// A rename keeps the type's id; only the label people and signup links carry
// for display changes.
export async function syncTypeLabel(orgId, typeId, label) {
  const [people, links] = await Promise.all([
    getPeopleOfType(orgId, typeId),
    getSignupLinksOfType(orgId, typeId),
  ]);
  await commitInChunks(
    [...people, ...links].map(d => batch => batch.update(d.ref, { typeLabel: label }))
  );
}

// People of this type keep their group and intendedRole; only their type is
// cleared. The type's signup links are switched off, since the public signup
// page needs the type. The type doc goes in the last chunk, so a failure
// part way through leaves it in place to retry.
export async function deletePersonType(orgId, typeId) {
  const [people, links] = await Promise.all([
    getPeopleOfType(orgId, typeId),
    getSignupLinksOfType(orgId, typeId),
  ]);
  await commitInChunks([
    ...people.map(d => batch => batch.update(d.ref, { typeId: null, typeLabel: null })),
    ...links.map(d => batch => batch.update(d.ref, { active: false })),
    batch => batch.delete(doc(db, 'organizations', orgId, 'personTypes', typeId)),
  ]);
}
