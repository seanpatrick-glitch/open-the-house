import React, { useState } from 'react'
import Sidebar from './Sidebar'
import HomeView from '../dashboard/HomeView'
import InviteCollaborator from '../invites/InviteCollaborator'
import InviteVolunteer from '../invites/InviteVolunteer'

// Section key → human-readable label for placeholder screens
const SECTION_LABELS = {
  productions:             'Productions',
  'volunteer-list':        'Volunteer List',
  lobby:                   'Lobby',
  'bar-program':           'Bar Program',
  'inventory-beverages':   'Beverages',
  'inventory-concessions': 'Concessions and Snacks',
  'inventory-merch':       'Merch',
  promo:                   'Promo',
  'collaborator-list':     'Collaborator List',
  settings:                'Settings',
}

function PlaceholderSection({ section }) {
  const label = SECTION_LABELS[section] ?? section
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">{label}</h1>
      <p className="text-gray-500 mt-2">Coming soon.</p>
    </div>
  )
}

function SectionContent({ section, onNavigate }) {
  if (section === 'home')               return <HomeView onNavigate={onNavigate} />
  if (section === 'invite-collaborator') return <InviteCollaborator />
  if (section === 'invite-volunteer')    return <InviteVolunteer />
  return <PlaceholderSection section={section} />
}

export default function DashboardShell() {
  const [activeSection, setActiveSection] = useState('home')
  const [sidebarOpen,   setSidebarOpen]   = useState(false)

  function handleNavigate(section) {
    setActiveSection(section)
    setSidebarOpen(false) // always close mobile sidebar on navigation
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">

      {/* Mobile backdrop — clicking outside sidebar closes it */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        activeSection={activeSection}
        onNavigate={handleNavigate}
        sidebarOpen={sidebarOpen}
      />

      {/* Right column: mobile header + scrollable content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile header — hamburger + logo, hidden on desktop */}
        <header className="md:hidden flex-shrink-0 flex items-center gap-3 px-4 h-14 bg-white border-b border-gray-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-600 hover:text-gray-900 transition-colors p-1 -ml-1"
            aria-label="Open navigation"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 22 22"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="2" y1="5"  x2="20" y2="5"  />
              <line x1="2" y1="11" x2="20" y2="11" />
              <line x1="2" y1="17" x2="20" y2="17" />
            </svg>
          </button>
          <span className="text-gray-900 font-semibold text-base">Open the House</span>
        </header>

        {/* Scrollable content area */}
        <main className="flex-1 overflow-y-auto p-6">
          <SectionContent section={activeSection} onNavigate={handleNavigate} />
        </main>

      </div>
    </div>
  )
}
