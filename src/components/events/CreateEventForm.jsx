import { useState, useEffect } from 'react';
import { collection, doc, getDocs, query, where, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { EVENT_SCOPE, RECURRENCE_FREQUENCY, MAX_RECURRENCE_OCCURRENCES } from '../../models/events';

function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Adds calendar months while clamping the day-of-month to the target month's
// last day (e.g. Jan 31 + 1 month -> Feb 28/29, not the native JS overflow
// into March). Keeps monthly recurrence on end-of-month dates predictable.
function addMonths(date, months) {
  const day = date.getDate();
  const firstOfTargetMonth = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDayOfTargetMonth = new Date(firstOfTargetMonth.getFullYear(), firstOfTargetMonth.getMonth() + 1, 0).getDate();
  firstOfTargetMonth.setDate(Math.min(day, lastDayOfTargetMonth));
  return firstOfTargetMonth;
}

// Generates one { start, end } Date pair per occurrence, preserving the
// original event's day span (end - start) on every repeat. Stops once an
// occurrence's start date passes recurrenceEndDate, or once maxCount+1
// occurrences have been generated (the caller treats hitting that ceiling
// as "exceeds the cap" and does not write anything).
function generateOccurrences(startDate, endDate, frequency, recurrenceEndDate, maxCount) {
  const spanDays = Math.round((endDate - startDate) / (24 * 60 * 60 * 1000));
  const occurrences = [];
  let i = 0;
  while (occurrences.length <= maxCount) {
    const occStart = frequency === RECURRENCE_FREQUENCY.WEEKLY ? addDays(startDate, i * 7) : addMonths(startDate, i);
    if (occStart > recurrenceEndDate) break;
    occurrences.push({ start: occStart, end: addDays(occStart, spanDays) });
    i++;
  }
  return occurrences;
}

export default function CreateEventForm({ onSuccess, onCancel }) {
  const { userProfile } = useAuth();
  const { orgId, uid } = userProfile;

  const isDepartmentHead = userProfile.role === 'departmentHead';

  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate]     = useState('');
  const [endDate, setEndDate]         = useState('');
  const [endDateTouched, setEndDateTouched] = useState(false);
  const [startTime, setStartTime]     = useState('');
  const [endTime, setEndTime]         = useState('');
  const [location, setLocation]       = useState('');
  const [scope, setScope]             = useState(isDepartmentHead ? EVENT_SCOPE.DEPARTMENT : EVENT_SCOPE.ORG);
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState([]);
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
  const [frequency, setFrequency]     = useState(RECURRENCE_FREQUENCY.WEEKLY);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  useEffect(() => {
    if (!orgId) return;
    getDocs(query(collection(db, 'departments'), where('orgId', '==', orgId)))
      .then(snap => setDepartments(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [orgId]);

  function handleStartDateChange(value) {
    setStartDate(value);
    if (!endDateTouched || !endDate || endDate < value) {
      setEndDate(value);
    }
  }

  const startDateObj = parseLocalDate(startDate);
  const endDateObj = parseLocalDate(endDate);
  const recurrenceEndDateObj = parseLocalDate(recurrenceEndDate);

  const previewOccurrences = recurrenceEnabled && startDateObj && recurrenceEndDateObj
    ? generateOccurrences(startDateObj, endDateObj || startDateObj, frequency, recurrenceEndDateObj, MAX_RECURRENCE_OCCURRENCES)
    : [];
  const exceedsCap = recurrenceEnabled && previewOccurrences.length > MAX_RECURRENCE_OCCURRENCES;

  function validate() {
    if (!title.trim()) return 'Title is required.';
    if (!startDate) return 'Start date is required.';
    if (!endDate) return 'End date is required.';
    if (endDate < startDate) return 'End date cannot be before the start date.';
    if (scope === EVENT_SCOPE.DEPARTMENT && !departmentId) return 'Select a department for department-scoped events.';
    if (recurrenceEnabled) {
      if (!recurrenceEndDate) return 'Recurrence end date is required when repeat is on.';
      if (recurrenceEndDate < startDate) return 'Recurrence end date cannot be before the start date.';
      if (exceedsCap) return `This repeat rule would create more than ${MAX_RECURRENCE_OCCURRENCES} events. Choose a shorter recurrence end date.`;
    }
    return '';
  }

  async function handleSubmit() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError('');

    const base = {
      orgId,
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      startTime: startTime || null,
      endTime: endTime || null,
      scope,
      departmentId: scope === EVENT_SCOPE.DEPARTMENT ? departmentId : null,
      createdBy: uid,
      createdAt: serverTimestamp(),
    };

    try {
      if (!recurrenceEnabled) {
        const batch = writeBatch(db);
        const ref = doc(collection(db, 'events'));
        batch.set(ref, {
          ...base,
          startDate: Timestamp.fromDate(startDateObj),
          endDate: Timestamp.fromDate(endDateObj),
          recurrence: { enabled: false, frequency: null, endDate: null },
          recurrenceGroupId: null,
        });
        await batch.commit();
      } else {
        const occurrences = generateOccurrences(startDateObj, endDateObj, frequency, recurrenceEndDateObj, MAX_RECURRENCE_OCCURRENCES);
        if (occurrences.length > MAX_RECURRENCE_OCCURRENCES) {
          setError(`This repeat rule would create more than ${MAX_RECURRENCE_OCCURRENCES} events. Choose a shorter recurrence end date.`);
          setSaving(false);
          return;
        }
        const groupRef = doc(collection(db, 'events'));
        const recurrenceGroupId = groupRef.id;
        const recurrenceInfo = {
          enabled: true,
          frequency,
          endDate: Timestamp.fromDate(recurrenceEndDateObj),
        };
        const batch = writeBatch(db);
        occurrences.forEach(occ => {
          const ref = doc(collection(db, 'events'));
          batch.set(ref, {
            ...base,
            startDate: Timestamp.fromDate(occ.start),
            endDate: Timestamp.fromDate(occ.end),
            recurrence: recurrenceInfo,
            recurrenceGroupId,
          });
        });
        await batch.commit();
      }
      onSuccess();
    } catch (err) {
      console.error('CreateEventForm error:', err);
      setError('Failed to create event. Please try again.');
      setSaving(false);
    }
  }

  const submitDisabled = saving || !title.trim() || !startDate || !endDate || endDate < startDate
    || (scope === EVENT_SCOPE.DEPARTMENT && !departmentId)
    || (recurrenceEnabled && (!recurrenceEndDate || recurrenceEndDate < startDate || exceedsCap));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-lg">
      <h2 className="text-base font-semibold text-gray-900 mb-5">New Event</h2>
      <div className="space-y-4">

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Opening Night"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Optional details" rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date <span className="text-red-500">*</span></label>
            <input type="date" value={startDate} onChange={e => handleStartDateChange(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date <span className="text-red-500">*</span></label>
            <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setEndDateTouched(true); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>
        {endDate && startDate && endDate < startDate && (
          <p className="text-sm text-red-600">End date cannot be before the start date.</p>
        )}

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Time (optional)</label>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">End Time (optional)</label>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location (optional)</label>
          <input type="text" value={location} onChange={e => setLocation(e.target.value)}
            placeholder="e.g. Main Stage"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        {/* Scope */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-gray-700">Scope</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {isDepartmentHead
                ? 'Department events are owned by your department.'
                : 'Org events appear on the org-wide calendar. Department events are owned by a department.'}
            </p>
          </div>
          {!isDepartmentHead && (
            <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1 flex-shrink-0">
              <button type="button" onClick={() => setScope(EVENT_SCOPE.ORG)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${scope === EVENT_SCOPE.ORG ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                Org
              </button>
              <button type="button" onClick={() => setScope(EVENT_SCOPE.DEPARTMENT)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${scope === EVENT_SCOPE.DEPARTMENT ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                Department
              </button>
            </div>
          )}
        </div>

        {scope === EVENT_SCOPE.DEPARTMENT && departments.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department <span className="text-red-500">*</span></label>
            <select value={departmentId} onChange={e => setDepartmentId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Select a department...</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Recurrence */}
        <div className="flex items-start justify-between gap-6 pt-1">
          <div>
            <p className="text-sm font-medium text-gray-700">Repeats</p>
            <p className="text-xs text-gray-400 mt-0.5">Weekly or monthly, until an end date. Each occurrence is created as its own event.</p>
          </div>
          <button type="button" onClick={() => setRecurrenceEnabled(v => !v)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${recurrenceEnabled ? 'bg-indigo-600' : 'bg-gray-200'}`}
            role="switch" aria-checked={recurrenceEnabled}>
            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${recurrenceEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {recurrenceEnabled && (
          <div className="space-y-3 bg-gray-50 rounded-lg p-3">
            <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1 w-fit">
              <button type="button" onClick={() => setFrequency(RECURRENCE_FREQUENCY.WEEKLY)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${frequency === RECURRENCE_FREQUENCY.WEEKLY ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                Weekly
              </button>
              <button type="button" onClick={() => setFrequency(RECURRENCE_FREQUENCY.MONTHLY)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${frequency === RECURRENCE_FREQUENCY.MONTHLY ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                Monthly
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Repeat Until <span className="text-red-500">*</span></label>
              <input type="date" value={recurrenceEndDate} onChange={e => setRecurrenceEndDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            {recurrenceEndDate && recurrenceEndDate < startDate && (
              <p className="text-sm text-red-600">Recurrence end date cannot be before the start date.</p>
            )}
            {exceedsCap && (
              <p className="text-sm text-red-600">
                This repeat rule would create more than {MAX_RECURRENCE_OCCURRENCES} events. Choose a shorter recurrence end date.
              </p>
            )}
            {!exceedsCap && previewOccurrences.length > 0 && (
              <p className="text-xs text-gray-500">Will create {previewOccurrences.length} events, including the first occurrence.</p>
            )}
          </div>
        )}

      </div>

      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

      <div className="flex items-center gap-3 mt-6">
        <button onClick={handleSubmit}
          disabled={submitDisabled}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
          {saving ? 'Creating...' : 'Create Event'}
        </button>
        <button onClick={onCancel}
          className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}
