const { setGlobalOptions } = require("firebase-functions");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const { FieldPath, FieldValue } = require("firebase-admin/firestore");
const { isValidRole } = require("./roles");

admin.initializeApp();

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit.
setGlobalOptions({ maxInstances: 10 });

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Sends an alert email to the other thread participant when a new message
// is written to organizations/{orgId}/threads/{threadId}/messages/{messageId}.
exports.emailOnNewMessage = onDocumentCreated(
  "organizations/{orgId}/threads/{threadId}/messages/{messageId}",
  async (event) => {
    const message = event.data?.data();
    if (!message) return;

    const { orgId, threadId } = event.params;
    const db = admin.firestore();

    try {
      const threadSnap = await db.doc(`organizations/${orgId}/threads/${threadId}`).get();
      if (!threadSnap.exists) return;
      const thread = threadSnap.data();

      const recipientUid =
        thread.participantA === message.senderUid ? thread.participantB : thread.participantA;

      if (!recipientUid || recipientUid === message.senderUid) return;

      const preview = (message.body || "").slice(0, 200);
      const subject = `New message: ${thread.subject || "Places People"}`;
      // ?org= makes the app open the org this message belongs to, not
      // whichever org the recipient happened to use last.
      const dashboardUrl = `https://open-the-house.web.app/dashboard?org=${encodeURIComponent(orgId)}`;

      await db.collection("mail").add({
        toUids: [recipientUid],
        message: {
          subject,
          text: `You have a new message.\n\n${preview}\n\nView it at ${dashboardUrl}`,
          html: `<p>You have a new message.</p><p>${escapeHtml(preview)}</p><p><a href="${dashboardUrl}">View it in Places People</a></p>`,
        },
      });
    } catch (err) {
      logger.error("emailOnNewMessage failed", { orgId, threadId, error: err.message });
    }
  }
);

// Alerts the Places People team when a new Bug/Feedback report is
// submitted via the in-app widget, to organizations/{orgId}/feedback/{feedbackId}.
// Looks up the team member's uid dynamically each time (Firestore users
// collection, email == "seanpatrickphilibin@gmail.com") rather than
// hardcoding it, since a hardcoded uid could go stale if that account is
// ever recreated. Missing team account is logged, not thrown — a lookup
// failure here must never block the feedback submission itself, which has
// already succeeded by the time this trigger runs.
exports.emailOnNewFeedback = onDocumentCreated(
  "organizations/{orgId}/feedback/{feedbackId}",
  async (event) => {
    const feedback = event.data?.data();
    if (!feedback) return;

    const { orgId } = event.params;
    const db = admin.firestore();

    try {
      const teamSnap = await db
        .collection("users")
        .where("email", "==", "seanpatrickphilibin@gmail.com")
        .limit(1)
        .get();

      if (teamSnap.empty) {
        logger.error("emailOnNewFeedback: no user found with the internal team email", { orgId });
        return;
      }

      const toUid = teamSnap.docs[0].id;
      const typeLabel = feedback.type === "bug" ? "Bug" : "Feedback";
      const orgName = feedback.orgName || "Unknown organization";
      const subject = `${typeLabel} report: ${orgName}`;
      const description = feedback.description || "";

      const contextLines = [
        `Organization: ${orgName} (${orgId})`,
        `Submitted by: ${feedback.submitterEmail || "unknown email"} (uid ${feedback.createdBy || "unknown"}), role ${feedback.submitterRole || "unknown"}`,
        `Page: ${feedback.page || "unknown"}`,
      ];

      await db.collection("mail").add({
        toUids: [toUid],
        message: {
          subject,
          text: `${description}\n\n${contextLines.join("\n")}`,
          html: `<p>${escapeHtml(description).replace(/\n/g, "<br>")}</p><p>${contextLines.map(escapeHtml).join("<br>")}</p>`,
        },
      });
    } catch (err) {
      logger.error("emailOnNewFeedback failed", { orgId, error: err.message });
    }
  }
);

