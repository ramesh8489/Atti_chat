/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f3f4ff',
          100: '#e6e8ff',
          200: '#cfd4ff',
          300: '#abb3ff',
          400: '#848bff',
          500: '#6366f1', // crisp PingUp indigo-violet
          600: '#5452e6',
          700: '#4640cc',
          800: '#3935a6',
          900: '#312e81',
          950: '#1e1b4b',
        },
      },
    },
  },
  plugins: [],
}

