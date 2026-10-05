import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import Providers from './providers';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'Fleet · Limit', template: '%s · Limit Fleet' },
  description:
    'A clear view of your vehicles, maintenance and people. Less chasing records. More time on the road.',
  robots: { index: false, follow: false },
};
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html lang="en">
      <body>
        <AppRouterCacheProvider options={{ key: 'mui', nonce }}>
          <Providers>{children}</Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
