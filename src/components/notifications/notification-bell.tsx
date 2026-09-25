'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck, LoaderCircle, X } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

type NotificationItem = { id: string; type: string; title: string; body: string | null; entityType: string | null; entityId: string | null; link: string | null; readAt: string | null; createdAt: string };
type NotificationResponse = { notifications?: NotificationItem[]; unreadCount?: number };

function safeInternalLink(link: string | null): string | null { return link && link.startsWith('/') && !link.startsWith('//') ? link : null; }
function errorMessage(payload: unknown, fallback: string): string { if (typeof payload !== 'object' || payload === null || !('error' in payload)) return fallback; const error = payload.error; return typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string' ? error.message : fallback; }

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch('/api/v1/notifications');
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorMessage(payload, 'Notifications could not be loaded.'));
      const data = payload as NotificationResponse;
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Notifications could not be loaded.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);


  async function markRead(notification: NotificationItem) {
    if (notification.readAt) return;
    setActionLoading(true); setError(null);
    try {
      const response = await fetch(`/api/v1/notifications/${notification.id}`, { method: 'PATCH' });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorMessage(payload, 'Notification could not be updated.'));
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item));
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Notification could not be updated.'); }
    finally { setActionLoading(false); }
  }

  async function markAllRead() {
    setActionLoading(true); setError(null);
    try {
      const response = await fetch('/api/v1/notifications/read-all', { method: 'POST' });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorMessage(payload, 'Notifications could not be updated.'));
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? readAt })));
      setUnreadCount(0);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Notifications could not be updated.'); }
    finally { setActionLoading(false); }
  }

  return <div className="relative"><Button type="button" variant="ghost" size="icon-sm" aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'} aria-expanded={open} onClick={() => setOpen((current) => !current)}><Bell className="size-4" />{unreadCount > 0 ? <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground">{unreadCount > 99 ? '99+' : unreadCount}</span> : null}</Button>{open ? <div className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-card shadow-xl" role="dialog" aria-label="Notifications"><div className="flex items-center justify-between border-b border-border px-4 py-3"><div><p className="text-sm font-semibold">Notifications</p><p className="text-xs text-muted-foreground" aria-live="polite">{unreadCount} unread</p></div><div className="flex items-center gap-1"><Button type="button" variant="ghost" size="icon-sm" aria-label="Close notifications" onClick={() => setOpen(false)}><X /></Button>{unreadCount > 0 ? <Button type="button" variant="ghost" size="sm" loading={actionLoading} onClick={() => void markAllRead()}><CheckCheck />Mark all read</Button> : null}</div></div><div className="max-h-96 overflow-y-auto">{error ? <div className="p-3"><Alert variant="destructive">{error}</Alert></div> : null}{loading ? <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Loading notifications</div> : notifications.length ? <ul className="divide-y divide-border">{notifications.map((notification) => <NotificationRow key={notification.id} notification={notification} actionLoading={actionLoading} onRead={markRead} />)}</ul> : <p className="p-8 text-center text-sm text-muted-foreground">You are all caught up.</p>}</div><div className="border-t border-border px-4 py-2 text-center"><Button type="button" variant="ghost" size="sm" onClick={() => { setOpen(false); void load(); }}>Refresh</Button></div></div> : null}</div>;
}



function NotificationRow({ notification, actionLoading, onRead }: { notification: NotificationItem; actionLoading: boolean; onRead: (notification: NotificationItem) => Promise<void> }) {
  const href = safeInternalLink(notification.link);
  const content = <div className={`block px-4 py-3 text-left transition hover:bg-muted/60 ${notification.readAt ? '' : 'bg-primary/5'}`}><div className="flex items-start justify-between gap-3"><p className="text-sm font-medium">{notification.title}</p>{!notification.readAt ? <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" /> : null}</div>{notification.body ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{notification.body}</p> : null}<p className="mt-2 text-[11px] text-muted-foreground">{formatDateTime(notification.createdAt)}</p></div>;
  return <li>{href ? <Link href={href} onClick={() => { if (!actionLoading) void onRead(notification); }}>{content}</Link> : <button type="button" className="w-full" disabled={actionLoading} onClick={() => void onRead(notification)}>{content}</button>}</li>;
}
