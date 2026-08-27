"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Home", color: "var(--color-ink-soft)" },
  { href: "/workplaces", label: "Sites", color: "var(--color-secondary)" },
  { href: "/employees", label: "Team", color: "var(--color-primary)" },
  { href: "/attendance", label: "Attendance", color: "var(--color-half)" },
  { href: "/payroll", label: "Payroll", color: "var(--color-full)" },
];

export default function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="tabbar">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link key={t.href} href={t.href} className={active ? "active" : ""}>
            <span
              className="tabicon"
              style={{ background: active ? t.color : "var(--color-empty)" }}
            />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
