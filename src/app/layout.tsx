import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "NMMS Attendance Portal",
  description:
    "National Means Cum Merit Scholarship Scheme — Teacher Attendance Management System, Tamil Nadu",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased bg-gray-50 text-gray-900 min-h-screen">
        {children}
        <Toaster position="top-right" theme="light" richColors closeButton />
      </body>
    </html>
  );
}
