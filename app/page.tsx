"use client";

import { useState } from "react";
import type { TimeSlot, TrainingType } from "../types/booking";
import { trainingTypeLabels } from "../types/booking";

type BookingForm = {
  name: string;
  email: string;
  phone: string;
  date: string;
  trainingType: TrainingType;
};

const initialForm: BookingForm = {
  name: "",
  email: "",
  phone: "",
  date: "",
  trainingType: "oncourt"
};

export default function BookingPage() {
  const [form, setForm] = useState<BookingForm>(initialForm);
  const [times, setTimes] = useState<TimeSlot[]>([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">("error");
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [creatingCheckout, setCreatingCheckout] = useState(false);

  function updateForm<K extends keyof BookingForm>(key: K, value: BookingForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function loadAvailableTimes() {
    if (!form.date) {
      setMessageType("error");
      setMessage("Please select a date first.");
      return;
    }

    setLoadingTimes(true);
    setMessage("");
    setSelectedTime("");

    try {
      const response = await fetch(`/api/available-times?date=${form.date}`);
      const data = (await response.json()) as TimeSlot[] | { error?: string };

      if (!response.ok) {
        throw new Error("error" in data && data.error ? data.error : "Unable to load times.");
      }

      setTimes(data as TimeSlot[]);

      if ((data as TimeSlot[]).length === 0) {
        setMessageType("error");
        setMessage("No available times for this date.");
      }
    } catch (err) {
      setMessageType("error");
      setMessage(err instanceof Error ? err.message : "Error loading times.");
    } finally {
      setLoadingTimes(false);
    }
  }

  async function createCheckout() {
    if (!form.name || !form.email || !form.phone || !form.date || !selectedTime) {
      setMessageType("error");
      setMessage("Please complete all fields and select a time.");
      return;
    }

    setCreatingCheckout(true);
    setMessage("");

    try {
      const response = await fetch("/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...form,
          time: selectedTime
        })
      });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Payment session failed.");
      }

      window.location.href = data.url;
    } catch (err) {
      setMessageType("error");
      setMessage(err instanceof Error ? err.message : "Payment session failed.");
      setCreatingCheckout(false);
    }
  }

  return (
    <main className="booking-page">
      <div className="brand-mark">All Around Sports Development</div>

      <section className="booking-card" aria-labelledby="booking-title">
        <h1 id="booking-title">Book a Training Session</h1>

        <label htmlFor="datePicker">Select Date:</label>
        <input
          id="datePicker"
          type="date"
          value={form.date}
          onChange={(event) => updateForm("date", event.target.value)}
        />

        <button className="primary-button" type="button" onClick={loadAvailableTimes}>
          {loadingTimes ? "Loading..." : "View Available Times"}
        </button>

        <h2>Available Times</h2>
        <div className="time-grid" aria-live="polite">
          {times.map((slot) => (
            <button
              className={`time-button ${selectedTime === slot.time_slot ? "selected" : ""}`}
              key={slot.time_slot}
              type="button"
              onClick={() => setSelectedTime(slot.time_slot)}
            >
              {slot.time_slot}
            </button>
          ))}
        </div>

        <hr className="booking-divider" />

        <h2>Book Selected Time</h2>

        <input
          aria-label="Name"
          placeholder="Name"
          type="text"
          value={form.name}
          onChange={(event) => updateForm("name", event.target.value)}
        />
        <input
          aria-label="Email"
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(event) => updateForm("email", event.target.value)}
        />
        <input
          aria-label="Phone number"
          placeholder="Phone number"
          type="tel"
          value={form.phone}
          onChange={(event) => updateForm("phone", event.target.value)}
        />

        <label htmlFor="trainingType">Select Training Type:</label>
        <select
          id="trainingType"
          value={form.trainingType}
          onChange={(event) => updateForm("trainingType", event.target.value as TrainingType)}
        >
          {Object.entries(trainingTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <button
          className="primary-button"
          type="button"
          disabled={creatingCheckout}
          onClick={createCheckout}
        >
          {creatingCheckout ? "Starting checkout..." : "Book Now"}
        </button>

        {message ? <p className={`message ${messageType}`}>{message}</p> : null}
      </section>
    </main>
  );
}
