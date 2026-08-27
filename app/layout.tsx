import type { Metadata, Viewport } from "next";
import "./globals.css";
import PinGate from "@/components/PinGate";
import NavBar from "@/components/NavBar";
import SwRegister from "@/components/SwRegister";

export const metadata: Metadata = {
  title: "Paint Co Payroll",
  description: "Weekly attendance & payroll for site employees",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Payroll",
  },
};

export const viewport: Viewport = {
  themeColor: "#c8963e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SwRegister />
        <PinGate>
          {children}
          <NavBar />
        </PinGate>
      </body>
    </html>
  );
}
