import Link from "next/link";

type CancelPageProps = {
  searchParams: Promise<{ reservation_id?: string }>;
};

export default async function CheckoutCancelPage({
  searchParams,
}: CancelPageProps) {
  const { reservation_id: reservationId } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-6 py-16 text-white">
      <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-6">
        <h1 className="text-2xl font-semibold">Checkout cancelled</h1>
        <p className="mt-3 text-sm text-white/80">
          Your payment was not completed. The reservation remains valid until its
          expiry timestamp, then it is released automatically.
        </p>
        <p className="mt-3 text-xs text-white/60">
          Reservation: {reservationId ?? "N/A"}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/"
            className="rounded-md border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            Back to Pixel Sheet
          </Link>
          <Link
            href={reservationId ? `/?reservation_id=${reservationId}` : "/"}
            className="rounded-md border border-amber-200/60 bg-amber-200/20 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-200/30"
          >
            Retry from Reservation
          </Link>
        </div>
      </div>
    </main>
  );
}
