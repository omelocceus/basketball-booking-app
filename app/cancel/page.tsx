import Link from "next/link";

export default function CancelPage() {
  return (
    <main className="simple-page">
      <section className="simple-card">
        <h1>Booking not completed</h1>
        <p>Your card was not charged. Please choose a time slot again when you are ready.</p>
        <Link href="/">Return to booking</Link>
      </section>
    </main>
  );
}
