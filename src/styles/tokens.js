// Design tokens for Places People!, extracted from the brand guideline
// ("Places People Brand Guidelines", Claude Design project, Aug 2026).
// This is a source-of-truth data file, not yet wired into tailwind.config.js.
// Spread `theme.extend` into tailwind.config.js's own theme.extend to activate
// it as Tailwind utility classes (e.g. bg-stage-navy, font-body).

export const theme = {
  extend: {
    colors: {
      // Foundation. Backgrounds, the house lights down. ~90% of a layout
      // (navy + house-white + places-blue combined) per the guideline's balance rule.
      'stage-navy': '#022557',
      // The primary brand color. The signature stroke.
      'places-blue': '#0171d3',
      // Space, reversed type, room to breathe.
      'house-white': '#ffffff',
      // Warmth from the beam. Emphasis, used sparingly — spotlight + haze
      // together must never exceed 10% of a layout per the guideline.
      spotlight: '#ff8c51',
      // The cool edge of the light. A secondary accent.
      haze: '#c26fbe',
    },
    fontFamily: {
      // Hand-lettered, licensed display faces. Build the wordmark only —
      // never set in running text, headlines, or UI. No web-font @font-face
      // exists for these; they ship baked into the logo artwork.
      display: ["'Have Heart One'", "'Have Heart Two'", 'cursive'],
      // Primary voice. Carries every headline, subhead, and paragraph.
      // Body copy: 17-22px with generous line height, per the guideline.
      body: ["'Alice'", 'serif'],
      // Utility/annotation layer: section numbers, labels, kickers, hex
      // values, timestamps. Uppercase with wide letter spacing. Never for
      // long-form reading. Weights 400 and 700 only.
      mono: ["'Space Mono'", 'monospace'],
    },
    spacing: {
      // Explicit spacing scale from the guideline's Layout & Grid section.
      'brand-xs': '8px',
      'brand-sm': '16px',
      'brand-md': '28px',
      'brand-lg': '44px',
      'brand-xl': '60px',
    },
    maxWidth: {
      // Centered content column width from the guideline's Layout & Grid section.
      content: '1120px',
    },
  },
}

// Google Fonts import used by the guideline for the two live web fonts:
// https://fonts.googleapis.com/css2?family=Alice&family=Space+Mono:wght@400;700&display=swap

export default theme
