import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import MovieMasterChat from "../components/MovieMasterChat";
import Footer from "../components/Footer";
// (duplicate import removed)

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0f" },
    { media: "(prefers-color-scheme: light)", color: "#0b0b0f" },
  ],
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Movrex",
  description: "Discover trending, popular, and top‑rated movies — fast and beautifully with Movrex.",
  keywords: ["movies", "movie search", "trending movies", "top rated", "popular", "TMDB", "Movrex"],
  openGraph: {
    title: "Movrex — Discover Movies",
    description: "Search and discover movies with a fast, modern interface.",
    type: "website",
    url: "https://movrex.example.com",
    siteName: "Movrex",
  },
  twitter: {
    card: "summary_large_image",
    title: "Movrex — Discover Movies",
    description: "Search and discover movies with a fast, modern interface.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Movrex",
    url: "https://movrex.example.com",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://movrex.example.com/?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[--color-bg] text-white`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
        {children}
        <Footer />
        <MovieMasterChat />
      </body>
    </html>
  );
}
