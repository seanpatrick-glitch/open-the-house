import { useState } from 'react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function sameDay(ts, year, month, day) {
  if (!ts) return false;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
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

export default function CalendarGrid({ tasks, departments }) {
  const today = new Date();
  const [year, setYear]               = useState(today.getFullYear());
  const [month, setMonth]             = useState(today.getMonth());
  const [selectedTask, setSelectedTask] = useState(null);
  const [deptFilter, setDeptFilter]   = useState('all');

  const filteredTasks = deptFilter === 'all'
    ? tasks
    : tasks.filter(t => t.department === deptFilter);

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth    = new Date(year, month + 1, 0).getDate();
  const cells = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const deptOptions = Object.entries(departments);

  return (
    <div className="flex gap-6">
      {/* Calendar */}
      <div className="flex-1 min-w-0">
        {/* Controls */}
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="p-1.5 rounded hover:bg-gray-100 text-gray-600 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-gray-900 w-36 text-center">
              {MONTHS[month]} {year}
            </span>
            <button onClick={nextMonth} className="p-1.5 rounded hover:bg-gray-100 text-gray-600 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {deptOptions.length > 0 && (
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
          )}
        </div>

        {/* Grid */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-200">
            {DAYS.map(d => (
              <div key={d} className="py-2 text-center text-xs font-medium text-gray-500">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              const isToday = day && new Date().getFullYear() === year && new Date().getMonth() === month && new Date().getDate() === day;
              const dayTasks = day ? filteredTasks.filter(t => sameDay(t.dueDate, year, month, day)) : [];

              return (
                <div
                  key={i}
                  className={`min-h-[80px] p-1.5 border-b border-r border-gray-100 ${!day ? 'bg-gray-50' : ''}`}
                >
                  {day && (
                    <>
                      <p className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white' : 'text-gray-600'}`}>
                        {day}
                      </p>
                      <div className="space-y-0.5">
                        {dayTasks.map(task => {
                          const dept = task.department ? departments[task.department] : null;
                          return (
                            <button
                              key={task.id}
                              onClick={() => setSelectedTask(task)}
                              className="w-full text-left text-xs px-1.5 py-0.5 rounded truncate font-medium hover:opacity-80 transition-opacity"
                              style={{
                                backgroundColor: dept?.colorCode ? `${dept.colorCode}25` : '#e0e7ff',
                                color: dept?.colorCode || '#4f46e5',
                              }}
                            >
                              {task.title}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selectedTask && (
        <div className="w-72 flex-shrink-0">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-start justify-between gap-2 mb-4">
              <h3 className="text-sm font-semibold text-gray-900 leading-snug">{selectedTask.title}</h3>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0 transition-colors"
              >
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
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: departments[selectedTask.department].colorCode || '#6366f1' }} />
                    <span className="text-gray-700">{departments[selectedTask.department].name}</span>
                  </div>
                </div>
              )}

              {selectedTask.description && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Description</p>
                  <p className="text-gray-700 text-sm leading-relaxed">{selectedTask.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
