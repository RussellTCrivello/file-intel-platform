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
        // Primary interaction color: a muted, editorial teal rather than default electric blue.
        blue: {
          50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4',
          400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e',
          800: '#115e59', 900: '#134e4a', 950: '#042f2e',
        },
        surface: {
          950: '#f4f6f8',
          900: '#ffffff',
          850: '#f8fafc',
          800: '#eef2f6',
          750: '#e7edf3',
          700: '#dce4ec',
          600: '#cbd5e180',
          border: '#dbe3eb',
        },
        accent: {
          DEFAULT: '#0f766e',
          soft: '#0f766e14',
        },
      },
      boxShadow: {
        panel: '0 1px 3px 0 rgba(15, 23, 42, 0.08), 0 1px 2px 0 rgba(15, 23, 42, 0.04)',
      },
    },
  },
  plugins: [],
}
