"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/stores/auth";
import { useOpenPageTab } from "@/hooks/use-open-page-tab";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  targetType: string;
  targetId: string;
  isRead: boolean;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  comment: <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" />,
  rule_update: <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />,
  enhancement: <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />,
  analysis: <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />,
  broadcast: <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />,
  urgent_broadcast: <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  default: <><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></>,
};

function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch { /* audio not available */ }
}

function playUrgentSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "square";
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.setValueAtTime(1200, t + 0.15);
    osc.frequency.setValueAtTime(800, t + 0.3);
    osc.frequency.setValueAtTime(1200, t + 0.45);
    osc.frequency.setValueAtTime(800, t + 0.6);
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.8);
    osc.start(t);
    osc.stop(t + 0.8);
  } catch { /* audio not available */ }
}

export function NotificationBell() {
  const { openRule } = useOpenPageTab();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastPriority, setBroadcastPriority] = useState<"normal" | "urgent">("normal");
  const [broadcastRuleId, setBroadcastRuleId] = useState("");
  const [sending, setSending] = useState(false);
  const prevUnreadRef = useRef(0);
  const ref = useRef<HTMLDivElement>(null);
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "ADMIN";

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=15");
      if (!res.ok) return;
      const data = await res.json();
      const newItems: Notification[] = data.notifications || [];
      const newUnread: number = data.unreadCount || 0;

      if (newUnread > prevUnreadRef.current && prevUnreadRef.current >= 0) {
        const hasUrgent = newItems.some(
          (n: Notification) => !n.isRead && n.type === "urgent_broadcast"
        );
        if (hasUrgent) {
          playUrgentSound();
        } else if (newUnread > prevUnreadRef.current) {
          playNotificationSound();
        }
      }

      prevUnreadRef.current = newUnread;
      setItems(newItems);
      setUnreadCount(newUnread);
    } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowBroadcast(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const markAsRead = async (id?: string) => {
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : {}),
      });
      if (id) {
        setItems((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
        setUnreadCount((c) => Math.max(0, c - 1));
        prevUnreadRef.current = Math.max(0, prevUnreadRef.current - 1);
      } else {
        setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
        prevUnreadRef.current = 0;
      }
    } catch { /* */ }
  };

  const handleBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: broadcastTitle,
          message: broadcastMessage,
          priority: broadcastPriority,
          ruleId: broadcastRuleId || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setBroadcastTitle("");
        setBroadcastMessage("");
        setBroadcastPriority("normal");
        setBroadcastRuleId("");
        setShowBroadcast(false);
        fetchNotifications();
        alert(`Notification sent to ${data.recipientCount} users`);
      }
    } catch { /* */ }
    finally { setSending(false); }
  };

  const isUrgent = (n: Notification) => n.type === "urgent_broadcast";
  const isBroadcast = (n: Notification) => n.type === "broadcast" || n.type === "urgent_broadcast";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen((v) => !v); setShowBroadcast(false); }}
        className="relative p-2 rounded-lg text-text-muted hover:bg-surface-light hover:text-text transition-all"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-danger text-white text-[10px] font-bold px-1 animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-surface border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in-up">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-text">Notifications</h3>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <button
                  onClick={() => setShowBroadcast((v) => !v)}
                  className="text-xs text-accent hover:text-accent font-medium transition-colors flex items-center gap-1"
                  title="Broadcast notification"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
                  </svg>
                  Broadcast
                </button>
              )}
              {unreadCount > 0 && (
                <button
                  onClick={() => markAsRead()}
                  className="text-xs text-primary hover:text-primary-hover font-medium transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {showBroadcast && isAdmin && (
            <div className="px-4 py-3 border-b border-border bg-surface-light space-y-2">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Broadcast to All Users</p>
              <input
                type="text"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                placeholder="Notification title..."
                className="w-full text-sm px-3 py-1.5 rounded-lg border border-border bg-bg text-text placeholder:text-text-muted focus:outline-none focus:border-primary"
                maxLength={100}
              />
              <textarea
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Message..."
                rows={2}
                className="w-full text-sm px-3 py-1.5 rounded-lg border border-border bg-bg text-text placeholder:text-text-muted focus:outline-none focus:border-primary resize-none"
                maxLength={500}
              />
              <input
                type="text"
                value={broadcastRuleId}
                onChange={(e) => setBroadcastRuleId(e.target.value)}
                placeholder="Rule ID (optional — links notification to rule)"
                className="w-full text-xs px-3 py-1.5 rounded-lg border border-border bg-bg text-text placeholder:text-text-muted focus:outline-none focus:border-primary"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-text-muted">Priority:</label>
                  <button
                    onClick={() => setBroadcastPriority("normal")}
                    className={`text-xs px-2 py-0.5 rounded ${broadcastPriority === "normal" ? "bg-primary text-white" : "bg-bg text-text-muted border border-border"}`}
                  >
                    Normal
                  </button>
                  <button
                    onClick={() => setBroadcastPriority("urgent")}
                    className={`text-xs px-2 py-0.5 rounded ${broadcastPriority === "urgent" ? "bg-danger text-white" : "bg-bg text-text-muted border border-border"}`}
                  >
                    Urgent
                  </button>
                </div>
                <button
                  onClick={handleBroadcast}
                  disabled={sending || !broadcastTitle.trim() || !broadcastMessage.trim()}
                  className="text-xs px-3 py-1 rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {sending ? "Sending..." : "Send"}
                </button>
              </div>
              {broadcastPriority === "urgent" && (
                <p className="text-[10px] text-danger">Urgent notifications play an alert sound for all users.</p>
              )}
            </div>
          )}

          <div className="max-h-96 overflow-y-auto">
            {loading && items.length === 0 && (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            )}

            {!loading && items.length === 0 && (
              <div className="text-center py-8">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-text-muted mb-2">
                  <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
                </svg>
                <p className="text-sm text-text-muted">No notifications yet</p>
              </div>
            )}

            {items.map((n) => {
              const isRuleLink = n.targetType === "rule" && !!n.targetId;
              const urgent = isUrgent(n);
              const broadcast = isBroadcast(n);
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-surface-light/50 transition-colors border-b border-border/50 last:border-0 cursor-pointer ${
                    !n.isRead
                      ? urgent
                        ? "border-l-2 border-l-danger bg-danger/5"
                        : "border-l-2 border-l-primary bg-primary/5"
                      : ""
                  }`}
                  onClick={() => {
                    if (!n.isRead) markAsRead(n.id);
                    if (isRuleLink) {
                      openRule(n.targetId, n.title);
                      setOpen(false);
                    }
                  }}
                >
                  <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5 ${
                    urgent ? "bg-danger/15 text-danger" : broadcast ? "bg-accent/15 text-accent" : "bg-primary/15 text-primary"
                  }`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {TYPE_ICONS[n.type] || TYPE_ICONS.default}
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {urgent && <span className="text-[9px] font-bold text-danger bg-danger/10 px-1 py-0.5 rounded uppercase">Urgent</span>}
                      {broadcast && !urgent && <span className="text-[9px] font-bold text-accent bg-accent/10 px-1 py-0.5 rounded uppercase">Broadcast</span>}
                      <p className={`text-sm truncate ${!n.isRead ? "font-semibold text-text" : "font-medium text-text-secondary"}`}>
                        {n.title}
                      </p>
                    </div>
                    {n.message && (
                      <p className="text-xs text-text-muted truncate mt-0.5">{n.message}</p>
                    )}
                    <span className="text-xs text-text-muted mt-1 block">{timeAgo(n.createdAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border px-4 py-2.5">
            <a
              href="/dashboard/audit"
              className="text-xs text-primary hover:text-primary-hover font-medium transition-colors"
            >
              View all activity →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
