import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import Shell from './components/Shell.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Dashboard from './pages/Dashboard.jsx';
import { Empty, Skeleton } from './components/ui.jsx';
import { Compass } from 'lucide-react';
import { ImportHost } from './components/CaseShare.jsx';

const Explore = lazy(() => import('./pages/Explore.jsx'));
const CasePlayer = lazy(() => import('./pages/CasePlayer.jsx'));
const Research = lazy(() => import('./pages/Research.jsx'));
const W = () => import('./pages/Workspace.jsx');
const Simulations = lazy(() => W().then((m) => ({ default: m.Simulations })));
const Learning = lazy(() => W().then((m) => ({ default: m.Learning })));
const Principles = lazy(() => import('./pages/Library.jsx'));
const MyCases = lazy(() => W().then((m) => ({ default: m.MyCases })));
const Companies = lazy(() => W().then((m) => ({ default: m.Companies })));
const History = lazy(() => W().then((m) => ({ default: m.History })));
const SettingsPage = lazy(() => W().then((m) => ({ default: m.SettingsPage })));
const About = lazy(() => W().then((m) => ({ default: m.About })));
const Collections = lazy(() => import('./components/Collections.jsx').then((m) => ({ default: m.CollectionsPage })));
const Notifications = lazy(() => import('./pages/Notifications.jsx'));

/** Notification taps and other outside events ask for a page by path. */
function NavigateListener() {
  const navigate = useNavigate();
  useEffect(() => {
    // Only in-app paths: no protocol, no "//host", no backslashes.
    const go = (e) => typeof e.detail === 'string' && /^\/(?!\/)[\w/#?=&.%-]{0,300}$/.test(e.detail) && navigate(e.detail);
    window.addEventListener('bizsim:navigate', go);
    return () => window.removeEventListener('bizsim:navigate', go);
  }, [navigate]);
  return null;
}

// Hash routing inside native shells (Capacitor) and file:// loads; clean URLs elsewhere.
const useHash = typeof window !== 'undefined' && (window.location.protocol === 'file:' || window.Capacitor?.isNativePlatform?.());
const Router = useHash ? HashRouter : BrowserRouter;

function Loading() {
  return (
    <div className="stack gap-4" aria-busy="true" aria-label="Loading">
      <Skeleton h={14} w={180} />
      <Skeleton h={44} w="60%" />
      <Skeleton h={18} w="80%" />
      <Skeleton h={240} />
    </div>
  );
}

function NotFound() {
  return (
    <Empty icon={Compass} title="Page not found" action={<Link to="/" className="btn">Back to overview</Link>}>
      The page you were looking for does not exist.
    </Empty>
  );
}

export default function App() {
  return (
    <Router>
      <Shell>
        <ErrorBoundary>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/cases" element={<Explore />} />
            <Route path="/cases/:id" element={<CasePlayer />} />
            <Route path="/research" element={<Research />} />
            <Route path="/simulations" element={<Simulations />} />
            <Route path="/learning" element={<Learning />} />
            <Route path="/principles" element={<Principles />} />
            <Route path="/my-cases" element={<MyCases />} />
            <Route path="/collections" element={<Collections />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        </ErrorBoundary>
        <ImportHost />
        <NavigateListener />
      </Shell>
    </Router>
  );
}
