// Shared "Upcoming Dates" widget for AdminDashboardView.jsx (org-wide) and
// DHDashboardView.jsx (department-scoped): merges tasks (by dueByDate) and
// events (by startDate) into one chronological list, capped at a small
// count, each row tagged Task or Event so the two aren't confused.

export const UPCOMING_LIMIT = 6;

function toMs(ts) {
  if (!ts) return Infinity;
  return ts.toDate ? ts.toDate().getTime() : new Date(ts).getTime();
}

export function mergeUpcoming(tasks, events, limit = UPCOMING_LIMIT) {
  const items = [
    ...tasks.map(t => ({ id: `task-${t.id}`, type: 'task', title: t.title, date: t.dueByDate })),
    ...events.map(e => ({ id: `event-${e.id}`, type: 'event', title: e.title, date: e.startDate })),
  ];
  items.sort((a, b) => toMs(a.date) - toMs(b.date));
  return items.slice(0, limit);
}

export default function UpcomingDatesWidget({ items }) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Upcoming Dates</h2>
      {items.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
          <p className="text-sm text-gray-400">Nothing upcoming.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="divide-y divide-gray-100">
            {items.map(item => (
              <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide flex-shrink-0 ${
                    item.type === 'event' ? 'bg-purple-100 text-purple-700' : 'bg-places-blue/15 text-places-blue/90'
                  }`}>
                    {item.type === 'event' ? 'Event' : 'Task'}
                  </span>
                  <p className="text-sm text-gray-900 font-medium truncate">{item.title}</p>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {item.date?.toDate?.().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
