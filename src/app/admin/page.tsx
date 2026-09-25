import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Activity, BriefcaseBusiness, UsersRound } from 'lucide-react';
import { getAuthContext } from '@/lib/auth/session';
import { dashboardPathForRole } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';
import { formatDateTime } from '@/lib/utils';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Admin dashboard' };

export default async function AdminDashboard() {
  const auth = await getAuthContext();
  if (!auth) redirect('/login?next=/admin');
  if (!['SUPER_ADMIN', 'ADMIN'].includes(auth.user.role)) redirect(dashboardPathForRole(auth.user.role));
  const [users, jobs, applications, audit] = await prisma.$transaction([
    prisma.user.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
    prisma.job.count({ where: { deletedAt: null, status: 'PUBLISHED' } }),
    prisma.application.count(),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 8, select: { id: true, action: true, entityType: true, entityId: true, createdAt: true, actorRole: true } }),
  ]);
  return <div className="min-h-screen bg-background"><header className="border-b border-border bg-card"><div className="container-page flex min-h-18 items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Administration</p><h1 className="text-lg font-semibold">Platform control center</h1></div><div className="flex items-center gap-2"><NotificationBell /><SignOutButton /></div></div></header><main id="main-content" className="container-page space-y-8 py-8"><div><p className="text-sm text-muted-foreground">Operations overview</p><h2 className="mt-1 text-3xl font-semibold tracking-tight">Keep the platform healthy.</h2></div><div className="grid gap-4 sm:grid-cols-3"><Card><CardContent className="p-5"><UsersRound className="text-primary" /><p className="mt-4 text-3xl font-semibold">{users}</p><p className="text-sm text-muted-foreground">Active users</p></CardContent></Card><Card><CardContent className="p-5"><BriefcaseBusiness className="text-primary" /><p className="mt-4 text-3xl font-semibold">{jobs}</p><p className="text-sm text-muted-foreground">Published jobs</p></CardContent></Card><Card><CardContent className="p-5"><Activity className="text-primary" /><p className="mt-4 text-3xl font-semibold">{applications}</p><p className="text-sm text-muted-foreground">Applications</p></CardContent></Card></div><Card><CardHeader className="flex-row items-center justify-between"><CardTitle>Recent audit activity</CardTitle><Link href="/admin/audit" className="text-sm font-medium text-primary hover:underline">View audit log</Link></CardHeader><CardContent>{audit.length ? <div className="divide-y divide-border">{audit.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-4 py-3 text-sm"><div><p className="font-medium">{entry.action.replaceAll('_', ' ')}</p><p className="text-xs text-muted-foreground">{entry.entityType}{entry.entityId ? ` · ${entry.entityId}` : ''}</p></div><div className="text-right"><Badge variant="secondary">{entry.actorRole ?? 'SYSTEM'}</Badge><p className="mt-1 text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</p></div></div>)}</div> : <p className="text-sm text-muted-foreground">No audit records yet.</p>}</CardContent></Card></main></div>;
}
