import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Search, ShieldCheck } from 'lucide-react';
import type { Prisma } from '@/generated/prisma/client';
import { getAuthContext } from '@/lib/auth/session';
import { can, dashboardPathForRole } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';
import { formatDateTime } from '@/lib/utils';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow, TableWrap } from '@/components/ui/table';

export const metadata = { title: 'Audit log' };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const PAGE_SIZE = 25;

function first(value: string | string[] | undefined): string { return Array.isArray(value) ? value[0] ?? '' : value ?? ''; }
function bounded(value: string, max: number): string { return value.trim().slice(0, max); }

function displayMetadata(metadata: unknown): string | null {
  if (metadata === null || metadata === undefined) return null;
  if (['string', 'number', 'boolean'].includes(typeof metadata)) return String(metadata).slice(0, 200);
  if (typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const blocked = /password|token|secret|credential|cookie|authorization|session/i;
  const entries = Object.entries(metadata as Record<string, unknown>)
    .filter(([key, value]) => !blocked.test(key) && ['string', 'number', 'boolean'].includes(typeof value))
    .slice(0, 6)
    .map(([key, value]) => `${key}: ${String(value).slice(0, 120)}`);
  return entries.length ? entries.join(' · ') : null;
}

export default async function AuditLogPage({ searchParams }: { searchParams: SearchParams }) {
  const auth = await getAuthContext();
  if (!auth) redirect('/login?next=/admin/audit');
  if (!can(auth.user.role, 'audit.read')) redirect(dashboardPathForRole(auth.user.role));

  const params = await searchParams;
  const query = bounded(first(params.q), 100);
  const action = bounded(first(params.action), 80);
  const entityType = bounded(first(params.entityType), 80);
  const actorRole = bounded(first(params.actorRole), 40);
  const requestedPage = Number(first(params.page));
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const where: Prisma.AuditLogWhereInput = {
    ...(action ? { action: { contains: action } } : {}),
    ...(entityType ? { entityType: { contains: entityType } } : {}),
    ...(actorRole ? { actorRole: { contains: actorRole } } : {}),
    ...(query ? { OR: [{ action: { contains: query } }, { entityType: { contains: query } }, { entityId: { contains: query } }, { actorRole: { contains: query } }] } : {}),
  };
  const total = await prisma.auditLog.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const effectivePage = Math.min(page, totalPages);
  const entries = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: (effectivePage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true, action: true, entityType: true, entityId: true, actorUserId: true,
      actorRole: true, metadata: true, ipAddress: true, createdAt: true,
      actor: { select: { name: true } },
    },
  });
  const hasFilters = Boolean(query || action || entityType || actorRole);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container-page flex min-h-18 items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-medium text-primary"><ArrowLeft className="size-4" />Control center</Link>
            <div className="hidden h-6 w-px bg-border sm:block" />
            <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Governance</p><h1 className="text-lg font-semibold">Audit log</h1></div>
          </div>
          <div className="flex items-center gap-2"><NotificationBell /><SignOutButton /></div>
        </div>
      </header>
      <main id="main-content" className="container-page space-y-8 py-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="text-sm text-muted-foreground">Administrator visibility</p><h2 className="mt-1 text-3xl font-semibold tracking-tight">Trace every important action.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Persistent business events, actor context, and record references for investigation and operational review.</p></div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-success" />Admin-only access</div>
        </div>
        <Card>
          <CardHeader><CardTitle>Filter audit events</CardTitle></CardHeader>
          <CardContent>
            <form method="get" className="grid gap-4 md:grid-cols-[1.5fr_1fr_1fr_1fr_auto] md:items-end">
              <div><label htmlFor="q" className="mb-1.5 block text-sm font-medium">Search</label><Input id="q" name="q" defaultValue={query} maxLength={100} placeholder="Action, entity, or ID" /></div>
              <div><label htmlFor="action" className="mb-1.5 block text-sm font-medium">Action</label><Input id="action" name="action" defaultValue={action} maxLength={80} placeholder="e.g. LOGIN_FAILED" /></div>
              <div><label htmlFor="entityType" className="mb-1.5 block text-sm font-medium">Entity type</label><Input id="entityType" name="entityType" defaultValue={entityType} maxLength={80} placeholder="e.g. Application" /></div>
              <div><label htmlFor="actorRole" className="mb-1.5 block text-sm font-medium">Actor role</label><Select id="actorRole" name="actorRole" defaultValue={actorRole}><option value="">All roles</option><option value="SUPER_ADMIN">Super admin</option><option value="ADMIN">Admin</option><option value="RECRUITER">Recruiter</option><option value="CLIENT">Client</option><option value="CANDIDATE">Candidate</option><option value="EMPLOYEE">Employee</option></Select></div>
              <Button type="submit"><Search />Apply</Button>
            </form>
            {hasFilters ? <div className="mt-3 text-right"><Link href="/admin/audit" className="text-sm font-medium text-primary hover:underline">Clear filters</Link></div> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Events ({total})</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <TableWrap>
              <Table>
                <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>Actor</TableHead><TableHead>Metadata</TableHead><TableHead>IP address</TableHead><TableHead>Timestamp</TableHead></TableRow></TableHeader>
                <TableBody>
                  {entries.length ? entries.map((entry) => {
                    const metadata = displayMetadata(entry.metadata);
                    const actor = entry.actor?.name ?? entry.actorUserId ?? 'SYSTEM';
                    return <TableRow key={entry.id}><TableCell><p className="font-medium">{entry.action.replaceAll('_', ' ')}</p><p className="mt-1 max-w-48 truncate font-mono text-[11px] text-muted-foreground">{entry.id}</p></TableCell><TableCell><p className="font-medium">{entry.entityType}</p>{entry.entityId ? <p className="mt-1 max-w-48 truncate font-mono text-[11px] text-muted-foreground">{entry.entityId}</p> : null}</TableCell><TableCell><Badge variant="secondary">{entry.actorRole ?? 'SYSTEM'}</Badge><p className="mt-1 max-w-32 truncate text-xs text-muted-foreground">{actor}</p></TableCell><TableCell className="max-w-72 break-words text-xs text-muted-foreground">{metadata ?? '—'}</TableCell><TableCell className="font-mono text-xs">{entry.ipAddress ?? '—'}</TableCell><TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</TableCell></TableRow>;
                  }) : <TableEmpty colSpan={6} message={hasFilters ? 'No audit events match these filters.' : 'No audit events recorded yet.'} />}
                </TableBody>
              </Table>
            </TableWrap>
            <Pagination page={effectivePage} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} basePath="/admin/audit" params={{ q: query || undefined, action: action || undefined, entityType: entityType || undefined, actorRole: actorRole || undefined }} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
