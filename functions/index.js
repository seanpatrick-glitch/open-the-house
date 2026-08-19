const { setGlobalOptions } = require("firebase-functions");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

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

      await db.collection("mail").add({
        toUids: [recipientUid],
        message: {
          subject,
          text: `You have a new message.\n\n${preview}\n\nView it at https://open-the-house.web.app/dashboard`,
          html: `<p>You have a new message.</p><p>${escapeHtml(preview)}</p><p><a href="https://open-the-house.web.app/dashboard">View it in Places People</a></p>`,
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
