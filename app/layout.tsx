import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "እስቲብሳር | Istibsar Online Academy",
  description: "በእስቲብሳር ኦንላይን አካዳሚ የዲን እውቀትዎን በጥራትና በስርዓት ይማሩ።",
  openGraph: {
    title: "እስቲብሳር | Istibsar Online Academy",
    description: "በእስቲብሳር ኦንላይን አካዳሚ የዲን እውቀትዎን በጥራትና በስርዓት ይማሩ።",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}