import { useState, useMemo } from 'react';

const DAYS_WARNING = 3;

function toMs(ts) {
  if (!ts) return 0;
  if (ts.toDate) return ts.toDate().getTime();
  return new Date(ts).getTime();
}

export default function NotificationBanner({ tasks }) {
  const [dismissed, setDismissed] = useState(new Set());

  const allAlerts = useMemo(() => {
    const now      = Date.now();
    const warnMs   = DAYS_WARNING * 24 * 60 * 60 * 1000;
    const taskMap  = Object.fromEntries(tasks.map(t => [t.id, t]));
    const result   = [];

    for (const task of tasks) {
      const dueMs = toMs(task.dueDate);
      if (!dueMs) continue;

      // Overdue — past due and not complete
      if (dueMs < now && task.status !== 'complete') {
        result.push({
          id:      `overdue-${task.id}`,
          type:    'overdue',
          title:   task.title,
          message: 'This task is overdue.',
        });
        continue;
      }

      // Coming due — within warning window and not complete
      if (dueMs >= now && dueMs <= now + warnMs && task.status !== 'complete') {
        const daysLeft = Math.ceil((dueMs - now) / (1000 * 60 * 60 * 24));
        result.push({
          id:      `due-soon-${task.id}`,
          type:    'due-soon',
          title:   task.title,
          message: daysLeft === 0
            ? 'Due today.'
            : `Due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`,
        });
      }

      // Handoff ready — not started, all dependencies complete
      if (task.status === 'not_started' && task.dependsOn?.length > 0) {
        const allDone = task.dependsOn.every(id => taskMap[id]?.status === 'complete');
        if (allDone) {
          result.push({
            id:      `handoff-${task.id}`,
            type:    'handoff',
            title:   task.title,
            message: 'All dependencies are complete. This task is ready to start.',
          });
        }
      }
    }
    return result;
  }, [tasks]);

  const alerts = allAlerts.filter(a => !dismissed.has(a.id));

  if (alerts.length === 0) return null;

  const styles = {
    overdue:   { wrap: 'bg-red-50 border-red-200',     text: 'text-red-800',   sub: 'text-red-600',   btn: 'text-red-400 hover:text-red-600',    dot: '🔴' },
    'due-soon':{ wrap: 'bg-amber-50 border-amber-200', text: 'text-amber-800', sub: 'text-amber-600', btn: 'text-amber-400 hover:text-amber-600', dot: '🟡' },
    handoff:   { wrap: 'bg-blue-50 border-blue-200',   text: 'text-blue-800',  sub: 'text-blue-600',  btn: 'text-blue-400 hover:text-blue-600',   dot: '🔵' },
  };

  return (
    <div className="mb-6 space-y-2">
      {alerts.map(alert => {
        const s = styles[alert.type];
        return (
          <div key={alert.id}
            className={`flex items-start justify-between gap-4 px-4 py-3 rounded-xl border text-sm ${s.wrap}`}>
            <div className="flex items-start gap-3 min-w-0">
              <span className="flex-shrink-0 mt-0.5 text-base">{s.dot}</span>
              <div className="min-w-0">
                <p className={`font-medium truncate ${s.text}`}>{alert.title}</p>
                <p className={`text-xs mt-0.5 ${s.sub}`}>{alert.message}</p>
              </div>
            </div>
            <button
              onClick={() => setDismissed(prev => new Set([...prev, alert.id]))}
              className={`flex-shrink-0 transition-colors ${s.btn}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
