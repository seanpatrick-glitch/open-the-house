import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export default function SettingsView() {
  const { userProfile } = useAuth();
  const [departmentsEnabled, setDepartmentsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const orgId = userProfile?.orgId;

  useEffect(() => {
    if (!orgId) return;
    const fetchSettings = async () => {
      try {
        const orgRef = doc(db, 'organizations', orgId);
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
  }, [orgId]);

  const handleToggle = async () => {
    if (!orgId) return;
    const newValue = !departmentsEnabled;
    setSaving(true);
    try {
      const orgRef = doc(db, 'organizations', orgId);
      await updateDoc(orgRef, { departmentsEnabled: newValue });
      setDepartmentsEnabled(newValue);
    } catch (err) {
      console.error('Error updating settings:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-gray-500 text-sm">Loading settings...</div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Settings</h1>
      <p className="text-sm text-gray-500 mb-8">Manage your organization configuration.</p>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Organization Structure</h2>

        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-gray-700">Departments</p>
            <p className="text-sm text-gray-500 mt-1">
              Organize your venues and productions under departments. Off by default. Turning this on adds a Departments section to your navigation.
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
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                departmentsEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
