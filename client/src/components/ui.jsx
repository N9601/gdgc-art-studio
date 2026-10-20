// Shared building blocks: the loading / empty / error states every data screen uses,
// plus page headers, tabs, status badges, notices (toasts) and form fields.
import { useEffect } from 'react';
import Icon from './Icon.jsx';

export function PageHeader({ title, subtitle, children }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      {children && <div className="actions">{children}</div>}
    </header>
  );
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="state" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="state state-error" role="alert">
      <span className="state-icon"><Icon name="alert" size={22} /></span>
      <div className="state-title">Something went wrong</div>
      <p>{error.message}</p>
      {onRetry && (
        <button type="button" className="secondary" onClick={onRetry}><Icon name="refresh" size={16} /> Try again</button>
      )}
    </div>
  );
}

export function Empty({ title = 'Nothing here yet', icon = 'inbox', children, action }) {
  return (
    <div className="state state-empty">
      <span className="state-icon"><Icon name={icon} size={22} /></span>
      <div className="state-title">{title}</div>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

// Shows loading, then an error (with retry), then the empty state, then the content.
export function AsyncView({ state, isEmpty = () => false, empty, emptyTitle, emptyIcon, loading, children }) {
  if (state.loading && !state.data) return loading ?? <Loading />;
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (isEmpty(state.data)) return <Empty title={emptyTitle} icon={emptyIcon}>{empty}</Empty>;
  return children(state.data);
}

// Segmented tabs, e.g. All · Available · Sold, each with a count.
export function Tabs({ value, onChange, options, label }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value}
          className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined && <span className="tab-count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}

// A message after an action. Page-level notices float as a toast; success ones fade after 4s.
export function Notice({ notice, onClose, inline = false }) {
  useEffect(() => {
    if (notice?.kind !== 'success' || !onClose) return undefined;
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [notice]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!notice) return null;
  return (
    <div className={`notice notice-${notice.kind} ${inline ? 'notice-inline' : 'toast'}`}
      role={notice.kind === 'error' ? 'alert' : 'status'}>
      <Icon name={notice.kind === 'error' ? 'alert' : 'checkCircle'} size={18} />
      <span className="notice-text">{notice.text}</span>
      {onClose && (
        <button type="button" className="icon-button" onClick={onClose} aria-label="Dismiss"><Icon name="x" size={16} /></button>
      )}
    </div>
  );
}

export function Field({ label, error, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}
