import type { Config } from 'tailwindcss';

// ---------------------------------------------------------------------------
// Tokens de Casa Numa
// ---------------------------------------------------------------------------
// Paleta y tipografías del brandbook (CASA NUMA - BRANDBOOK 2.pdf, pp. 8-10).
// Los valores viven como variables CSS en src/index.css; aquí solo se exponen
// a Tailwind para que ningún componente escriba un color o un tamaño suelto.
// ---------------------------------------------------------------------------

const token = (nombre: string) => `rgb(var(--numa-${nombre}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Principales
        crema: token('crema'),
        terracota: token('terracota'),
        cafe: token('cafe'),
        indigo: token('indigo'),
        // Secundarios: solo como acento gráfico, nunca como fondo de texto
        naranja: token('naranja'),
        amarillo: token('amarillo'),
        verde: token('verde'),

        // Alias de la paleta anterior que aún usan la pantalla de estado del
        // pago (features/reservations) y componentes/ui.
        tinta: token('cafe'),
        papel: token('crema'),
        olivo: token('indigo'),
        arcilla: token('terracota'),
      },
      // Pasos finos para líneas y tintes (border-cafe/12, bg-terracota/8…)
      opacity: {
        3: '0.03', 4: '0.04', 6: '0.06', 7: '0.07', 8: '0.08', 12: '0.12', 14: '0.14', 18: '0.18',
      },
      fontFamily: {
        // Ivy Mode vive en Adobe Fonts. Sin kit configurado cae en Noto Serif
        // Display, la libre más cercana en contraste y proporción.
        display: ['ivymode', '"Noto Serif Display"', 'Georgia', 'serif'],
        sans: ['Poppins', 'system-ui', 'sans-serif'],
        bebas: ['"Bebas Neue"', 'Impact', 'sans-serif'],
      },
      fontSize: {
        // [tamaño, { interlineado, tracking }] — fluidos entre móvil y escritorio
        hero: ['clamp(3.1rem, 7.6vw, 7.75rem)', { lineHeight: '0.94', letterSpacing: '-0.025em' }],
        't1': ['clamp(2.5rem, 5.4vw, 5rem)', { lineHeight: '1', letterSpacing: '-0.02em' }],
        't2': ['clamp(2rem, 3.6vw, 3.4rem)', { lineHeight: '1.04', letterSpacing: '-0.015em' }],
        't3': ['clamp(1.5rem, 2.2vw, 2.1rem)', { lineHeight: '1.12', letterSpacing: '-0.01em' }],
        't4': ['1.3rem', { lineHeight: '1.25' }],
        'cuerpo-l': ['clamp(1.05rem, 1.25vw, 1.2rem)', { lineHeight: '1.7' }],
        cuerpo: ['1rem', { lineHeight: '1.7' }],
        nota: ['0.875rem', { lineHeight: '1.6' }],
        etiqueta: ['0.72rem', { lineHeight: '1.3', letterSpacing: '0.22em' }],
        cifra: ['clamp(2.6rem, 5vw, 4.5rem)', { lineHeight: '0.9', letterSpacing: '0.01em' }],
      },
      spacing: {
        seccion: 'clamp(5.5rem, 11vw, 10rem)',
        'seccion-s': 'clamp(3.5rem, 7vw, 6rem)',
        canal: 'clamp(1.25rem, 4vw, 3.5rem)',
        header: '4.75rem',
      },
      maxWidth: {
        contenedor: '90rem',
        lectura: '40rem',
        texto: '32rem',
      },
      borderRadius: {
        suave: '0.875rem',
        foto: '0.25rem',
        // Arco: la U de NUMA girada. Se usa en pocas fotos, a propósito.
        arco: '9999px 9999px 0.25rem 0.25rem',
        u: '0.25rem 0.25rem 9999px 9999px',
      },
      transitionTimingFunction: {
        numa: 'cubic-bezier(.22,1,.36,1)',
        casa: 'cubic-bezier(.22,1,.36,1)',
      },
      transitionDuration: {
        rapida: '200ms',
        media: '450ms',
        lenta: '800ms',
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
