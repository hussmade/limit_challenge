'use client';
import { Box, Button, Typography } from '@mui/material';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <Box className="center-state">
      <Typography variant="h5" component="h1">
        We couldn’t load this page
      </Typography>
      <Typography color="text.secondary">
        Please try again. Your saved records are still safe.
      </Typography>
      <Button variant="contained" onClick={reset}>
        Try again
      </Button>
    </Box>
  );
}
