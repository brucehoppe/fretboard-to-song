import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fretboard to Song",
  description: "Explore the whole guitar neck and build a repertoire of complete songs.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
