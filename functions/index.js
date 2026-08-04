const { setGlobalOptions } = require("firebase-functions");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
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
