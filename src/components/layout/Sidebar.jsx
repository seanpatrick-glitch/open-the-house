import React, { useEffect, useState } from 'react'
import { doc, onSnapshot, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { useUnread } from '../../contexts/UnreadContext'
import { getDisplayName } from '../../utils/displayName'
import toast from 'react-hot-toast'

const NAV_ITEMS = [
  { key: 'home',        label: 'Home',        emoji: '🏠' },
  { key: 'timeline',    label: 'Timeline',    emoji: '📅' },
  { key: 'messages',    label: 'Messages',    emoji: '💬' },
  {
    key: 'people-group',
    label: 'People',
    emoji: '🧑‍🤝‍🧑',
    children: [
      { key: 'people',            label: 'Company'      },
      { key: 'collaborator-list', label: 'Collaborators' },
    ],
  },
  { key: 'places',      label: 'Places',      emoji: '📍' },
  { key: 'departments', label: 'Departments', emoji: '🏢' },
  { key: 'productions', label: 'Productions', emoji: '🎭' },
  { key: 'settings', label: 'Settings', emoji: '⚙️' },
]

// Returns true if any child of item matches activeSection
function hasActiveChild(item, activeSection) {
  return item.children?.some((c) => c.key === activeSection) ?? false
}

export default function Sidebar({ activeSection, onNavigate, sidebarOpen }) {
  const { userProfile, logout } = useAuth()
  const unreadCount = useUnread()
  const orgId = userProfile?.orgId
  const [departmentsEnabled, setDepartmentsEnabled] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput]     = useState('')
  const [savingName, setSavingName]   = useState(false)

  async function handleSaveName() {
    if (!userProfile?.uid || !orgId) return
    setSavingName(true)
    const displayName = nameInput.trim() || userProfile.name || userProfile.email
    try {
      await updateDoc(doc(db, 'users', userProfile.uid), { displayName })
      await updateDoc(doc(db, 'organizations', orgId, 'members', userProfile.uid), { displayName })
      setEditingName(false)
    } catch (err) {
      console.error('Save display name error:', err)
      toast.error('Could not save your name. Please try again.')
    } finally {
      setSavingName(false)
    }
  }

  useEffect(() => {
    if (!orgId) return
    const orgRef = doc(db, 'organizations', orgId)
    const unsubscribe = onSnapshot(orgRef, (snap) => {
      if (snap.exists()) {
        setDepartmentsEnabled(snap.data().departmentsEnabled ?? false)
      }
    })
    return () => unsubscribe()
  }, [orgId])

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
        'fixed inset-y-0 left-0 z-30 w-64 flex flex-col bg-stage-navy',
        // Slide transition on mobile
        'transform transition-transform duration-200 ease-in-out',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        // On desktop: static (in normal flow), always visible
        'md:static md:inset-y-auto md:z-auto md:translate-x-0',
      ].join(' ')}
    >
      {/* Logo + user info */}
      <div className="flex-shrink-0 px-5 pt-6 pb-5 border-b border-white/10">
        <p className="text-house-white text-xl leading-tight tracking-tight">
          Places People!
        </p>
        {editingName ? (
          <div className="mt-3 space-y-1.5">
            <input
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              placeholder={userProfile?.email}
              autoFocus
              className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-xs font-mono text-house-white focus:outline-none focus:ring-1 focus:ring-places-blue"
            />
            <div className="flex gap-2">
              <button onClick={handleSaveName} disabled={savingName}
                className="text-xs font-medium text-places-blue hover:text-haze disabled:opacity-50 transition-colors">
                {savingName ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setEditingName(false)}
                className="text-xs text-white/50 hover:text-white/80 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setNameInput(userProfile?.displayName || ''); setEditingName(true) }}
            className="font-mono text-white/55 text-xs mt-3 truncate hover:text-white/80 transition-colors text-left"
            title="Click to edit display name"
          >
            {getDisplayName(userProfile)}
          </button>
        )}
        <p className="font-mono text-places-blue text-[10px] tracking-[.18em] uppercase mt-1.5">{userProfile?.role}</p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          if (item.key === 'departments' && !departmentsEnabled) return null
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
                    ? 'bg-places-blue text-house-white'
                    : parentLit
                      ? 'bg-white/10 text-house-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-house-white',
                ].join(' ')}
              >
                <span className="text-base leading-none w-5 text-center flex-shrink-0">
                  {item.emoji}
                </span>
                <span className="flex-1 leading-snug">{item.label}</span>
                {item.key === 'messages' && unreadCount > 0 && (
                  <span className="flex-shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-spotlight text-house-white text-xs font-semibold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
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
                          ? 'bg-places-blue text-house-white font-semibold'
                          : 'text-white/55 hover:bg-white/10 hover:text-house-white',
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
      <div className="flex-shrink-0 px-3 pb-5 pt-3 border-t border-white/10">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/55 hover:bg-white/10 hover:text-house-white transition-colors text-left"
        >
          <span className="text-base leading-none w-5 text-center flex-shrink-0">🚪</span>
          Sign out
        </button>
      </div>
    </aside>
  )
}
