"use client";

import { BuildingComplex, Flag, House, Receipt, UserGroup } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { icon: <House />, href: "/", label: "Home", color: "var(--color-ink-soft)" },
  { icon: <BuildingComplex />, href: "/workplaces", label: "Sites", color: "var(--color-secondary)" },
  { icon: <UserGroup /> ,href: "/employees", label: "Team", color: "var(--color-primary)" },
  { icon: <Flag />,href: "/attendance", label: "Attendance", color: "var(--color-half)" },
  { icon: <Receipt />,href: "/payroll", label: "Payroll", color: "var(--color-full)" },
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
              // style={{ background: active ? t.color : "var(--color-empty)" }}
            >
              {t.icon}
            </span>

            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
