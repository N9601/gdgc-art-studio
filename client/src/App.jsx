import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router';
import { useAuth } from './auth.jsx';
import { Loading } from './components/ui.jsx';
import Bookings from './pages/Bookings.jsx';
import Login from './pages/Login.jsx';
import Orders from './pages/Orders.jsx';
import PaintingForm from './pages/PaintingForm.jsx';
import Paintings from './pages/Paintings.jsx';
import Pottery from './pages/Pottery.jsx';
import Signup from './pages/Signup.jsx';

// Sends logged-out visitors to /login, and the wrong role back to the gallery.
// (The server enforces the same rules; this only keeps the UI tidy.)
function RequireAuth({ role, children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

function Header() {
  const { user, logout } = useAuth();
  const studio = user?.role === 'studio';
  return (
    <header className="header">
      <NavLink to="/" className="brand">Art Studio</NavLink>
      {user && (
        <>
          <nav className="nav">
            <NavLink to="/" end>Paintings</NavLink>
            <NavLink to="/orders">{studio ? 'All orders' : 'My orders'}</NavLink>
            <NavLink to="/bookings">{studio ? 'Wall bookings' : 'Book a wall'}</NavLink>
            <NavLink to="/pottery">{studio ? 'Pottery requests' : 'Custom pottery'}</NavLink>
          </nav>
          <div className="who">
            <span>{user.name}</span>
            <span className={`badge badge-role-${user.role}`}>{user.role}</span>
            <button type="button" className="secondary" onClick={logout}>Log out</button>
          </div>
        </>
      )}
    </header>
  );
}

export default function App() {
  const { user, checking } = useAuth();
  if (checking) return <main className="page"><Loading label="Starting…" /></main>;

  return (
    <>
      <Header />
      <main className="page">
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/signup" element={user ? <Navigate to="/" replace /> : <Signup />} />
          <Route path="/" element={<RequireAuth><Paintings /></RequireAuth>} />
          <Route path="/orders" element={<RequireAuth><Orders /></RequireAuth>} />
          <Route path="/bookings" element={<RequireAuth><Bookings /></RequireAuth>} />
          <Route path="/pottery" element={<RequireAuth><Pottery /></RequireAuth>} />
          <Route path="/paintings/new" element={<RequireAuth role="studio"><PaintingForm /></RequireAuth>} />
          <Route path="/paintings/:id/edit" element={<RequireAuth role="studio"><PaintingForm /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