// Admin-only data scrub for one organization. Deletes productions, places,
// people, personTypes, departments, tasks, timelineTemplates, threads
// (with messages), broadcasts, and checkins — everything a test/seed org
// accumulates during setup. Does NOT touch the organization document itself,
// its members/collaborators, or its settings (activeProdId,
// dashboardStateOverride, departmentsEnabled, name, etc.) — this is a data
// scrub, not an org deletion. personTypes has no system-default concept in
// the schema (checked models/people.js: label, description, orgId,
// departmentHeadId, departmentId, createdBy, createdAt, active,
// universalFields, toggleableFields, customFields — nothing resembling a
// protected/default flag), so every personType document is deleted
// unconditionally.
//
// Runs server-side via the Admin SDK specifically because several of these
// collections nest multiple levels of subcollections (tasks alone can carry
// up to six: comments, clarificationFlags, accessRequests, handoffs,
// history, notes; people has internalData and hours; threads has messages;
// places has productions) and because a real org can accumulate far more
// documents than a single 500-op client batch can hold. admin.firestore()
// bypasses firestore.rules entirely, so authorization is enforced here in
// code — never trust request.data for the caller's role.
exports.resetOrganization = onCall({ timeoutSeconds: 300, memory: "256MiB" }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const { orgId, confirmName } = request.data || {};
  if (!orgId || typeof orgId !== "string") {
    throw new HttpsError("invalid-argument", "orgId is required.");
  }

  const db = admin.firestore();

  const userSnap = await db.doc(`users/${uid}`).get();
  const role = userSnap.exists ? userSnap.data()?.organizations?.[orgId]?.role : null;
  if (role !== "admin" && role !== "secondaryAdmin") {
    throw new HttpsError("permission-denied", "Only an admin can reset organization data.");
  }

  const orgSnap = await db.doc(`organizations/${orgId}`).get();
  if (!orgSnap.exists) {
    throw new HttpsError("not-found", "Organization not found.");
  }
  const orgName = orgSnap.data()?.name || "";

  // Mirrors the UI's type-to-confirm gate server-side, so a scripted or
  // buggy client can never skip confirmation.
  if (!confirmName || confirmName !== orgName) {
    throw new HttpsError(
      "failed-precondition",
      "Confirmation text did not match the organization name."
    );
  }

  const counts = {
    people: 0,
    personTypes: 0,
    places: 0,
    productions: 0,
    departments: 0,
    tasks: 0,
    timelineTemplates: 0,
    threads: 0,
    messages: 0,
    broadcasts: 0,
    checkins: 0,
  };

  logger.info("resetOrganization starting", { orgId, uid });

  // places → count and cascade-delete nested productions along the way
  const placesSnap = await db.collection(`organizations/${orgId}/places`).get();
  counts.places = placesSnap.size;
  for (const place of placesSnap.docs) {
    const prodsSnap = await place.ref.collection("productions").get();
    counts.productions += prodsSnap.size;
    await db.recursiveDelete(place.ref);
  }

  // threads → count and cascade-delete nested messages along the way
  const threadsSnap = await db.collection(`organizations/${orgId}/threads`).get();
  counts.threads = threadsSnap.size;
  for (const thread of threadsSnap.docs) {
    const msgsSnap = await thread.ref.collection("messages").get();
    counts.messages += msgsSnap.size;
    await db.recursiveDelete(thread.ref);
  }

  // Remaining org subcollections with no further nesting to report on.
  for (const sub of ["people", "personTypes", "broadcasts", "checkins"]) {
    const snap = await db.collection(`organizations/${orgId}/${sub}`).get();
    counts[sub] = snap.size;
    for (const doc of snap.docs) {
      await db.recursiveDelete(doc.ref);
    }
  }

  // Top-level collections that reference orgId as a field rather than
  // living under organizations/{orgId}. recursiveDelete on each doc catches
  // tasks' and timelineTemplates' subcollections regardless of which ones
  // actually have data.
  for (const collectionName of ["departments", "tasks", "timelineTemplates"]) {
    const snap = await db.collection(collectionName).where("orgId", "==", orgId).get();
    counts[collectionName] = snap.size;
    for (const doc of snap.docs) {
      await db.recursiveDelete(doc.ref);
    }
  }

  logger.info("resetOrganization complete", { orgId, uid, counts });

  return { success: true, counts };
});

