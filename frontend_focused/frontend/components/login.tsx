'use client';
import { useState } from 'react';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import { apiClient, errorMessage } from '@/lib/api-client';
import type { User } from '@/lib/auth';

export default function Login({ onSuccess }: { onSuccess: (user: User) => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      await apiClient.get('/auth/csrf/');
      const response = await apiClient.post<User>('/auth/login/', {
        username: form.get('username'),
        password: form.get('password'),
      });
      onSuccess(response.data);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="login-page">
      <Box className="login-story">
        <div className="brand">
          <span className="brand-mark">L</span> limit<span className="brand-divider">/</span>
          <span className="brand-product">Submissions</span>
        </div>
        <Box sx={{ maxWidth: 560 }}>
          <div className="eyebrow">A CLEARER WORKING DAY</div>
          <Typography
            variant="h1"
            sx={{ fontSize: { xs: 40, md: 58 }, lineHeight: 1.12, mt: 3, mb: 3 }}
          >
            Every opportunity, in focus.
          </Typography>
          <Typography sx={{ fontSize: 18, lineHeight: 1.8, color: '#bed0ca', maxWidth: 450 }}>
            Bring submissions, supporting documents and broker context together. Make your next
            decision with the full picture.
          </Typography>
          <div className="login-lines" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </Box>
        <Typography variant="body2" sx={{ color: '#bed0ca' }}>
          One workspace. Every detail in view.
        </Typography>
      </Box>
      <Box className="login-form">
        <Paper elevation={0} sx={{ maxWidth: 420, width: '100%', p: { xs: 3, md: 5 } }}>
          <div className="eyebrow">Submissions WORKSPACE</div>
          <Typography variant="h4" component="h2" sx={{ mt: 1.5, mb: 1 }}>
            Welcome back
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 4 }}>
            Sign in to your company workspace.
          </Typography>
          <Box component="form" onSubmit={submit}>
            <Stack spacing={2.5}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                label="Username"
                name="username"
                autoComplete="username"
                required
                fullWidth
                autoFocus
                disabled={pending}
              />
              <TextField
                label="Password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                fullWidth
                disabled={pending}
              />
              <Button
                size="large"
                type="submit"
                variant="contained"
                disabled={pending}
                endIcon={<ArrowForwardRounded />}
              >
                {pending ? 'Signing in…' : 'Sign in'}
              </Button>
              <Typography variant="caption" color="text.secondary">
                Need access? Contact your workspace administrator.
              </Typography>
            </Stack>
          </Box>
        </Paper>
      </Box>
    </main>
  );
}
