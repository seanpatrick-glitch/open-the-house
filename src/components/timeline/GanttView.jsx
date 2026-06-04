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

function formatDetailDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
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

export default function GanttView({ tasks, departments }) {
  const [deptFilter, setDeptFilter]     = useState('all');
  const [selectedTask, setSelectedTask] = useState(null);

  const filteredTasks = deptFilter === 'all'
    ? tasks
    : tasks.filter(t => t.department === deptFilter);

  const deptOptions = Object.entries(departments);

  const allMs = filteredTasks
    .flatMap(t => [t.startDate, t.dueDate].filter(Boolean).map(toMs))
    .filter(Boolean);

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
        <p className="text-gray-500 text-sm mb-1">No tasks to display.</p>
        <p className="text-gray-400 text-sm">Tasks with due dates will appear here.</p>
      </div>
    </div>
  );

  if (filteredTasks.length === 0 || allMs.length === 0) return emptyState;

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
                <span className="text-xs font-medium text-gray-500">Task</span>
              </div>
              {filteredTasks.map(task => (
                <div key={task.id}
                  className={`border-b border-r border-gray-100 px-3 flex items-center cursor-pointer transition-colors ${selectedTask?.id === task.id ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => setSelectedTask(selectedTask?.id === task.id ? null : task)}
                >
                  <p className="text-sm text-gray-900 truncate font-medium">{task.title}</p>
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
                {filteredTasks.map(task => {
                  const dept         = task.department ? departments[task.department] : null;
                  const color        = dept?.colorCode || '#6366f1';
                  const startOffset  = task.startDate ? dayOffset(task.startDate) : dayOffset(task.dueDate);
                  const endOffset    = dayOffset(task.dueDate);
                  const barLeft      = startOffset * DAY_WIDTH;
                  const barWidth     = Math.max(DAY_WIDTH * 2, (endOffset - startOffset + 1) * DAY_WIDTH);
                  const isSelected   = selectedTask?.id === task.id;

                  return (
                    <div key={task.id}
                      className={`border-b border-gray-100 relative transition-colors ${isSelected ? 'bg-indigo-50' : ''}`}
                      style={{ height: ROW_HEIGHT, width: totalWidth }}
                    >
                      {weeks.map((week, i) => (
                        <div key={i} className="absolute top-0 h-full border-l border-gray-100"
                          style={{ left: dayOffset(week) * DAY_WIDTH }} />
                      ))}
                      {todayOffset >= 0 && todayOffset <= totalDays && (
                        <div className="absolute top-0 h-full w-0.5 bg-red-100"
                          style={{ left: todayOffset * DAY_WIDTH }} />
                      )}
                      <button
                        onClick={() => setSelectedTask(isSelected ? null : task)}
                        title={task.title}
                        className="absolute top-3 rounded flex items-center px-2 overflow-hidden hover:opacity-90 transition-opacity"
                        style={{
                          left: barLeft,
                          width: barWidth,
                          height: ROW_HEIGHT - 24,
                          backgroundColor: `${color}28`,
                          borderLeft: `3px solid ${color}`,
                          outline: isSelected ? `2px solid ${color}` : 'none',
                        }}
                      >
                        <span className="text-xs font-medium truncate" style={{ color }}>
                          {task.title}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selectedTask && (
        <div className="w-72 flex-shrink-0">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-start justify-between gap-2 mb-4">
              <h3 className="text-sm font-semibold text-gray-900 leading-snug">{selectedTask.title}</h3>
              <button onClick={() => setSelectedTask(null)}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Due</p>
                <p className="text-gray-700">{formatDetailDate(selectedTask.dueDate)}</p>
              </div>
              {selectedTask.startDate && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Starts</p>
                  <p className="text-gray-700">{formatDetailDate(selectedTask.startDate)}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Status</p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[selectedTask.status] || STATUS_STYLES.not_started}`}>
                  {STATUS_LABELS[selectedTask.status] || 'Not started'}
                </span>
              </div>
              {selectedTask.department && departments[selectedTask.department] && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Department</p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: departments[selectedTask.department].colorCode || '#6366f1' }} />
                    <span className="text-gray-700">{departments[selectedTask.department].name}</span>
                  </div>
                </div>
              )}
              {selectedTask.description && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Description</p>
                  <p className="text-gray-700 leading-relaxed">{selectedTask.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
