import { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useUnread } from '../contexts/UnreadContext';
import { DASHBOARD_STATES } from '../models/org';
import { differenceInDays, startOfDay, endOfDay, addDays } from 'date-fns';
import UnreadCallout from '../components/messaging/UnreadCallout';
import UpcomingDatesWidget, { mergeUpcoming, UPCOMING_LIMIT } from '../components/dashboard/UpcomingDatesWidget';
import toast from 'react-hot-toast';

function goToMessages() {
  window.dispatchEvent(new CustomEvent('navigate', { detail: { section: 'messages' } }));
}

function getDashboardState(openDate, closeDate, override) {
  if (override) return override;
  const today        = new Date();
  const open         = openDate?.toDate ? openDate.toDate() : new Date(openDate);
  const close        = closeDate?.toDate ? closeDate.toDate() : new Date(closeDate);
  const daysToOpen   = differenceInDays(open, today);
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

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function AdminDashboardView() {
  const { userProfile } = useAuth();
  const orgId = userProfile?.orgId;
  const unreadCount = useUnread();

  const [dashState, setDashState]         = useState(DASHBOARD_STATES.PLANNING);
  const [activeProd, setActiveProd]       = useState(null);
  const [daysToOpen, setDaysToOpen]       = useState(null);
  const [isOverride, setIsOverride]       = useState(false);
  const [loading, setLoading]             = useState(true);

  // State-specific data
  const [tasks, setTasks]               = useState([]);
  const [tasksToday, setTasksToday]     = useState([]);
  const [tasksTomorrow, setTasksTomorrow] = useState([]);
  const [members, setMembers]             = useState([]);
  const [flags, setFlags]                 = useState([]);
  const [checkinTokens, setCheckinTokens] = useState([]);
  const [nextProd, setNextProd]           = useState(null);
  const [upcomingTasks, setUpcomingTasks]   = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);

  useEffect(() => {
    if (!orgId) return;

    const loadOrgAndState = async () => {
      try {
        const orgSnap = await getDoc(doc(db, 'organizations', orgId));
        if (!orgSnap.exists()) { setLoading(false); return; }

        const orgData  = orgSnap.data();
        const override = orgData.dashboardStateOverride ?? null;
        const compositeId = orgData.activeProdId ?? null;

        if (!compositeId) {
          setDashState(DASHBOARD_STATES.PLANNING);
          setIsOverride(false);
          setLoading(false);
          return;
        }

        const [placeId, productionId] = compositeId.split('/');
        const prodSnap = await getDoc(
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
        console.error('AdminDashboardView load error:', err);
        toast.error('Could not load your dashboard. Please refresh and try again.');
      } finally {
        setLoading(false);
      }
    };

    loadOrgAndState();
  }, [orgId]);

  // Upcoming Dates widget — org-wide, independent of dashState so it shows
  // in every state. Each query is capped to UPCOMING_LIMIT and already
  // sorted ascending by its own date field, so merging the two capped,
  // sorted lists and re-slicing to UPCOMING_LIMIT always yields the true
  // nearest N items across both collections.
  useEffect(() => {
    if (!orgId || loading) return;
    const todayStart = startOfDay(new Date());

    const tasksQ = query(
      collection(db, 'tasks'),
      where('orgId', '==', orgId),
      where('dueByDate', '>=', todayStart),
      orderBy('dueByDate', 'asc'),
      limit(UPCOMING_LIMIT)
    );
    const eventsQ = query(
      collection(db, 'events'),
      where('orgId', '==', orgId),
      where('startDate', '>=', todayStart),
      orderBy('startDate', 'asc'),
      limit(UPCOMING_LIMIT)
    );

    const unsubTasks  = onSnapshot(tasksQ,  snap => setUpcomingTasks(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubEvents = onSnapshot(eventsQ, snap => setUpcomingEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubTasks(); unsubEvents(); };
  }, [orgId, loading]);

  // Live data subscriptions based on state
  useEffect(() => {
    if (!orgId || loading) return;

    const today      = new Date();
    const todayStart = startOfDay(today);
    const todayEnd   = endOfDay(today);
    const subs       = [];

    if (dashState === DASHBOARD_STATES.PLANNING) {
      const q = query(
        collection(db, 'tasks'),
        where('orgId', '==', orgId),
        where('level', '==', 'org'),
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
        where('dueByDate', '>=', todayStart),
        where('dueByDate', '<=', todayEnd)
      );
      const qTomorrow = query(
        collection(db, 'tasks'),
        where('orgId', '==', orgId),
        where('dueByDate', '>=', tomorrowStart),
        where('dueByDate', '<=', tomorrowEnd),
        where('status', 'in', ['not_started', 'overdue'])
      );
      const qMembers = query(
        collection(db, 'organizations', orgId, 'members'),
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
        where('dueByDate', '>=', todayStart),
        where('dueByDate', '<=', todayEnd),
        orderBy('dueByDate', 'asc')
      );
      const qTokens = query(
        collection(db, 'organizations', orgId, 'checkinTokens'),
        where('date', '>=', todayStart),
        where('date', '<=', todayEnd),
        where('active', '==', true)
      );
      const qFlags = query(
        collection(db, 'organizations', orgId, 'flags'),
        where('status', '==', 'open'),
        orderBy('createdAt', 'asc')
      );

      subs.push(onSnapshot(qTasks,  snap => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
      subs.push(onSnapshot(qTokens, snap => setCheckinTokens(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
      subs.push(onSnapshot(qFlags,  snap => setFlags(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
      subs.push(onSnapshot(collection(db, 'organizations', orgId, 'members'), snap => setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
    }

    if (dashState === DASHBOARD_STATES.POSTMORTEM) {
      const qWrap = query(
        collection(db, 'tasks'),
        where('orgId', '==', orgId),
        where('phase', '==', 'wrap'),
        orderBy('dueByDate', 'asc')
      );
      subs.push(onSnapshot(qWrap, snap => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
    }

    return () => subs.forEach(u => u());
  }, [orgId, dashState, loading]);

  if (loading) {
    return <div className="p-6 text-gray-500 text-sm">Loading dashboard...</div>;
  }

  return (
    <div className="p-6 max-w-6xl">
      <DashboardHeader
        state={dashState}
        activeProd={activeProd}
        daysToOpen={daysToOpen}
        isOverride={isOverride}
      />
      {unreadCount > 0 && (
        <div className="mb-6">
          <UnreadCallout count={unreadCount} onClick={goToMessages} />
        </div>
      )}
      <UpcomingDatesWidget items={mergeUpcoming(upcomingTasks, upcomingEvents)} />
      <DashboardContent
        state={dashState}
        tasks={tasks}
        tasksToday={tasksToday}
        tasksTomorrow={tasksTomorrow}
        members={members}
        flags={flags}
        checkinTokens={checkinTokens}
        activeProd={activeProd}
        orgId={orgId}
      />
    </div>
  );
}

function DashboardHeader({ state, activeProd, daysToOpen, isOverride }) {
  const prodName = activeProd?.name || 'your next production';

  const headers = {
    [DASHBOARD_STATES.PLANNING]:        `${daysToOpen !== null ? `${daysToOpen} days` : 'Planning ahead'} to ${prodName}`,
    [DASHBOARD_STATES.FINAL_COUNTDOWN]: `${daysToOpen !== null ? `${daysToOpen} day${daysToOpen === 1 ? '' : 's'}` : 'Almost there'} to ${prodName}`,
    [DASHBOARD_STATES.LIVE]:            `Tonight: ${prodName}`,
    [DASHBOARD_STATES.POSTMORTEM]:      `Wrapping ${prodName}`,
  };

  const stateLabels = {
    [DASHBOARD_STATES.PLANNING]:        { label: 'Planning', color: 'bg-gray-100 text-gray-600' },
    [DASHBOARD_STATES.FINAL_COUNTDOWN]: { label: 'Final Countdown', color: 'bg-amber-100 text-amber-700' },
    [DASHBOARD_STATES.LIVE]:            { label: 'Live', color: 'bg-green-100 text-green-700' },
    [DASHBOARD_STATES.POSTMORTEM]:      { label: 'Postmortem', color: 'bg-blue-100 text-blue-700' },
  };

  const { label, color } = stateLabels[state] || stateLabels[DASHBOARD_STATES.PLANNING];
  const descriptor = getStateDescriptor(state, isOverride);

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-2xl font-bold text-gray-900">{headers[state]}</h1>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
          {descriptor ? `${label} (${descriptor})` : label}
        </span>
      </div>
    </div>
  );
}

function DashboardContent({ state, tasks, tasksToday, tasksTomorrow, members, flags, checkinTokens, activeProd, orgId }) {
  if (state === DASHBOARD_STATES.PLANNING)        return <PlanningState tasks={tasks} orgId={orgId} />;
  if (state === DASHBOARD_STATES.FINAL_COUNTDOWN) return <FinalCountdownState tasksToday={tasksToday} tasksTomorrow={tasksTomorrow} members={members} />;
  if (state === DASHBOARD_STATES.LIVE)            return <LiveState tasks={tasks} members={members} flags={flags} checkinTokens={checkinTokens} />;
  if (state === DASHBOARD_STATES.POSTMORTEM)      return <PostmortemState tasks={tasks} activeProd={activeProd} />;
  return null;
}

function PlanningState({ tasks, orgId }) {
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
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Upcoming Tasks</h2>
        {upcoming.length === 0 ? (
          <EmptyState message="No upcoming tasks. Add tasks to your timeline to get started." />
        ) : (
          <TaskList tasks={upcoming} />
        )}
      </div>

      {/* Quick actions */}
      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <a href="#timeline"
            onClick={e => { e.preventDefault(); window.dispatchEvent(new CustomEvent('navigate', { detail: { section: 'timeline', state: { action: 'addTask' } } })); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-gray-300 transition-colors">
            Add a timeline task
          </a>
          <a href="#collaborators"
            onClick={e => { e.preventDefault(); window.dispatchEvent(new CustomEvent('navigate', { detail: { section: 'invite-collaborator' } })); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-gray-300 transition-colors">
            Invite a team member
          </a>
          <a href="#messages"
            onClick={e => { e.preventDefault(); window.dispatchEvent(new CustomEvent('navigate', { detail: { section: 'messages', state: { action: 'broadcast', scope: 'all' } } })); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-gray-300 transition-colors">
            Message the org
          </a>
        </div>
      </div>
    </div>
  );
}

function FinalCountdownState({ tasksToday, tasksTomorrow, members }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Today</h2>
        {tasksToday.length === 0 ? <EmptyState message="Nothing due today." /> : <TaskList tasks={tasksToday} />}
      </div>
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Tomorrow: overdue or not started</h2>
        {tasksTomorrow.length === 0 ? <EmptyState message="Nothing due tomorrow." /> : <TaskList tasks={tasksTomorrow} />}
      </div>
    </div>
  );
}

function LiveState({ tasks, members, flags, checkinTokens }) {
  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Today's Schedule */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Today's Schedule</h2>
        {checkinTokens.length > 0 && (
          <div className="mb-3 space-y-1.5">
            {checkinTokens.map(t => (
              <div key={t.id} className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <p className="text-xs font-medium text-green-800">Check-in open</p>
                <p className="text-xs text-green-600">
                  Until {t.validUntil?.toDate().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
            ))}
          </div>
        )}
        {tasks.length === 0 ? <EmptyState message="No tasks due today." /> : <TaskList tasks={tasks} />}
      </div>

      {/* People Status */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">People Status</h2>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-gray-900">{members.length}</p>
          <p className="text-xs text-gray-500">team members</p>
        </div>
      </div>

      {/* Open Flags */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Open Flags</h2>
        {flags.length === 0 ? (
          <EmptyState message="No open flags." />
        ) : (
          <div className="space-y-2">
            {flags.map(flag => (
              <div key={flag.id} className="bg-white border border-gray-200 rounded-xl p-3">
                <p className="text-sm text-gray-800">{flag.note}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {flag.createdAt?.toDate().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 italic">Anything to flag before tonight?</p>
        </div>
      </div>
    </div>
  );
}

function PostmortemState({ tasks, activeProd }) {
  const incompleteTasks = tasks.filter(t => t.status !== 'complete');
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Wrap Tasks</h2>
        {incompleteTasks.length === 0 ? (
          <EmptyState message="All wrap tasks complete." />
        ) : (
          <TaskList tasks={incompleteTasks} />
        )}
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
