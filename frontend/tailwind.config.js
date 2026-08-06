/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // High-end futuristic color scheme (slate, emerald, violet/indigo accents)
        dark: {
          900: '#0B0F19',
          800: '#151D30',
          700: '#1E294B',
          600: '#2A3C6B',
        },
      },
    },
  },
  plugins: [],
}