// ── Org membership and role writes ──────────────────────────────────────────
// The canonical role is users/{uid}.organizations[orgId].role — routing and
// every firestore.rules check read it. These three callables are the only
// code that writes it (firestore.rules no longer lets a client change it),
// so the members doc and department.departmentHeadUid can't drift from it
// the way they did before. Memberships are keyed per org and only ever added
// or removed one org at a time, so a person can belong to several orgs.
//
// Role is access only and is never derived from taxonomy Group — see
// "People taxonomy and access separation" in docs/PROJECT_STATE.md.

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

function requireString(value, name) {
  if (!value || typeof value !== "string") {
    throw new HttpsError("invalid-argument", `${name} is required.`);
  }
  return value;
}

async function requireOrgAdmin(db, uid, orgId) {
  const snap = await db.doc(`users/${uid}`).get();
  const role = snap.exists ? snap.data()?.organizations?.[orgId]?.role : null;
  if (role !== "admin" && role !== "secondaryAdmin") {
    throw new HttpsError("permission-denied", "Only an admin can change someone's access.");
  }
}

// Transaction reads for keeping department heads in step with a role change.
// Must run before any writes in the same transaction.
async function readDepartmentState(tx, db, orgId, uid, departmentId) {
  const headedSnap = await tx.get(
    db.collection("departments")
      .where("orgId", "==", orgId)
      .where("departmentHeadUid", "==", uid)
  );
  let deptRef = null;
  if (departmentId) {
    deptRef = db.doc(`departments/${departmentId}`);
    const deptSnap = await tx.get(deptRef);
    if (!deptSnap.exists || deptSnap.data().orgId !== orgId) {
      throw new HttpsError("invalid-argument", "That department does not belong to this organization.");
    }
  }
  return { headedDocs: headedSnap.docs, deptRef };
}

// Clears departmentHeadUid on any department this user no longer heads and
// sets it on the one they now head (if any).
function writeDepartmentHeads(tx, { headedDocs, deptRef }, uid, role, departmentId) {
  for (const d of headedDocs) {
    if (role !== "departmentHead" || d.id !== departmentId) {
      tx.update(d.ref, { departmentHeadUid: null });
    }
  }
  if (role === "departmentHead" && deptRef) {
    tx.update(deptRef, { departmentHeadUid: uid, departmentHeadEmail: null });
  }
}

