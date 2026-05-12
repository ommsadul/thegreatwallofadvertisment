"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Globe, Info, HelpCircle, Plus } from "lucide-react";

const navItems = [
  { name: "Explore", href: "/", icon: Globe },
  { name: "About", href: "/about", icon: Info },
  { name: "FAQ", href: "/faq", icon: HelpCircle },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-fit px-4">
      <nav className="flex items-center gap-1 p-1 rounded border border-white/20 bg-black/60 backdrop-blur-md shadow-xl">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-2 px-3 py-1.5 rounded transition-colors duration-150 font-mono text-[11px] uppercase tracking-wider",
                isActive
                  ? "text-yellow-200 bg-white/10"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              )}
            >
              <Icon size={14} className={cn(
                "transition-colors",
                isActive ? "text-yellow-200" : "text-white/40"
              )} />
              <span>{item.name}</span>
            </Link>
          );
        })}
        
        <div className="w-px h-4 mx-1 bg-white/10" />

        <Link
          href="/#buy"
          className="flex items-center gap-2 px-3 py-1.5 rounded font-mono text-[11px] uppercase tracking-wider bg-yellow-200 text-black hover:bg-yellow-300 transition-colors font-bold"
        >
          <Plus size={14} />
          <span>Buy Pixels</span>
        </Link>
      </nav>
    </div>
  );
}
