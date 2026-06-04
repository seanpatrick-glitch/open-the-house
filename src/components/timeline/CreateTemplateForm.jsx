import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';

function offsetLabel(offsetDays, anchor) {
  const label = anchor || 'anchor date';
  if (offsetDays === 0) return `On ${label}`;
  if (offsetDays > 0) return `${offsetDays} day${offsetDays !== 1 ? 's' : ''} after ${label}`;
  return `${Math.abs(offsetDays)} day${Math.abs(offsetDays) !== 1 ? 's' : ''} before ${label}`;
}

export default function CreateTemplateForm({ departments, onSuccess, onCancel }) {
  const { userProfile } = useAuth();
  const { orgId, uid } = userProfile;

  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [anchorLabel, setAnchorLabel] = useState('Opening Night');

  const [taskTitle, setTaskTitle]           = useState('');
  const [taskOffsetDays, setTaskOffsetDays] = useState(0);
  const [taskDepartment, setTaskDepartment] = useState('');
  const [tasks, setTasks]                   = useState([]);

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const deptOptions = Object.entries(departments);

  function handleAddTask() {
    if (!taskTitle.trim()) return;
    setTasks(prev => [...prev, {
      id: Date.now(),
      title: taskTitle.trim(),
      offsetDays: parseInt(taskOffsetDays) || 0,
      department: taskDepartment,
    }]);
    setTaskTitle('');
    setTaskOffsetDays(0);
    setTaskDepartment('');
  }

  async function handleSave() {
    if (!name.trim() || !anchorLabel.trim()) {
      setError('Template name and anchor label are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const templateRef = await addDoc(collection(db, 'timelineTemplates'), {
        name: name.trim(),
        description: description.trim(),
        orgId,
        anchorLabel: anchorLabel.trim(),
        createdBy: uid,
        lastUsed: null,
        createdAt: serverTimestamp(),
      });
      await Promise.all(tasks.map(task =>
        addDoc(collection(db, 'timelineTemplates', templateRef.id, 'templateTasks'), {
          title: task.title,
          description: '',
          offsetDays: task.offsetDays,
          department: task.department || null,
          assignedRole: null,
          notifyOnComplete: false,
          dependsOn: [],
        })
      ));
      onSuccess(templateRef.id);
    } catch (err) {
      console.error('CreateTemplateForm error:', err);
      setError('Failed to save template. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-base font-semibold text-gray-900 mb-5">New Template</h2>

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4 space-y-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Template Details</p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Regional Production"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Optional description" rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Anchor Label <span className="text-red-500">*</span></label>
          <input type="text" value={anchorLabel} onChange={e => setAnchorLabel(e.target.value)}
            placeholder="e.g. Opening Night"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <p className="text-xs text-gray-400 mt-1">The reference date all task offsets are calculated from.</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">Template Tasks</p>
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Task Title</label>
            <input type="text" value={taskTitle} onChange={e => setTaskTitle(e.target.value)}
              placeholder="e.g. Print volunteer run sheets"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTask(); }}}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Offset Days</label>
              <input type="number" value={taskOffsetDays} onChange={e => setTaskOffsetDays(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <p className="text-xs text-gray-400 mt-1">{offsetLabel(parseInt(taskOffsetDays) || 0, anchorLabel)}</p>
            </div>
            {deptOptions.length > 0 && (
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
                <select value={taskDepartment} onChange={e => setTaskDepartment(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">None</option>
                  {deptOptions.map(([id, dept]) => (
                    <option key={id} value={id}>{dept.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <button type="button" onClick={handleAddTask} disabled={!taskTitle.trim()}
            className="bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            Add Task
          </button>
        </div>

        {tasks.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-lg">
            No tasks added yet.
          </p>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Task</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Timing</th>
                  {deptOptions.length > 0 && <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Dept</th>}
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tasks.map(task => {
                  const dept = task.department ? departments[task.department] : null;
                  return (
                    <tr key={task.id}>
                      <td className="px-3 py-2 font-medium text-gray-900">{task.title}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{offsetLabel(task.offsetDays, anchorLabel)}</td>
                      {deptOptions.length > 0 && (
                        <td className="px-3 py-2">
                          {dept ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dept.colorCode || '#6366f1' }} />
                              <span className="text-xs text-gray-600">{dept.name}</span>
                            </div>
                          ) : <span className="text-xs text-gray-400">None</span>}
                        </td>
                      )}
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => setTasks(prev => prev.filter(t => t.id !== task.id))}
                          className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving || !name.trim() || !anchorLabel.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
          {saving ? 'Saving...' : 'Save Template'}
        </button>
        <button onClick={onCancel} className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}
