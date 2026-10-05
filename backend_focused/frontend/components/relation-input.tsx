'use client';
import { useEffect, useState } from 'react';
import { Autocomplete, TextField } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { getData, PageResult } from '@/lib/api-client';
import { Row } from '@/lib/types';
const labelFor = (row: Row) =>
  typeof row.name === 'string'
    ? `${row.name}${row.city ? ` · ${row.city}` : ''}`
    : `${row.make} ${row.model} · ${row.license_plate}`;
export default function RelationInput({
  resource,
  label,
  value,
  onChange,
  disabled,
  required = true,
}: {
  resource: string;
  label: string;
  value: number;
  onChange: (id: number) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  const [input, setInput] = useState('');
  const [term, setTerm] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setTerm(input), 250);
    return () => clearTimeout(timer);
  }, [input]);
  const options = useQuery({
    queryKey: ['options', resource, term],
    queryFn: ({ signal }) =>
      getData<PageResult<Row>>(`/${resource}/`, signal, {
        ...(term ? { search: term } : {}),
        pageSize: 30,
        ...(resource === 'vehicles' || resource === 'mechanics' ? { active: 'true' } : {}),
      }),
  });
  const selected = useQuery({
    queryKey: ['option', resource, value],
    queryFn: ({ signal }) => getData<Row>(`/${resource}/${value}/`, signal),
    enabled: value > 0,
  });
  const rows = options.data?.results ?? [];
  const current = rows.find((r) => r.id === value) ?? selected.data ?? null;
  return (
    <Autocomplete
      options={current && !rows.some((r) => r.id === current.id) ? [current, ...rows] : rows}
      value={current}
      getOptionLabel={labelFor}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      filterOptions={(x) => x}
      onInputChange={(_, v, reason) => {
        if (reason === 'input' || reason === 'clear') setInput(v);
      }}
      onChange={(_, row) => onChange(row?.id ?? 0)}
      disabled={disabled}
      loading={options.isPending}
      noOptionsText={
        options.isError ? 'Could not load options. Try typing again.' : 'No matching records'
      }
      renderInput={(params) => (
        <TextField
          {...params}
          required={required}
          label={label}
          error={options.isError || selected.isError}
          helperText={
            options.isError || selected.isError
              ? 'Could not load records. Close and retry.'
              : 'Type to search; up to 30 matching records shown.'
          }
        />
      )}
    />
  );
}
