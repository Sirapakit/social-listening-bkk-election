import type { Metadata } from "next";
import { Geist, JetBrains_Mono, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const notoThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bangkok Election 2026: Social Listening",
  description: "Monitor candidate buzz, reach, engagement, and sentiment on X.com",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="th"
      className={`${geistSans.variable} ${jetbrainsMono.variable} ${notoThai.variable} h-full antialiased`}
    >
      <head>
        {/* Prevent flash of wrong theme on load */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme:dark)').matches;if(t==='dark'||(t===null&&d)){document.documentElement.classList.add('dark')}else if(t==='light'){document.documentElement.classList.add('light')}}catch(e){}})();` }} />
      </head>
      <body className="h-full flex overflow-hidden" style={{ background: "var(--background)" }}>
        <Sidebar />
        <div className="flex-1 min-w-0 overflow-y-auto scroll-y">
          {children}
        </div>
      </body>
    </html>
  );
}
