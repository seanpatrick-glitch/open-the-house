import { useState } from 'react';

const DAY_WIDTH = 28;
const ROW_HEIGHT = 44;
const LABEL_WIDTH = 200;

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

export default function GanttView({ tasks, departments }) {
  const [deptFilter, setDeptFilter] = useState('all');

  const filteredTasks = deptFilter === 'all'
    ? tasks
    : tasks.filter(t => t.department === deptFilter);

  const deptOptions = Object.entries(departments);

  const allMs = filteredTasks
    .flatMap(t => [t.startDate, t.dueDate].filter(Boolean).map(toMs))
    .filter(Boolean);

  if (filteredTasks.length === 0 || allMs.length === 0) {
    return (
      <div>
        {deptOptions.length > 0 && (
          <div className="mb-4">
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All departments</option>
              {deptOptions.map(([id, dept]) => (
                <option key={id} value={id}>{dept.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <p className="text-gray-500 text-sm mb-1">No tasks to display.</p>
          <p className="text-gray-400 text-sm">Tasks with due dates will appear here.</p>
        </div>
      </div>
    );
  }

  const minMs = Math.min(...allMs);
  const maxMs = Math.max(...allMs);

  const viewStart = new Date(startOfDay(minMs));
  viewStart.setDate(viewStart.getDate() - 7);
  const viewEnd = new Date(startOfDay(maxMs));
  viewEnd.setDate(viewEnd.getDate() + 14);

  const totalDays = Math.ceil((viewEnd.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24));
  const totalWidth = totalDays * DAY_WIDTH;

  function dayOffset(ts) {
    if (!ts) return 0;
    const ms = toMs(ts);
    return Math.floor((startOfDay(ms) - viewStart.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Generate week markers starting from first Monday on or after viewStart
  const weeks = [];
  const cur = new Date(viewStart);
  const dow = cur.getDay();
  cur.setDate(cur.getDate() + (dow === 1 ? 0 : dow === 0 ? 1 : 8 - dow));
  while (cur <= viewEnd) {
    weeks.push(new Date(cur));
    cur.setDate(cur.getDate() + 7);
  }

  const todayOffset = dayOffset(new Date());

  return (
    <div>
      {deptOptions.length > 0 && (
        <div className="mb-4">
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
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
              <span className="text-xs font-medium text-gray-500">Task</span>
            </div>
            {filteredTasks.map(task => (
              <div
                key={task.id}
                className="border-b border-r border-gray-100 px-3 flex items-center"
                style={{ height: ROW_HEIGHT }}
              >
                <p className="text-sm text-gray-900 truncate font-medium">{task.title}</p>
              </div>
            ))}
          </div>

          {/* Scrollable timeline */}
          <div className="flex-1 overflow-x-auto">
            <div style={{ width: totalWidth, position: 'relative' }}>
              {/* Week header row */}
              <div className="h-10 border-b border-gray-200 bg-gray-50 relative" style={{ width: totalWidth }}>
                {weeks.map((week, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full flex items-center border-l border-gray-200"
                    style={{ left: dayOffset(week) * DAY_WIDTH }}
                  >
                    <span className="text-xs text-gray-500 ml-1.5 whitespace-nowrap">{formatShort(week)}</span>
                  </div>
                ))}
                {todayOffset >= 0 && todayOffset <= totalDays && (
                  <div
                    className="absolute top-0 h-full w-0.5 bg-red-400 z-10"
                    style={{ left: todayOffset * DAY_WIDTH }}
                  />
                )}
              </div>

              {/* Task rows */}
              {filteredTasks.map(task => {
                const dept = task.department ? departments[task.department] : null;
                const color = dept?.colorCode || '#6366f1';
                const startOffset = task.startDate ? dayOffset(task.startDate) : dayOffset(task.dueDate);
                const endOffset = dayOffset(task.dueDate);
                const barLeft = startOffset * DAY_WIDTH;
                const barWidth = Math.max(DAY_WIDTH, (endOffset - startOffset + 1) * DAY_WIDTH);

                return (
                  <div
                    key={task.id}
                    className="border-b border-gray-100 relative"
                    style={{ height: ROW_HEIGHT, width: totalWidth }}
                  >
                    {weeks.map((week, i) => (
                      <div
                        key={i}
                        className="absolute top-0 h-full border-l border-gray-100"
                        style={{ left: dayOffset(week) * DAY_WIDTH }}
                      />
                    ))}
                    {todayOffset >= 0 && todayOffset <= totalDays && (
                      <div
                        className="absolute top-0 h-full w-0.5 bg-red-100"
                        style={{ left: todayOffset * DAY_WIDTH }}
                      />
                    )}
                    <div
                      className="absolute top-3 rounded flex items-center px-2 overflow-hidden"
                      style={{
                        left: barLeft,
                        width: barWidth,
                        height: ROW_HEIGHT - 24,
                        backgroundColor: `${color}28`,
                        borderLeft: `3px solid ${color}`,
                      }}
                    >
                      <span className="text-xs font-medium truncate" style={{ color }}>
                        {task.title}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
