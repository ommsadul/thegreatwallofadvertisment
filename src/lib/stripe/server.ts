import Stripe from "stripe";

let stripeSingleton: Stripe | null = null;

function isLikelyPlaceholder(value: string): boolean {
  const normalized = value.trim().toLowerCase();

  return (
    normalized.includes("xxx") ||
    normalized.includes("your-") ||
    normalized.includes("placeholder")
  );
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function hasStripeEnv(): boolean {
  const key = process.env.STRIPE_SECRET_KEY;

  return Boolean(
    key && key.startsWith("sk_") && !isLikelyPlaceholder(key),
  );
}

export function hasStripeWebhookEnv(): boolean {
  const key = process.env.STRIPE_SECRET_KEY;
  const webhook = process.env.STRIPE_WEBHOOK_SECRET;

  return Boolean(
    key &&
      key.startsWith("sk_") &&
      !isLikelyPlaceholder(key) &&
      webhook &&
      webhook.startsWith("whsec_") &&
      !isLikelyPlaceholder(webhook),
  );
}

export function getStripeServerClient(): Stripe {
  if (stripeSingleton) {
    return stripeSingleton;
  }

  stripeSingleton = new Stripe(getRequiredEnv("STRIPE_SECRET_KEY"), {
    apiVersion: "2026-04-22.dahlia",
  });

  return stripeSingleton;
}

export function getStripeWebhookSecret(): string {
  return getRequiredEnv("STRIPE_WEBHOOK_SECRET");
}
