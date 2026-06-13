import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Monthly Survival",
  description: "Local month-to-month survival dashboard for family finance.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
