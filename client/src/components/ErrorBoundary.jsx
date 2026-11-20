// Keeps one broken page from blanking the whole app: shows what went wrong,
// lets the user retry or go home, and resets automatically on navigation.
import { Component } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

class Boundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('BIZSIM page error:', error, info?.componentStack);
  }
  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const chunk = /Loading chunk|dynamically imported module|Importing a module script failed/i.test(String(error?.message));
    return (
      <div className="panel panel-pad stack gap-3" role="alert" style={{ maxWidth: 620 }}>
        <h2 className="section-title row gap-2">
          <AlertTriangle size={18} aria-hidden="true" /> This screen could not be shown
        </h2>
        <p className="muted">
          {chunk
            ? 'Part of the app could not be loaded. This usually happens right after an update or when the connection drops. Reloading fixes it.'
            : 'Something went wrong while drawing this screen. Your progress and saved seasons are safe.'}
        </p>
        <pre className="meta" style={{ whiteSpace: 'pre-wrap', margin: 0, maxHeight: 120, overflow: 'auto' }}>{String(error?.message || error).slice(0, 400)}</pre>
        <div className="row gap-2 wrap">
          <button type="button" className="btn btn-primary" onClick={() => (chunk ? window.location.reload() : this.setState({ error: null }))}>
            <RotateCcw aria-hidden="true" /> {chunk ? 'Reload' : 'Try again'}
          </button>
          <a className="btn" href={window.location.protocol === 'file:' || window.Capacitor?.isNativePlatform?.() ? '#/' : '/'}>
            <Home aria-hidden="true" /> Overview
          </a>
        </div>
      </div>
    );
  }
}

export default function ErrorBoundary({ children }) {
  const { pathname } = useLocation();
  return <Boundary resetKey={pathname}>{children}</Boundary>;
}
