// Shared field-rendering, validation, and cleanup logic for a person's
// fieldValues, used by both CreatePersonForm.jsx (create) and
// PersonProfileView.jsx (edit) so the two write paths can never drift
// apart on what fields exist or how they're shaped on save.

import { withFieldError, FieldError } from '../shared/FormField';

export const TOGGLEABLE_LABELS = {
  address:             'Address',
  dateOfBirth:         'Date of Birth',
  tShirtSize:          'T-Shirt Size',
  dietaryRestrictions: 'Dietary Restrictions',
  accessibilityNeeds:  'Accessibility Needs',
};

export function validatePersonFields(fieldValues) {
  if (!fieldValues.name?.trim()) return 'Name is required.';
  return null;
}

export function cleanFieldValues(fieldValues) {
  return {
    name:             fieldValues.name?.trim() || '',
    email:            fieldValues.email?.trim() || '',
    phone:            fieldValues.phone?.trim() || '',
    emergencyContact: fieldValues.emergencyContact?.trim() || '',
    ...Object.fromEntries(
      Object.entries(fieldValues).filter(
        ([k]) => !['name', 'email', 'phone', 'emergencyContact'].includes(k)
      ).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])
    ),
  };
}

export default function PersonFieldsEditor({ personType, fieldValues, setField, nameError }) {
  const activeToggleableFields = personType
    ? Object.entries(personType.toggleableFields || {}).filter(([, v]) => v)
    : [];

  const customFields = personType?.customFields || [];

  return (
    <>
      {/* Universal fields */}
      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Required Fields</p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
            <input type="text" value={fieldValues.name || ''} onChange={e => setField('name', e.target.value)}
              placeholder="Full name"
              className={withFieldError('w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-places-blue', !!nameError)} />
            <FieldError message={nameError} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={fieldValues.email || ''} onChange={e => setField('email', e.target.value)}
              placeholder="email@example.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-places-blue" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input type="tel" value={fieldValues.phone || ''} onChange={e => setField('phone', e.target.value)}
              placeholder="Phone number"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-places-blue" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact</label>
            <input type="text" value={fieldValues.emergencyContact || ''} onChange={e => setField('emergencyContact', e.target.value)}
              placeholder="Name and phone number"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-places-blue" />
          </div>
        </div>
      </div>

      {/* Toggleable fields */}
      {activeToggleableFields.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Additional Fields</p>
          <div className="space-y-3">
            {activeToggleableFields.map(([key]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{TOGGLEABLE_LABELS[key] || key}</label>
                <input type={key === 'dateOfBirth' ? 'date' : 'text'}
                  value={fieldValues[key] || ''}
                  onChange={e => setField(key, e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-places-blue" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom fields */}
      {customFields.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Custom Fields</p>
          <div className="space-y-3">
            {customFields
              .slice()
              .sort((a, b) => a.order - b.order)
              .map(field => (
                <div key={field.fieldId}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  {field.type === 'text' && (
                    <input type="text" value={fieldValues[field.fieldId] || ''}
                      onChange={e => setField(field.fieldId, e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-places-blue" />
                  )}
                  {field.type === 'date' && (
                    <input type="date" value={fieldValues[field.fieldId] || ''}
                      onChange={e => setField(field.fieldId, e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-places-blue" />
                  )}
                  {field.type === 'select' && (
                    <select value={fieldValues[field.fieldId] || ''}
                      onChange={e => setField(field.fieldId, e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-places-blue">
                      <option value="">Select...</option>
                      {(field.options || []).map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}
                  {field.type === 'multiselect' && (
                    <div className="space-y-1">
                      {(field.options || []).map(opt => (
                        <label key={opt} className="flex items-center gap-2 text-sm text-gray-700">
                          <input type="checkbox"
                            checked={(fieldValues[field.fieldId] || []).includes(opt)}
                            onChange={e => {
                              const current = fieldValues[field.fieldId] || [];
                              setField(field.fieldId, e.target.checked
                                ? [...current, opt]
                                : current.filter(v => v !== opt));
                            }}
                            className="rounded border-gray-300" />
                          {opt}
                        </label>
                      ))}
                    </div>
                  )}
                  {field.type === 'checkboxGroup' && (
                    <div className="space-y-1">
                      {(field.options || []).map(opt => (
                        <label key={opt} className="flex items-center gap-2 text-sm text-gray-700">
                          <input type="checkbox"
                            checked={(fieldValues[field.fieldId] || []).includes(opt)}
                            onChange={e => {
                              const current = fieldValues[field.fieldId] || [];
                              setField(field.fieldId, e.target.checked
                                ? [...current, opt]
                                : current.filter(v => v !== opt));
                            }}
                            className="rounded border-gray-300" />
                          {opt}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </>
  );
}
