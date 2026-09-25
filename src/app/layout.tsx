import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "NEXORA | Workforce. Recruitment. HR solutions.",
    template: "%s | NEXORA",
  },
  description:
    "Connected workforce, recruitment, client collaboration, and employee operations for growing organizations.",
  applicationName: "NEXORA",
  keywords: [
    "workforce management",
    "recruitment",
    "staffing",
    "human resources",
    "employee management",
  ],
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  openGraph: {
    type: "website",
    siteName: "NEXORA",
    title: "NEXORA | Workforce. Recruitment. HR solutions.",
    description:
      "Move from manpower requirement to a confident hire with one connected platform.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
