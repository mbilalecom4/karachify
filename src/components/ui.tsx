import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { AlertTriangle, Check, ChevronRight, Info, Star, X, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { placeholderImage } from '../lib/media';

/* ------------------------------- toasts ------------------------------- */

type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}
interface ToastApi {
  push: (message: string, kind?: ToastKind) => void;
}

const ToastCtx = createContext<ToastApi>({ push: () => {} });
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);

  const push = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = ++seq.current;
    setItems((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3600);
  }, []);

  const api = useMemo(() => ({ push }), [push]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4 sm:bottom-6"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border bg-white px-4 py-3 shadow-lift animate-fade-up ${
              t.kind === 'error' ? 'border-rose-200' : t.kind === 'info' ? 'border-navy-200' : 'border-teal-200'
            }`}
            role="status"
          >
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                t.kind === 'error'
                  ? 'bg-rose-50 text-rose-600'
                  : t.kind === 'info'
                    ? 'bg-navy-50 text-navy-600'
                    : 'bg-teal-50 text-teal-600'
              }`}
            >
              {t.kind === 'error' ? <XCircle className="h-4 w-4" /> : t.kind === 'info' ? <Info className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            </span>
            <p className="text-sm font-medium leading-snug text-navy-800">{t.message}</p>
            <button
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
              className="ml-auto rounded-full p-1 text-navy-400 hover:bg-navy-50 hover:text-navy-700"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ------------------------------ imagery ------------------------------- */

export function ImageWithFallback({
  src,
  alt,
  label,
  className = '',
  wrapperClass = '',
  eager = false,
}: {
  src?: string;
  alt: string;
  label?: string;
  className?: string;
  wrapperClass?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const fallback = useMemo(() => placeholderImage(label ?? alt), [label, alt]);
  const resolved = !src || failed ? fallback : src;

  return (
    <span className={`block overflow-hidden bg-navy-50 ${wrapperClass}`}>
      <img
        src={resolved}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => setFailed(true)}
        className={`h-full w-full object-cover ${className}`}
      />
    </span>
  );
}

/* ------------------------------- badges ------------------------------- */

export function StatusBadge({ status, className = '' }: { status: 'demo' | 'verified' | 'needs-review'; className?: string }) {
  const map = {
    demo: { label: 'Sample data', cls: 'badge-demo' },
    verified: { label: 'Verified', cls: 'badge-verified' },
    'needs-review': { label: 'Needs review', cls: 'badge-demo' },
  } as const;
  const m = map[status];
  return <span className={`${m.cls} ${className}`}>{m.label}</span>;
}

export function Stars({ value, size = 14, showValue = true }: { value: number; size?: number; showValue?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1" title={`${value.toFixed(1)} out of 5`}>
      <span className="inline-flex">
        {[0, 1, 2, 3, 4].map((i) => {
          const fill = Math.max(0, Math.min(1, value - i));
          return (
            <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
              <Star className="absolute inset-0 text-navy-200" style={{ width: size, height: size }} />
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className="fill-amber-400 text-amber-400" style={{ width: size, height: size }} />
              </span>
            </span>
          );
        })}
      </span>
      {showValue && <span className="text-[13px] font-semibold text-navy-700">{value.toFixed(1)}</span>}
    </span>
  );
}

/* ------------------------------- layout ------------------------------- */

export function SectionHeading({
  eyebrow,
  title,
  sub,
  action,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4 [&>*]:min-w-0">
      <div>
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h2 className="section-title">{title}</h2>
        {sub && <p className="section-sub">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Breadcrumbs({ trail }: { trail: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1.5 text-[13px] text-navy-500">
      {trail.map((t, i) => (
        <span key={`${t.label}-${i}`} className="inline-flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-navy-300" />}
          {t.to && i < trail.length - 1 ? (
            <Link to={t.to} className="hover:text-teal-700">
              {t.label}
            </Link>
          ) : (
            <span className={i === trail.length - 1 ? 'font-semibold text-navy-700' : ''}>{t.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function EmptyState({
  title = 'Nothing here yet',
  body,
  action,
  icon,
}: {
  title?: string;
  body: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-50 text-navy-500">
        {icon ?? <AlertTriangle className="h-6 w-6" />}
      </span>
      <h3 className="text-lg font-bold text-navy-800">{title}</h3>
      <p className="max-w-md text-sm leading-relaxed text-navy-500">{body}</p>
      {action}
    </div>
  );
}

export function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card overflow-hidden">
          <div className="skeleton aspect-[4/3] w-full" />
          <div className="space-y-2 p-4">
            <div className="skeleton h-4 w-2/3 rounded" />
            <div className="skeleton h-3 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Fades children in the first time they scroll into view. */
export function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: '60px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${className} ${shown ? 'animate-fade-up' : 'opacity-0'}`}
      style={shown ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/* -------------------------------- modal ------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const width = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl';

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-navy-950/60 px-4 py-8 backdrop-blur-sm animate-fade-in" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`w-full ${width} rounded-2xl border border-navy-100 bg-white shadow-lift animate-fade-up`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-4 border-b border-navy-100 px-5 py-4">
          <h3 id={titleId} className="text-lg font-bold text-navy-800">
            {title}
          </h3>
          <button onClick={onClose} aria-label="Close dialog" className="rounded-full p-1.5 text-navy-500 hover:bg-navy-50 hover:text-navy-800">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="px-5 py-5">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-3 border-t border-navy-100 bg-mist px-5 py-4">{footer}</footer>}
      </div>
    </div>
  );
}

/* -------------------------------- forms ------------------------------- */

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="field-label">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1.5 block text-[13px] text-navy-400">{hint}</span>}
      {error && (
        <span className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-rose-600">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </span>
      )}
    </label>
  );
}

export function TextInput({ error, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return <input {...rest} className={`input ${error ? 'input-error' : ''} ${className ?? ''}`} />;
}

export function TextArea({ error, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return <textarea {...rest} className={`input min-h-[120px] resize-y ${error ? 'input-error' : ''} ${className ?? ''}`} />;
}

export function Select({ error, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  return (
    <select {...rest} className={`select ${error ? 'input-error' : ''} ${className ?? ''}`}>
      {children}
    </select>
  );
}

/* ------------------------------- tabs --------------------------------- */

export function Tabs({
  tabs,
  active,
  onChange,
  size = 'md',
}: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="tablist" className="no-scrollbar flex max-w-full min-w-0 gap-1.5 overflow-x-auto rounded-full border border-navy-100 bg-white p-1.5">
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={`whitespace-nowrap rounded-full px-4 font-semibold transition-colors ${
              size === 'sm' ? 'py-1.5 text-[13px]' : 'py-2 text-sm'
            } ${on ? 'bg-navy-800 text-white shadow-card' : 'text-navy-600 hover:bg-navy-50'}`}
          >
            {t.label}
            {typeof t.count === 'number' && <span className={`ml-1.5 text-[12px] ${on ? 'text-teal-100' : 'text-navy-400'}`}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function LoadMore({ shown, total, onClick }: { shown: number; total: number; onClick: () => void }) {
  if (shown >= total) return null;
  return (
    <div className="mt-9 flex flex-col items-center gap-3">
      <p className="text-sm text-navy-500">
        Showing {shown} of {total}
      </p>
      <button className="btn-outline" onClick={onClick}>
        Load more listings
      </button>
    </div>
  );
}

/* --------------------------- decorative image -------------------------- */

export function DemoBannerImage({ label, className = '' }: { label: string; className?: string }) {
  return <img src={placeholderImage(label)} alt="" aria-hidden className={className} />;
}
