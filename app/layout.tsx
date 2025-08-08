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
  title: "Stillness – Minimal Meditation Timer",
  description: "A minimalist meditation timer with gentle chimes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div aria-hidden className="zen-bg">
          <span className="zen-blob zen-blob--1" />
          <span className="zen-blob zen-blob--2" />
          <span className="zen-blob zen-blob--3" />
        </div>
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
