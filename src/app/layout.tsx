import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ball Path Simulator",
  description: "Create paths and animate a ball following them",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}