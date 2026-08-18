// sendCollaboratorInvite() — creates one pendingInvite doc and sends the
// sign-in link email. Extracted from InviteCollaborator.jsx's
// handleCreateInvite so both the single-invite form and the onboarding
// wizard's batch InvitesStep.jsx share one implementation. Stateless per
// invite, so it's safe to call in a loop for a batch send.

import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { sendSignInLinkToEmail } from 'firebase/auth'
import { db, auth } from '../firebase'
import { getInviteActionCodeSettings } from './invites'

export async function sendCollaboratorInvite({ orgId, uid, email, role, departmentId = null }) {
  const orgSnap = await getDoc(doc(db, 'organizations', orgId))
  if (!orgSnap.exists()) {
    throw new Error('Could not read organization information.')
  }
  const orgName = orgSnap.data().name

  // Department Head invites use the department's own id as the pendingInvites
  // doc id, so firestore.rules can look it up deterministically when the
  // incoming head writes departmentHeadUid back onto the department doc.
  const inviteId  = role === 'departmentHead' ? departmentId : crypto.randomUUID()
  const now       = Timestamp.now()
  const expiresAt = Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1000)

  await setDoc(
    doc(db, 'organizations', orgId, 'pendingInvites', inviteId),
    {
      inviteId,
      email:        email.trim(),
      role,
      departmentId: role === 'departmentHead' ? departmentId : null,
      level:        'organization',
      scopeId:      orgId,
      orgId,
      orgName,
      createdBy:    uid,
      createdAt:    serverTimestamp(),
      expiresAt,
      status:       'pending',
    }
  )

  await sendSignInLinkToEmail(auth, email.trim(), getInviteActionCodeSettings(orgId, inviteId))
  window.localStorage.setItem('emailForSignIn', email.trim())

  return inviteId
}
