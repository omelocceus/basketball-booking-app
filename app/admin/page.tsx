"use client";

import { useEffect, useMemo, useState } from "react";
import type { Booking, TrainingType } from "../../types/booking";

const fallbackPrices: Record<TrainingType, number> = {
  oncourt: 60,
  sand: 50,
  weight: 50
};

function trainingClass(type: TrainingType) {
  return type;
}

export default function AdminPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filterDate, setFilterDate] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const filteredBookings = useMemo(() => {
    if (!filterDate) return bookings;
    return bookings.filter((booking) => booking.date === filterDate);
  }, [bookings, filterDate]);

  const today = new Date().toISOString().split("T")[0];
  const todayBookings = bookings.filter((booking) => booking.date === today).length;
  const totalRevenue = bookings.reduce((sum, booking) => {
    if (typeof booking.amount_paid === "number") {
      return sum + booking.amount_paid / 100;
    }

    return sum + fallbackPrices[booking.training_type];
  }, 0);

  async function loadBookings() {
    setLoading(true);
    setError("");

    try {
      const adminToken =
        typeof window !== "undefined" ? window.localStorage.getItem("ADMIN_API_TOKEN") : "";
      const response = await fetch("/api/bookings", {
        headers: adminToken ? { "x-admin-token": adminToken } : {}
      });
      const data = (await response.json()) as Booking[] | { error?: string };

      if (!response.ok) {
        throw new Error("error" in data && data.error ? data.error : "Unable to load bookings.");
      }

      setBookings(data as Booking[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load bookings.");
    } finally {
      setLoading(false);
    }
  }

  async function cancelBooking(id: number) {
    if (!window.confirm("Cancel this booking?")) return;

    try {
      const adminToken = window.localStorage.getItem("ADMIN_API_TOKEN");
      const response = await fetch(`/api/bookings/${id}`, {
        method: "DELETE",
        headers: adminToken ? { "x-admin-token": adminToken } : {}
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Unable to cancel booking.");
      }

      await loadBookings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to cancel booking.");
    }
  }

  useEffect(() => {
    void loadBookings();
  }, []);

  return (
    <main className="admin-page">
      <div className="dashboard">
        <aside className="sidebar">
          <div className="brand-mark">All Around Sports Development</div>
          <h2>Dashboard</h2>

          <div className="sidebar-stats">
            <div className="mini-card">
              <span>Total</span>
              <h3>{bookings.length}</h3>
            </div>
            <div className="mini-card">
              <span>Today</span>
              <h3>{todayBookings}</h3>
            </div>
            <div className="mini-card">
              <span>Revenue</span>
              <h3>${totalRevenue.toFixed(0)}</h3>
            </div>
          </div>
        </aside>

        <section className="main-content">
          <div className="top-header">
            <div>
              <h1>Upcoming Sessions</h1>
              <p>Manage bookings and sessions</p>
            </div>
            <input
              className="admin-filter"
              aria-label="Filter bookings by date"
              type="date"
              value={filterDate}
              onChange={(event) => setFilterDate(event.target.value)}
            />
          </div>

          {error ? <p className="message error">{error}</p> : null}

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="empty-row" colSpan={5}>
                      Loading bookings...
                    </td>
                  </tr>
                ) : null}

                {!loading && filteredBookings.length === 0 ? (
                  <tr>
                    <td className="empty-row" colSpan={5}>
                      No bookings found.
                    </td>
                  </tr>
                ) : null}

                {!loading
                  ? filteredBookings.map((booking) => (
                      <tr key={booking.id}>
                        <td>{booking.name}</td>
                        <td>{booking.date}</td>
                        <td>{booking.time_slot}</td>
                        <td>
                          <span className={`tag ${trainingClass(booking.training_type)}`}>
                            {booking.training_type}
                          </span>
                        </td>
                        <td>
                          <div className="actions">
                            <button className="complete-button" type="button">
                              Done
                            </button>
                            <button
                              className="cancel-button"
                              type="button"
                              onClick={() => cancelBooking(booking.id)}
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
