import type { Config } from 'tailwindcss';

// Paleta y tipografía recuperadas del bundle del demo. Son la identidad ya
// aprobada de Casa Numa, así que se conservan tal cual.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        tinta: '#27231F',      // texto y fondos oscuros
        papel: '#F5F0E7',      // fondo de página
        crema: '#FBF9F5',      // superficies elevadas
        terracota: '#C76749',  // acento
        olivo: '#85836B',      // secundario
        arcilla: '#DDA8A0',    // tono suave
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Karla', 'system-ui', 'sans-serif'],
      },
      transitionTimingFunction: {
        casa: 'cubic-bezier(.22,1,.36,1)',
      },
      keyframes: {
        entrada: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        entrada: 'entrada .5s cubic-bezier(.22,1,.36,1) both',
      },
    },
  },
  plugins: [],
} satisfies Config;
