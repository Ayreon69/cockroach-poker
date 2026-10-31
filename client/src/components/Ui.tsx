// Briques d'interface communes : boutons, fenêtres, pastilles, sélecteurs, logo et décor du cabinet.
import { X } from 'lucide-react';
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cls } from '../lib/util';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost' | 'true' | 'false' | 'peek' | 'danger';
  icon?: ReactNode;
}

export function Button({ variant = 'default', icon, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={cls('btn', `btn-${variant}`, className)} {...rest}>
      {icon}
      {children && <span className="btn-label">{children}</span>}
    </button>
  );
}

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div className={cls('logo', `logo-${size}`)} aria-label="Cockroach Poker">
      <span className="logo-top" aria-hidden>
        Cockroach
      </span>
      <span className="logo-bottom" aria-hidden>
        <i>~</i> Poker <i>~</i>
      </span>
    </div>
  );
}

/** Le cabinet : velours vert bouteille, motif damassé, et l'ombre des vitrines. */
export function Cabinet({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cls('cabinet', className)}>
      <div className="cabinet-body">{children}</div>
    </div>
  );
}

/** Un cafard qui traverse l'écran de temps en temps. Pur décor, et immobile pour qui préfère moins d'animations. */
export function Scuttler() {
  return (
    <span className="scuttler" aria-hidden>
      <svg viewBox="0 0 40 24">
        <g fill="#2a1d12" stroke="#2a1d12" strokeWidth={1.4} strokeLinecap="round">
          <path d="M6 12 L1 6 M6 12 L0 14 M30 10 L38 3 M30 14 L38 21" fill="none" />
          <path className="scuttler-legs" d="M12 8 L9 2 M18 8 L18 1 M24 8 L27 2 M12 16 L9 22 M18 16 L18 23 M24 16 L27 22" fill="none" />
          <ellipse cx="17" cy="12" rx="11" ry="5.5" />
          <ellipse cx="29" cy="12" rx="3.5" ry="3" />
        </g>
      </svg>
    </span>
  );
}

export function Pill({ tone, children, className }: { tone?: 'brass' | 'green' | 'red'; children: ReactNode; className?: string }) {
  return <span className={cls('pill', tone && `pill-${tone}`, className)}>{children}</span>;
}

interface SegmentedOption<T> {
  value: T;
  label: string;
  sub?: string;
}

export function Segmented<T extends string | number | boolean>({ options, value, onChange, disabled, label }: { options: SegmentedOption<T>[]; value: T; onChange: (v: T) => void; disabled?: boolean; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          disabled={disabled}
          className={cls('seg', o.value === value && 'is-on')}
          onClick={() => onChange(o.value)}
        >
          <b>{o.label}</b>
          {o.sub && <small>{o.sub}</small>}
        </button>
      ))}
    </div>
  );
}

/**
 * Une fenêtre. Elle entre en douceur mais disparaît d'un coup : aucune animation de sortie
 * ne doit pouvoir la laisser traîner devant l'écran suivant.
 */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      before?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-back" onClick={onClose}>
      <div ref={box} tabIndex={-1} className={cls('modal', wide && 'is-wide')} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Fermer" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
