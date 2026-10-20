import { Link } from 'react-router';
import Icon from './Icon.jsx';

export default function Brand() {
  return (
    <Link to="/" className="brand">
      <span className="brand-mark"><Icon name="sparkles" size={18} /></span>
      <span>Art Studio<small>Paintings · Murals · Pottery</small></span>
    </Link>
  );
}
