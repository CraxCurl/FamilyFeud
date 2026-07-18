/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: '#0A0518',
        neonPurple: '#8B5CF6',
        neonPink: '#EC4899',
        neonCyan: '#06B6D4',
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        neonPurple: '0 0 15px rgba(139, 92, 246, 0.5)',
        neonPink: '0 0 15px rgba(236, 72, 153, 0.5)',
        neonCyan: '0 0 15px rgba(6, 182, 212, 0.5)',
      }
    },
  },
  plugins: [],
}
