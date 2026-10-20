import { Link } from 'react-router';
import Logo from './Logo.jsx';

export default function Brand({ size = 44 }) {
  return (
    <Link to="/" className="brand">
      <Logo size={size} />
      <span>
        <span className="brand-name">Art Studio</span>
        <small>Paintings · Murals · Pottery</small>
      </span>
    </Link>
  );
}
