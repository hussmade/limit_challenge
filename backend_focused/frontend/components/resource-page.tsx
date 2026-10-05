'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import EditOutlined from '@mui/icons-material/EditOutlined';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import TuneRounded from '@mui/icons-material/TuneRounded';
import Shell from './shell';
import RecordForm from './record-form';
import RelationInput from './relation-input';
import {
  dateLabel,
  EmptyState,
  ErrorState,
  LoadingState,
  money,
  PageHeading,
  Pager,
  Status,
} from './ui';
import { apiClient, errorMessage, getData, PageResult } from '@/lib/api-client';
import { useUrlFilters } from '@/lib/use-url-filters';
import { useUser } from '@/lib/auth';
import { Maintenance, Mechanic, Office, Resource, Row, Vehicle } from '@/lib/types';
const titles: Record<Resource, [string, string, string]> = {
  vehicles: [
    'Vehicles',
    'Manage your fleet, from daily runners to the next service due.',
    'vehicle',
  ],
  offices: ['Offices', 'The places your fleet calls home.', 'office'],
  mechanics: ['Mechanics', 'The people keeping your vehicles ready for the road.', 'mechanic'],
  maintenance: [
    'Maintenance',
    'A complete record of service, repairs, and care.',
    'maintenance record',
  ],
};
const columns: Record<Resource, string[]> = {
  vehicles: ['Vehicle', 'License plate / VIN', 'Office', 'Last service', 'Status'],
  offices: ['Office', 'City'],
  mechanics: ['Mechanic', 'Certification', 'Status'],
  maintenance: ['Vehicle', 'Service', 'Mechanic', 'Date', 'Cost'],
};
function Cells({ resource, row }: { resource: Resource; row: Row }) {
  if (resource === 'vehicles') {
    const v = row as Vehicle;
    return (
      <>
        <TableCell>
          <Link className="record-link" href={`/vehicles/${v.id}`}>
            {v.make} {v.model}
          </Link>
          <span className="subtext">{v.year}</span>
        </TableCell>
        <TableCell>
          {v.license_plate}
          <span className="subtext mono">{v.vin}</span>
        </TableCell>
        <TableCell>
          {v.office_detail.name}
          <span className="subtext">{v.office_detail.city}</span>
        </TableCell>
        <TableCell>{dateLabel(v.last_maintenance)}</TableCell>
        <TableCell>
          <Status value={v.active} />
        </TableCell>
      </>
    );
  }
  if (resource === 'offices') {
    const v = row as Office;
    return (
      <>
        <TableCell>
          <strong>{v.name}</strong>
        </TableCell>
        <TableCell>{v.city}</TableCell>
      </>
    );
  }
  if (resource === 'mechanics') {
    const v = row as Mechanic;
    return (
      <>
        <TableCell>
          <strong>{v.name}</strong>
        </TableCell>
        <TableCell>
          <span className="mono">{v.certification_number}</span>
        </TableCell>
        <TableCell>
          <Status value={v.active} />
        </TableCell>
      </>
    );
  }
  const v = row as Maintenance;
  return (
    <>
      <TableCell>
        <Link className="record-link" href={`/vehicles/${v.vehicle}`}>
          {v.vehicle_label}
        </Link>
      </TableCell>
      <TableCell sx={{ textTransform: 'capitalize' }}>
        {v.maintenance_type.replaceAll('_', ' ')}
        <span className="subtext note-preview" title={v.notes}>
          {v.notes}
        </span>
      </TableCell>
      <TableCell>{v.mechanic_detail.name}</TableCell>
      <TableCell>{dateLabel(v.maintenance_date)}</TableCell>
      <TableCell>{money(v.cost)}</TableCell>
    </>
  );
}
function OfficeFilter({ initial }: { initial: number }) {
  const [office, setOffice] = useState(initial);
  return (
    <Box sx={{ minWidth: 220, flex: 1 }}>
      <input type="hidden" name="office" value={office || ''} />
      <RelationInput
        resource="offices"
        label="Office"
        value={office}
        onChange={setOffice}
        required={false}
      />
    </Box>
  );
}
function Workspace({ resource }: { resource: Resource }) {
  const { params, page, update, clear, query } = useUrlFilters();
  const user = useUser();
  const client = useQueryClient();
  const [form, setForm] = useState<Row | 'new' | null>(params.create === '1' ? 'new' : null);
  const [remove, setRemove] = useState<Row | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [title, description, singular] = titles[resource];
  const endpoint =
    resource === 'vehicles' && params.due === 'true'
      ? '/vehicles/needing-maintenance/'
      : `/${resource}/`;
  const list = useQuery({
    queryKey: [resource, params],
    queryFn: ({ signal }) => getData<PageResult<Row>>(endpoint, signal, params),
  });
  const deletion = useMutation({
    mutationFn: () => apiClient.delete(`/${resource}/${remove!.id}/`),
    onSuccess: async () => {
      await client.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'session' });
      setRemove(null);
    },
  });
  const close = () => {
    setForm(null);
    if (params.create) update({ create: '' }, true);
  };
  const actions = (row: Row) => (
    <div className="table-actions">
      <IconButton
        size="small"
        aria-label={`Edit ${singular} ${row.id}`}
        onClick={() => setForm(row)}
      >
        <EditOutlined fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
        aria-label={`Delete ${singular} ${row.id}`}
        onClick={() => {
          deletion.reset();
          setRemove(row);
        }}
      >
        <DeleteOutlineRounded fontSize="small" />
      </IconButton>
    </div>
  );
  return (
    <>
      <PageHeading
        eyebrow="FLEET WORKSPACE"
        title={title}
        description={description}
        action={
          user.role === 'operator' ? (
            <Button variant="contained" startIcon={<AddRounded />} onClick={() => setForm('new')}>
              Add {singular}
            </Button>
          ) : undefined
        }
      />
      <section className="panel" aria-label={`${title} list`}>
        {resource !== 'maintenance' && (
          <Box
            component="form"
            className="filters"
            key={query}
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              update(
                Object.fromEntries(Array.from(data.entries()).map(([k, v]) => [k, String(v)])),
              );
            }}
          >
            <div className="filter-row">
              <TextField
                className="search-field"
                label={`Search ${resource}`}
                name="search"
                defaultValue={params.search ?? ''}
                placeholder={resource === 'vehicles' ? 'Make, model, plate or VIN…' : 'Name…'}
              />
              {resource !== 'offices' && (
                <TextField select label="Status" name="active" defaultValue={params.active ?? ''}>
                  <MenuItem value="">All statuses</MenuItem>
                  <MenuItem value="true">Active</MenuItem>
                  <MenuItem value="false">Inactive</MenuItem>
                </TextField>
              )}
              {resource === 'vehicles' && (
                <>
                  <TextField
                    select
                    label="Service status"
                    name="due"
                    defaultValue={params.due ?? ''}
                  >
                    <MenuItem value="">Any service status</MenuItem>
                    <MenuItem value="true">Needs maintenance</MenuItem>
                  </TextField>
                  <Button
                    onClick={() => setAdvanced(!advanced)}
                    aria-expanded={advanced}
                    startIcon={<TuneRounded />}
                  >
                    More filters
                  </Button>
                </>
              )}
              <Button type="submit" variant="contained">
                Apply
              </Button>
              <Button onClick={clear}>Reset</Button>
            </div>
            {resource === 'vehicles' &&
              (advanced ||
                [
                  'office',
                  'make',
                  'model',
                  'maintenanceFrom',
                  'maintenanceTo',
                  'certification',
                ].some((k) => params[k])) && (
                <div className="filter-row extra-filters">
                  <OfficeFilter initial={Number(params.office) || 0} />
                  {[
                    ['make', 'Make'],
                    ['model', 'Model'],
                    ['certification', 'Mechanic certification'],
                  ].map(([k, l]) => (
                    <TextField key={k} label={l} name={k} defaultValue={params[k] ?? ''} />
                  ))}
                  {[
                    ['maintenanceFrom', 'Serviced from'],
                    ['maintenanceTo', 'Serviced to'],
                  ].map(([k, l]) => (
                    <TextField
                      key={k}
                      label={l}
                      name={k}
                      type="date"
                      defaultValue={params[k] ?? ''}
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                  ))}
                </div>
              )}
          </Box>
        )}
        {resource === 'maintenance' && params.vehicle && (
          <Alert severity="info" action={<Button onClick={clear}>Show all</Button>}>
            Showing service history for vehicle #{params.vehicle}.
          </Alert>
        )}
        {list.isPending ? (
          <LoadingState />
        ) : list.isError ? (
          <ErrorState error={list.error} retry={() => list.refetch()} />
        ) : !list.data.count ? (
          <EmptyState action={<Button onClick={clear}>Clear filters</Button>} />
        ) : (
          <>
            <div className="data-table desktop-table">
              <Table aria-label={title}>
                <TableHead>
                  <TableRow>
                    {columns[resource].map((c) => (
                      <TableCell key={c}>{c}</TableCell>
                    ))}
                    {user.role === 'operator' && <TableCell align="right">Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {list.data.results.map((row) => (
                    <TableRow key={row.id} hover>
                      <Cells resource={resource} row={row} />
                      {user.role === 'operator' && <TableCell>{actions(row)}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mobile-cards">
              {list.data.results.map((row) => (
                <article key={row.id} className="record-card">
                  <div className="record-card-head">
                    {resource === 'vehicles' ? (
                      <Link className="record-link" href={`/vehicles/${row.id}`}>
                        {String(row.make)} {String(row.model)}
                      </Link>
                    ) : (
                      <strong>{String(row.name ?? row.vehicle_label)}</strong>
                    )}
                    {user.role === 'operator' && actions(row)}
                  </div>
                  {resource === 'vehicles' ? (
                    <>
                      <Typography variant="body2">
                        {String(row.license_plate)} · {String((row as Vehicle).office_detail.name)}
                      </Typography>
                      <span className="subtext">
                        Last service: {dateLabel((row as Vehicle).last_maintenance)}
                      </span>
                      <Box sx={{ mt: 1 }}>
                        <Status value={Boolean(row.active)} />
                      </Box>
                    </>
                  ) : resource === 'maintenance' ? (
                    <>
                      <Typography variant="body2">
                        {String(row.maintenance_type).replaceAll('_', ' ')} ·{' '}
                        {money(String(row.cost))}
                      </Typography>
                      <span className="subtext">
                        {dateLabel(String(row.maintenance_date))} ·{' '}
                        {(row as Maintenance).mechanic_detail.name}
                      </span>
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {String(row.city ?? row.certification_number)}
                    </Typography>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
        {list.data && (
          <Pager count={list.data.count} page={page} setPage={(p) => update({ page: String(p) })} />
        )}
      </section>
      {form && user.role === 'operator' && (
        <RecordForm
          resource={resource}
          record={form === 'new' ? undefined : form}
          defaults={
            resource === 'maintenance' && params.vehicle ? { vehicle: Number(params.vehicle) } : {}
          }
          onClose={close}
        />
      )}
      <Dialog
        open={Boolean(remove)}
        onClose={() => {
          if (!deletion.isPending) setRemove(null);
        }}
        aria-labelledby="delete-title"
      >
        <DialogTitle id="delete-title">Delete this {singular}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This cannot be undone. Referenced records are protected; deactivate vehicles or
            mechanics to preserve their history.
          </DialogContentText>
          {deletion.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {errorMessage(deletion.error)}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={deletion.isPending} onClick={() => setRemove(null)}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={deletion.isPending}
            onClick={() => deletion.mutate()}
          >
            {deletion.isPending ? 'Deleting…' : 'Delete record'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
export default function ResourcePage({ resource }: { resource: Resource }) {
  return (
    <Shell>
      <Suspense fallback={<LoadingState />}>
        <Workspace resource={resource} />
      </Suspense>
    </Shell>
  );
}
