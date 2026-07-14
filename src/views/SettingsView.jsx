import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import CreatePersonTypeForm from '../components/people/CreatePersonTypeForm';

export default function SettingsView() {
  const { userProfile } = useAuth();
  const [departmentsEnabled, setDepartmentsEnabled] = useState(false);
  const [personTypes, setPersonTypes]               = useState([]);
  const [loading, setLoading]                       = useState(true);
  const [saving, setSaving]                         = useState(false);
  const [showForm, setShowForm]                     = useState(false);

  const orgId = userProfile?.orgId;

  useEffect(() => {
    if (!orgId) return;

    const fetchSettings = async () => {
      try {
        const orgRef  = doc(db, 'organizations', orgId);
        const orgSnap = await getDoc(orgRef);
        if (orgSnap.exists()) {
          setDepartmentsEnabled(orgSnap.data().departmentsEnabled ?? false);
        }
      } catch (err) {
        console.error('Error fetching org settings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();

    const q = query(
      collection(db, 'organizations', orgId, 'personTypes'),
      where('active', '==', true)
    );
    const unsub = onSnapshot(q, snap => {
      setPersonTypes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [orgId]);

  const handleToggle = async () => {
    if (!orgId) return;
    const newValue = !departmentsEnabled;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'organizations', orgId), { departmentsEnabled: newValue });
      setDepartmentsEnabled(newValue);
    } catch (err) {
      console.error('Error updating settings:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-500 text-sm">Loading settings...</div>;
  }

  if (showForm) {
    return (
      <div className="p-6 max-w-2xl">
        <button
          onClick={() => setShowForm(false)}
          className="text-sm text-gray-500 hover:text-gray-700 mb-6 flex items-center gap-1"
        >
          ← Back to Settings
        </button>
        <CreatePersonTypeForm
          onSuccess={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Settings</h1>
      <p className="text-sm text-gray-500 mb-8">Manage your organization configuration.</p>

      <div className="space-y-6">

        {/* Organization Structure */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Organization Structure</h2>
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-sm font-medium text-gray-700">Departments</p>
              <p className="text-sm text-gray-500 mt-1">
                Organize your venues and productions under departments. Turning this on adds a Departments section to your navigation.
              </p>
            </div>
            <button
              onClick={handleToggle}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                departmentsEnabled ? 'bg-indigo-600' : 'bg-gray-200'
              } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
              role="switch"
              aria-checked={departmentsEnabled}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                departmentsEnabled ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>

        {/* Person Types */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-800">Person Types</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Define the kinds of people your organization coordinates.
              </p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Add Type
            </button>
          </div>

          {personTypes.length === 0 ? (
            <div className="border border-dashed border-gray-200 rounded-lg p-6 text-center">
              <p className="text-sm text-gray-500 mb-0.5">No person types yet.</p>
              <p className="text-xs text-gray-400">Add your first type to start coordinating people.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {personTypes.map(type => (
                <div key={type.id} className="flex items-start justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{type.label}</p>
                    {type.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{type.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {['Name', 'Email', 'Phone', 'Emergency Contact'].map(f => (
                        <span key={f} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">{f}</span>
                      ))}
                      {Object.entries(type.toggleableFields || {})
                        .filter(([, v]) => v)
                        .map(([k]) => (
                          <span key={k} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-600 capitalize">
                            {k.replace(/([A-Z])/g, ' $1')}
                          </span>
                        ))
                      }
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
