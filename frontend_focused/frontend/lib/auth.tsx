'use client';
import { createContext, useContext, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, CircularProgress } from '@mui/material';
import { apiClient, errorMessage, getData } from './api-client';
import Login from '@/components/login';

export interface User {
  id: number;
  username: string;
  name: string;
  role: 'operator' | 'viewer';
}
const UserContext = createContext<User | null>(null);
export function useUser() {
  return useContext(UserContext)!;
}

export function AuthBoundary({ children }: { children: React.ReactNode }) {
  const client = useQueryClient();
  const session = useQuery({
    queryKey: ['session'],
    queryFn: ({ signal }) => getData<User>('/auth/me/', signal),
    retry: false,
    staleTime: 60_000,
  });
  useEffect(() => {
    const expired = () => {
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' });
      client.setQueryData(['session'], null);
    };
    window.addEventListener('session-expired', expired);
    return () => window.removeEventListener('session-expired', expired);
  }, [client]);
  if (session.isPending)
    return (
      <Box className="center-state" role="status">
        <CircularProgress size={28} aria-label="Loading workspace" />
      </Box>
    );
  if (
    session.isError &&
    (session.error as { response?: { status?: number } }).response?.status !== 401
  )
    return (
      <Box className="center-state">
        <Alert severity="error" action={<Button onClick={() => session.refetch()}>Retry</Button>}>
          {errorMessage(session.error)}
        </Alert>
      </Box>
    );
  if (!session.data || session.isError)
    return (
      <Login
        onSuccess={(user) => {
          client.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' });
          client.setQueryData(['session'], user);
        }}
      />
    );
  return <UserContext.Provider value={session.data}>{children}</UserContext.Provider>;
}

export async function logout() {
  await apiClient.get('/auth/csrf/');
  await apiClient.post('/auth/logout/', {});
}
