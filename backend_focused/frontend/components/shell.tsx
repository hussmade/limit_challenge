'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Avatar, Box, Drawer, IconButton, Typography } from '@mui/material';
import MenuRounded from '@mui/icons-material/MenuRounded';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import DirectionsCarOutlined from '@mui/icons-material/DirectionsCarOutlined';
import BuildOutlined from '@mui/icons-material/BuildOutlined';
import BusinessOutlined from '@mui/icons-material/BusinessOutlined';
import PeopleOutlineRounded from '@mui/icons-material/PeopleOutlineRounded';
import { AuthBoundary, logout, useUser } from '@/lib/auth';
import { errorMessage } from '@/lib/api-client';

const links = [
  { href: '/', label: 'Overview', icon: DashboardOutlined },
  { href: '/vehicles', label: 'Vehicles', icon: DirectionsCarOutlined },
  { href: '/maintenance', label: 'Maintenance', icon: BuildOutlined },
  { href: '/offices', label: 'Offices', icon: BusinessOutlined },
  { href: '/mechanics', label: 'Mechanics', icon: PeopleOutlineRounded },
];
function Workspace({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const user = useUser();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [leaving, setLeaving] = useState(false);
  const active = links.find((item) =>
    item.href === '/' ? path === '/' : path.startsWith(item.href),
  );
  const nav = (
    <>
      <Link href="/" className="brand sidebar-brand" aria-label="Fleet home">
        <span className="brand-mark">L</span>limit<span className="brand-product">Fleet</span>
      </Link>
      <div className="workspace-tag">
        <span className="workspace-dot" /> Company workspace
      </div>
      <div className="nav-label">WORKSPACE</div>
      <nav aria-label="Main navigation">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={`nav-item ${active?.href === href ? 'active' : ''}`}
            aria-current={active?.href === href ? 'page' : undefined}
          >
            <Icon sx={{ fontSize: 20 }} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-note">
          <div className="eyebrow">BUILT FOR CLARITY</div>
          <p>The right service, at the right time. Keep every vehicle ready for what’s next.</p>
        </div>
        <div className="user-card">
          <Avatar
            sx={{ width: 34, height: 34, bgcolor: '#e6edea', color: '#2f5849', fontSize: 13 }}
          >
            {user.name
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')}
          </Avatar>
          <div>
            <strong>{user.name}</strong>
            <span>{user.role === 'operator' ? 'Operator access' : 'View access'}</span>
          </div>
          <IconButton
            aria-label="Sign out"
            disabled={leaving}
            size="small"
            onClick={async () => {
              setLeaving(true);
              try {
                await logout();
                client.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' });
                client.setQueryData(['session'], null);
              } catch (error) {
                setError(errorMessage(error));
              } finally {
                setLeaving(false);
              }
            }}
          >
            <LogoutRounded fontSize="small" />
          </IconButton>
        </div>
      </div>
    </>
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">{nav}</aside>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{ paper: { className: 'mobile-sidebar' } }}
      >
        {nav}
      </Drawer>
      <div className="workspace-main">
        <header className="topbar">
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <IconButton
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
              sx={{ display: { md: 'none' } }}
            >
              <MenuRounded />
            </IconButton>
            <span className="breadcrumb">
              Workspace <span>/</span> <strong>{active?.label ?? 'Record detail'}</strong>
            </span>
          </Box>
          <span className="topbar-label">
            Fleet <span className="workspace-dot" />
          </span>
        </header>
        <main id="main-content" className="page-content" tabIndex={-1}>
          {error && (
            <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {children}
        </main>
        <footer className="workspace-footer">
          <Typography variant="caption">Limit · Fleet workspace</Typography>
          <Typography variant="caption">Costs in USD · Dates in UTC</Typography>
        </footer>
      </div>
    </div>
  );
}
export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AuthBoundary>
      <Workspace>{children}</Workspace>
    </AuthBoundary>
  );
}
