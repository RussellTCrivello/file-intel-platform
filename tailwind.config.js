/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        surface: {
          950: '#07090d',
          900: '#0b0e14',
          850: '#0f1420',
          800: '#131926',
          750: '#171e2d',
          700: '#1c2434',
          600: '#26304480',
          border: '#232c3d',
        },
        accent: {
          DEFAULT: '#3b82f6',
          soft: '#1d4ed81a',
        },
      },
      boxShadow: {
        panel: '0 1px 2px 0 rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)',
      },
    },
  },
  plugins: [],
}
