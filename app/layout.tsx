import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { DisableNumberInputWheel } from "@/components/layout/DisableNumberInputWheel";
import { RegisterServiceWorker } from "@/components/layout/RegisterServiceWorker";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "RentLoop - 专业租赁管理系统",
  description: "以租代售模式的专业租赁管理系统",
  applicationName: "RentLoop",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RentLoop",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="font-sans antialiased">
        <RegisterServiceWorker />
        <DisableNumberInputWheel />
        <Navbar />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
