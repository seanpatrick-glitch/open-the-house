// UnreadContext.jsx — exposes the current user's unread message count to any
// screen inside DashboardShell (Sidebar badge, dashboard callout cards).

import React, { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';
import { useUnreadCount } from '../hooks/useUnreadCount';

const UnreadContext = createContext(0);

export function useUnread() {
  return useContext(UnreadContext);
}

export function UnreadProvider({ children }) {
  const { userProfile } = useAuth();
  const unreadCount = useUnreadCount(userProfile?.uid, userProfile?.orgId);

  return (
    <UnreadContext.Provider value={unreadCount}>
      {children}
    </UnreadContext.Provider>
  );
}
