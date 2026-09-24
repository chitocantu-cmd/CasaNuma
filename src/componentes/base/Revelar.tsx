import type { ReactNode } from 'react';
import { m } from 'framer-motion';

export const EASE_NUMA = [0.22, 1, 0.36, 1] as const;

/**
 * Aparición suave al entrar en pantalla: sube 24 px y se asienta.
 * Una sola vez; nunca bloquea la navegación. Con "reducir movimiento"
 * activado, MotionConfig deja solo el fundido.
 */
export default function Revelar({
  children,
  retraso = 0,
  className = '',
  y = 24,
  como = 'div',
}: {
  children: ReactNode;
  retraso?: number;
  className?: string;
  y?: number;
  /** 'li' dentro de listas, para no romper el HTML. */
  como?: 'div' | 'li';
}) {
  const Elemento = como === 'li' ? m.li : m.div;
  return (
    <Elemento
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 0.9, ease: EASE_NUMA, delay: retraso }}
    >
      {children}
    </Elemento>
  );
}
