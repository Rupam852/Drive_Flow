import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import NoInternetModal from "@/components/NoInternetModal";
import PushNotificationManager from "@/components/PushNotificationManager";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DriveFlow",
  description: "Secure and modern file management system",
  icons: {
    icon: [
      { url: '/icon.svg?v=4', type: 'image/svg+xml' },
      { url: '/favicon.ico?v=4', sizes: 'any' },
    ],
    shortcut: '/icon.svg?v=4',
    apple: '/icon.svg?v=4',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="icon" href="/icon.svg?v=4" type="image/svg+xml" />
        <link rel="icon" href="/favicon.ico?v=4" sizes="any" />
        <link rel="shortcut icon" href="/icon.svg?v=4" />
        <link rel="apple-touch-icon" href="/icon.svg?v=4" />
        <meta name="theme-color" content="#080711" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('driveflow_theme') || 'dark';
                  var isDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.classList.remove('light');
                  } else {
                    document.documentElement.classList.add('light');
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <NoInternetModal />
          <PushNotificationManager />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
