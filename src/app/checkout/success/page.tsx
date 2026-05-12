import Link from "next/link";

import { finalizeCheckoutSession } from "@/lib/payments/finalize-checkout-session";
import { getStripeServerClient, hasStripeEnv } from "@/lib/stripe/server";
import { hasSupabaseServiceEnv } from "@/lib/supabase/server";

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
  let finalizeMessageClass = "text-emerald-950";

  if (!sessionId) {
    finalizeMessage =
      "Missing checkout session id in URL. If payment was successful, contact support with your email.";
    finalizeMessageClass = "text-amber-950";
  } else if (!hasStripeEnv() || !hasSupabaseServiceEnv()) {
    finalizeMessage =
      "Server payment environment is incomplete, so auto-finalization on this page is unavailable.";
    finalizeMessageClass = "text-amber-950";
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
        finalizeMessageClass = "text-emerald-950";
      } else if (finalizeResult.state === "waiting-payment") {
        finalizeMessage =
          "Payment confirmation is still processing. Refresh this page in a few seconds.";
        finalizeMessageClass = "text-amber-950";
      } else {
        finalizeMessage = finalizeResult.message;
        finalizeMessageClass = "text-rose-950";
      }
    } catch (error) {
      finalizeMessage =
        error instanceof Error
          ? `Could not finalize session on return: ${error.message}`
          : "Could not finalize session on return.";
      finalizeMessageClass = "text-rose-950";
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-6 py-16 text-emerald-950">
      <div className="rounded-2xl border border-emerald-300/30 bg-emerald-50 p-6">
        <h1 className="text-2xl font-semibold text-emerald-950">Payment received</h1>
        <p className="mt-3 text-sm text-emerald-900">
          Your reservation payment has been captured. We now auto-publish your
          ad placement after payment finalization.
        </p>
        <p className={`mt-3 text-sm font-medium ${finalizeMessageClass}`}>{finalizeMessage}</p>
        <p className="mt-3 text-xs text-emerald-800">Session: {sessionId ?? "N/A"}</p>

        <div className="mt-5">
          <Link
            href="/"
            className="inline-flex rounded-md border border-emerald-600/30 bg-emerald-600/10 px-3 py-2 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-600/20"
          >
            Back to Pixel Sheet
          </Link>
        </div>
      </div>
    </main>
  );
}
