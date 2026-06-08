import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';

function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  return Timestamp.fromDate(new Date(year, month - 1, day));
}

export default function CreateTaskForm({ onSuccess, onCancel }) {
  const { userProfile } = useAuth();
  const { orgId, uid } = userProfile;

  const [title, setTitle]           = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate]       = useState('');
  const [startDate, setStartDate]   = useState('');
  const [department, setDepartment] = useState('');
  const [visibleToAll, setVisibleToAll] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    if (!orgId) return;
    getDocs(query(collection(db, 'departments'), where('orgId', '==', orgId)))
      .then(snap => setDepartments(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [orgId]);

  async function handleSubmit() {
    if (!title.trim() || !dueDate) {
      setError('Title and due date are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await addDoc(collection(db, 'tasks'), {
        orgId,
        title:                title.trim(),
        description:          description.trim(),
        assignedTo:           null,
        assignedToDepartment: department || null,
        dueDate:              parseLocalDate(dueDate),
        startDate:            parseLocalDate(startDate),
        status:               'not_started',
        department:           department || null,
        production:           null,
        visibleToAll,
        visibleToDepartments: [],
        dependsOn:            [],
        notifyOnComplete:     [],
        notifyOnOverdue:      [],
        createdBy:            uid,
        completedAt:          null,
        createdAt:            serverTimestamp(),
      });
      onSuccess();
    } catch (err) {
      console.error('CreateTaskForm error:', err);
      setError('Failed to create task. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-lg">
      <h2 className="text-base font-semibold text-gray-900 mb-5">New Task</h2>
      <div className="space-y-4">

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Confirm volunteer assignments"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date <span className="text-red-500">*</span></label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        {departments.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <select value={department} onChange={e => setDepartment(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">All departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-start justify-between gap-6 pt-1">
          <div>
            <p className="text-sm font-medium text-gray-700">Visible to everyone</p>
            <p className="text-xs text-gray-400 mt-0.5">When on, all members of your organization can see this task.</p>
          </div>
          <button type="button" onClick={() => setVisibleToAll(v => !v)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${visibleToAll ? 'bg-indigo-600' : 'bg-gray-200'}`}
            role="switch" aria-checked={visibleToAll}>
            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${visibleToAll ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

      <div className="flex items-center gap-3 mt-6">
        <button onClick={handleSubmit} disabled={saving || !title.trim() || !dueDate}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
          {saving ? 'Creating...' : 'Create Task'}
        </button>
        <button onClick={onCancel} className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}
