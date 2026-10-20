// Small shared pieces: the loading / empty / error states every data screen uses,
// plus status badges, notices and form fields.

export function Loading({ label = 'Loading…' }) {
  return <p className="state" role="status">{label}</p>;
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="state state-error" role="alert">
      <p>{error.message}</p>
      {onRetry && <button type="button" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Empty({ children }) {
  return <p className="state state-empty">{children}</p>;
}

// Shows loading, then an error (with retry), then the empty message, then the content.
export function AsyncView({ state, isEmpty = () => false, empty, children }) {
  if (state.loading && !state.data) return <Loading />;
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (isEmpty(state.data)) return <Empty>{empty}</Empty>;
  return children(state.data);
}

export function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}

export function Notice({ notice, onClose }) {
  if (!notice) return null;
  return (
    <div className={`notice notice-${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
      <span>{notice.text}</span>
      {onClose && <button type="button" className="link" onClick={onClose} aria-label="Dismiss">✕</button>}
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
