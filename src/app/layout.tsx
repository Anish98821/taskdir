import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { LiveRefresh } from "@/components/layout/LiveRefresh";
import { TooltipProvider } from "@/components/ui/tooltip";
import { readProjectConfig } from "@/lib/project-config";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const project = await readProjectConfig();
  const name = project.name.trim();
  return {
    title: name ? `${name} · taskdir` : "taskdir",
    description: "Local task substrate for AI agents.",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${geistMono.variable}`}>
      <body className="h-dvh overflow-hidden bg-background text-foreground font-mono text-sm">
        <TooltipProvider>
          <LiveRefresh />
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
