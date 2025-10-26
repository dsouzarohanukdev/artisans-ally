import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import Footer from "@/components/Footer";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Artisan's Ally",
  description: "Market analysis and workshop manager for craft businesses.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} flex flex-col min-h-screen`}>
        <div className="flex-grow"> 
          <AuthProvider>
            {children}
          </AuthProvider>
        </div>
        <GoogleAnalytics />
        <Analytics />
        <SpeedInsights />        
        <Footer /> 
      </body>
    </html>
  );
}