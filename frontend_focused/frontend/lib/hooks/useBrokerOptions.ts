'use client';
import { useQuery } from '@tanstack/react-query';
import { getData } from '@/lib/api-client';
import { Broker } from '@/lib/types';
export function useBrokerOptions() {
  return useQuery({
    queryKey: ['brokers'],
    queryFn: ({ signal }) => getData<Broker[]>('/brokers/', signal),
    staleTime: 300_000,
  });
}
