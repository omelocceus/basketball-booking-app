-- schema.sql
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  date DATE NOT NULL,
  time_slot VARCHAR(50) NOT NULL,
  training_type VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schedule (
  id SERIAL PRIMARY KEY,
  day_of_week VARCHAR(20) NOT NULL,
  time_slot VARCHAR(50) NOT NULL,
  UNIQUE(day_of_week, time_slot)
);
