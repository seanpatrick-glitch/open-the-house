import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { getDisplayName } from '../utils/displayName';
import CreatePersonTypeForm from '../components/people/CreatePersonTypeForm';
import CreateSignupTokenForm from '../components/people/CreateSignupTokenForm';
import toast from 'react-hot-toast';

export default function SettingsView() {
  const { userProfile } = useAuth();
  const [departmentsEnabled, setDepartmentsEnabled] = useState(false);
  const [personTypes, setPersonTypes]               = useState([]);
  const [departmentHeads, setDepartmentHeads]        = useState([]);
  const [savingTypeHead, setSavingTypeHead]           = useState(null);
  const [loading, setLoading]                       = useState(true);
  const [saving, setSaving]                         = useState(false);
  const [showForm, setShowForm]                     = useState(false);
  const [signupTokens, setSignupTokens]   = useState([]);
  const [showTokenForm, setShowTokenForm] = useState(false);
  const [newToken, setNewToken]           = useState(null);
  const [productions, setProductions]         = useState([]);
  const [activeProdId, setActiveProdId]       = useState('');
  const [dashboardOverride, setDashboardOverride] = useState('');
  const [savingProd, setSavingProd]           = useState(false);
  const [savingOverride, setSavingOverride]   = useState(false);

  const orgId = userProfile?.orgId;

  useEffect(() => {
    if (!orgId) return;

    const fetchSettings = async () => {
      try {
        const orgRef  = doc(db, 'organizations', orgId);
        const orgSnap = await getDoc(orgRef);
        if (orgSnap.exists()) {
          const data = orgSnap.data();
          setDepartmentsEnabled(data.departmentsEnabled ?? false);
          setActiveProdId(data.activeProdId ?? '');
          setDashboardOverride(data.dashboardStateOverride ?? '');
        }
      } catch (err) {
        console.error('Error fetching org settings:', err);
        toast.error('Could not load settings. Please refresh and try again.');
      } finally {
        setLoading(false);
      }
    };

    // Load org members with the Department Head role, for the Person Types assignment control
    const loadDepartmentHeads = async () => {
      try {
        const snap = await getDocs(collection(db, 'organizations', orgId, 'members'));
        setDepartmentHeads(
          snap.docs
            .map(d => ({ uid: d.id, ...d.data() }))
            .filter(m => m.role === 'departmentHead')
        );
      } catch (err) {
        console.error('Error loading department heads:', err);
        toast.error('Could not load department heads.');
      }
    };

    // Load all productions for active production selector
    const loadProductions = async () => {
      try {
        const placesSnap = await getDocs(collection(db, 'organizations', orgId, 'places'));
        const allProds = [];
        for (const place of placesSnap.docs) {
          const prodsSnap = await getDocs(
            collection(db, 'organizations', orgId, 'places', place.id, 'productions')
          );
          prodsSnap.docs.forEach(d => {
            allProds.push({
              id:        d.id,
              placeId:   place.id,
              placeName: place.data().name,
              ...d.data(),
            });
          });
        }
        setProductions(allProds);
      } catch (err) {
        console.error('Error loading productions:', err);
        toast.error('Could not load productions.');
      }
    };

    fetchSettings();
    loadProductions();
    loadDepartmentHeads();

    const q = query(
      collection(db, 'organizations', orgId, 'personTypes'),
      where('active', '==', true)
    );
    const unsub = onSnapshot(q, snap => {
      setPersonTypes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const tokenQuery = query(
      collection(db, 'organizations', orgId, 'signupTokens'),
      where('active', '==', true)
    );
    const tokenUnsub = onSnapshot(tokenQuery, snap => {
      setSignupTokens(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsub(); tokenUnsub(); };
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
      toast.error('Could not update settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  async function handleSetActiveProd(compositeId) {
    setSavingProd(true);
    try {
      await updateDoc(doc(db, 'organizations', orgId), {
        activeProdId: compositeId || null,
      });
      setActiveProdId(compositeId);
    } catch (err) {
      console.error('Error setting active production:', err);
      toast.error('Could not set active production. Please try again.');
    } finally {
      setSavingProd(false);
    }
  }

  async function handleAssignTypeHead(typeId, headUid) {
    setSavingTypeHead(typeId);
    try {
      await updateDoc(doc(db, 'organizations', orgId, 'personTypes', typeId), {
        departmentHeadId: headUid || null,
      });
    } catch (err) {
      console.error('Error assigning person type department head:', err);
      toast.error('Could not assign department head. Please try again.');
    } finally {
      setSavingTypeHead(null);
    }
  }

  async function handleSetOverride(value) {
    setSavingOverride(true);
    try {
      await updateDoc(doc(db, 'organizations', orgId), {
        dashboardStateOverride: value || null,
      });
      setDashboardOverride(value);
    } catch (err) {
      console.error('Error setting dashboard override:', err);
      toast.error('Could not set dashboard override. Please try again.');
    } finally {
      setSavingOverride(false);
    }
  }

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
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs font-medium text-gray-500 mb-1">Department Head</p>
                    {departmentHeads.length === 0 ? (
                      <p className="text-xs text-gray-400 max-w-[180px]">
                        Invite a Department Head first before assigning one here.
                      </p>
                    ) : (
                      <select
                        value={type.departmentHeadId || ''}
                        onChange={e => handleAssignTypeHead(type.id, e.target.value)}
                        disabled={savingTypeHead === type.id}
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                      >
                        <option value="">Unassigned</option>
                        {departmentHeads.map(dh => (
                          <option key={dh.uid} value={dh.uid}>{getDisplayName(dh)}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Production */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-1">Active Production</h2>
          <p className="text-sm text-gray-500 mb-4">
            The active production drives the dashboard state for all staff. Set it when a production enters its final countdown.
          </p>
          <select
            value={activeProdId}
            onChange={e => handleSetActiveProd(e.target.value)}
            disabled={savingProd}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <option value="">No active production</option>
            {productions.map(p => (
              <option key={`${p.placeId}/${p.id}`} value={`${p.placeId}/${p.id}`}>
                {p.name} — {p.placeName}
              </option>
            ))}
          </select>
        </div>

        {/* Dashboard State Override */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-1">Dashboard State Override</h2>
          <p className="text-sm text-gray-500 mb-4">
            Force the dashboard to a specific state regardless of production dates. Leave blank to auto-calculate.
          </p>
          <select
            value={dashboardOverride}
            onChange={e => handleSetOverride(e.target.value)}
            disabled={savingOverride}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <option value="">Auto (based on production dates)</option>
            <option value="planning">Planning</option>
            <option value="finalCountdown">Final Countdown</option>
            <option value="live">Live</option>
            <option value="postmortem">Postmortem</option>
          </select>
        </div>

        {/* Signup Links */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-800">Signup Links</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Share a link so people can submit their own information.
              </p>
            </div>
            {!showTokenForm && (
              <button onClick={() => { setShowTokenForm(true); setNewToken(null); }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                New Link
              </button>
            )}
          </div>

          {showTokenForm && (
            <div className="mb-4">
              <CreateSignupTokenForm
                personTypes={personTypes}
                onSuccess={(token) => {
                  setNewToken(token);
                  setShowTokenForm(false);
                }}
                onCancel={() => setShowTokenForm(false)}
              />
            </div>
          )}

          {newToken && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm font-medium text-green-800 mb-1">Link created for {newToken.typeLabel}</p>
              <p className="text-xs text-green-700 font-mono break-all">
                {window.location.origin}/signup/{userProfile.orgId}/{newToken.id}
              </p>
              <p className="text-xs text-green-600 mt-1">Copy this link and share it with your team.</p>
            </div>
          )}

          {signupTokens.length === 0 && !showTokenForm ? (
            <div className="border border-dashed border-gray-200 rounded-lg p-6 text-center">
              <p className="text-sm text-gray-500 mb-0.5">No active signup links.</p>
              <p className="text-xs text-gray-400">Create a link to share with your team.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {signupTokens.map(token => (
                <div key={token.id} className="flex items-center justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{token.typeLabel}</p>
                    <p className="text-xs text-gray-400 font-mono truncate">
                      {window.location.origin}/signup/{orgId}/{token.id}
                    </p>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/signup/${orgId}/${token.id}`)}
                    className="flex-shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors">
                    Copy
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
