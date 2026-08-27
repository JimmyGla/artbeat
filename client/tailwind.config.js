/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fdf4ff',
          100: '#fae8ff',
          200: '#f5d0fe',
          300: '#f0abfc',
          400: '#e879f9',
          500: '#d946ef',
          600: '#c026d3',
          700: '#a21caf',
          800: '#86198f',
          900: '#701a75',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      // Tailwind's default scale skips 4.5, so `w-4.5`/`h-4.5` silently
      // generated no CSS and every icon sized with it rendered at zero — the
      // Preferences rows looked like they simply had no icons. Defining the
      // value fixes all of them without touching the markup.
      spacing: {
        4.5: '1.125rem',
      },
    },
  },
  plugins: [],
}
