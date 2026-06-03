import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { TIMELINE_STATUS } from '../models/timeline';
import CalendarGrid from '../components/timeline/CalendarGrid';
import GanttView from '../components/timeline/GanttView';

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
  const [tasks, setTasks]             = useState([]);
  const [departments, setDepartments] = useState({});
  const [loading, setLoading]         = useState(true);
  const [viewMode, setViewMode]       = useState(null);

  const orgId = userProfile?.orgId;

  useEffect(() => {
    if (!orgId) return;

    const loadDepartments = async () => {
      const snap = await getDocs(
        query(collection(db, 'departments'), where('orgId', '==', orgId))
      );
      const map = {};
      snap.docs.forEach(d => { map[d.id] = d.data(); });
      setDepartments(map);
    };
    loadDepartments();

    // Load saved view preference
    const loadViewPref = async () => {
      try {
        const userSnap = await getDoc(doc(db, 'users', userProfile.uid));
        if (userSnap.exists() && userSnap.data().preferredTimelineView) {
          setViewMode(userSnap.data().preferredTimelineView);
          return;
        }
        const orgSnap = await getDoc(doc(db, 'organizations', orgId));
        if (orgSnap.exists() && orgSnap.data().defaultView) {
          setViewMode(orgSnap.data().defaultView);
          return;
        }
      } catch (err) {
        console.error('Error loading view preference:', err);
      }
      setViewMode('list');
    };
    loadViewPref();

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

  async function handleViewChange(mode) {
    setViewMode(mode);
    try {
      await updateDoc(doc(db, 'users', userProfile.uid), {
        preferredTimelineView: mode,
      });
    } catch (err) {
      console.error('Error saving view preference:', err);
    }
  }

  if (loading || viewMode === null) {
    return <div className="p-6 text-gray-500 text-sm">Loading timeline...</div>;
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Timeline</h1>
          <p className="text-sm text-gray-500">
            {viewMode === 'list' ? 'All tasks sorted by due date.' : viewMode === 'calendar' ? 'Tasks by month.' : 'Tasks plotted by date.'}
          </p>
        </div>
        <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
          <button
            onClick={() => handleViewChange('list')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            List
          </button>
          <button
            onClick={() => handleViewChange('calendar')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'calendar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Calendar
          </button>
          <button
            onClick={() => handleViewChange('gantt')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'gantt' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Timeline
          </button>
        </div>
      </div>

      {viewMode === 'gantt' ? (
        <GanttView tasks={tasks} departments={departments} />
      ) : viewMode === 'calendar' ? (
        <CalendarGrid tasks={tasks} departments={departments} />
      ) : (
        <>
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
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dept.colorCode || '#6366f1' }} />
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
        </>
      )}
    </div>
  );
}
