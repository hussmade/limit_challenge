'use client';
import { useState } from 'react';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const theme = createTheme({
  palette: {
    primary: { main: '#27634d' },
    background: { default: '#f6f7f9', paper: '#ffffff' },
    text: { primary: '#182723', secondary: '#64716d' },
    divider: '#e5eae7',
  },
  typography: {
    fontFamily: 'Arial, Helvetica, sans-serif',
    h3: { fontSize: '2rem', fontWeight: 650, letterSpacing: '-0.055em' },
    h4: { fontWeight: 650, letterSpacing: '-0.04em' },
    h5: { fontWeight: 650, letterSpacing: '-0.03em' },
    h6: { fontSize: '1rem', fontWeight: 650 },
    button: { textTransform: 'none', fontWeight: 600 },
    body2: { fontSize: '0.82rem' },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 7, minHeight: 38 } },
    },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiInputLabel: {
      styleOverrides: { root: { color: '#52615b', transition: 'transform 200ms ease-out' } },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiTableCell: {
      styleOverrides: {
        head: {
          background: '#fafbfa',
          color: '#63716b',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '.06em',
          fontWeight: 700,
          paddingTop: 14,
          paddingBottom: 14,
        },
        body: { paddingTop: 18, paddingBottom: 18, borderColor: '#edf0ee', fontSize: 13 },
      },
    },
  },
});
export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            retry: (count, error) => {
              const status = (error as { response?: { status?: number } }).response?.status;
              return count < 1 && (!status || status >= 500);
            },
          },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
