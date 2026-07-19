import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { PERSON_STATUS } from '../models/people';
import CreatePersonForm from '../components/people/CreatePersonForm';
import CsvImportForm from '../components/people/CsvImportForm';
import PersonProfileView from './PersonProfileView';

const STATUS_STYLES = {
  [PERSON_STATUS.APPLIED]:    'bg-amber-100 text-amber-700',
  [PERSON_STATUS.WAITLISTED]: 'bg-purple-100 text-purple-700',
  [PERSON_STATUS.ACTIVE]:     'bg-green-100 text-green-700',
  [PERSON_STATUS.INACTIVE]:   'bg-gray-100 text-gray-500',
};

const STATUS_LABELS = {
  [PERSON_STATUS.APPLIED]:    'Applied',
  [PERSON_STATUS.WAITLISTED]: 'Waitlisted',
  [PERSON_STATUS.ACTIVE]:     'Active',
  [PERSON_STATUS.INACTIVE]:   'Inactive',
};

export default function PeopleView({ onNavigate }) {
  const { userProfile } = useAuth();
  const [people, setPeople]           = useState([]);
  const [personTypes, setPersonTypes] = useState([]);
  const [typeFilter, setTypeFilter]   = useState('all');
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [showCsvImport, setShowCsvImport]       = useState(false);
  const [csvImportTypeId, setCsvImportTypeId]   = useState(null);
  const [selectedPersonId, setSelectedPersonId] = useState(null);

  const orgId = userProfile?.orgId;

  useEffect(() => {
    if (!orgId) return;

    // Load person types for filter dropdown
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

    // Live people subscription
    const q = query(
      collection(db, 'organizations', orgId, 'people')
    );
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPeople(data);
      setLoading(false);
    });
    return () => unsub();
  }, [orgId]);

  const filtered = typeFilter === 'all'
    ? people
    : people.filter(p => p.typeId === typeFilter);

  const csvImportType = personTypes.find(t => t.id === csvImportTypeId) || null;

  if (loading) {
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

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">People</h1>
          <p className="text-sm text-gray-500">Everyone your organization coordinates, in one place.</p>
        </div>
        <div className="flex items-center gap-2">
          {personTypes.length > 0 && !showForm && !showCsvImport && (
            <div className="relative group">
              <button className="border border-gray-200 text-gray-600 hover:border-gray-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors bg-white">
                Import CSV
              </button>
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-10 hidden group-hover:block">
                {personTypes.map(type => (
                  <button
                    key={type.id}
                    onClick={() => { setCsvImportTypeId(type.id); setShowCsvImport(true); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl transition-colors"
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!showForm && !showCsvImport && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
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
        <>
          {personTypes.length > 0 && (
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  typeFilter === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                All
              </button>
              {personTypes.map(type => (
                <button
                  key={type.id}
                  onClick={() => setTypeFilter(type.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    typeFilter === type.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
              <p className="text-gray-500 text-sm mb-1">
                {typeFilter === 'all' ? 'No people yet.' : `No ${personTypes.find(t => t.id === typeFilter)?.label ?? 'people'} yet.`}
              </p>
              <p className="text-gray-400 text-sm">Add your first person to get started.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Account</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(person => (
                    <tr
                      key={person.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedPersonId(person.id)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {person.fieldValues?.name || <span className="text-gray-400">No name</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{person.typeLabel}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {person.fieldValues?.email || <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[person.status] || STATUS_STYLES[PERSON_STATUS.APPLIED]}`}>
                          {STATUS_LABELS[person.status] || 'Applied'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {person.accountStatus === 'active' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Account active</span>
                        ) : person.accountStatus === 'invited' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Invited</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">No account</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