// Accepts an email-link invite for the signed-in user. Two kinds share this:
//   - inviteId → organizations/{orgId}/pendingInvites (/join). The role comes
//     from the invite an admin created.
//   - tokenId → organizations/{orgId}/personInviteTokens (/person-join). Links
//     a People record to this login. An existing member keeps their current
//     role (linking a record never changes access); a new member gets 'person'.
// Works for brand-new accounts and for people who already have one, in this
// org or another.
exports.acceptInvite = onCall(async (request) => {
  const uid = request.auth?.uid;
  const tokenEmail = request.auth?.token?.email || "";
  if (!uid || !tokenEmail) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const { inviteId, tokenId } = request.data || {};
  const orgId = requireString(request.data?.orgId, "orgId");
  if (Boolean(inviteId) === Boolean(tokenId)) {
    throw new HttpsError("invalid-argument", "Provide exactly one of inviteId or tokenId.");
  }
  const isPersonToken = Boolean(tokenId);
  requireString(isPersonToken ? tokenId : inviteId, isPersonToken ? "tokenId" : "inviteId");
  const displayNameInput = typeof request.data?.displayName === "string"
    ? request.data.displayName.trim().slice(0, 100)
    : "";

  const db = admin.firestore();
  const inviteRef = isPersonToken
    ? db.doc(`organizations/${orgId}/personInviteTokens/${tokenId}`)
    : db.doc(`organizations/${orgId}/pendingInvites/${inviteId}`);
  const userRef = db.doc(`users/${uid}`);
  const memberRef = db.doc(`organizations/${orgId}/members/${uid}`);

  return db.runTransaction(async (tx) => {
    const [inviteSnap, userSnap, memberSnap] = await Promise.all([
      tx.get(inviteRef), tx.get(userRef), tx.get(memberRef),
    ]);

    if (!inviteSnap.exists) {
      throw new HttpsError("not-found", "This invite no longer exists. Ask your admin to send a new one.");
    }
    const invite = inviteSnap.data();
    const stillOpen = isPersonToken ? invite.accepted === false : invite.status === "pending";
    if (!stillOpen) {
      throw new HttpsError("failed-precondition", "This invite has already been used or was replaced.");
    }
    if ((invite.expiresAt?.toMillis?.() ?? 0) < Date.now()) {
      throw new HttpsError("failed-precondition", "This invite has expired. Ask your admin to send a new one.");
    }
    if (normalizeEmail(invite.email) !== normalizeEmail(tokenEmail)) {
      throw new HttpsError("permission-denied", "This invite was sent to a different email address.");
    }

    const userData = userSnap.exists ? userSnap.data() : null;
    const existingMembership = userData?.organizations?.[orgId] ?? null;
    const memberData = memberSnap.exists ? memberSnap.data() : null;
    const displayName = memberData?.displayName || userData?.displayName || displayNameInput || tokenEmail;

    let role;
    let departmentId;
    let level;
    let scopeId;
    let personRef = null;
    let deptState = null;

    if (isPersonToken) {
      role = existingMembership?.role ?? "person";
      departmentId = memberData?.departmentId ?? null;
      level = existingMembership?.level ?? "organization";
      scopeId = existingMembership?.scopeId ?? orgId;
      personRef = db.doc(`organizations/${orgId}/people/${invite.personId}`);
      const personSnap = await tx.get(personRef);
      if (!personSnap.exists) {
        throw new HttpsError("not-found", "The People record for this invite no longer exists.");
      }
      const linkedUid = personSnap.data().accountUid;
      if (linkedUid && linkedUid !== uid) {
        throw new HttpsError("failed-precondition", "This People record is already linked to another account.");
      }
    } else {
      role = invite.role;
      if (!isValidRole(role)) {
        throw new HttpsError("failed-precondition", "This invite has an unrecognized role. Ask your admin to send a new one.");
      }
      departmentId = role === "departmentHead" ? (invite.departmentId || null) : null;
      if (role === "departmentHead" && !departmentId) {
        throw new HttpsError("failed-precondition", "This Department Head invite has no department. Ask your admin to send a new one.");
      }
      level = invite.level ?? "organization";
      scopeId = invite.scopeId ?? orgId;
      deptState = await readDepartmentState(tx, db, orgId, uid, departmentId);
    }

    // ── writes ──
    const membership = {
      role,
      level,
      scopeId,
      joinedAt: existingMembership?.joinedAt ?? FieldValue.serverTimestamp(),
    };
    if (userSnap.exists) {
      tx.update(userRef, new FieldPath("organizations", orgId), membership);
    } else {
      tx.set(userRef, {
        name: tokenEmail,
        email: tokenEmail,
        displayName,
        createdAt: FieldValue.serverTimestamp(),
        organizations: { [orgId]: membership },
      });
    }

    const memberUpdate = {
      uid,
      email: tokenEmail,
      role,
      departmentId,
      provisionalAdmin: false,
      accountStatus: "confirmed",
    };
    if (!memberSnap.exists) {
      memberUpdate.displayName = displayName;
      memberUpdate.joinedAt = FieldValue.serverTimestamp();
      memberUpdate.invitedBy = invite.createdBy ?? invite.invitedBy ?? null;
    }
    if (isPersonToken) {
      memberUpdate.personId = invite.personId;
      if (role === "person") memberUpdate.personClass = true;
    }
    tx.set(memberRef, memberUpdate, { merge: true });

    if (deptState) writeDepartmentHeads(tx, deptState, uid, role, departmentId);

    if (isPersonToken) {
      const personUpdate = { accountUid: uid, accountStatus: "active" };
      if (displayNameInput) personUpdate.displayName = displayNameInput;
      tx.update(personRef, personUpdate);
      tx.update(inviteRef, { accepted: true, acceptedAt: FieldValue.serverTimestamp(), acceptedByUid: uid });
    } else {
      tx.update(inviteRef, { status: "accepted", acceptedByUid: uid, acceptedAt: FieldValue.serverTimestamp() });
    }

    return { orgId, role, isNewAccount: !userSnap.exists };
  });
});

