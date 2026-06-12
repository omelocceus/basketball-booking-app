CREATE TABLE IF NOT EXISTS schedule (
  id BIGSERIAL PRIMARY KEY,
  day_of_week TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (day_of_week, time_slot)
);

CREATE TABLE IF NOT EXISTS bookings (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  booking_date DATE NOT NULL,
  time_slot TEXT NOT NULL,
  training_type TEXT NOT NULL CHECK (training_type IN ('oncourt', 'sand', 'weight')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'expired')),
  stripe_session_id TEXT UNIQUE,
  amount_paid INTEGER,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS bookings_one_active_slot
  ON bookings (booking_date, time_slot)
  WHERE status IN ('pending', 'confirmed');

INSERT INTO schedule (day_of_week, time_slot)
VALUES
  ('Monday', '09:00'),
  ('Monday', '10:00'),
  ('Monday', '11:00'),
  ('Tuesday', '09:00'),
  ('Tuesday', '10:00'),
  ('Tuesday', '11:00'),
  ('Wednesday', '09:00'),
  ('Wednesday', '10:00'),
  ('Wednesday', '11:00'),
  ('Thursday', '09:00'),
  ('Thursday', '10:00'),
  ('Thursday', '11:00'),
  ('Friday', '09:00'),
  ('Friday', '10:00'),
  ('Friday', '11:00'),
  ('Saturday', '09:00'),
  ('Saturday', '10:00'),
  ('Saturday', '11:00')
ON CONFLICT (day_of_week, time_slot) DO NOTHING;
