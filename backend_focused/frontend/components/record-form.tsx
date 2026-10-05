'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
} from '@mui/material';
import { apiClient, errorMessage } from '@/lib/api-client';
import { Resource, Row } from '@/lib/types';
import RelationInput from './relation-input';

interface Field {
  key: string;
  label: string;
  type?: 'number' | 'date' | 'boolean' | 'relation' | 'select' | 'multiline';
  resource?: string;
  options?: string[];
  required?: boolean;
  max?: number;
}
const fields: Record<Resource, Field[]> = {
  offices: [
    { key: 'name', label: 'Office name', max: 120 },
    { key: 'city', label: 'City', max: 120 },
  ],
  mechanics: [
    { key: 'name', label: 'Full name', max: 120 },
    { key: 'certification_number', label: 'Certification number', max: 64 },
    { key: 'active', label: 'Active mechanic', type: 'boolean' },
  ],
  vehicles: [
    { key: 'vin', label: 'VIN', max: 17 },
    { key: 'license_plate', label: 'License plate', max: 20 },
    { key: 'make', label: 'Make', max: 80 },
    { key: 'model', label: 'Model', max: 80 },
    { key: 'year', label: 'Model year', type: 'number' },
    { key: 'office', label: 'Office', type: 'relation', resource: 'offices' },
    { key: 'active', label: 'Active vehicle', type: 'boolean' },
  ],
  maintenance: [
    { key: 'vehicle', label: 'Vehicle', type: 'relation', resource: 'vehicles' },
    { key: 'mechanic', label: 'Mechanic', type: 'relation', resource: 'mechanics' },
    { key: 'maintenance_date', label: 'Maintenance date', type: 'date' },
    {
      key: 'maintenance_type',
      label: 'Service type',
      type: 'select',
      options: ['inspection', 'oil_change', 'tires', 'brakes', 'repair', 'other'],
    },
    { key: 'cost', label: 'Cost (USD)', type: 'number' },
    { key: 'notes', label: 'Service notes', type: 'multiline', required: false, max: 4000 },
  ],
};
const singular: Record<Resource, string> = {
  vehicles: 'vehicle',
  offices: 'office',
  mechanics: 'mechanic',
  maintenance: 'maintenance record',
};
export default function RecordForm({
  resource,
  record,
  defaults = {},
  onClose,
}: {
  resource: Resource;
  record?: Row;
  defaults?: Record<string, string | number>;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string | number | boolean>>(
    () =>
      Object.fromEntries(
        fields[resource].map((field) => [
          field.key,
          record?.[field.key] ??
            defaults[field.key] ??
            (field.type === 'boolean'
              ? true
              : field.type === 'relation'
                ? 0
                : field.type === 'date'
                  ? new Date().toISOString().slice(0, 10)
                  : ''),
        ]),
      ) as Record<string, string | number | boolean>,
  );
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: async () => {
      if (resource === 'vehicles') {
        const result = await apiClient.get<{ conflicts: string[] }>('/vehicles/duplicate-check/', {
          params: {
            vin: values.vin,
            license_plate: values.license_plate,
            active: values.active,
            ...(record ? { exclude_id: record.id } : {}),
          },
        });
        if (result.data.conflicts.length) {
          throw new Error(
            `Another vehicle already uses this ${result.data.conflicts.map((x) => x.replaceAll('_', ' ')).join(' and ')}.`,
          );
        }
      }
      return record
        ? apiClient.patch(`/${resource}/${record.id}/`, values)
        : apiClient.post(`/${resource}/`, values);
    },
    onSuccess: async () => {
      await client.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'session' });
      onClose();
    },
  });
  const message =
    save.error instanceof Error && !('isAxiosError' in save.error)
      ? save.error.message
      : errorMessage(save.error);
  return (
    <Dialog
      open
      onClose={() => {
        if (!save.isPending) onClose();
      }}
      fullWidth
      maxWidth="sm"
      aria-labelledby="record-form-title"
    >
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <DialogTitle id="record-form-title">
          {record ? 'Edit' : 'Add'} {singular[resource]}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {save.isError && <Alert severity="error">{message}</Alert>}
            {fields[resource].map((field) =>
              field.type === 'boolean' ? (
                <FormControlLabel
                  key={field.key}
                  control={
                    <Switch
                      checked={Boolean(values[field.key])}
                      disabled={save.isPending}
                      onChange={(_, v) => setValues({ ...values, [field.key]: v })}
                    />
                  }
                  label={field.label}
                />
              ) : field.type === 'relation' ? (
                <RelationInput
                  key={field.key}
                  resource={field.resource!}
                  label={field.label}
                  value={Number(values[field.key])}
                  onChange={(v) => setValues({ ...values, [field.key]: v })}
                  disabled={save.isPending}
                />
              ) : (
                <TextField
                  key={field.key}
                  label={field.label}
                  value={values[field.key]}
                  onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                  disabled={save.isPending}
                  required={field.required !== false}
                  fullWidth
                  select={field.type === 'select'}
                  multiline={field.type === 'multiline'}
                  minRows={field.type === 'multiline' ? 3 : undefined}
                  type={
                    field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'
                  }
                  helperText={
                    field.key === 'vin'
                      ? '17 characters. Letters I, O and Q are not used.'
                      : field.key === 'cost'
                        ? 'USD, including tax. Use 0 for no-charge work.'
                        : undefined
                  }
                  slotProps={{
                    inputLabel: field.type === 'date' ? { shrink: true } : undefined,
                    htmlInput: {
                      maxLength: field.max,
                      ...(field.key === 'cost'
                        ? { min: 0, step: '.01' }
                        : field.key === 'year'
                          ? { min: 1886, max: new Date().getUTCFullYear() + 1 }
                          : field.type === 'date'
                            ? { max: new Date().toISOString().slice(0, 10) }
                            : {}),
                    },
                  }}
                >
                  {field.options?.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option.replaceAll('_', ' ')}
                    </MenuItem>
                  ))}
                </TextField>
              ),
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : record ? 'Save changes' : 'Create record'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
