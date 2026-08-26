// PageHeader — the kicker + rule + large-Alice-headline pattern from the
// brand guideline's own section openers (e.g. "01 — The Name" / "Why
// Places People!"), applied to each top-level app section.
//
// `bleed`: some views wrap themselves in their own p-6 (on top of
// DashboardShell's main p-6), which this component can negate with
// negative margins for a true edge-to-edge banner. Others rely solely on
// main's padding and have nothing local to negate — those pass
// bleed={false} and get a plain rounded card instead.

export default function PageHeader({ kicker = 'PLACES PEOPLE!', title, children, bleed = true }) {
  return (
    <div className={bleed
      ? '-mx-6 -mt-6 mb-6 px-6 py-8 bg-stage-navy'
      : 'mb-6 px-6 py-8 rounded-xl bg-stage-navy'}>
      <span className="block font-mono text-[11px] tracking-[.3em] uppercase text-spotlight mb-3">
        {kicker}
      </span>
      <span className="block w-8 h-[3px] bg-spotlight mb-4" />
      <h1 className="font-body text-4xl md:text-5xl text-house-white leading-tight">
        {title}
      </h1>
      {children}
    </div>
  )
}
