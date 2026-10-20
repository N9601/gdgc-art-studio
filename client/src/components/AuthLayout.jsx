import Brand from './Brand.jsx';
import Icon from './Icon.jsx';

// Split screen for login and sign-up: artwork on the left, the form on the right.
export default function AuthLayout({ children }) {
  return (
    <div className="auth">
      <section className="auth-art" aria-hidden="true">
        <Brand size={64} />
        <div>
          <h2 className="auth-headline">Original art, made by hand, for your walls.</h2>
          <ul className="auth-points">
            <li><Icon name="image" /> One-of-a-kind paintings from Indian folk traditions</li>
            <li><Icon name="calendar" /> Book a wall mural on a date that suits you</li>
            <li><Icon name="vase" /> Custom pottery in the glaze you choose</li>
          </ul>
        </div>
        <div className="auth-collage">
          <img src="/images/p-003.jpg" alt="" />
          <img src="/images/p-006.jpg" alt="" />
          <img src="/images/p-011.jpg" alt="" />
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">{children}</div>
      </section>
    </div>
  );
}
