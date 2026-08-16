import { useState } from 'react';

const DAY_WIDTH = 28;
const ROW_HEIGHT = 44;
const LABEL_WIDTH = 200;
const EVENT_MARKER_SIZE = 10;

function toMs(ts) {
  if (!ts) return 0;
  if (ts.toDate) return ts.toDate().getTime();
  return new Date(ts).getTime();
}

function startOfDay(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatShort(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDetailDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatDetailDateShort(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

const STATUS_STYLES = {
  not_started: 'bg-gray-100 text-gray-600',
  in_progress:  'bg-blue-100 text-blue-700',
  complete:     'bg-green-100 text-green-700',
  overdue:      'bg-red-100 text-red-700',
};

const STATUS_LABELS = {
  not_started: 'Not started',
  in_progress:  'In progress',
  complete:     'Complete',
  overdue:      'Overdue',
};

export default function GanttView({ tasks, events = [], departments }) {
  const [deptFilter, setDeptFilter] = useState('all');
  const [selected, setSelected]     = useState(null); // { type: 'task' | 'event', data }

  const filteredTasks = deptFilter === 'all'
    ? tasks
    : tasks.filter(t => (t.departmentId || t.department) === deptFilter);

  const filteredEvents = deptFilter === 'all'
    ? events
    : events.filter(e => e.departmentId === deptFilter);

  const deptOptions = Object.entries(departments);

  // Rows share one timeline: tasks first, then events. Each row knows its own
  // type so it can render as a duration bar (tasks, and multi-day events) or
  // a small marker (single-day events, which don't fit the bar model well).
  const rows = [
    ...filteredTasks.map(t => ({ type: 'task', id: t.id, data: t })),
    ...filteredEvents.map(e => ({ type: 'event', id: e.id, data: e })),
  ];

  const allMs = [
    ...filteredTasks.flatMap(t => [t.assignedOnDate, t.dueByDate].filter(Boolean).map(toMs)),
    ...filteredEvents.flatMap(e => [e.startDate, e.endDate].filter(Boolean).map(toMs)),
  ].filter(Boolean);

  const emptyState = (
    <div>
      {deptOptions.length > 0 && (
        <div className="mb-4">
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="all">All departments</option>
            {deptOptions.map(([id, dept]) => (
              <option key={id} value={id}>{dept.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
        <p className="text-gray-500 text-sm mb-1">No tasks or events to display.</p>
        <p className="text-gray-400 text-sm">Tasks with due dates and events with a start date will appear here.</p>
      </div>
    </div>
  );

  if (rows.length === 0 || allMs.length === 0) return emptyState;

  const minMs = Math.min(...allMs);
  const maxMs = Math.max(...allMs);

  const viewStart = new Date(startOfDay(minMs));
  viewStart.setDate(viewStart.getDate() - 7);
  const viewEnd = new Date(startOfDay(maxMs));
  viewEnd.setDate(viewEnd.getDate() + 14);

  const totalDays  = Math.ceil((viewEnd.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24));
  const totalWidth = totalDays * DAY_WIDTH;

  function dayOffset(ts) {
    if (!ts) return 0;
    const ms = toMs(ts);
    return Math.floor((startOfDay(ms) - viewStart.getTime()) / (1000 * 60 * 60 * 24));
  }

  const weeks = [];
  const cur = new Date(viewStart);
  const dow = cur.getDay();
  cur.setDate(cur.getDate() + (dow === 1 ? 0 : dow === 0 ? 1 : 8 - dow));
  while (cur <= viewEnd) {
    weeks.push(new Date(cur));
    cur.setDate(cur.getDate() + 7);
  }

  const todayOffset = dayOffset(new Date());

  function isSelected(row) {
    return selected?.type === row.type && selected?.id === row.id;
  }

  function renderGridlines() {
    return (
      <>
        {weeks.map((week, i) => (
          <div key={i} className="absolute top-0 h-full border-l border-gray-100"
            style={{ left: dayOffset(week) * DAY_WIDTH }} />
        ))}
        {todayOffset >= 0 && todayOffset <= totalDays && (
          <div className="absolute top-0 h-full w-0.5 bg-red-100"
            style={{ left: todayOffset * DAY_WIDTH }} />
        )}
      </>
    );
  }

  return (
    <div className="flex gap-6">
      {/* Gantt chart */}
      <div className="flex-1 min-w-0">
        {deptOptions.length > 0 && (
          <div className="mb-4">
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="all">All departments</option>
              {deptOptions.map(([id, dept]) => (
                <option key={id} value={id}>{dept.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex">
            {/* Fixed label column */}
            <div className="flex-shrink-0 z-10 bg-white" style={{ width: LABEL_WIDTH }}>
              <div className="h-10 border-b border-r border-gray-200 bg-gray-50 px-3 flex items-center">
                <span className="text-xs font-medium text-gray-500">Task / Event</span>
              </div>
              {rows.map(row => (
                <div key={`${row.type}-${row.id}`}
                  className={`border-b border-r border-gray-100 px-3 flex items-center gap-1.5 cursor-pointer transition-colors ${isSelected(row) ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => setSelected(isSelected(row) ? null : { type: row.type, id: row.id, data: row.data })}
                >
                  {row.type === 'event' && (
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: (row.data.departmentId && departments[row.data.departmentId]?.colorCode) || '#7c3aed' }} />
                  )}
                  <p className="text-sm text-gray-900 truncate font-medium">{row.data.title}</p>
                </div>
              ))}
            </div>

            {/* Scrollable timeline */}
            <div className="flex-1 overflow-x-auto">
              <div style={{ width: totalWidth, position: 'relative' }}>
                {/* Week header */}
                <div className="h-10 border-b border-gray-200 bg-gray-50 relative" style={{ width: totalWidth }}>
                  {weeks.map((week, i) => (
                    <div key={i} className="absolute top-0 h-full flex items-center border-l border-gray-200"
                      style={{ left: dayOffset(week) * DAY_WIDTH }}>
                      <span className="text-xs text-gray-500 ml-1.5 whitespace-nowrap">{formatShort(week)}</span>
                    </div>
                  ))}
                  {todayOffset >= 0 && todayOffset <= totalDays && (
                    <div className="absolute top-0 h-full w-0.5 bg-red-400 z-10"
                      style={{ left: todayOffset * DAY_WIDTH }} />
                  )}
                </div>

                {/* Task rows */}
                {rows.filter(r => r.type === 'task').map(row => {
                  const task         = row.data;
                  const dept         = (task.departmentId || task.department) ? departments[task.departmentId || task.department] : null;
                  const color        = dept?.colorCode || '#6366f1';
                  const startOffset  = task.assignedOnDate ? dayOffset(task.assignedOnDate) : dayOffset(task.dueByDate);
                  const endOffset    = dayOffset(task.dueByDate);
                  const barLeft      = startOffset * DAY_WIDTH;
                  const barWidth     = Math.max(DAY_WIDTH * 2, (endOffset - startOffset + 1) * DAY_WIDTH);
                  const rowSelected  = isSelected(row);

                  return (
                    <div key={`task-${task.id}`}
                      className={`border-b border-gray-100 relative transition-colors ${rowSelected ? 'bg-indigo-50' : ''}`}
                      style={{ height: ROW_HEIGHT, width: totalWidth }}
                    >
                      {renderGridlines()}
                      <button
                        onClick={() => setSelected(rowSelected ? null : { type: 'task', id: task.id, data: task })}
                        title={task.title}
                        className="absolute top-3 rounded flex items-center px-2 overflow-hidden hover:opacity-90 transition-opacity"
                        style={{
                          left: barLeft,
                          width: barWidth,
                          height: ROW_HEIGHT - 24,
                          backgroundColor: `${color}28`,
                          borderLeft: `3px solid ${color}`,
                          outline: rowSelected ? `2px solid ${color}` : 'none',
                        }}
                      >
                        <span className="text-xs font-medium truncate" style={{ color }}>
                          {task.title}
                        </span>
                      </button>
                    </div>
                  );
                })}

                {/* Event rows: multi-day events render as a dashed-outline duration bar
                    (distinct from a task's solid tinted bar); single-day events render
                    as a small diamond marker, since a 1-day bar doesn't read well next
                    to multi-day bars on the same axis. */}
                {rows.filter(r => r.type === 'event').map(row => {
                  const event        = row.data;
                  const dept         = event.departmentId ? departments[event.departmentId] : null;
                  const color        = dept?.colorCode || '#7c3aed';
                  const startOffset  = dayOffset(event.startDate);
                  const endOffset    = dayOffset(event.endDate);
                  const isSingleDay  = endOffset <= startOffset;
                  const rowSelected  = isSelected(row);

                  return (
                    <div key={`event-${event.id}`}
                      className={`border-b border-gray-100 relative transition-colors ${rowSelected ? 'bg-indigo-50' : ''}`}
                      style={{ height: ROW_HEIGHT, width: totalWidth }}
                    >
                      {renderGridlines()}
                      {isSingleDay ? (
                        <button
                          onClick={() => setSelected(rowSelected ? null : { type: 'event', id: event.id, data: event })}
                          title={event.title}
                          className="absolute top-1/2 rounded-sm rotate-45 hover:scale-110 transition-transform"
                          style={{
                            left: startOffset * DAY_WIDTH + DAY_WIDTH / 2 - EVENT_MARKER_SIZE / 2,
                            width: EVENT_MARKER_SIZE,
                            height: EVENT_MARKER_SIZE,
                            marginTop: -EVENT_MARKER_SIZE / 2,
                            backgroundColor: color,
                            outline: rowSelected ? `2px solid ${color}` : 'none',
                          }}
                        />
                      ) : (
                        <button
                          onClick={() => setSelected(rowSelected ? null : { type: 'event', id: event.id, data: event })}
                          title={event.title}
                          className="absolute top-3 rounded-full flex items-center px-2 overflow-hidden bg-white hover:bg-gray-50 transition-colors"
                          style={{
                            left: startOffset * DAY_WIDTH,
                            width: (endOffset - startOffset + 1) * DAY_WIDTH,
                            height: ROW_HEIGHT - 24,
                            border: `2px dashed ${color}`,
                            outline: rowSelected ? `2px solid ${color}` : 'none',
                          }}
                        >
                          <span className="text-xs font-medium truncate" style={{ color }}>
                            {event.title}
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-72 flex-shrink-0">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-start justify-between gap-2 mb-4">
              <h3 className="text-sm font-semibold text-gray-900 leading-snug">{selected.data.title}</h3>
              <button onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {selected.type === 'task' && (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Due</p>
                  <p className="text-gray-700">{formatDetailDate(selected.data.dueByDate)}</p>
                </div>
                {selected.data.assignedOnDate && (
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Assigned on</p>
                    <p className="text-gray-700">{formatDetailDate(selected.data.assignedOnDate)}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Status</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[selected.data.status] || STATUS_STYLES.not_started}`}>
                    {STATUS_LABELS[selected.data.status] || 'Not started'}
                  </span>
                </div>
                {(selected.data.departmentId || selected.data.department) && departments[selected.data.departmentId || selected.data.department] && (
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Department</p>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: departments[selected.data.departmentId || selected.data.department].colorCode || '#6366f1' }} />
                      <span className="text-gray-700">{departments[selected.data.departmentId || selected.data.department].name}</span>
                    </div>
                  </div>
                )}
                {selected.data.description && (
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Description</p>
                    <p className="text-gray-700 leading-relaxed">{selected.data.description}</p>
                  </div>
                )}
              </div>
            )}

            {selected.type === 'event' && (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">
                    {formatDetailDateShort(selected.data.startDate) === formatDetailDateShort(selected.data.endDate) ? 'Date' : 'Dates'}
                  </p>
                  <p className="text-gray-700">
                    {formatDetailDateShort(selected.data.startDate) === formatDetailDateShort(selected.data.endDate)
                      ? formatDetailDate(selected.data.startDate)
                      : `${formatDetailDateShort(selected.data.startDate)} – ${formatDetailDateShort(selected.data.endDate)}`}
                  </p>
                </div>
                {(selected.data.startTime || selected.data.endTime) && (
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Time</p>
                    <p className="text-gray-700">
                      {formatTime(selected.data.startTime)}
                      {selected.data.endTime ? ` – ${formatTime(selected.data.endTime)}` : ''}
                    </p>
                  </div>
                )}
                {selected.data.location && (
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Location</p>
                    <p className="text-gray-700">{selected.data.location}</p>
                  </div>
                )}
                {selected.data.departmentId && departments[selected.data.departmentId] && (
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Department</p>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: departments[selected.data.departmentId].colorCode || '#7c3aed' }} />
                      <span className="text-gray-700">{departments[selected.data.departmentId].name}</span>
                    </div>
                  </div>
                )}
                {selected.data.recurrence?.enabled && (
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Repeats</p>
                    <p className="text-gray-700 capitalize">{selected.data.recurrence.frequency}</p>
                  </div>
                )}
                {selected.data.description && (
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Description</p>
                    <p className="text-gray-700 leading-relaxed">{selected.data.description}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
