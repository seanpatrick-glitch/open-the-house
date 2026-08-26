import { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useUnread } from '../contexts/UnreadContext';
import { DASHBOARD_STATES } from '../models/org';
import { differenceInDays, startOfDay, endOfDay, addDays } from 'date-fns';
import UnreadCallout from '../components/messaging/UnreadCallout';
import UpcomingDatesWidget, { mergeUpcoming, UPCOMING_LIMIT } from '../components/dashboard/UpcomingDatesWidget';
import PageHeader from '../components/shared/PageHeader';
import toast from 'react-hot-toast';

function goToMessages() {
  window.dispatchEvent(new CustomEvent('navigate', { detail: { section: 'messages' } }));
}

// One retry after a short delay before giving up — cheap insurance against a
// single dropped request on a slow/unreliable connection (seen on mobile)
// collapsing the whole load into the generic error state.
async function getDocWithRetry(ref, delayMs = 800) {
  try {
    return await getDoc(ref);
  } catch (err) {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    return getDoc(ref);
  }
}

function getDashboardState(openDate, closeDate, override) {
  if (override) return override;
  const today          = new Date();
  const open           = openDate?.toDate ? openDate.toDate() : new Date(openDate);
  const close          = closeDate?.toDate ? closeDate.toDate() : new Date(closeDate);
  const daysToOpen     = differenceInDays(open, today);
  const daysSinceClose = differenceInDays(today, close);
  if (daysSinceClose > 0) return DASHBOARD_STATES.POSTMORTEM;
  if (daysToOpen <= 0 && daysSinceClose <= 0) return DASHBOARD_STATES.LIVE;
  if (daysToOpen <= 7) return DASHBOARD_STATES.FINAL_COUNTDOWN;
  return DASHBOARD_STATES.PLANNING;
}

// Short badge suffix explaining why the dashboard is in this state. Only
// call with isOverride true when the override actually determined the
// displayed state — not just whenever the org has one stored, since the
// no-active-production fallback ignores it.
function getStateDescriptor(state, isOverride) {
  if (isOverride) return 'manually set';
  switch (state) {
    case DASHBOARD_STATES.PLANNING:        return 'more than a week out';
    case DASHBOARD_STATES.FINAL_COUNTDOWN: return 'within a week';
    case DASHBOARD_STATES.LIVE:            return 'opens tonight';
    case DASHBOARD_STATES.POSTMORTEM:      return 'production closed';
    default: return '';
  }
}

