import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cursor Guild - Credits Distribution",
  description: "Claim your complimentary Cursor credits from the hackathon",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
