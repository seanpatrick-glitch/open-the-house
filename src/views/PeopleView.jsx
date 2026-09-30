import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { PERSON_GROUP_LABELS, PERSON_GROUP_ORDER } from '../models/people';
import { getDisplayName } from '../utils/displayName';
import CreatePersonForm from '../components/people/CreatePersonForm';
import CsvImportForm from '../components/people/CsvImportForm';
import GroupBadge from '../components/people/GroupBadge';
import RoleBadge from '../components/people/RoleBadge';
import PersonProfileView from './PersonProfileView';
import PageHeader from '../components/shared/PageHeader';

const ALL = 'all';

// The People page is a contact and taxonomy roster: everyone in the org,
// filterable by Group. Managing logins and invites lives in Settings.
export default function PeopleView({ onNavigate, navState }) {
  const { userProfile } = useAuth();
  const [people, setPeople]           = useState([]);
  const [members, setMembers]         = useState([]);
  const [personTypes, setPersonTypes] = useState([]);
  const [groupFilter, setGroupFilter] = useState(ALL);
  const [peopleLoading, setPeopleLoading]   = useState(true);
  const [membersLoading, setMembersLoading] = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [showCsvImport, setShowCsvImport]       = useState(false);
  const [csvImportTypeId, setCsvImportTypeId]   = useState(null);
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [showCsvDropdown, setShowCsvDropdown]   = useState(false);

  const orgId = userProfile?.orgId;

  useEffect(() => {
    if (navState?.action === 'addPerson') {
      setShowForm(true);
    }
  }, [navState]);

  useEffect(() => {
    if (!orgId) return;

    // Load person types for the CSV import picker
    const loadTypes = async () => {
      const snap = await getDocs(
        query(
          collection(db, 'organizations', orgId, 'personTypes'),
          where('active', '==', true)
        )
      );
      setPersonTypes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    loadTypes();

    const unsubPeople = onSnapshot(
      collection(db, 'organizations', orgId, 'people'),
      snap => {
        setPeople(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setPeopleLoading(false);
      },
      err => {
        console.error('PeopleView people listener error:', err);
        setPeopleLoading(false);
      }
    );

    // Members docs carry a display copy of each login's role, used only for
    // the role badge. Never read for routing or permissions.
    const unsubMembers = onSnapshot(
      collection(db, 'organizations', orgId, 'members'),
      snap => {
        setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setMembersLoading(false);
      },
      err => {
        console.error('PeopleView members listener error:', err);
        setMembersLoading(false);
      }
    );

    return () => { unsubPeople(); unsubMembers(); };
  }, [orgId]);

  const memberByUid = new Map(members.map(m => [m.id, m]));
  const linkedUids  = new Set(people.map(p => p.accountUid).filter(Boolean));

  const rows = [
    ...people.map(p => ({
      key:      `person-${p.id}`,
      personId: p.id,
      name:     getDisplayName(p),
      group:    p.group ?? null,
      role:     p.accountUid ? memberByUid.get(p.accountUid)?.role ?? null : null,
      email:    p.fieldValues?.email || '',
      phone:    p.fieldValues?.phone || '',
    })),
    // Logins with no People record yet. They have no Group until one exists,
    // so they show under Everyone only.
    ...members
      .filter(m => !linkedUids.has(m.id))
      .map(m => ({
        key:      `member-${m.id}`,
        personId: null,
        name:     getDisplayName(m) || m.email,
        group:    null,
        role:     m.role ?? null,
        email:    m.email || '',
        phone:    '',
      })),
  ].sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));

  const filtered = groupFilter === ALL ? rows : rows.filter(r => r.group === groupFilter);
  const countFor = group => rows.filter(r => r.group === group).length;

  const csvImportType = personTypes.find(t => t.id === csvImportTypeId) || null;

  if (peopleLoading || membersLoading) {
    return <div className="p-6 text-gray-500 text-sm">Loading...</div>;
  }

  if (selectedPersonId) {
    return (
      <PersonProfileView
        personId={selectedPersonId}
        onBack={() => setSelectedPersonId(null)}
      />
    );
  }

  const tabs = [
    { key: ALL, label: 'Everyone', count: rows.length },
    ...PERSON_GROUP_ORDER.map(g => ({ key: g, label: PERSON_GROUP_LABELS[g], count: countFor(g) })),
  ];

  return (
    <div className="p-6 max-w-5xl">
      <PageHeader title="People" />
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <p className="text-sm text-gray-500">Everyone in your org.</p>
        <div className="flex items-center gap-2">
          {personTypes.length > 0 && !showForm && !showCsvImport && (
            <div className="relative">
              <button
                onClick={() => setShowCsvDropdown(v => !v)}
                className="border border-gray-200 text-gray-600 hover:border-gray-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors bg-white"
              >
                Import CSV
              </button>
              {showCsvDropdown && (
                <>
                  {/* Tap-outside-to-close backdrop */}
                  <div className="fixed inset-0 z-0" onClick={() => setShowCsvDropdown(false)} />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-10">
                    {personTypes.map(type => (
                      <button
                        key={type.id}
                        onClick={() => { setCsvImportTypeId(type.id); setShowCsvImport(true); setShowCsvDropdown(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl transition-colors"
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {!showForm && !showCsvImport && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-places-blue hover:bg-places-blue/90 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Add Person
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="mb-6">
          <button onClick={() => setShowForm(false)}
            className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">
            ← Back to People
          </button>
          <CreatePersonForm
            onSuccess={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {showCsvImport && csvImportType && (
        <div className="mb-6">
          <button onClick={() => { setShowCsvImport(false); setCsvImportTypeId(null); }}
            className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">
            ← Back to People
          </button>
          <CsvImportForm
            personType={csvImportType}
            onSuccess={() => { setShowCsvImport(false); setCsvImportTypeId(null); }}
            onCancel={() => { setShowCsvImport(false); setCsvImportTypeId(null); }}
          />
        </div>
      )}

      {!showForm && !showCsvImport && (
        rows.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
            <p className="text-gray-500 text-sm mb-4">No one added yet. Invite someone or add them manually.</p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                onClick={() => onNavigate?.('invite-collaborator')}
                className="border border-gray-200 text-gray-700 hover:border-gray-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors bg-white"
              >
                Invite someone
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="bg-places-blue hover:bg-places-blue/90 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Add Person
              </button>
            </div>
          </div>
        ) : (
          <>
            <div role="tablist" aria-label="Filter by group" className="flex items-center gap-2 mb-5 flex-wrap">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={groupFilter === tab.key}
                  onClick={() => setGroupFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    groupFilter === tab.key
                      ? 'bg-places-blue text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                  <span className={`ml-1.5 text-xs ${groupFilter === tab.key ? 'text-white/70' : 'text-gray-400'}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
                <p className="text-gray-500 text-sm">No one in {PERSON_GROUP_LABELS[groupFilter]} yet.</p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Table — sm and up */}
                <table className="w-full text-sm hidden sm:table">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Group</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Contact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map(row => (
                      <tr
                        key={row.key}
                        className={row.personId ? 'hover:bg-gray-50 transition-colors cursor-pointer' : ''}
                        onClick={row.personId ? () => setSelectedPersonId(row.personId) : undefined}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {row.name || <span className="text-gray-400">No name</span>}
                        </td>
                        <td className="px-4 py-3">
                          {row.group ? <GroupBadge group={row.group} /> : <span className="text-gray-400">No group</span>}
                        </td>
                        <td className="px-4 py-3">
                          {row.role ? <RoleBadge role={row.role} /> : <span className="text-gray-400">No sign-in yet</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          <ContactLines email={row.email} phone={row.phone} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Card list — below sm */}
                <div className="sm:hidden divide-y divide-gray-100">
                  {filtered.map(row => {
                    const body = (
                      <>
                        <p className="font-medium text-gray-900 truncate">
                          {row.name || <span className="text-gray-400">No name</span>}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {row.group ? <GroupBadge group={row.group} /> : <span className="text-xs text-gray-400">No group</span>}
                          {row.role ? <RoleBadge role={row.role} /> : <span className="text-xs text-gray-400">No sign-in yet</span>}
                        </div>
                        <div className="text-xs text-gray-500 mt-1.5">
                          <ContactLines email={row.email} phone={row.phone} />
                        </div>
                      </>
                    );
                    return row.personId ? (
                      <button
                        key={row.key}
                        onClick={() => setSelectedPersonId(row.personId)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        {body}
                      </button>
                    ) : (
                      <div key={row.key} className="px-4 py-3">{body}</div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}

function ContactLines({ email, phone }) {
  if (!email && !phone) return <span className="text-gray-400">No contact info</span>;
  return (
    <>
      {email && <span className="block truncate">{email}</span>}
      {phone && <span className="block">{phone}</span>}
    </>
  );
}
