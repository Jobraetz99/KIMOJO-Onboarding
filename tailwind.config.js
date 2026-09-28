/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'kimojo-red':   '#BF3B36',
        'kimojo-dark':  '#8B1F1A',
        'kimojo-light': '#FDF0EF',
        'kimojo-muted': '#F3D4D3',
        'phfip-teal':   '#4DB8AC',
        'phfip-dark':   '#2D8A80',
        'phfip-light':  '#E8F7F5',
        'phfip-muted':  '#B2DFDB',
        'ink':          '#1A1A1A',
        'ink-muted':    '#6B6B6B',
        'ink-faint':    '#9B9B9B',
        'surface-subtle': '#FAFAFA',
      },
      fontFamily: {
        display: ['SF Pro Display', 'system-ui', 'sans-serif'],
        body:    ['SF Pro Text',    'system-ui', 'sans-serif'],
      },
      boxShadow: {
        float: '0 4px 24px rgba(0,0,0,0.12)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}
