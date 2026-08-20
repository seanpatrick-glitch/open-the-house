import { theme as tokens } from './src/styles/tokens.js'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: tokens.extend,
  },
  plugins: [],
}
