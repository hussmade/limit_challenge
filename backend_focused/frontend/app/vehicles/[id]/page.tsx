'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import Shell from '@/components/shell';
import RecordForm from '@/components/record-form';
import RelationInput from '@/components/relation-input';
import { dateLabel, ErrorState, LoadingState, money, PageHeading, Status } from '@/components/ui';
import { apiClient, errorMessage, getData } from '@/lib/api-client';
import { useUser } from '@/lib/auth';
import { Vehicle } from '@/lib/types';
function Detail() {
  const { id } = useParams<{ id: string }>();
  const user = useUser();
  const client = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [assign, setAssign] = useState(false);
  const [office, setOffice] = useState(0);
  const query = useQuery({
    queryKey: ['vehicles', id],
    queryFn: ({ signal }) => getData<Vehicle>(`/vehicles/${id}/`, signal),
  });
  const move = useMutation({
    mutationFn: () => apiClient.post(`/vehicles/${id}/assign/`, { office }),
    onSuccess: async () => {
      await client.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'session' });
      setAssign(false);
    },
  });
  if (query.isPending) return <LoadingState />;
  if (query.isError)
    return (
      <>
        <Link href="/vehicles" className="back-link">
          Back to vehicles
        </Link>
        <ErrorState error={query.error} retry={() => query.refetch()} />
      </>
    );
  const v = query.data;
  const history = v.maintenance_history ?? [];
  return (
    <>
      <Link className="back-link" href="/vehicles">
        <ArrowBackRounded sx={{ fontSize: 15 }} />
        Back to vehicles
      </Link>
      <PageHeading
        eyebrow={`${v.license_plate} · ${v.year}`}
        title={`${v.make} ${v.model}`}
        description={v.vin}
        action={
          user.role === 'operator' ? (
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={() => setEdit(true)}>
                Edit vehicle
              </Button>
              <Button
                variant="contained"
                startIcon={<AddRounded />}
                component={Link}
                href={`/maintenance?vehicle=${v.id}&create=1`}
              >
                Log service
              </Button>
            </Stack>
          ) : undefined
        }
      />
      <div className="detail-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <Typography variant="h6" component="h2">
                Maintenance history
              </Typography>
              <p>{history.length} completed services · newest first</p>
            </div>
            <Typography variant="body2" fontWeight={600}>
              {money(history.reduce((a, r) => a + Number(r.cost), 0))} total
            </Typography>
          </div>
          <div className="detail-body">
            {history.length ? (
              history.map((r) => (
                <article key={r.id} className="timeline-item">
                  <Stack direction="row" justifyContent="space-between" gap={2}>
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      sx={{ textTransform: 'capitalize' }}
                    >
                      {r.maintenance_type.replaceAll('_', ' ')}
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {money(r.cost)}
                    </Typography>
                  </Stack>
                  <span className="subtext">
                    {dateLabel(r.maintenance_date)} · {r.mechanic_detail.name} ·{' '}
                    {r.mechanic_detail.certification_number}
                  </span>
                  {r.notes && (
                    <Typography
                      sx={{
                        fontSize: 13,
                        color: 'text.secondary',
                        lineHeight: 1.8,
                        mt: 1,
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {r.notes}
                    </Typography>
                  )}
                </article>
              ))
            ) : (
              <Typography color="text.secondary">No maintenance has been recorded yet.</Typography>
            )}
          </div>
          {user.role === 'operator' && (
            <Box sx={{ px: 3, pb: 3 }}>
              <Button component={Link} href={`/maintenance?vehicle=${v.id}`}>
                Manage service records
              </Button>
            </Box>
          )}
        </section>
        <aside className="detail-stack">
          <section className="panel">
            <div className="panel-heading">
              <Typography variant="h6" component="h2">
                Vehicle details
              </Typography>
              <Status value={v.active} />
            </div>
            <div className="detail-body">
              <div className="facts">
                {[
                  ['License plate', v.license_plate],
                  ['Model year', String(v.year)],
                  ['Make', v.make],
                  ['Model', v.model],
                  ['Last service', dateLabel(v.last_maintenance)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span className="fact-label">{label}</span>
                    <span className="fact-value">{value}</span>
                  </div>
                ))}
              </div>
              <Box sx={{ mt: 3 }}>
                <span className="fact-label">VIN</span>
                <span className="mono">{v.vin}</span>
              </Box>
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <Typography variant="h6" component="h2">
                Current office
              </Typography>
            </div>
            <div className="detail-body">
              <Typography fontWeight={600}>{v.office_detail.name}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {v.office_detail.city}
              </Typography>
              {user.role === 'operator' && (
                <Button
                  variant="outlined"
                  sx={{ mt: 3 }}
                  onClick={() => {
                    setOffice(v.office);
                    move.reset();
                    setAssign(true);
                  }}
                >
                  Move to another office
                </Button>
              )}
            </div>
          </section>
        </aside>
      </div>
      {edit && <RecordForm resource="vehicles" record={v} onClose={() => setEdit(false)} />}
      <Dialog
        open={assign}
        onClose={() => {
          if (!move.isPending) setAssign(false);
        }}
        fullWidth
        maxWidth="sm"
        aria-labelledby="assignment-title"
      >
        <DialogTitle id="assignment-title">Move vehicle</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Choose the new office for {v.license_plate}. Its maintenance history stays with the
            vehicle.
          </Typography>
          {move.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMessage(move.error)}
            </Alert>
          )}
          <RelationInput
            resource="offices"
            label="New office"
            value={office}
            onChange={setOffice}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssign(false)} disabled={move.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!office || office === v.office || move.isPending}
            onClick={() => move.mutate()}
          >
            {move.isPending ? 'Moving…' : 'Move vehicle'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
export default function Page() {
  return (
    <Shell>
      <Detail />
    </Shell>
  );
}
