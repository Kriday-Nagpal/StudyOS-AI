import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const productionUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : 'https://studyos-web-production.up.railway.app');

export const metadata: Metadata = {
  metadataBase: new URL(productionUrl),
  title: 'StudyOS AI — Your academic operating system',
  description:
    'An intelligent study operating system that turns your syllabus, exams, progress, and revision into the right next action.',
  applicationName: 'StudyOS AI',
  openGraph: {
    title: 'StudyOS AI — Your academic operating system',
    description: 'Turn your syllabus, exams, progress, mistakes, and revision into the right next action.',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'StudyOS AI — Your academic operating system' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'StudyOS AI — Your academic operating system',
    description: 'Turn your syllabus, exams, progress, mistakes, and revision into the right next action.',
    images: ['/og.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#050507',
  colorScheme: 'dark light',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
