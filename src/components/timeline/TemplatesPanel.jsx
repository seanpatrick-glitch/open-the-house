import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import CreateTemplateForm from './CreateTemplateForm';

function offsetLabel(offsetDays, anchor) {
  const label = anchor || 'anchor date';
  if (offsetDays === 0) return `On ${label}`;
  if (offsetDays > 0) return `${offsetDays} day${offsetDays !== 1 ? 's' : ''} after ${label}`;
  return `${Math.abs(offsetDays)} day${Math.abs(offsetDays) !== 1 ? 's' : ''} before ${label}`;
}

function calcDueDate(anchorDateStr, offsetDays) {
  const [year, month, day] = anchorDateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day); // local midnight, avoids UTC shift
  d.setDate(d.getDate() + offsetDays);
  return d;
}

function formatPreviewDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TemplatesPanel({ departments, onClose, onTasksCreated }) {
  const { userProfile } = useAuth();
  const [templates, setTemplates]         = useState([]);
  const [loading, setLoading]             = useState(true);
  const [mode, setMode]                   = useState('list'); // 'list' | 'create' | 'use'
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateTasks, setTemplateTasks] = useState([]);
  const [tasksLoading, setTasksLoading]   = useState(false);
  const [anchorDate, setAnchorDate]       = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [creating, setCreating]           = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);

  const orgId = userProfile?.orgId;
  const uid   = userProfile?.uid;

  useEffect(() => {
    if (!orgId) return;
    const q = query(collection(db, 'timelineTemplates'), where('orgId', '==', orgId));
    const unsub = onSnapshot(q, snap => {
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [orgId]);

  useEffect(() => {
    if (!selectedTemplate) return;
    setTasksLoading(true);
    getDocs(collection(db, 'timelineTemplates', selectedTemplate.id, 'templateTasks'))
      .then(snap => {
        const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        tasks.sort((a, b) => a.offsetDays - b.offsetDays);
        setTemplateTasks(tasks);
      })
      .catch(err => console.error('Error fetching template tasks:', err))
      .finally(() => setTasksLoading(false));
  }, [selectedTemplate]);

  function handleUseTemplate(template) {
    setSelectedTemplate(template);
    setCreateSuccess(false);
    setMode('use');
  }

  async function handleCreateTasks() {
    if (!anchorDate || templateTasks.length === 0) return;
    setCreating(true);
    try {
      await Promise.all(templateTasks.map(task => {
        const dueDate = calcDueDate(anchorDate, task.offsetDays);
        return addDoc(collection(db, 'tasks'), {
          orgId,
          title: task.title,
          description: task.description || '',
          assignedTo: null,
          assignedToDepartment: task.department || null,
          dueDate: Timestamp.fromDate(dueDate),
          startDate: null,
          status: 'not_started',
          department: task.department || null,
          production: null,
          visibleToAll: false,
          visibleToDepartments: [],
          dependsOn: [],
          notifyOnComplete: [],
          notifyOnOverdue: [],
          createdBy: uid,
          completedAt: null,
          createdAt: serverTimestamp(),
        });
      }));
      setCreateSuccess(true);
      if (onTasksCreated) onTasksCreated();
    } catch (err) {
      console.error('Error creating tasks from template:', err);
    } finally {
      setCreating(false);
    }
  }

  if (mode === 'create') {
    return (
      <div>
        <button onClick={() => setMode('list')}
          className="text-sm text-gray-500 hover:text-gray-700 mb-6 flex items-center gap-1">
          ← Back to Templates
        </button>
        <CreateTemplateForm
          departments={departments}
          onSuccess={() => setMode('list')}
          onCancel={() => setMode('list')}
        />
      </div>
    );
  }

  if (mode === 'use' && selectedTemplate) {
    return (
      <div className="max-w-2xl">
        <button onClick={() => { setMode('list'); setSelectedTemplate(null); setTemplateTasks([]); setCreateSuccess(false); }}
          className="text-sm text-gray-500 hover:text-gray-700 mb-6 flex items-center gap-1">
          ← Back to Templates
        </button>

        <h2 className="text-base font-semibold text-gray-900 mb-1">{selectedTemplate.name}</h2>
        <p className="text-sm text-gray-500 mb-6">
          Set your {selectedTemplate.anchorLabel} date and all task due dates will calculate automatically.
        </p>

        {createSuccess ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <p className="text-green-700 font-medium text-sm mb-1">
              {templateTasks.length} task{templateTasks.length !== 1 ? 's' : ''} created.
            </p>
            <p className="text-green-600 text-sm mb-4">Your timeline is ready to view.</p>
            <button
              onClick={onClose}
              className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              View Timeline
            </button>
          </div>
        ) : (
          <>
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {selectedTemplate.anchorLabel} Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={anchorDate}
                onChange={e => setAnchorDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {tasksLoading ? (
              <p className="text-sm text-gray-500">Loading tasks...</p>
            ) : templateTasks.length === 0 ? (
              <p className="text-sm text-gray-400">This template has no tasks.</p>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-5">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {templateTasks.length} Task{templateTasks.length !== 1 ? 's' : ''} to Create
                  </p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Task</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Timing</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Due Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {templateTasks.map(task => {
                      const dept = task.department ? departments[task.department] : null;
                      const due  = anchorDate ? calcDueDate(anchorDate, task.offsetDays) : null;
                      return (
                        <tr key={task.id}>
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-gray-900">{task.title}</p>
                            {dept && (
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dept.colorCode || '#6366f1' }} />
                                <span className="text-xs text-gray-400">{dept.name}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">
                            {offsetLabel(task.offsetDays, selectedTemplate.anchorLabel)}
                          </td>
                          <td className="px-4 py-2.5 text-sm text-gray-700 whitespace-nowrap">
                            {due ? formatPreviewDate(due) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleCreateTasks}
                disabled={creating || !anchorDate || templateTasks.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
              >
                {creating ? 'Creating...' : `Create ${templateTasks.length} Task${templateTasks.length !== 1 ? 's' : ''}`}
              </button>
              <button
                onClick={() => { setMode('list'); setSelectedTemplate(null); setTemplateTasks([]); }}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Templates</h2>
          <p className="text-sm text-gray-500">Reusable task sets for any production or event.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setMode('create')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            New Template
          </button>
          <button onClick={onClose}
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
            Close
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading templates...</p>
      ) : templates.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <p className="text-gray-500 text-sm mb-1">No templates yet.</p>
          <p className="text-gray-400 text-sm">Create a template to reuse task sets across productions.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map(t => (
            <div key={t.id} className="bg-white border border-gray-200 rounded-xl p-5 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                {t.description && <p className="text-sm text-gray-500 mt-0.5">{t.description}</p>}
                <p className="text-xs text-gray-400 mt-1">Anchor: {t.anchorLabel}</p>
              </div>
              <button
                onClick={() => handleUseTemplate(t)}
                className="flex-shrink-0 text-sm font-medium text-indigo-600 border border-indigo-200 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                Use Template
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
