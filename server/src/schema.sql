-- Art studio database. Safe to run more than once (everything is IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('customer', 'studio')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- one account per email, ignoring upper/lower case
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (lower(email));

-- A login session. The cookie holds a random token; only its SHA-256 hash is stored here.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS paintings (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  artist      TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price       INT  NOT NULL CHECK (price > 0),
  image_url   TEXT,
  status      TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'sold')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id           SERIAL PRIMARY KEY,
  painting_id  INT  NOT NULL REFERENCES paintings(id),
  customer_id  INT  NOT NULL REFERENCES users(id),
  price        INT  NOT NULL,
  status       TEXT NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ
);
-- Safety net: a painting can have at most one live (placed) order at a time.
CREATE UNIQUE INDEX IF NOT EXISTS orders_one_placed_per_painting
  ON orders (painting_id) WHERE status = 'placed';

CREATE TABLE IF NOT EXISTS bookings (
  id            SERIAL PRIMARY KEY,
  customer_id   INT  NOT NULL REFERENCES users(id),
  date          DATE NOT NULL,
  wall_sqft     INT  NOT NULL CHECK (wall_sqft BETWEEN 10 AND 500),
  address       TEXT NOT NULL,
  rate_per_sqft INT  NOT NULL,
  price         INT  NOT NULL,
  status        TEXT NOT NULL DEFAULT 'requested'
                CHECK (status IN ('requested', 'confirmed', 'declined', 'cancelled')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Each date can be booked only once. Declined or cancelled bookings free the date again.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_one_active_per_date
  ON bookings (date) WHERE status IN ('requested', 'confirmed');

CREATE TABLE IF NOT EXISTS pottery_items (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS glazes (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pottery_requests (
  id          SERIAL PRIMARY KEY,
  customer_id INT  NOT NULL REFERENCES users(id),
  item_id     TEXT NOT NULL REFERENCES pottery_items(id),
  glaze_id    TEXT NOT NULL REFERENCES glazes(id),
  quantity    INT  NOT NULL CHECK (quantity BETWEEN 1 AND 12),
  needed_by   DATE NOT NULL,
  notes       TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'requested'
              CHECK (status IN ('requested', 'accepted', 'declined', 'cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hosts like Supabase also expose tables through an auto-generated REST API (the "Data API").
-- Row Level Security with no policies blocks that API completely. This app is unaffected:
-- it connects as the tables' owner, and owners are not subject to row security.
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE paintings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pottery_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE glazes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE pottery_requests ENABLE ROW LEVEL SECURITY;
