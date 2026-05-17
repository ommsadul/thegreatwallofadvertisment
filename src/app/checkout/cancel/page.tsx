import Link from "next/link";

import styles from "../checkout.module.css";

type CancelPageProps = {
  searchParams: Promise<{ reservation_id?: string }>;
};

export default async function CheckoutCancelPage({
  searchParams,
}: CancelPageProps) {
  const { reservation_id: reservationId } = await searchParams;

  return (
    <main className={styles.checkoutPage}>
      <section className={styles.shell}>
        <div className={`${styles.panel} ${styles.warning}`}>
          <div className={styles.panelInner}>
            <span className={styles.statusPill}>
              <span className={styles.statusDot} />
              Checkout cancelled
            </span>
            <h1 className={styles.title}>No charge was made.</h1>
            <p className={styles.description}>
              The checkout did not complete. Your held pixels will stay reserved
              briefly, then release automatically if you do not finish payment.
            </p>
            <p className={styles.message}>
              Return to the wall, select the region again if needed, and generate
              a fresh preview before starting checkout.
            </p>

            <div className={styles.actions}>
              <Link href="/" className={styles.primaryAction}>
                Back to wall
              </Link>
              <Link
                href={reservationId ? `/?reservation_id=${reservationId}` : "/"}
                className={styles.secondaryAction}
              >
                Try again
              </Link>
            </div>
            <p className={styles.supportNote}>
              We keep the reservation reference internally while it is active;
              there is no need to copy an ID from this page.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
