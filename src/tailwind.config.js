/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'],
      },
      colors: {
        primary: '#10b981',   // Example: emerald
        darkBg: '#1f2937',     // Tailwind slate-800
        card: '#111827',       // Tailwind gray-900
      },
    },
  },
  darkMode: 'class',
  plugins: [],
};
