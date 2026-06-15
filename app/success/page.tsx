import Link from "next/link";

export default function SuccessPage() {
  return (
    <main className="simple-page">
      <section className="simple-card">
        <h1>Booking confirmed</h1>
        <p>Your payment was received. You will get a confirmation email from Stripe.</p>
        <Link href="/">Book another session</Link>
      </section>
    </main>
  );
}
