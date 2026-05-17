import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  HelpCircle,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import styles from "./faq.module.css";

const faqs = [
  {
    category: "Lease",
    q: "How long does my ad stay on the wall?",
    a: "Every pixel purchase includes a one-year lease. After the lease ends, the region can become available again unless renewal support is added before then.",
  },
  {
    category: "Pricing",
    q: "How much does a region cost?",
    a: "The current rate is $2 per pixel. Your quote is based on the width and height of the rectangle you select, so you can see the price before reserving anything.",
  },
  {
    category: "Checkout",
    q: "Why do I need to reserve before paying?",
    a: "A reservation temporarily locks your selected coordinates so another buyer cannot take the same region while you are preparing checkout details.",
  },
  {
    category: "Publishing",
    q: "What happens after payment?",
    a: "After successful payment finalization, the stored ad preview is published to the wall with its destination link.",
  },
  {
    category: "Edits",
    q: "Can I change my ad image or link later?",
    a: "For this version, ad details are treated as final once payment is complete. A future buyer dashboard could make active regions easier to manage.",
  },
  {
    category: "Policy",
    q: "What kind of content is allowed?",
    a: "Legal, safe, non-malicious content is the baseline. Explicit material, hate speech, malicious links, or unsafe destinations can be rejected and refunded.",
  },
  {
    category: "Grid",
    q: "How does the infinite wall work?",
    a: "The wall uses coordinates in every direction instead of a fixed board, so space can expand as more regions are claimed.",
  },
  {
    category: "Support",
    q: "I paid but do not see my ad yet.",
    a: "Refresh the wall first. If checkout completed and the placement still has not appeared after 10 minutes, contact support with the email used during checkout.",
  },
];

const quickFacts = [
  {
    icon: CreditCard,
    title: "$2 per pixel",
    text: "Flat pricing before checkout",
  },
  {
    icon: Clock3,
    title: "365-day lease",
    text: "Time-boxed so the wall stays fresh",
  },
  {
    icon: ShieldCheck,
    title: "Content review",
    text: "Unsafe links can be rejected",
  },
];

export default function FAQPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroIcon}>
          <HelpCircle size={24} aria-hidden="true" />
        </div>
        <h1>Answers before you claim your pixels</h1>
        <p>
          Clear notes on pricing, leases, reservations, checkout, allowed
          content, and what happens after your ad goes live.
        </p>
      </section>

      <section className={styles.quickFacts} aria-label="Quick facts">
        <Card className={styles.factsCard} size="sm">
          <CardHeader className={styles.factsHeader}>
            <div className={styles.factsIntro}>
              <CardTitle>Before you claim</CardTitle>
              <CardDescription>
                The core rules are intentionally simple so the wall stays easy
                to understand before checkout.
              </CardDescription>
            </div>
            <CardAction>
              <Badge variant="secondary" className={styles.factsBadge}>
                Claim rules
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className={styles.factsContent}>
            {quickFacts.map((fact, index) => {
              const Icon = fact.icon;

              return (
                <div key={fact.title} className={styles.factItem}>
                  <div className={styles.factIcon}>
                    <Icon aria-hidden="true" />
                  </div>
                  <div className={styles.factCopy}>
                    <h2>{fact.title}</h2>
                    <p>{fact.text}</p>
                  </div>
                  {index < quickFacts.length - 1 ? (
                    <Separator
                      orientation="vertical"
                      className={styles.factRule}
                    />
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <section className={styles.faqShell} aria-label="Frequently asked questions">
        <aside>
          <span>FAQ</span>
          <h2>Everything important in one place</h2>
          <p>
            Start here if you are choosing a region, checking price, or trying
            to understand what you are buying.
          </p>
          <Link href="/about">
            Read the project story
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </aside>

        <div className={styles.faqList}>
          {faqs.map((faq, index) => (
            <details key={faq.q} open={index === 0}>
              <summary>
                <span>{faq.category}</span>
                <strong>{faq.q}</strong>
                <ArrowRight size={18} aria-hidden="true" />
              </summary>
              <p>{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className={styles.supportSection}>
        <div className={styles.supportIcon}>
          <Mail size={25} aria-hidden="true" />
        </div>
        <h2>Still need help?</h2>
        <p>
          Send the email used during checkout, your destination link, selected
          coordinates if you remember them, and a short description of the issue.
        </p>
        <a href="mailto:support@2milliondollarwall.com">
          Contact support
          <ArrowRight size={17} aria-hidden="true" />
        </a>
      </section>

      <section className={styles.finalCta}>
        <CheckCircle2 size={22} aria-hidden="true" />
        <h2>Ready when your region is</h2>
        <Link href="/#buy">
          Claim pixels
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
