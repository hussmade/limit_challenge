'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Box, Button, LinearProgress, Stack, Typography } from '@mui/material';
import DirectionsCarOutlined from '@mui/icons-material/DirectionsCarOutlined';
import BuildOutlined from '@mui/icons-material/BuildOutlined';
import BusinessOutlined from '@mui/icons-material/BusinessOutlined';
import PaymentsOutlined from '@mui/icons-material/PaymentsOutlined';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import Shell from '@/components/shell';
import {
  dateLabel,
  EmptyState,
  ErrorState,
  LoadingState,
  money,
  PageHeading,
  Stat,
} from '@/components/ui';
import { getData, PageResult } from '@/lib/api-client';
import { OfficeSummary, Vehicle, Workload } from '@/lib/types';
function Overview() {
  const offices = useQuery({
    queryKey: ['offices', 'summary'],
    queryFn: ({ signal }) => getData<OfficeSummary[]>('/offices/summary/', signal),
  });
  const due = useQuery({
    queryKey: ['vehicles', 'due'],
    queryFn: ({ signal }) => getData<PageResult<Vehicle>>('/vehicles/needing-maintenance/', signal),
  });
  const workload = useQuery({
    queryKey: ['mechanics', 'workload'],
    queryFn: ({ signal }) => getData<Workload[]>('/mechanics/workload/', signal),
  });
  return (
    <>
      <PageHeading
        eyebrow="YOUR FLEET AT A GLANCE"
        title="Keep things moving."
        description="A little foresight today. A smoother journey tomorrow."
        action={
          <Button
            component={Link}
            href="/vehicles"
            variant="outlined"
            endIcon={<ArrowForwardRounded />}
          >
            View all vehicles
          </Button>
        }
      />
      <div className="stats-grid">
        <Stat
          label="Active vehicles"
          value={offices.data?.reduce((a, v) => a + v.active_vehicle_count, 0) ?? '—'}
          detail="Ready for daily operations"
          icon={<DirectionsCarOutlined />}
        />
        <Stat
          label="Needs attention"
          value={due.data?.count ?? '—'}
          detail="Never serviced or over 365 days"
          icon={<BuildOutlined />}
        />
        <Stat
          label="Maintenance spend"
          value={
            offices.data
              ? money(offices.data.reduce((a, v) => a + Number(v.maintenance_cost_last_year), 0))
              : '—'
          }
          detail="Rolling 12 months · USD"
          icon={<PaymentsOutlined />}
        />
        <Stat
          label="Offices"
          value={offices.data?.length ?? '—'}
          detail="Across your operating network"
          icon={<BusinessOutlined />}
        />
      </div>
      <div className="overview-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <Typography variant="h6" component="h2">
                Next in line for service
              </Typography>
              <p>Never serviced first, then oldest maintenance</p>
            </div>
            <Button
              component={Link}
              href="/vehicles?due=true"
              size="small"
              endIcon={<ArrowForwardRounded />}
            >
              View queue
            </Button>
          </div>
          {due.isPending ? (
            <LoadingState />
          ) : due.isError ? (
            <ErrorState error={due.error} retry={() => due.refetch()} />
          ) : !due.data.count ? (
            <EmptyState
              title="Your fleet is up to date"
              description="No active vehicles are currently overdue for maintenance."
            />
          ) : (
            due.data.results.slice(0, 5).map((v) => (
              <div key={v.id} className="record-card">
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                  <div className="company-cell">
                    <div className="row-avatar">
                      <DirectionsCarOutlined fontSize="small" />
                    </div>
                    <div>
                      <Link href={`/vehicles/${v.id}`} className="record-link">
                        {v.make} {v.model}
                      </Link>
                      <span className="subtext">
                        {v.license_plate} · {v.office_detail.name}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Typography
                      variant="caption"
                      sx={{ color: v.last_maintenance ? '#9b6030' : '#617068' }}
                    >
                      {v.last_maintenance ? 'Service overdue' : 'No service recorded'}
                    </Typography>
                    <span className="subtext">{dateLabel(v.last_maintenance)}</span>
                  </div>
                </Stack>
              </div>
            ))
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <Typography variant="h6" component="h2">
                Workshop activity
              </Typography>
              <p>Completed services this calendar year</p>
            </div>
          </div>
          <div className="detail-body">
            {workload.isPending ? (
              <LoadingState />
            ) : workload.isError ? (
              <ErrorState error={workload.error} retry={() => workload.refetch()} />
            ) : !workload.data.length ? (
              <EmptyState
                title="No mechanics yet"
                description="Add your team to start tracking their work."
              />
            ) : (
              workload.data.slice(0, 5).map((m) => (
                <Box key={m.id} sx={{ mb: 3, '&:last-child': { mb: 0 } }}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" fontWeight={600}>
                      {m.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {m.maintenance_count} services
                    </Typography>
                  </Stack>
                  <LinearProgress
                    aria-label={`${m.name}: ${m.maintenance_count} services`}
                    variant="determinate"
                    value={Math.min(
                      100,
                      (m.maintenance_count / Math.max(1, workload.data[0].maintenance_count)) * 100,
                    )}
                    sx={{ height: 5, borderRadius: 3, my: 1.2, bgcolor: '#edf2ef' }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {money(m.total_cost)} in completed work
                  </Typography>
                </Box>
              ))
            )}
          </div>
        </section>
      </div>
      <section className="panel" style={{ marginTop: 24 }}>
        <div className="panel-heading">
          <div>
            <Typography variant="h6" component="h2">
              Office overview
            </Typography>
            <p>Service history follows each vehicle’s current office</p>
          </div>
          <Button component={Link} href="/offices" size="small">
            Manage offices
          </Button>
        </div>
        {offices.isPending ? (
          <LoadingState />
        ) : offices.isError ? (
          <ErrorState error={offices.error} retry={() => offices.refetch()} />
        ) : (
          <div className="office-grid">
            {offices.data.map((o) => (
              <Link className="office-card" key={o.id} href={`/vehicles?office=${o.id}`}>
                <div className="eyebrow">{o.city}</div>
                <Typography variant="h6" sx={{ my: 1 }}>
                  {o.name}
                </Typography>
                <div className="facts">
                  <div>
                    <span className="fact-label">Active vehicles</span>
                    <span className="fact-value">{o.active_vehicle_count}</span>
                  </div>
                  <div>
                    <span className="fact-label">12-month spend</span>
                    <span className="fact-value">{money(o.maintenance_cost_last_year)}</span>
                  </div>
                </div>
                <span className="subtext" style={{ marginTop: 18 }}>
                  Last service: {dateLabel(o.last_maintenance)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
export default function Page() {
  return (
    <Shell>
      <Overview />
    </Shell>
  );
}
