"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { NotificationItem } from "@/components/admin/notification-item";
import { EmptyState } from "@/components/shared/states";
import { useData } from "@/components/providers/data-provider";
import { getNotifications } from "@/lib/selectors";
import { api, errorMessage } from "@/lib/api";
import { toast } from "@/components/ui/toaster";

export function NotificationBell() {
  const { db, run, ready } = useData();
  const [open, setOpen] = React.useState(false);

  const notifications = React.useMemo(() => getNotifications(db).slice(0, 6), [db]);
  const unread = db.notifications.filter((n) => !n.read).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative"
          aria-label={`Notifications${unread > 0 ? ` — ${unread} unread` : ""}`}
        >
          <Bell className="h-4 w-4" />
          {ready && unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold tabular-nums text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between gap-2 p-3">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">
              {unread > 0 ? `${unread} unread` : "You are all caught up"}
            </p>
          </div>
          {unread > 0 ? (
            <Button
              variant="ghost"
              size="xs"
              onClick={async () => {
                try {
                  await run(() => api.markAllNotificationsRead());
                  toast.success("All notifications marked as read.");
                } catch (error) {
                  toast.error(errorMessage(error, "Could not update the notifications."));
                }
              }}
            >
              Mark all read
            </Button>
          ) : null}
        </div>

        <Separator />

        {notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications"
            description="Activity from the gate and the approval queue will appear here."
            className="py-10"
          />
        ) : (
          <ul className="max-h-[320px] divide-y divide-border overflow-y-auto scrollbar-slim">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <NotificationItem
                  notification={notification}
                  compact
                  onOpen={() => {
                    // Fire-and-forget: navigation should not wait on the flag,
                    // and a failed read-marker is not worth interrupting for.
                    void run(() => api.markNotificationRead(notification.id, true)).catch(
                      () => undefined,
                    );
                    setOpen(false);
                  }}
                />
              </li>
            ))}
          </ul>
        )}

        <Separator />
        <div className="p-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href="/admin/notifications" onClick={() => setOpen(false)}>
              View all notifications
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
