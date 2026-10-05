'use client';
import { useQuery } from '@tanstack/react-query';
import { getData, PageResult } from '@/lib/api-client';
import { SubmissionDetail, SubmissionListItem } from '@/lib/types';
export function useSubmissionsList(filters: Record<string, string>) {
  return useQuery({
    queryKey: ['submissions', filters],
    queryFn: ({ signal }) =>
      getData<PageResult<SubmissionListItem>>('/submissions/', signal, filters),
  });
}
export function useSubmissionDetail(id: string) {
  return useQuery({
    queryKey: ['submissions', id],
    queryFn: ({ signal }) => getData<SubmissionDetail>(`/submissions/${id}/`, signal),
  });
}
