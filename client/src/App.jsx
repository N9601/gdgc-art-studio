import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router';
import { useAuth } from './auth.jsx';
import Brand from './components/Brand.jsx';
import Icon from './components/Icon.jsx';
import { Loading } from './components/ui.jsx';
import Bookings from './pages/Bookings.jsx';
import Login from './pages/Login.jsx';
import Orders from './pages/Orders.jsx';
import PaintingForm from './pages/PaintingForm.jsx';
import Paintings from './pages/Paintings.jsx';
import Pottery from './pages/Pottery.jsx';
import Signup from './pages/Signup.jsx';
import Dashboard from './pages/studio/Dashboard.jsx';

const NAV = {
  customer: [
    { to: '/', label: 'Gallery', icon: 'image' },
    { to: '/orders', label: 'My orders', icon: 'bag' },
    { to: '/bookings', label: 'Wall painting', icon: 'calendar' },
    { to: '/pottery', label: 'Custom pottery', icon: 'vase' },
  ],
  studio: [
    { to: '/', label: 'Overview', icon: 'grid' },
    { to: '/paintings', label: 'Paintings', icon: 'image' },
    { to: '/orders', label: 'Orders', icon: 'bag' },
    { to: '/bookings', label: 'Wall bookings', icon: 'calendar' },
    { to: '/pottery', label: 'Pottery requests', icon: 'vase' },
  ],
};

function Sidebar() {
  const { user, logout } = useAuth();
  const initials = user.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <aside className="sidebar">
      <Brand />
      <nav className="nav">
        <div className="nav-label">{user.role === 'studio' ? 'Studio' : 'Shop'}</div>
        {NAV[user.role].map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'}>
            <Icon name={item.icon} size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-foot">
        <span className="avatar" aria-hidden="true">{initials}</span>
        <div className="who">
          <div className="who-name">{user.name}</div>
          <div className="who-role">{user.role}</div>
        </div>
        <button type="button" className="icon-button" onClick={logout} aria-label="Log out" title="Log out">
          <Icon name="logout" size={18} />
        </button>
      </div>
    </aside>
  );
}

// Sends logged-out visitors to /login, and the wrong role back home.
// (The server enforces the same rules; this only keeps the UI tidy.)
function RequireAuth({ role, children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

function Shell({ children }) {
  return (
    <div className="shell">
      <Sidebar />
      <main className="main"><div className="content">{children}</div></main>
    </div>
  );
}

export default function App() {
  const { user, checking } = useAuth();
  if (checking) return <main className="main"><div className="content"><Loading label="Starting…" /></div></main>;

  const page = (element, role) => <RequireAuth role={role}><Shell>{element}</Shell></RequireAuth>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/signup" element={user ? <Navigate to="/" replace /> : <Signup />} />
      <Route path="/" element={page(user?.role === 'studio' ? <Dashboard /> : <Paintings />)} />
      <Route path="/paintings" element={page(<Paintings />)} />
      <Route path="/orders" element={page(<Orders />)} />
      <Route path="/bookings" element={page(<Bookings />)} />
      <Route path="/pottery" element={page(<Pottery />)} />
      <Route path="/paintings/new" element={page(<PaintingForm />, 'studio')} />
      <Route path="/paintings/:id/edit" element={page(<PaintingForm />, 'studio')} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
