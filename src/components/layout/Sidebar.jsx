import React from 'react'
import { useAuth } from '../../contexts/AuthContext'

const NAV_ITEMS = [
  { key: 'home',        label: 'Home',                   emoji: '🏠' },
  { key: 'productions', label: 'Productions',            emoji: '🎭' },
  {
    key: 'volunteers-group',
    label: 'Volunteers',
    emoji: '🙋',
    children: [
      { key: 'volunteer-list',    label: 'Volunteer List'    },
      { key: 'invite-volunteer',  label: 'Invite Volunteer'  },
    ],
  },
  { key: 'lobby',       label: 'Lobby',                  emoji: '🏛️' },
  { key: 'bar-program', label: 'Bar Program',            emoji: '🍹' },
  {
    key: 'inventory-group',
    label: 'Inventory and Ordering',
    emoji: '📦',
    children: [
      { key: 'inventory-beverages',   label: 'Beverages'               },
      { key: 'inventory-concessions', label: 'Concessions and Snacks'  },
      { key: 'inventory-merch',       label: 'Merch'                   },
    ],
  },
  { key: 'promo', label: 'Promo', emoji: '📣' },
  {
    key: 'collaborators-group',
    label: 'Collaborators',
    emoji: '👥',
    children: [
      { key: 'collaborator-list',    label: 'Collaborator List'    },
      { key: 'invite-collaborator',  label: 'Invite Collaborator'  },
    ],
  },
  { key: 'settings', label: 'Settings', emoji: '⚙️' },
]

// Returns true if any child of item matches activeSection
function hasActiveChild(item, activeSection) {
  return item.children?.some((c) => c.key === activeSection) ?? false
}

export default function Sidebar({ activeSection, onNavigate, sidebarOpen }) {
  const { userProfile, logout } = useAuth()

  async function handleSignOut() {
    await logout()
  }

  function handleParentClick(item) {
    if (item.children) {
      // Navigate to first child; submenu will open because a child is now active
      onNavigate(item.children[0].key)
    } else {
      onNavigate(item.key)
    }
  }

  return (
    <aside
      className={[
        // Base: fixed on mobile so it overlays content
        'fixed inset-y-0 left-0 z-30 w-64 flex flex-col bg-gray-900',
        // Slide transition on mobile
        'transform transition-transform duration-200 ease-in-out',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        // On desktop: static (in normal flow), always visible
        'md:static md:inset-y-auto md:z-auto md:translate-x-0',
      ].join(' ')}
    >
      {/* Logo + user info */}
      <div className="flex-shrink-0 px-5 pt-6 pb-5 border-b border-gray-700">
        <p className="text-white font-bold text-base leading-tight tracking-tight">
          Open the House
        </p>
        <p className="text-gray-400 text-xs mt-3 truncate">{userProfile?.email}</p>
        <p className="text-amber-500 text-xs capitalize mt-0.5">{userProfile?.role}</p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const childActive   = hasActiveChild(item, activeSection)
          const isLeafActive  = !item.children && item.key === activeSection
          const parentLit     = childActive

          return (
            <div key={item.key}>
              {/* Parent / leaf row */}
              <button
                onClick={() => handleParentClick(item)}
                className={[
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left',
                  isLeafActive
                    ? 'bg-amber-600 text-white'
                    : parentLit
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white',
                ].join(' ')}
              >
                <span className="text-base leading-none w-5 text-center flex-shrink-0">
                  {item.emoji}
                </span>
                <span className="flex-1 leading-snug">{item.label}</span>
                {item.children && (
                  <span className="text-xs opacity-50 flex-shrink-0">
                    {childActive ? '▾' : '▸'}
                  </span>
                )}
              </button>

              {/* Submenu — visible when a child is active */}
              {item.children && childActive && (
                <div className="mt-0.5 ml-8 space-y-0.5">
                  {item.children.map((child) => (
                    <button
                      key={child.key}
                      onClick={() => onNavigate(child.key)}
                      className={[
                        'w-full flex items-center px-3 py-1.5 rounded-lg text-sm transition-colors text-left',
                        activeSection === child.key
                          ? 'bg-amber-500 text-white font-semibold'
                          : 'text-gray-400 hover:bg-gray-800 hover:text-white',
                      ].join(' ')}
                    >
                      {child.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="flex-shrink-0 px-3 pb-5 pt-3 border-t border-gray-700">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors text-left"
        >
          <span className="text-base leading-none w-5 text-center flex-shrink-0">🚪</span>
          Sign out
        </button>
      </div>
    </aside>
  )
}
