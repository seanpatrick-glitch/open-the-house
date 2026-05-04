import React from 'react'

const PLACEHOLDER_PRODUCTIONS = [
  {
    id: 1,
    name: 'The Tempest',
    status: 'In Prep',
    openingNight: 'June 14, 2026',
    progress: 40,
  },
  {
    id: 2,
    name: 'The Tempest',
    status: 'In Prep',
    openingNight: 'June 14, 2026',
    progress: 40,
  },
]

const PLACEHOLDER_DATES = [
  { label: 'Preview Night: The Tempest',  date: 'June 12, 2026' },
  { label: 'Opening Night: The Tempest',  date: 'June 14, 2026' },
  { label: 'Lobby Install: The Tempest',  date: 'June 10, 2026' },
]

const PLACEHOLDER_OVERDUE = [
  { id: 1, text: 'Bar guide not finalized — The Tempest' },
]

export default function HomeView({ onNavigate }) {
  return (
    <div className="space-y-8 max-w-4xl">

      {/* Section 1 — Active Productions */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Active Productions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {PLACEHOLDER_PRODUCTIONS.map((prod) => (
            <div
              key={prod.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"
            >
              <div className="flex items-start justify-between mb-3">
                <p className="font-semibold text-gray-900">{prod.name}</p>
                <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700 ml-2 flex-shrink-0">
                  {prod.status}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Opening night: {prod.openingNight}
              </p>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-amber-500 h-1.5 rounded-full"
                  style={{ width: `${prod.progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">{prod.progress}% complete</p>
            </div>
          ))}
        </div>
        <button
          onClick={() => onNavigate('productions')}
          className="text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors"
        >
          + Add Production
        </button>
      </section>

      {/* Section 2 — Upcoming Dates */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Upcoming Dates</h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
          {PLACEHOLDER_DATES.map((item, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="text-base">📅</span>
                <span className="text-sm text-gray-800">{item.label}</span>
              </div>
              <span className="text-sm text-gray-500 flex-shrink-0 ml-4">{item.date}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Section 3 — Overdue Items */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Overdue Items</h2>
        {PLACEHOLDER_OVERDUE.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-5 py-4">
            <p className="text-sm text-gray-500">All caught up.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {PLACEHOLDER_OVERDUE.map((item) => (
              <div
                key={item.id}
                className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex items-center gap-3"
              >
                <span className="text-amber-500 text-base flex-shrink-0">⚠️</span>
                <p className="text-sm text-amber-800 font-medium">{item.text}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 4 — Quick Actions */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => onNavigate('productions')}
            className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            Add Production
          </button>
          <button
            onClick={() => onNavigate('invite-collaborator')}
            className="bg-white hover:bg-gray-50 text-gray-800 text-sm font-semibold px-5 py-2.5 rounded-lg border border-gray-300 transition-colors"
          >
            Invite Someone
          </button>
          <button
            onClick={() => onNavigate('volunteer-list')}
            className="bg-white hover:bg-gray-50 text-gray-800 text-sm font-semibold px-5 py-2.5 rounded-lg border border-gray-300 transition-colors"
          >
            View Volunteers
          </button>
        </div>
      </section>

    </div>
  )
}