// Admin-only: changes an existing member's role in one org, directly, with no
// email round-trip. Used for promoting existing members (including to
// Department Head of a department). Pending invites to the same email in this
// org are marked superseded, so an older invite can't later undo this change.
exports.setMemberRole = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Sign in required.");

  const orgId = requireString(request.data?.orgId, "orgId");
  const targetUid = requireString(request.data?.uid, "uid");
  const role = request.data?.role;
  const departmentId = role === "departmentHead" ? request.data?.departmentId || null : null;
  if (!isValidRole(role)) throw new HttpsError("invalid-argument", "Unrecognized role.");
  if (role === "departmentHead" && !departmentId) {
    throw new HttpsError("invalid-argument", "A department is required for a Department Head.");
  }
  if (targetUid === callerUid) {
    throw new HttpsError("failed-precondition", "You can't change your own access.");
  }

  const db = admin.firestore();
  await requireOrgAdmin(db, callerUid, orgId);

  const orgRef = db.doc(`organizations/${orgId}`);
  const userRef = db.doc(`users/${targetUid}`);
  const memberRef = db.doc(`organizations/${orgId}/members/${targetUid}`);

  return db.runTransaction(async (tx) => {
    const [orgSnap, userSnap, memberSnap] = await Promise.all([
      tx.get(orgRef), tx.get(userRef), tx.get(memberRef),
    ]);
    if (!orgSnap.exists) throw new HttpsError("not-found", "Organization not found.");
    if (orgSnap.data().ownerId === targetUid) {
      throw new HttpsError("failed-precondition", "The organization owner's access can't be changed.");
    }
    if (!userSnap.exists || !userSnap.data().organizations?.[orgId]) {
      throw new HttpsError("not-found", "That person is not a member of this organization.");
    }

    const deptState = await readDepartmentState(tx, db, orgId, targetUid, departmentId);
    const email = userSnap.data().email || memberSnap.data()?.email || "";
    const pendingSnap = await tx.get(
      db.collection(`organizations/${orgId}/pendingInvites`).where("status", "==", "pending")
    );
    const superseded = pendingSnap.docs.filter(
      (d) => email && normalizeEmail(d.data().email) === normalizeEmail(email)
    );

    tx.update(userRef, new FieldPath("organizations", orgId, "role"), role);
    tx.set(memberRef, { uid: targetUid, email, role, departmentId }, { merge: true });
    writeDepartmentHeads(tx, deptState, targetUid, role, departmentId);
    for (const d of superseded) {
      tx.update(d.ref, { status: "superseded", supersededAt: FieldValue.serverTimestamp() });
    }

    return { role, supersededInvites: superseded.length };
  });
});

// Admin-only: removes a member's access to one org. Their memberships in any
// other org are untouched.
exports.revokeMember = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Sign in required.");

  const orgId = requireString(request.data?.orgId, "orgId");
  const targetUid = requireString(request.data?.uid, "uid");
  if (targetUid === callerUid) {
    throw new HttpsError("failed-precondition", "You can't remove your own access.");
  }

  const db = admin.firestore();
  await requireOrgAdmin(db, callerUid, orgId);

  const orgRef = db.doc(`organizations/${orgId}`);
  const userRef = db.doc(`users/${targetUid}`);
  const memberRef = db.doc(`organizations/${orgId}/members/${targetUid}`);

  return db.runTransaction(async (tx) => {
    const [orgSnap, userSnap] = await Promise.all([tx.get(orgRef), tx.get(userRef)]);
    if (!orgSnap.exists) throw new HttpsError("not-found", "Organization not found.");
    if (orgSnap.data().ownerId === targetUid) {
      throw new HttpsError("failed-precondition", "The organization owner's access can't be removed.");
    }

    const deptState = await readDepartmentState(tx, db, orgId, targetUid, null);

    if (userSnap.exists && userSnap.data().organizations?.[orgId]) {
      tx.update(userRef, new FieldPath("organizations", orgId), FieldValue.delete());
    }
    tx.delete(memberRef);
    writeDepartmentHeads(tx, deptState, targetUid, null, null);

    return { removed: true };
  });
});
