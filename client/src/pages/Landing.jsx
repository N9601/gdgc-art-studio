import { Link } from 'react-router';
import Brand from '../components/Brand.jsx';
import Icon from '../components/Icon.jsx';

// The public home page for visitors who aren't logged in. It shows no prices or stock,
// because those come from the API, which needs a login.

const SERVICES = [
  {
    icon: 'image',
    title: 'Original paintings',
    text: 'Madhubani, Gond, Tanjore, Kalamkari and more, painted by hand by folk artists from across India.',
    rule: 'Each painting is one of a kind and sells only once',
  },
  {
    icon: 'calendar',
    title: 'Wall murals',
    text: 'Our artists come to you and paint a mural on your wall. Tell us the date, the wall size and the address.',
    rule: 'Book a date 7 to 90 days away, priced by the square foot',
  },
  {
    icon: 'vase',
    title: 'Custom pottery',
    text: 'Kulhads, surahis, matkas, diya sets and planters, thrown and glazed to order in the colour you pick.',
    rule: 'Order 1 to 12 pieces, needed at least 14 days out',
  },
];

const FEATURED = [
  { image: '/images/p-001.jpg', title: 'Madhubani Peacock Garden', artist: 'Meera Kumari' },
  { image: '/images/p-006.jpg', title: 'Gond Forest Spirits', artist: 'Mohan Markam' },
  { image: '/images/p-003.jpg', title: 'Tanjore Lakshmi with Gold Leaf', artist: 'Revathi Iyer' },
  { image: '/images/p-007.jpg', title: 'Cheriyal Panel: Bonalu Procession', artist: 'Ramesh Naidu' },
];

const STEPS = [
  { title: 'Create a free account', text: 'Sign up with your name, email and a password. It takes a few seconds.' },
  { title: 'Choose what you want', text: 'Buy a painting, request a mural date, or send a pottery request.' },
  { title: 'The studio confirms', text: 'Track every order, booking and request from your account, and cancel if plans change.' },
];

export default function Landing() {
  return (
    <div className="landing">
      <div className="landing-inner">
        <header className="landing-nav">
          <Brand />
          <nav className="landing-links" aria-label="Main">
            <a href="#services">What we make</a>
            <a href="#how">How it works</a>
            <Link className="button secondary small" to="/login">Log in</Link>
            <Link className="button small" to="/signup">Sign up</Link>
          </nav>
        </header>

        <section className="hero">
          <div>
            <span className="eyebrow"><Icon name="sparkles" size={14} /> Handmade in India</span>
            <h1>Original art, <span className="hand">made by hand</span>, for your walls.</h1>
            <p className="hero-lead">
              Buy one-of-a-kind paintings from Indian folk traditions, book our artists to paint a mural
              at your place, or order pottery in the glaze you choose.
            </p>
            <div className="actions">
              <Link className="button large" to="/signup">Start exploring <Icon name="arrowRight" size={18} /></Link>
              <Link className="button secondary large" to="/login">I have an account</Link>
            </div>
            <ul className="hero-facts">
              <li><strong>1 of 1</strong><span>every painting</span></li>
              <li><strong>7–90 days</strong><span>to book a mural</span></li>
              <li><strong>1–12 pieces</strong><span>per pottery order</span></li>
            </ul>
          </div>

          <div className="hero-art" aria-hidden="true">
            <img src="/images/p-005.jpg" alt="" />
            <img src="/images/p-011.jpg" alt="" />
            <img src="/images/p-008.jpg" alt="" />
            <div className="hero-note">
              <span className="item-icon"><Icon name="checkCircle" size={20} /></span>
              <div>
                <strong>Sold once, kept forever</strong>
                <span>No prints, no copies.</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="landing-section alt" id="services">
        <div className="landing-inner">
          <div className="section-head">
            <span className="kicker">What we make</span>
            <h2>Three ways to bring handmade art home</h2>
          </div>
          <div className="services">
            {SERVICES.map((s) => (
              <article key={s.title} className="card service">
                <span className="item-icon"><Icon name={s.icon} size={22} /></span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
                <p className="service-rule"><Icon name="check" size={15} /> {s.rule}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-inner">
          <div className="section-head row">
            <div>
              <span className="kicker">From the gallery</span>
              <h2>Painted by artists who learned from their elders</h2>
            </div>
            <Link className="button secondary" to="/signup">See prices and buy <Icon name="arrowRight" size={16} /></Link>
          </div>
          <ul className="featured">
            {FEATURED.map((p) => (
              <li key={p.image}>
                <img src={p.image} alt={p.title} loading="lazy" />
                <strong>{p.title}</strong>
                <span>by {p.artist}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="landing-section alt" id="how">
        <div className="landing-inner">
          <div className="section-head">
            <span className="kicker">How it works</span>
            <h2>From browsing to your wall in three steps</h2>
          </div>
          <ol className="steps">
            {STEPS.map((step, i) => (
              <li key={step.title} className="card">
                <span className="step-num">{i + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-inner">
          <div className="cta-band">
            <div>
              <h2>Find a piece you'll love</h2>
              <p>Create a free account to see prices, buy paintings and book the studio.</p>
            </div>
            <Link className="button large" to="/signup">Create your account</Link>
          </div>
        </div>
      </section>

      <footer className="landing-inner landing-foot">
        <span>Art Studio · a demo project for the GDGC VNRVJIET web dev task. No real payments are taken.</span>
        <Link to="/login">Studio login</Link>
      </footer>
    </div>
  );
}
