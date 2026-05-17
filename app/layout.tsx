import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppChrome } from "@/components/layout/AppChrome";
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

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#5E6AD2",
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
    <html lang="zh-CN" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <RegisterServiceWorker />
        <DisableNumberInputWheel />
        <AppChrome>{children}</AppChrome>
        <Toaster />
      </body>
    </html>
  );
}
