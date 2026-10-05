'use client';
import { Alert, Box, Button, Chip, Pagination, Skeleton, Stack, Typography } from '@mui/material';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import SearchOffRounded from '@mui/icons-material/SearchOffRounded';
import { errorMessage } from '@/lib/api-client';
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <Typography variant="h3" component="h1">
          {title}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {description}
        </Typography>
      </div>
      {action}
    </div>
  );
}
export function LoadingState() {
  return (
    <Stack spacing={2} role="status" aria-label="Loading records" sx={{ p: 3 }}>
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} height={54} variant="rounded" />
      ))}
    </Stack>
  );
}
export function ErrorState({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <Alert
      severity="error"
      sx={{ m: 2 }}
      action={
        <Button onClick={retry} startIcon={<RefreshRounded />}>
          Retry
        </Button>
      }
    >
      {errorMessage(error)}
    </Alert>
  );
}
export function EmptyState({
  title = 'No matching records',
  description = 'Try adjusting your filters or clearing them to see more results.',
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <Box className="empty-state">
      <SearchOffRounded sx={{ fontSize: 34, color: 'text.secondary', mb: 1 }} />
      <Typography variant="h6">{title}</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 2, maxWidth: 420 }}>
        {description}
      </Typography>
      {action}
    </Box>
  );
}
export function Pager({
  count,
  page,
  setPage,
  pageSize = 12,
}: {
  count: number;
  page: number;
  setPage: (page: number) => void;
  pageSize?: number;
}) {
  return (
    <div className="pager">
      <Typography variant="body2" color="text.secondary" role="status">
        {count
          ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, count)} of ${count} records`
          : '0 records'}
      </Typography>
      <Pagination
        count={Math.max(1, Math.ceil(count / pageSize))}
        page={page}
        onChange={(_, page) => setPage(page)}
        color="primary"
        size="small"
        shape="rounded"
      />
    </div>
  );
}
export function Status({ value }: { value: string | boolean }) {
  const label =
    value === true
      ? 'Active'
      : value === false
        ? 'Inactive'
        : ({
            new: 'New',
            in_review: 'In review',
            closed: 'Closed',
            lost: 'Lost',
            high: 'High priority',
            medium: 'Medium',
            low: 'Low',
          }[value] ?? value.replaceAll('_', ' '));
  return <Chip className={`status status-${String(value)}`} size="small" label={label} />;
}
export function Stat({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-detail">{detail}</div>
    </div>
  );
}
export const dateLabel = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(value))
    : 'Not yet serviced';
export const money = (value: string | number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value));