export default function DHDashboardView() {
  const { userProfile } = useAuth();
  const orgId = userProfile?.orgId;
  const uid   = userProfile?.uid;
  const unreadCount = useUnread();

  const [departmentId, setDepartmentId]   = useState(null);
  const [department, setDepartment]       = useState(null);
  const [dashState, setDashState]         = useState(DASHBOARD_STATES.PLANNING);
  const [activeProd, setActiveProd]       = useState(null);
  const [daysToOpen, setDaysToOpen]       = useState(null);
  const [isOverride, setIsOverride]       = useState(false);
  const [loading, setLoading]             = useState(true);

  const [tasks, setTasks]                 = useState([]);
  const [tasksToday, setTasksToday]       = useState([]);
  const [tasksTomorrow, setTasksTomorrow] = useState([]);
  const [members, setMembers]             = useState([]);
  const [flags, setFlags]                 = useState([]);
  const [upcomingTasks, setUpcomingTasks]   = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);

  // Load DH's department and org state
  useEffect(() => {
    if (!orgId || !uid) return;

    const loadState = async () => {
      try {
        // Get DH's departmentId from members subcollection
        const memberSnap = await getDocWithRetry(doc(db, 'organizations', orgId, 'members', uid));
        const deptId = memberSnap.exists() ? memberSnap.data().departmentId : null;
        setDepartmentId(deptId);

        // Load department document for display
        if (deptId) {
          const deptSnap = await getDocWithRetry(doc(db, 'departments', deptId));
          if (deptSnap.exists()) setDepartment({ id: deptSnap.id, ...deptSnap.data() });
        }

        // Load org and active production for state determination
        const orgSnap = await getDocWithRetry(doc(db, 'organizations', orgId));
        if (!orgSnap.exists()) { setLoading(false); return; }

        const orgData     = orgSnap.data();
        const override    = orgData.dashboardStateOverride ?? null;
        const compositeId = orgData.activeProdId ?? null;

        if (!compositeId) {
          setDashState(DASHBOARD_STATES.PLANNING);
          setIsOverride(false);
          setLoading(false);
          return;
        }

        const [placeId, productionId] = compositeId.split('/');
        const prodSnap = await getDocWithRetry(
          doc(db, 'organizations', orgId, 'places', placeId, 'productions', productionId)
        );

        if (!prodSnap.exists()) {
          setDashState(DASHBOARD_STATES.PLANNING);
          setIsOverride(false);
          setLoading(false);
          return;
        }

        const prod  = { id: prodSnap.id, ...prodSnap.data() };
        const state = getDashboardState(prod.openDate, prod.closeDate, override);
        const open  = prod.openDate?.toDate ? prod.openDate.toDate() : new Date(prod.openDate);
        setActiveProd(prod);
        setDashState(state);
        setIsOverride(!!override);
        setDaysToOpen(differenceInDays(open, new Date()));
      } catch (err) {
        console.error('DHDashboardView load error:', err);
        toast.error('Could not load your dashboard. Please refresh and try again.');
      } finally {
        setLoading(false);
      }
    };

    loadState();
  }, [orgId, uid]);

  // Upcoming Dates widget — department-scoped, independent of dashState so
  // it shows in every state. Explicitly guarded on a real departmentId
  // (rather than the deptFilter-omit-if-falsy pattern the other queries
  // below use) since showing every department's items to a DH with no
  // assignment yet would defeat the point of a department-scoped widget.
  useEffect(() => {
    if (!orgId || loading || !departmentId) {
      setUpcomingTasks([]);
      setUpcomingEvents([]);
      return;
    }
    const todayStart = startOfDay(new Date());

    const tasksQ = query(
      collection(db, 'tasks'),
      where('orgId', '==', orgId),
      where('departmentId', '==', departmentId),
      where('dueByDate', '>=', todayStart),
      orderBy('dueByDate', 'asc'),
      limit(UPCOMING_LIMIT)
    );
    const eventsQ = query(
      collection(db, 'events'),
      where('orgId', '==', orgId),
      where('departmentId', '==', departmentId),
      where('startDate', '>=', todayStart),
      orderBy('startDate', 'asc'),
      limit(UPCOMING_LIMIT)
    );

    const unsubTasks  = onSnapshot(tasksQ,  snap => setUpcomingTasks(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubEvents = onSnapshot(eventsQ, snap => setUpcomingEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubTasks(); unsubEvents(); };
  }, [orgId, departmentId, loading]);

  // Live data subscriptions scoped to department
  useEffect(() => {
    if (!orgId || loading) return;

    const today      = new Date();
    const todayStart = startOfDay(today);
    const todayEnd   = endOfDay(today);
    const subs       = [];

    const deptFilter = departmentId
      ? [where('departmentId', '==', departmentId)]
      : [];

    if (dashState === DASHBOARD_STATES.PLANNING) {
      const q = query(
        collection(db, 'tasks'),
        where('orgId', '==', orgId),
        where('level', '==', 'department'),
        ...deptFilter,
        where('status', 'in', ['not_started', 'in_progress', 'overdue']),
        orderBy('dueByDate', 'asc'),
        limit(20)
      );
      subs.push(onSnapshot(q, snap => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
    }

    if (dashState === DASHBOARD_STATES.FINAL_COUNTDOWN) {
      const tomorrowStart = startOfDay(addDays(today, 1));
      const tomorrowEnd   = endOfDay(addDays(today, 1));

      const qToday = query(
        collection(db, 'tasks'),
        where('orgId', '==', orgId),
        ...deptFilter,
        where('dueByDate', '>=', todayStart),
        where('dueByDate', '<=', todayEnd)
      );
      const qTomorrow = query(
        collection(db, 'tasks'),
        where('orgId', '==', orgId),
        ...deptFilter,
        where('dueByDate', '>=', tomorrowStart),
        where('dueByDate', '<=', tomorrowEnd),
        where('status', 'in', ['not_started', 'overdue'])
      );
      const qMembers = query(
        collection(db, 'organizations', orgId, 'members'),
        where('departmentId', '==', departmentId ?? ''),
        where('accountStatus', '==', 'provisional')
      );

      subs.push(onSnapshot(qToday,    snap => setTasksToday(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
      subs.push(onSnapshot(qTomorrow, snap => setTasksTomorrow(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
      subs.push(onSnapshot(qMembers,  snap => setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
    }

    if (dashState === DASHBOARD_STATES.LIVE) {
      const qTasks = query(
        collection(db, 'tasks'),
        where('orgId', '==', orgId),
        ...deptFilter,
        where('dueByDate', '>=', todayStart),
        where('dueByDate', '<=', todayEnd),
        orderBy('dueByDate', 'asc')
      );
      const qFlags = query(
        collection(db, 'organizations', orgId, 'flags'),
        where('status', '==', 'open'),
        where('departmentId', '==', departmentId ?? ''),
        orderBy('createdAt', 'asc')
      );
      const qMembers = query(
        collection(db, 'organizations', orgId, 'members'),
        where('departmentId', '==', departmentId ?? '')
      );

      subs.push(onSnapshot(qTasks,   snap => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
      subs.push(onSnapshot(
        qFlags,
        snap => setFlags(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        err => {
          console.error('DHDashboardView flags subscription error:', err);
          toast.error('Could not load flags. Please refresh and try again.');
        }
      ));
      subs.push(onSnapshot(qMembers, snap => setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
    }

    if (dashState === DASHBOARD_STATES.POSTMORTEM) {
      const q = query(
        collection(db, 'tasks'),
        where('orgId', '==', orgId),
        where('phase', '==', 'wrap'),
        ...deptFilter,
        orderBy('dueByDate', 'asc')
      );
      subs.push(onSnapshot(q, snap => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
    }

    return () => subs.forEach(u => u());
  }, [orgId, departmentId, dashState, loading]);

  if (loading) {
    return <div className="p-6 text-gray-500 text-sm">Loading dashboard...</div>;
  }

  const prodName   = activeProd?.name || 'your next production';
  const deptName   = department?.name || 'your department';

  const headers = {
    [DASHBOARD_STATES.PLANNING]:        `${daysToOpen !== null ? `${daysToOpen} days` : 'Planning ahead'} to ${deptName}`,
    [DASHBOARD_STATES.FINAL_COUNTDOWN]: `${daysToOpen !== null ? `${daysToOpen} day${daysToOpen === 1 ? '' : 's'}` : 'Almost there'} to ${prodName}`,
    [DASHBOARD_STATES.LIVE]:            `Tonight: ${prodName}`,
    [DASHBOARD_STATES.POSTMORTEM]:      `Wrapping ${prodName}`,
  };

  const stateLabels = {
    [DASHBOARD_STATES.PLANNING]:        { label: 'Planning', color: 'bg-gray-100 text-gray-600' },
    [DASHBOARD_STATES.FINAL_COUNTDOWN]: { label: 'Final Countdown', color: 'bg-spotlight/15 text-stage-navy' },
    [DASHBOARD_STATES.LIVE]:            { label: 'Live', color: 'bg-green-100 text-green-700' },
    [DASHBOARD_STATES.POSTMORTEM]:      { label: 'Postmortem', color: 'bg-blue-100 text-blue-700' },
  };

  const { label, color } = stateLabels[dashState] || stateLabels[DASHBOARD_STATES.PLANNING];
  const descriptor = getStateDescriptor(dashState, isOverride);

  return (
    <div className="p-6 max-w-6xl">
      <PageHeader title={headers[dashState]}>
        <div className="flex items-center gap-3 mt-4">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
            {descriptor ? `${label} (${descriptor})` : label}
          </span>
          {deptName && <p className="text-sm text-white/70">{deptName}</p>}
        </div>
      </PageHeader>

      {unreadCount > 0 && (
        <div className="mb-6">
          <UnreadCallout count={unreadCount} onClick={goToMessages} />
        </div>
      )}

      <UpcomingDatesWidget items={mergeUpcoming(upcomingTasks, upcomingEvents)} />

      {dashState === DASHBOARD_STATES.PLANNING && (
        <DHPlanningState tasks={tasks} departmentId={departmentId} />
      )}
      {dashState === DASHBOARD_STATES.FINAL_COUNTDOWN && (
        <DHFinalCountdownState tasksToday={tasksToday} tasksTomorrow={tasksTomorrow} members={members} />
      )}
      {dashState === DASHBOARD_STATES.LIVE && (
        <DHLiveState tasks={tasks} members={members} flags={flags} />
      )}
      {dashState === DASHBOARD_STATES.POSTMORTEM && (
        <DHPostmortemState tasks={tasks} />
      )}
    </div>
  );
}

function DHPlanningState({ tasks, departmentId }) {
  const overdue  = tasks.filter(t => t.status === 'overdue');
  const upcoming = tasks.filter(t => t.status !== 'overdue');

  return (
    <div className="space-y-6">
      {overdue.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-red-600 mb-3">Overdue</h2>
          <TaskList tasks={overdue} />
        </div>
      )}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Department Tasks</h2>
        {upcoming.length === 0 ? (
          <EmptyState message="No upcoming department tasks." />
        ) : (
          <TaskList tasks={upcoming} />
        )}
      </div>
      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { section: 'timeline', state: { action: 'addTask' } } }))}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-gray-300 transition-colors">
            Add a department task
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { section: 'people', state: { action: 'addPerson' } } }))}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-gray-300 transition-colors">
            Add people
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { section: 'messages', state: { action: 'broadcast', scope: 'department', departmentId } } } ))}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-gray-300 transition-colors">
            Message the department
          </button>
        </div>
      </div>
    </div>
  );
}

function DHFinalCountdownState({ tasksToday, tasksTomorrow, members }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Today</h2>
        {tasksToday.length === 0 ? <EmptyState message="Nothing due today." /> : <TaskList tasks={tasksToday} />}
      </div>
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Tomorrow</h2>
        {tasksTomorrow.length === 0 ? <EmptyState message="Nothing due tomorrow." /> : <TaskList tasks={tasksTomorrow} />}
      </div>
    </div>
  );
}

function DHLiveState({ tasks, members, flags }) {
  return (
    <div className="grid grid-cols-3 gap-6">
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Today's Tasks</h2>
        {tasks.length === 0 ? <EmptyState message="No tasks due today." /> : <TaskList tasks={tasks} />}
      </div>
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Department Status</h2>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-gray-900">{members.length}</p>
          <p className="text-xs text-gray-500">department members</p>
        </div>
      </div>
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Department Flags</h2>
        {flags.length === 0 ? (
          <EmptyState message="No open flags." />
        ) : (
          <div className="space-y-2">
            {flags.map(flag => (
              <div key={flag.id} className="bg-white border border-gray-200 rounded-xl p-3">
                <p className="text-sm text-gray-800">{flag.note}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DHPostmortemState({ tasks }) {
  const incomplete = tasks.filter(t => t.status !== 'complete');
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Wrap Tasks</h2>
        {incomplete.length === 0 ? <EmptyState message="All wrap tasks complete." /> : <TaskList tasks={incomplete} />}
      </div>
    </div>
  );
}

function TaskList({ tasks }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="divide-y divide-gray-100">
        {tasks.map(task => (
          <div key={task.id} className="px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-sm text-gray-900 font-medium truncate">{task.title}</p>
            <div className="flex items-center gap-2 flex-shrink-0">
              {task.dueByDate && (
                <span className="text-xs text-gray-400">
                  {task.dueByDate.toDate?.().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                task.status === 'overdue'     ? 'bg-red-100 text-red-700' :
                task.status === 'complete'    ? 'bg-green-100 text-green-700' :
                task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {task.status === 'not_started' ? 'Not started' :
                 task.status === 'in_progress' ? 'In progress' :
                 task.status === 'complete'    ? 'Complete' :
                 task.status === 'overdue'     ? 'Overdue' : task.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}
