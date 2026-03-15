import type { Metadata } from "next";
import { Syne, DM_Mono, Lora } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";

import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["400", "500", "600", "700", "800"],
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-dm-mono",
  weight: ["300", "400", "500"],
});

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "RRQ Content Factory",
  description: "Autonomous AI-powered YouTube content system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#f5a623",
          colorBackground: "#0a0a0a",
          colorInputBackground: "#111111",
          colorText: "#f0ece4",
          borderRadius: "8px",
        },
        elements: {
          card: "bg-[#111111] border border-[#222222]",
          headerTitle: "font-syne text-[#f0ece4]",
          socialButtonsBlockButton: "border-[#333333] hover:border-[#f5a623]",
          formButtonPrimary: "bg-[#f5a623] text-[#0a0a0a] hover:bg-[#f0b84a]",
        },
      }}
    >
      <html lang="en">
        <body
          className={`${syne.variable} ${dmMono.variable} ${lora.variable} antialiased bg-bg-base text-text-primary`}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
