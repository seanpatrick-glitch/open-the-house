import { useState, useEffect } from 'react';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useParams } from 'react-router-dom';

const TOGGLEABLE_LABELS = {
  address:             'Address',
  dateOfBirth:         'Date of Birth',
  tShirtSize:          'T-Shirt Size',
  dietaryRestrictions: 'Dietary Restrictions',
  accessibilityNeeds:  'Accessibility Needs',
};

export default function SelfSignupPage() {
  const { orgId, tokenId } = useParams();

  const [token, setToken]       = useState(null);
  const [personType, setPersonType] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [invalid, setInvalid]   = useState(false);
  const [fieldValues, setFieldValues] = useState({});
  const [saving, setSaving]     = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (!orgId || !tokenId) return;
    const loadToken = async () => {
      try {
        const tokenSnap = await getDoc(
          doc(db, 'organizations', orgId, 'signupTokens', tokenId)
        );
        if (!tokenSnap.exists() || !tokenSnap.data().active) {
          setInvalid(true);
          setLoading(false);
          return;
        }
        const tokenData = { id: tokenSnap.id, ...tokenSnap.data() };
        setToken(tokenData);

        const typeSnap = await getDoc(
          doc(db, 'organizations', orgId, 'personTypes', tokenData.typeId)
        );
        if (!typeSnap.exists()) {
          setInvalid(true);
          setLoading(false);
          return;
        }
        setPersonType({ id: typeSnap.id, ...typeSnap.data() });
      } catch (err) {
        console.error('SelfSignupPage load error:', err);
        setInvalid(true);
      } finally {
        setLoading(false);
      }
    };
    loadToken();
  }, [orgId, tokenId]);

  function setField(key, value) {
    setFieldValues(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    if (!fieldValues.name?.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await addDoc(
        collection(db, 'organizations', orgId, 'people'),
        {
          orgId,
          typeId:      token.typeId,
          typeLabel:   token.typeLabel,
          uid:         null,
          status:      'applied',
          createdBy:   'self-signup',
          createdAt:   serverTimestamp(),
          approvedBy:  null,
          approvedAt:  null,
          assignments: [],
          totalHours:  0,
          accountUid:    null,
          accountStatus: 'no_account',
          staff:         false,
          fieldValues: {
            name:             fieldValues.name?.trim() || '',
            email:            fieldValues.email?.trim() || '',
            phone:            fieldValues.phone?.trim() || '',
            emergencyContact: fieldValues.emergencyContact?.trim() || '',
            ...Object.fromEntries(
              Object.entries(fieldValues).filter(
                ([k]) => !['name','email','phone','emergencyContact'].includes(k)
              )
            ),
          },
        }
      );
      setSubmitted(true);
    } catch (err) {
      console.error('SelfSignupPage submit error:', err);
      setError('Something went wrong. Please try again.');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-gray-900 font-semibold mb-2">This link is no longer active.</p>
          <p className="text-gray-500 text-sm">Contact the organization for a new signup link.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-gray-900 font-semibold mb-2">You are all set.</p>
          <p className="text-gray-500 text-sm">Your information has been submitted. The team will be in touch.</p>
        </div>
      </div>
    );
  }

  const activeToggleable = personType
    ? Object.entries(personType.toggleableFields || {}).filter(([, v]) => v)
    : [];
  const customFields = personType?.customFields || [];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Places People!</h1>
          <p className="text-sm text-gray-500">
            Fill out the form below to register as a {token?.typeLabel || 'member'}.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
              <input type="text" value={fieldValues.name || ''} onChange={e => setField('name', e.target.value)}
                placeholder="Full name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={fieldValues.email || ''} onChange={e => setField('email', e.target.value)}
                placeholder="email@example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input type="tel" value={fieldValues.phone || ''} onChange={e => setField('phone', e.target.value)}
                placeholder="Phone number"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact</label>
              <input type="text" value={fieldValues.emergencyContact || ''} onChange={e => setField('emergencyContact', e.target.value)}
                placeholder="Name and phone number"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            {activeToggleable.map(([key]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{TOGGLEABLE_LABELS[key] || key}</label>
                <input type={key === 'dateOfBirth' ? 'date' : 'text'}
                  value={fieldValues[key] || ''}
                  onChange={e => setField(key, e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            ))}

            {customFields.sort((a, b) => a.order - b.order).map(field => (
              <div key={field.fieldId}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                {field.type === 'text' && (
                  <input type="text" value={fieldValues[field.fieldId] || ''}
                    onChange={e => setField(field.fieldId, e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                )}
                {field.type === 'select' && (
                  <select value={fieldValues[field.fieldId] || ''}
                    onChange={e => setField(field.fieldId, e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select...</option>
                    {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                )}
              </div>
            ))}
          </div>

          {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

          <button onClick={handleSubmit} disabled={saving || !fieldValues.name?.trim()}
            className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
            {saving ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
