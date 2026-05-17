"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import styles from "./Navigation.module.css";

const navItems = [
  { name: "About", href: "/about" },
  { name: "FAQ", href: "/faq" },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className={styles.referenceNav} aria-label="Primary navigation">
      <Link href="/" className={styles.brand}>
        <span className={styles.brandText}>
          thegreatwallofadvertisment
        </span>
      </Link>

      <div className={styles.navLinks}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(isActive && styles.activeLink)}
            >
              {item.name}
            </Link>
          );
        })}

        <Link
          href="/#buy"
          aria-current={pathname === "/" ? "page" : undefined}
          className={cn(styles.claimLink, pathname === "/" && styles.activeClaimLink)}
        >
          Claim pixels
        </Link>
      </div>
    </nav>
  );
}
