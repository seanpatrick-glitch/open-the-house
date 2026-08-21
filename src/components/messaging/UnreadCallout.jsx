// UnreadCallout — dashboard card prompting the user to check unread messages.
// Presentational only: caller supplies the count and the navigation handler,
// since DashboardShell-hosted views and standalone views (PersonView) reach
// Messages through different mechanisms.

export default function UnreadCallout({ count, onClick }) {
  if (!count) return null;

  const label = count === 1 ? 'You have 1 unread message' : `You have ${count} unread messages`;

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-places-blue/10 border border-places-blue/20 rounded-xl px-4 py-3 flex items-center justify-between gap-3 hover:bg-places-blue/15 transition-colors"
    >
      <p className="text-sm font-medium text-stage-navy">{label}</p>
      <span className="text-xs font-medium text-places-blue flex-shrink-0">View →</span>
    </button>
  );
}
