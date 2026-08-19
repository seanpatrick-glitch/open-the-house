import React, { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import AdminView from '../views/AdminView'
import CollaboratorView from '../views/CollaboratorView'
import PersonView from '../views/PersonView'
import OnboardingWizard from '../components/onboarding/OnboardingWizard'
import FeedbackWidget from '../components/shared/FeedbackWidget'

// Original-admin first-run onboarding check. Only the org's original owner
// (ownerId match on the organizations doc, set at creation in SignupStep3.jsx)
// with onboardingCompleted still false is routed into the wizard — a
// secondary admin invited later into the same org never matches ownerId, so
// they always fall through to AdminView regardless of this field's value.
// Missing onboardingCompleted (orgs created before this field existed)
// resolves to true via `?? true`, not false, so no pre-existing org's admin
// is retroactively routed into the wizard on their next login.
function useOriginalAdminOnboarding(userProfile) {
  const isAdminRole = userProfile?.role === 'admin'
  const [orgData, setOrgData] = useState(null)
  const [orgLoading, setOrgLoading] = useState(isAdminRole)

  useEffect(() => {
    if (!isAdminRole || !userProfile?.orgId) {
      setOrgData(null)
      setOrgLoading(false)
      return
    }

    setOrgLoading(true)
    const unsub = onSnapshot(
      doc(db, 'organizations', userProfile.orgId),
      (snap) => {
        setOrgData(snap.exists() ? snap.data() : null)
        setOrgLoading(false)
      },
      (error) => {
        console.error('AuthRouter org listener error:', error)
        setOrgData(null)
        setOrgLoading(false)
      }
    )
    return unsub
  }, [isAdminRole, userProfile?.orgId])

  const showOnboarding =
    isAdminRole &&
    !!orgData &&
    orgData.ownerId === userProfile.uid &&
    (orgData.onboardingCompleted ?? true) === false

  return { orgLoading: isAdminRole && orgLoading, showOnboarding }
}

export default function AuthRouter() {
  const { userProfile, loading } = useAuth()
  const { orgLoading, showOnboarding } = useOriginalAdminOnboarding(userProfile)

  if (loading || orgLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white text-base">Loading...</p>
      </div>
    )
  }

  if (!userProfile) {
    return <Navigate to="/" replace />
  }

  if (showOnboarding) return <OnboardingWizard orgId={userProfile.orgId} />

  let view = null
  if (userProfile.role === 'admin')             view = <AdminView />
  if (userProfile.role === 'secondaryAdmin')    view = <AdminView />
  if (userProfile.role === 'departmentHead')    view = <AdminView />
  if (userProfile.role === 'orgCollaborator')   view = <CollaboratorView />
  if (userProfile.role === 'collaborator')      view = <CollaboratorView />
  if (userProfile.role === 'venueManager')      view = <AdminView />
  if (userProfile.role === 'productionCollaborator') view = <CollaboratorView />
  if (userProfile.role === 'volunteer')         view = <PersonView />
  if (userProfile.role === 'person')            view = <PersonView />

  // FeedbackWidget is mounted once here, for every recognized role, rather
  // than duplicated inside DashboardShell/CollaboratorView/PersonView —
  // those are three separate top-level render trees with no shared shell.
  if (view) {
    return (
      <>
        {view}
        <FeedbackWidget />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <p className="text-white text-base text-center">
        Account not configured. Contact your administrator.
      </p>
    </div>
  )
}
