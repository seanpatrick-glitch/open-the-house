import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { TIMELINE_STATUS } from '../models/timeline';

const STATUS_STYLES = {
  [TIMELINE_STATUS.NOT_STARTED]: 'bg-gray-100 text-gray-600',
  [TIMELINE_STATUS.IN_PROGRESS]: 'bg-blue-100 text-blue-700',
  [TIMELINE_STATUS.COMPLETE]:    'bg-green-100 text-green-700',
  [TIMELINE_STATUS.OVERDUE]:     'bg-red-100 text-red-700',
};

const STATUS_LABELS = {
  [TIMELINE_STATUS.NOT_STARTED]: 'Not started',
  [TIMELINE_STATUS.IN_PROGRESS]: 'In progress',
  [TIMELINE_STATUS.COMPLETE]:    'Complete',
  [TIMELINE_STATUS.OVERDUE]:     'Overdue',
};

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TimelineView() {
  const { userProfile } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [departments, setDepartments] = useState({});
  const [loading, setLoading] = useState(true);

  const orgId = userProfile?.orgId;

  useEffect(() => {
    if (!orgId) return;

    // Load departments once for name lookup
    const loadDepartments = async () => {
      const snap = await getDocs(
        query(collection(db, 'departments'), where('orgId', '==', orgId))
      );
      const map = {};
      snap.docs.forEach(d => { map[d.id] = d.data(); });
      setDepartments(map);
    };
    loadDepartments();

    // Live task subscription
    const q = query(
      collection(db, 'tasks'),
      where('orgId', '==', orgId),
      orderBy('dueDate', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTasks(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [orgId]);

  if (loading) {
    return <div className="p-6 text-gray-500 text-sm">Loading timeline...</div>;
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Timeline</h1>
          <p className="text-sm text-gray-500">All tasks sorted by due date.</p>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <p className="text-gray-500 text-sm mb-1">No tasks yet.</p>
          <p className="text-gray-400 text-sm">Tasks will appear here once your timeline is set up.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Task</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Due</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Department</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tasks.map(task => {
                const dept = task.department ? departments[task.department] : null;
                return (
                  <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{task.title}</p>
                      {task.production && (
                        <p className="text-xs text-gray-400 mt-0.5">Production linked</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {formatDate(task.dueDate)}
                    </td>
                    <td className="px-4 py-3">
                      {dept ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: dept.colorCode || '#6366f1' }}
                          />
                          <span className="text-gray-700">{dept.name}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[task.status] || STATUS_STYLES[TIMELINE_STATUS.NOT_STARTED]}`}>
                        {STATUS_LABELS[task.status] || 'Not started'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
