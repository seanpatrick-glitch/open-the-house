// Production Team and Cast: the two person lists on a production record
// (productionTeam and cast; entry shape in models/productions.js).
//
// The pure helpers below match people, build the add-flow search, and edit a
// list array. The three save helpers at the bottom run each edit inside a
// transaction that re-reads the current array, so two admins working on the
// same production never overwrite each other's rows.

import { doc, runTransaction, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { PERSON_GROUP } from '../models/people';
import { getDisplayName } from './displayName';

export const LIST_ERROR = {
  ALREADY_ON_LIST:    'already-on-list',
  ROW_MISSING:        'row-missing',
  PRODUCTION_MISSING: 'production-missing',
};

function listError(code) {
  const err = new Error(code);
  err.code = code;
  return err;
}

const GROUP_VALUES = new Set(Object.values(PERSON_GROUP));

// The taxonomy Group on a People record, or null. Group isn't built yet, so
// null is the normal case and nothing may depend on it.
export function groupOf(person) {
  return GROUP_VALUES.has(person?.group) ? person.group : null;
}

// Same human: the same People record, or the same login. Works for list
// entries and search candidates alike.
export function isSamePerson(a, b) {
  if (!a || !b) return false;
  return Boolean(
    (a.personId && a.personId === b.personId) ||
    (a.accountUid && a.accountUid === b.accountUid)
  );
}

function sameTimestamp(a, b) {
  if (!a || !b) return a === b;
  return a.seconds === b.seconds && a.nanoseconds === b.nanoseconds;
}

// Same row: same person, added at the same moment. Rows have no id of their
// own, so this is how an edit or a removal finds its row again.
export function isSameEntry(a, b) {
  return (a.personId ?? null) === (b.personId ?? null)
    && (a.accountUid ?? null) === (b.accountUid ?? null)
    && sameTimestamp(a.addedAt, b.addedAt);
}

export function entryKey(entry) {
  return [
    entry.personId ?? '',
    entry.accountUid ?? '',
    entry.addedAt?.seconds ?? '',
    entry.addedAt?.nanoseconds ?? '',
  ].join(':');
}

// ── Add flow search ──────────────────────────────────────────────────────────

// A People record as someone to add. Email falls back to the linked login's.
export function candidateFromPerson(person, linkedMember = null) {
  return {
    key:         `person:${person.id}`,
    personId:    person.id,
    accountUid:  person.accountUid || null,
    displayName: getDisplayName(person) || getDisplayName(linkedMember),
    email:       person.fieldValues?.email || linkedMember?.email || '',
    group:       groupOf(person),
  };
}

// A login with no People record. Group lives on the People record, so these
// never have one.
function candidateFromMember(member) {
  return {
    key:         `account:${member.uid}`,
    personId:    null,
    accountUid:  member.uid,
    displayName: getDisplayName(member),
    email:       member.email || '',
    group:       null,
  };
}

// Everyone who can be added: every People record, plus every member account
// no People record is linked to, so each human appears once. Sorted by name.
// members are organizations/{orgId}/members docs as { uid, ...data }.
export function buildCandidates(people = [], members = []) {
  const memberByUid = new Map(members.map(m => [m.uid, m]));
  const personIds   = new Set(people.map(p => p.id));
  const linkedUids  = new Set(people.map(p => p.accountUid).filter(Boolean));

  const candidates = [
    ...people.map(p => candidateFromPerson(p, p.accountUid ? memberByUid.get(p.accountUid) : null)),
    ...members
      .filter(m => m.uid && !linkedUids.has(m.uid) && !(m.personId && personIds.has(m.personId)))
      .map(candidateFromMember),
  ];
  return candidates.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base', numeric: true }));
}

// Case-insensitive match on name or email. An empty term matches nothing.
export function searchCandidates(candidates, term, limit = 8) {
  const needle = term.trim().toLowerCase();
  if (!needle) return { matches: [], more: 0 };
  const all = candidates.filter(c =>
    c.displayName.toLowerCase().includes(needle) || c.email.toLowerCase().includes(needle));
  return { matches: all.slice(0, limit), more: Math.max(0, all.length - limit) };
}

// ── Showing a row ────────────────────────────────────────────────────────────

export function makeDirectory(people = [], members = []) {
  return {
    personById:  new Map(people.map(p => [p.id, p])),
    personByUid: new Map(people.filter(p => p.accountUid).map(p => [p.accountUid, p])),
    memberByUid: new Map(members.map(m => [m.uid, m])),
  };
}

// A row shows the person's current name and Group when their People record
// (or login) can still be found, else the copy saved when the row was added.
export function resolveEntry(entry, directory) {
  const person = (entry.personId && directory.personById.get(entry.personId))
    || (entry.accountUid && directory.personByUid.get(entry.accountUid))
    || null;
  if (person) {
    return { name: getDisplayName(person) || entry.displayName, group: groupOf(person) };
  }
  const member = entry.accountUid ? directory.memberByUid.get(entry.accountUid) : null;
  return {
    name:  getDisplayName(member) || entry.displayName,
    group: entry.group ?? null,
  };
}

// ── Editing a list ───────────────────────────────────────────────────────────

export function makeEntry(candidate, productionRole, addedBy, addedAt = Timestamp.now()) {
  return {
    personId:       candidate.personId ?? null,
    accountUid:     candidate.accountUid ?? null,
    displayName:    candidate.displayName || '',
    productionRole: productionRole.trim(),
    group:          candidate.group ?? null,
    addedBy,
    addedAt,
  };
}

// One row per person per list. The other list isn't checked: being on both
// is allowed.
export function addEntry(list, entry) {
  if (list.some(e => isSamePerson(e, entry))) throw listError(LIST_ERROR.ALREADY_ON_LIST);
  return [...list, entry];
}

export function setEntryRole(list, target, productionRole) {
  let found = false;
  const next = list.map(e => {
    if (!isSameEntry(e, target)) return e;
    found = true;
    return { ...e, productionRole };
  });
  if (!found) throw listError(LIST_ERROR.ROW_MISSING);
  return next;
}

export function removeEntry(list, target) {
  return list.filter(e => !isSameEntry(e, target));
}

// ── Saving ───────────────────────────────────────────────────────────────────

async function changeList(orgId, productionId, field, change) {
  const ref = doc(db, 'organizations', orgId, 'productions', productionId);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw listError(LIST_ERROR.PRODUCTION_MISSING);
    tx.update(ref, { [field]: change(snap.data()[field] ?? []) });
  });
}

export function addToList(orgId, productionId, field, entry) {
  return changeList(orgId, productionId, field, list => addEntry(list, entry));
}

export function updateRoleOnList(orgId, productionId, field, target, productionRole) {
  return changeList(orgId, productionId, field, list => setEntryRole(list, target, productionRole.trim()));
}

export function removeFromList(orgId, productionId, field, target) {
  return changeList(orgId, productionId, field, list => removeEntry(list, target));
}
