import React, { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import InviteCollaborator from '../invites/InviteCollaborator'
import ProductionsView from '../productions/ProductionsView'
import DepartmentsView from '../../views/DepartmentsView'
import TimelineView from '../../views/TimelineView'
import SettingsView from '../../views/SettingsView'
import PeopleView from '../../views/PeopleView'
import CheckInView from '../checkin/CheckInView'
import MessageView from '../../views/MessageView'
import AdminDashboardView from '../../views/AdminDashboardView';
import DHDashboardView from '../../views/DHDashboardView';
import PlacesView from '../../views/PlacesView';
import { useAuth } from '../../contexts/AuthContext';
import { UnreadProvider } from '../../contexts/UnreadContext';

// Section key → human-readable label for placeholder screens
const SECTION_LABELS = {
  messages:                'Messages',
  productions:             'Productions',
  checkin:                 'Check-In',
  departments:             'Departments',
  'volunteer-list':        'Volunteer List',
  lobby:                   'Lobby',
  'bar-program':           'Bar Program',
  'inventory-beverages':   'Beverages',
  'inventory-concessions': 'Concessions and Snacks',
  'inventory-merch':       'Merch',
  promo:                   'Promo',
  'collaborator-list':     'Collaborator List',
  places:                  'Places',
  people:                  'People',
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

function SectionContent({ section, onNavigate, userProfile, navState }) {
  if (section === 'home') {
    if (userProfile?.role === 'departmentHead') return <DHDashboardView />;
    return <AdminDashboardView />;
  }
  if (section === 'messages')            return <MessageView navState={navState} />
  if (section === 'productions')        return <ProductionsView />
  if (section === 'checkin')            return <CheckInView />
  if (section === 'timeline')           return <TimelineView navState={navState} />;
  if (section === 'departments')        return <DepartmentsView onNavigate={onNavigate} />
  if (section === 'places')              return <PlacesView />;
  if (section === 'invite-collaborator') return <InviteCollaborator />
  if (section === 'collaborator-list')   return <InviteCollaborator />
  if (section === 'settings')            return <SettingsView />
  if (section === 'people')              return <PeopleView onNavigate={onNavigate} navState={navState} />
  return <PlaceholderSection section={section} />
}

export default function DashboardShell() {
  const { userProfile } = useAuth();
  const [activeSection, setActiveSection] = useState('home')
  const [sidebarOpen,   setSidebarOpen]   = useState(false)
  const [navState, setNavState] = useState(null);

  useEffect(() => {
    // Quick-action buttons dispatch { section, state } so they can carry a
    // target-form flag through the same navState mechanism department-filter
    // navigation already uses (see TimelineView's departmentFilter).
    const handler = (e) => {
      handleNavigate(e.detail.section, e.detail.state);
    };
    window.addEventListener('navigate', handler);
    return () => window.removeEventListener('navigate', handler);
  }, []);

  function handleNavigate(section, state) {
    setActiveSection(section)
    setNavState(state ?? null)
    setSidebarOpen(false) // always close mobile sidebar on navigation
  }

  return (
    <UnreadProvider>
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
            <span className="text-gray-900 font-semibold text-base">Places People!</span>
          </header>

          {/* Scrollable content area */}
          <main className="flex-1 overflow-y-auto p-6">
            <SectionContent section={activeSection} onNavigate={handleNavigate} userProfile={userProfile} navState={navState} />
          </main>

        </div>
      </div>
    </UnreadProvider>
  )
}
