import Link from "next/link";

import { finalizeCheckoutSession } from "@/lib/payments/finalize-checkout-session";
import { getStripeServerClient, hasStripeEnv } from "@/lib/stripe/server";
import { hasSupabaseServiceEnv } from "@/lib/supabase/server";
import styles from "../checkout.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SuccessPageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function CheckoutSuccessPage({
  searchParams,
}: SuccessPageProps) {
  const { session_id: sessionId } = await searchParams;

  let finalizeMessage = "We are finalizing your ad placement.";
  let status: "success" | "warning" | "error" = "success";

  if (!sessionId) {
    finalizeMessage =
      "We could not confirm the checkout return link. If payment was successful, contact support with the email used at checkout.";
    status = "warning";
  } else if (!hasStripeEnv() || !hasSupabaseServiceEnv()) {
    finalizeMessage =
      "Server payment environment is incomplete, so auto-finalization on this page is unavailable.";
    status = "warning";
  } else {
    try {
      const stripe = getStripeServerClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const finalizeResult = await finalizeCheckoutSession(session);

      if (finalizeResult.ok) {
        finalizeMessage =
          finalizeResult.state === "already-finalized"
            ? "Your ad was already finalized and should now appear on the wall."
            : "Your ad has been finalized and should now appear on the wall.";
        status = "success";
      } else if (finalizeResult.state === "waiting-payment") {
        finalizeMessage =
          "Payment confirmation is still processing. Refresh this page in a few seconds.";
        status = "warning";
      } else {
        finalizeMessage = finalizeResult.message;
        status = "error";
      }
    } catch (error) {
      finalizeMessage =
        error instanceof Error
          ? `Could not finalize session on return: ${error.message}`
          : "Could not finalize session on return.";
      status = "error";
    }
  }

  return (
    <main className={styles.checkoutPage}>
      <section className={styles.shell}>
        <div className={`${styles.panel} ${styles[status]}`}>
          <div className={styles.panelInner}>
            <span className={styles.statusPill}>
              <span className={styles.statusDot} />
              Payment received
            </span>
            <h1 className={styles.title}>Your pixels are being placed.</h1>
            <p className={styles.description}>
              The payment is complete. We now publish your stored ad preview to
              the wall and make the selected region live for its lease period.
            </p>
            <p className={styles.message}>{finalizeMessage}</p>

            <div className={styles.steps} aria-label="Placement progress">
              <div className={styles.step}>
                <span className={styles.stepNumber}>1</span>
                <p className={styles.stepTitle}>Payment captured</p>
                <p className={styles.stepText}>Stripe confirmed the checkout.</p>
              </div>
              <div className={styles.step}>
                <span className={styles.stepNumber}>2</span>
                <p className={styles.stepTitle}>Preview published</p>
                <p className={styles.stepText}>The stored ad draft is attached.</p>
              </div>
              <div className={styles.step}>
                <span className={styles.stepNumber}>3</span>
                <p className={styles.stepTitle}>Region live</p>
                <p className={styles.stepText}>The wall now renders the placement.</p>
              </div>
            </div>

            <div className={styles.actions}>
              <Link href="/" className={styles.primaryAction}>
                Back to wall
              </Link>
              <Link href="/faq" className={styles.secondaryAction}>
                Read FAQ
              </Link>
            </div>
            <p className={styles.supportNote}>
              For support, use the email from checkout. Internal payment and
              reservation IDs are kept in the system, not shown here.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
