// Shared inline required-field error treatment for the app's Create*Form
// components (Production, Person, Event, Department). A missing required
// field always gets the same visual pattern — red border/ring on the field
// plus a short message below it — instead of a silently-disabled submit
// button giving the user no indication of what's wrong.
//
// withFieldError() does a targeted string replace on each field's own
// existing className rather than constructing classes from a shared color
// theme, so every field keeps its exact current look (bg-white or not,
// focus:border-transparent or not) when there's no error. The literal class
// names below ('border-red-400', 'focus:ring-red-400') are what Tailwind's
// content scanner picks up to generate the CSS, even though they're applied
// via replace() rather than written directly in a className attribute.
export function withFieldError(baseClassName, hasError) {
  if (!hasError) return baseClassName;
  return baseClassName
    .replace('border-gray-300', 'border-red-400')
    .replace(/focus:ring-(amber|indigo)-500/, 'focus:ring-red-400');
}

export function FieldError({ message }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}
