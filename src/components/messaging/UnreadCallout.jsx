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
      className="w-full text-left bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 hover:bg-indigo-100 transition-colors"
    >
      <p className="text-sm font-medium text-indigo-800">{label}</p>
      <span className="text-xs font-medium text-indigo-600 flex-shrink-0">View →</span>
    </button>
  );
}
