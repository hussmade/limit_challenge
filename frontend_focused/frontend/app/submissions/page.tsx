'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Button,
  Chip,
  Collapse,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import InboxOutlined from '@mui/icons-material/InboxOutlined';
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import TuneRounded from '@mui/icons-material/TuneRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import AttachFileRounded from '@mui/icons-material/AttachFileRounded';
import ChatBubbleOutlineRounded from '@mui/icons-material/ChatBubbleOutlineRounded';
import Shell from '@/components/shell';
import {
  dateLabel,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeading,
  Pager,
  Stat,
  Status,
} from '@/components/ui';
import { useSubmissionsList } from '@/lib/hooks/useSubmissions';
import { useBrokerOptions } from '@/lib/hooks/useBrokerOptions';
import { useUrlFilters } from '@/lib/use-url-filters';
import { getData } from '@/lib/api-client';
import { SubmissionListItem } from '@/lib/types';

function Workspace() {
  const { params, page, update, clear, query } = useUrlFilters();
  const [advanced, setAdvanced] = useState(false);
  const list = useSubmissionsList(params);
  const brokers = useBrokerOptions();
  const summary = useQuery({
    queryKey: ['submission-summary'],
    queryFn: ({ signal }) => getData<Record<string, number>>('/submissions/summary/', signal),
  });
  const detailLink = (row: SubmissionListItem) =>
    `/submissions/${row.id}?from=${encodeURIComponent(`/submissions${query ? `?${query}` : ''}`)}`;
  const filters = Object.entries(params).filter(([key]) => !['page', 'ordering'].includes(key));
  return (
    <>
      <PageHeading
        eyebrow="OPPORTUNITY WORKSPACE"
        title="Submissions"
        description="A clear view of what’s coming in. Review, prioritize, and keep things moving."
      />
      <div className="stats-grid">
        <Stat
          label="All submissions"
          value={summary.data?.total ?? '—'}
          detail="Across your workspace"
          icon={<InboxOutlined />}
        />
        <Stat
          label="New opportunities"
          value={summary.data?.new ?? '—'}
          detail="Ready for a first look"
          icon={<ScheduleOutlined />}
        />
        <Stat
          label="In review"
          value={summary.data?.in_review ?? '—'}
          detail="Currently being assessed"
          icon={<VisibilityOutlined />}
        />
        <Stat
          label="Closed"
          value={summary.data?.closed ?? '—'}
          detail="Review completed"
          icon={<CheckCircleOutline />}
        />
      </div>
      {summary.isError && <ErrorState error={summary.error} retry={() => summary.refetch()} />}
      <section className="panel" aria-label="Submission list">
        <Box sx={{ px: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Tabs
            value={
              ['new', 'in_review', 'closed', 'lost'].includes(params.status) ? params.status : ''
            }
            onChange={(_, v) => update({ status: v })}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="Submission status"
          >
            <Tab label="All submissions" value="" />
            <Tab label="New" value="new" />
            <Tab label="In review" value="in_review" />
            <Tab label="Closed" value="closed" />
            <Tab label="Lost" value="lost" />
          </Tabs>
        </Box>
        <Box
          component="form"
          key={query}
          className="filters"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            update(Object.fromEntries(Array.from(data.entries()).map(([k, v]) => [k, String(v)])));
          }}
        >
          <div className="filter-row">
            <TextField
              className="search-field"
              label="Search company"
              placeholder="Find a company…"
              name="companySearch"
              defaultValue={params.companySearch ?? ''}
            />
            <TextField
              select
              label="Broker"
              name="brokerId"
              defaultValue={params.brokerId ?? ''}
              disabled={brokers.isPending}
            >
              <MenuItem value="">All brokers</MenuItem>
              {brokers.data?.map((b) => (
                <MenuItem key={b.id} value={String(b.id)}>
                  {b.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Sort by"
              name="ordering"
              defaultValue={params.ordering ?? '-createdAt'}
            >
              <MenuItem value="-createdAt">Newest first</MenuItem>
              <MenuItem value="createdAt">Oldest first</MenuItem>
              <MenuItem value="company">Company name</MenuItem>
              <MenuItem value="priority">Highest priority</MenuItem>
            </TextField>
            <Button
              aria-expanded={advanced}
              onClick={() => setAdvanced(!advanced)}
              startIcon={<TuneRounded />}
              variant="outlined"
            >
              Filters
            </Button>
            <Button type="submit" variant="contained">
              Apply
            </Button>
          </div>
          <Collapse
            in={
              advanced ||
              ['priority', 'createdFrom', 'createdTo', 'hasDocuments', 'hasNotes'].some(
                (k) => params[k],
              )
            }
          >
            <div className="filter-row extra-filters">
              <TextField
                select
                label="Priority"
                name="priority"
                defaultValue={params.priority ?? ''}
              >
                <MenuItem value="">All priorities</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="low">Low</MenuItem>
              </TextField>
              <TextField
                label="Created from"
                name="createdFrom"
                type="date"
                defaultValue={params.createdFrom ?? ''}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="Created to"
                name="createdTo"
                type="date"
                defaultValue={params.createdTo ?? ''}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              {[
                ['hasDocuments', 'Documents'],
                ['hasNotes', 'Notes'],
              ].map(([key, label]) => (
                <TextField
                  key={key}
                  select
                  name={key}
                  label={label}
                  defaultValue={params[key] ?? ''}
                >
                  <MenuItem value="">Any</MenuItem>
                  <MenuItem value="true">Has {label.toLowerCase()}</MenuItem>
                  <MenuItem value="false">No {label.toLowerCase()}</MenuItem>
                </TextField>
              ))}
            </div>
          </Collapse>
          {filters.length > 0 && (
            <div className="active-filters">
              {filters.map(([key, value]) => (
                <Chip
                  key={key}
                  size="small"
                  label={`${key.replace(/([A-Z])/g, ' $1')}: ${key === 'brokerId' ? (brokers.data?.find((b) => String(b.id) === value)?.name ?? value) : value.replaceAll('_', ' ')}`}
                  onDelete={() => update({ [key]: '' })}
                />
              ))}
              <Button size="small" onClick={clear}>
                Clear all
              </Button>
            </div>
          )}
        </Box>
        {brokers.isError && <ErrorState error={brokers.error} retry={() => brokers.refetch()} />}
        {list.isPending ? (
          <LoadingState />
        ) : list.isError ? (
          <ErrorState error={list.error} retry={() => list.refetch()} />
        ) : list.data.count === 0 ? (
          <EmptyState action={<Button onClick={clear}>Clear filters</Button>} />
        ) : (
          <>
            <div className="data-table desktop-table">
              <Table aria-label="Submissions">
                <TableHead>
                  <TableRow>
                    {[
                      'Company',
                      'Status / priority',
                      'Broker & owner',
                      'Context',
                      'Received',
                      '',
                    ].map((h, i) => (
                      <TableCell key={i}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {list.data.results.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>
                        <div className="company-cell">
                          <div className="row-avatar" aria-hidden="true">
                            {row.company.legalName
                              .split(' ')
                              .slice(0, 2)
                              .map((v) => v[0])
                              .join('')}
                          </div>
                          <div>
                            <Link className="record-link" href={detailLink(row)}>
                              {row.company.legalName}
                            </Link>
                            <span className="subtext">
                              {row.company.industry} · #{String(row.id).padStart(4, '0')}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.8} alignItems="flex-start">
                          <Status value={row.status} />
                          <Status value={row.priority} />
                        </Stack>
                      </TableCell>
                      <TableCell>
                        {row.broker.name}
                        <span className="subtext">{row.owner.fullName}</span>
                      </TableCell>
                      <TableCell>
                        <Stack
                          direction="row"
                          spacing={1.5}
                          sx={{ color: 'text.secondary', fontSize: 11 }}
                        >
                          <span>
                            <AttachFileRounded sx={{ fontSize: 13, verticalAlign: 'middle' }} />{' '}
                            {row.documentCount} docs
                          </span>
                          <span>
                            <ChatBubbleOutlineRounded
                              sx={{ fontSize: 13, verticalAlign: 'middle' }}
                            />{' '}
                            {row.noteCount} notes
                          </span>
                        </Stack>
                        <span className="subtext note-preview">
                          {row.latestNote?.bodyPreview ?? 'No notes yet'}
                        </span>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 11 }}>
                        {dateLabel(row.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Link
                          aria-label={`Review ${row.company.legalName} submission ${row.id}`}
                          href={detailLink(row)}
                        >
                          <ArrowForwardRounded sx={{ fontSize: 18, color: 'text.secondary' }} />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mobile-cards">
              {list.data.results.map((row) => (
                <article className="record-card" key={row.id}>
                  <div className="record-card-head">
                    <Link className="record-link" href={detailLink(row)}>
                      {row.company.legalName}
                    </Link>
                    <Status value={row.status} />
                  </div>
                  <Typography variant="body2" color="text.secondary">
                    {row.company.industry} · {row.broker.name}
                  </Typography>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ mt: 2 }}
                  >
                    <Status value={row.priority} />
                    <Typography variant="caption" color="text.secondary">
                      {dateLabel(row.createdAt)} · {row.documentCount} docs
                    </Typography>
                  </Stack>
                </article>
              ))}
            </div>
          </>
        )}
        {list.data && (
          <Pager count={list.data.count} page={page} setPage={(p) => update({ page: String(p) })} />
        )}
      </section>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
        Showing your company’s submissions. All dates are displayed in UTC.
      </Typography>
    </>
  );
}
export default function Page() {
  return (
    <Shell>
      <Suspense fallback={<LoadingState />}>
        <Workspace />
      </Suspense>
    </Shell>
  );
}
