import Link from "next/link";
import type { CSSProperties } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  MapPinned,
  MousePointer2,
  ScanSearch,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import styles from "./about.module.css";

const flowSteps = [
  {
    icon: MousePointer2,
    title: "Select a region",
    text: "Pan the wall, switch to Select, and drag the exact rectangle you want people to notice",
  },
  {
    icon: ScanSearch,
    title: "See the quote",
    text: "The wall calculates size, coordinates, total pixels, and price before you commit",
  },
  {
    icon: CreditCard,
    title: "Reserve and pay",
    text: "Lock the region, attach your destination link, and finish through checkout",
  },
  {
    icon: MapPinned,
    title: "Go live",
    text: "Your ad becomes a clickable location on the public map for the lease term",
  },
];

const ownership = [
  "A visible coordinate range on an infinite wall",
  "A clickable destination for your campaign or project",
  "A fixed $2-per-pixel quote before checkout",
  "A stored ad preview that publishes after payment",
  "A one-year lease so the wall keeps moving",
];

const useCases = [
  "Product launches",
  "Indie portfolios",
  "Fundraisers",
  "Event pages",
  "Local shops",
  "Creator drops",
  "Communities",
  "Newsletter launches",
];

export default function AboutPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Visible internet real estate</span>
        <h1>Own a tiny piece of internet space</h1>
        <p>
          The Great Wall of Advertisement is an infinite pixel ad map where brands,
          creators, and projects can claim visible space, attach a link, and
          make a small public mark that people can revisit.
        </p>
        <div className={styles.heroStats} aria-label="Wall facts">
          <span><strong>$2</strong> per pixel</span>
          <span><strong>365</strong> day lease</span>
          <span><strong>Live</strong> clickable map</span>
        </div>
        <div className={styles.actions}>
          <Link href="/#buy" className={styles.primaryAction}>
            Claim pixels
          </Link>
          <Link href="/faq" className={styles.secondaryAction}>
            See the FAQ
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className={styles.ideaSection} aria-label="Why the wall exists">
        <div className={styles.sectionCopy}>
          <span>Why it exists</span>
          <h2>A simple internet protocol, rebuilt as a usable ad map</h2>
          <p>
            The original pixel-wall idea was powerful because anyone could
            understand it: buy a visible square, add a link, and become part of
            the page. This version keeps that clarity, but adds modern selection,
            quoting, stored ad previews, checkout, and leases so the wall can
            stay active instead of becoming a forgotten directory.
          </p>
        </div>

        <div className={styles.wallModel} aria-hidden="true">
          <div className={styles.scanLine} />
          {Array.from({ length: 96 }).map((_, index) => (
            <span
              key={index}
              className={
                index === 18 ||
                index === 19 ||
                index === 20 ||
                index === 34 ||
                index === 35 ||
                index === 36 ||
                index === 60 ||
                index === 61
                  ? styles.claimedCell
                  : ""
              }
            />
          ))}
          <div className={styles.mapBadge}>
            <MapPinned size={14} aria-hidden="true" />
            Live coordinate map
          </div>
        </div>
      </section>

      <section className={styles.flowSection} aria-label="How buying works">
        <div className={styles.flowHeader}>
          <h2>Buying pixels should feel obvious</h2>
          <p>
            The whole flow is designed around confidence: pick the place, know
            the price, reserve it, then publish a link people can actually click.
          </p>
        </div>

        <ol className={styles.flowTimeline}>
          {flowSteps.map((step, index) => {
            const Icon = step.icon;

            return (
              <li
                key={step.title}
                style={{ "--delay": `${index * 110}ms` } as CSSProperties}
              >
                <div className={styles.flowMarker}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <Icon aria-hidden="true" />
                </div>
                <div className={styles.flowStepCopy}>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className={styles.ownershipSection} aria-label="What buyers get">
        <div className={styles.purchaseCard}>
          <div className={styles.purchaseTop}>
            <span>Region preview</span>
            <strong>128 x 64 px</strong>
          </div>
          <div className={styles.selectionPreview} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <dl>
            <div>
              <dt>Pixels</dt>
              <dd>8,192</dd>
            </div>
            <div>
              <dt>Lease</dt>
              <dd>365 days</dd>
            </div>
            <div>
              <dt>Rate</dt>
              <dd>$2 / pixel</dd>
            </div>
          </dl>
        </div>

        <div className={styles.ownershipCopy}>
          <span>What you get</span>
          <h2>Not a banner impression, a place people can point to</h2>
          <div>
            {ownership.map((item) => (
              <p key={item}>
                <CheckCircle2 size={18} aria-hidden="true" />
                {item}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.integritySection} aria-label="Why leases matter">
        <div className={styles.integrityIcon}>
          <ShieldCheck size={34} aria-hidden="true" />
        </div>
        <h2>The wall should stay alive, not slowly rot</h2>
        <p>
          Permanent ad directories decay when links die and owners disappear.
          Time-boxed leases make the wall easier to keep current: expired space
          can come back, active buyers stay visible, and visitors are more likely
          to find links that still matter
        </p>
      </section>

      <section className={styles.useCaseSection} aria-label="Use cases">
        <div>
          <Sparkles size={20} aria-hidden="true" />
          <h2>Use it when a normal link feels too invisible</h2>
        </div>
        <div className={styles.marquee} aria-hidden="true">
          <div>
            {[...useCases, ...useCases].map((item, index) => (
              <span key={`${item}-${index}`}>{item}</span>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <h2>Find a square, make it yours</h2>
        <Link href="/#buy" className={styles.primaryAction}>
          Claim pixels
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
