import { Link } from 'react-router';
import { useApi } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import Icon from '../../components/Icon.jsx';
import { AsyncView, PageHeader } from '../../components/ui.jsx';
import { money, niceDate } from '../../format.js';
import { DateTile } from '../Bookings.jsx';

function Stat({ icon, label, value, sub }) {
  return (
    <div className="card stat">
      <div className="stat-top">{label}<span className="stat-icon"><Icon name={icon} size={18} /></span></div>
      <div className="stat-value">{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

// The studio's home: headline numbers and everything waiting for a decision.
export default function Dashboard() {
  const { user } = useAuth();
  const sources = [useApi('/paintings'), useApi('/orders'), useApi('/bookings'), useApi('/pottery'), useApi('/options')];
  const [paintings, orders, bookings, pottery, options] = sources;

  // One combined loading / error state for the five requests.
  const state = {
    loading: sources.some((s) => s.loading),
    error: sources.find((s) => s.error)?.error ?? null,
    data: sources.every((s) => s.data)
      ? {
          paintings: paintings.data.paintings, orders: orders.data.orders, bookings: bookings.data.bookings,
          pottery: pottery.data.requests, today: options.data.today,
        }
      : null,
    reload: () => sources.forEach((s) => s.reload()),
  };

  return (
    <>
      <PageHeader title={`Good to see you, ${user.name}`} subtitle="Here’s what’s happening at the studio." />
      <AsyncView state={state}>
        {(d) => {
          const placed = d.orders.filter((o) => o.status === 'placed');
          const pendingBookings = d.bookings.filter((b) => b.status === 'requested');
          const pendingPottery = d.pottery.filter((r) => r.status === 'requested');
          // bookings come sorted by date, so the first upcoming one is the next mural
          const upcoming = d.bookings.filter((b) => b.status === 'confirmed' && b.date >= d.today);
          const available = d.paintings.filter((p) => p.status === 'available').length;
          return (
            <>
              <div className="stats">
                <Stat icon="rupee" label="Painting sales" value={money(placed.reduce((sum, o) => sum + o.price, 0))}
                  sub={`${placed.length} active order${placed.length === 1 ? '' : 's'}`} />
                <Stat icon="inbox" label="Waiting for you" value={pendingBookings.length + pendingPottery.length}
                  sub={`${pendingBookings.length} booking${pendingBookings.length === 1 ? '' : 's'} · ${pendingPottery.length} pottery`} />
                <Stat icon="calendar" label="Upcoming murals" value={upcoming.length}
                  sub={upcoming[0] ? `Next: ${niceDate(upcoming[0].date)}` : 'None scheduled'} />
                <Stat icon="image" label="Paintings on sale" value={available}
                  sub={`${d.paintings.length - available} sold of ${d.paintings.length}`} />
              </div>

              <div className="panels">
                <section className="card card-pad">
                  <div className="card-title">
                    <h2><Icon name="calendar" /> Bookings to review</h2>
                    <Link to="/bookings" className="small">View all <Icon name="arrowRight" size={14} /></Link>
                  </div>
                  {pendingBookings.length === 0 ? <p className="faint">All caught up. No bookings waiting.</p> : (
                    <ul className="queue">
                      {pendingBookings.slice(0, 5).map((b) => (
                        <li key={b.id}>
                          <DateTile date={b.date} />
                          <div className="list-item-main">
                            <div className="cell-main">{b.customer.name}</div>
                            <div className="cell-sub">{b.wallSqft} sq ft · {money(b.price)}</div>
                          </div>
                          <Link to="/bookings" className="button secondary small">Review</Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="card card-pad">
                  <div className="card-title">
                    <h2><Icon name="vase" /> Pottery to review</h2>
                    <Link to="/pottery" className="small">View all <Icon name="arrowRight" size={14} /></Link>
                  </div>
                  {pendingPottery.length === 0 ? <p className="faint">All caught up. No requests waiting.</p> : (
                    <ul className="queue">
                      {pendingPottery.slice(0, 5).map((r) => (
                        <li key={r.id}>
                          <span className="item-icon"><Icon name="vase" size={18} /></span>
                          <div className="list-item-main">
                            <div className="cell-main">{r.quantity} × {r.item.name}</div>
                            <div className="cell-sub">{r.customer.name} · needed by {niceDate(r.neededBy)}</div>
                          </div>
                          <Link to="/pottery" className="button secondary small">Review</Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </>
          );
        }}
      </AsyncView>
    </>
  );
}
