"use client";

import * as React from "react";
import { Bell, CheckCheck, Inbox, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, TableLoadingState } from "@/components/shared/states";
import { FilterBar } from "@/components/admin/filter-bar";
import { NotificationItem } from "@/components/admin/notification-item";
import { useData } from "@/components/providers/data-provider";
import { useAction } from "@/components/providers/use-action";
import { api } from "@/lib/api";
import { getNotifications } from "@/lib/selectors";
import type { NotificationType } from "@/lib/types";

const TYPE_LABELS: Record<NotificationType, string> = {
  request: "New visitor request",
  approval: "Visit approved",
  rejection: "Visit rejected",
  checkin: "Visitor checked in",
  checkout: "Visitor checked out",
  security: "Security alert",
  incident: "Incident alert",
  emergency: "Emergency alert",
  vehicle: "Vehicle movement",
  meeting: "Meeting update",
  system: "System",
};

type TabValue = "all" | "unread" | "read";

export default function NotificationsPage() {
  const { db, ready } = useData();
  const act = useAction();
  const [tab, setTab] = React.useState<TabValue>("all");
  const [search, setSearch] = React.useState("");
  const [type, setType] = React.useState("all");

  const notifications = React.useMemo(() => getNotifications(db), [db]);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return notifications.filter((notification) => {
      if (tab === "unread" && notification.read) return false;
      if (tab === "read" && !notification.read) return false;
      if (type !== "all" && notification.type !== type) return false;
      if (!query) return true;
      return `${notification.title} ${notification.message}`.toLowerCase().includes(query);
    });
  }, [notifications, tab, type, search]);

  const isFiltered = search !== "" || type !== "all";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Activity from the approval queue, the gates, incidents and emergency alerts."
        actions={
          <Button
            variant="outline"
            disabled={unreadCount === 0}
            onClick={() => {
              void act(() => api.markAllNotificationsRead(), {
                success: "All notifications marked as read.",
                fallback: "Unable to update your notifications. Please try again.",
              });
            }}
          >
            <CheckCheck className="h-4 w-4" />
            Mark all as read
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabValue)}>
        <TabsList>
          <TabsTrigger value="all">
            All
            <span className="rounded-full bg-muted-foreground/15 px-1.5 text-[10px] font-semibold tabular-nums">
              {notifications.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="unread">
            Unread
            {unreadCount > 0 ? (
              <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold tabular-nums text-primary-foreground">
                {unreadCount}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="read">Read</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <Card>
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search notifications…"
              resultCount={filtered.length}
              totalCount={notifications.length}
              isFiltered={isFiltered}
              onReset={() => {
                setSearch("");
                setType("all");
              }}
              filters={[
                {
                  id: "notification-type",
                  label: "Type",
                  value: type,
                  onChange: setType,
                  options: [
                    { value: "all", label: "All types" },
                    ...(Object.keys(TYPE_LABELS) as NotificationType[]).map((key) => ({
                      value: key,
                      label: TYPE_LABELS[key],
                    })),
                  ],
                  className: "min-w-[180px]",
                },
              ]}
            />

            {!ready ? (
              <TableLoadingState rows={6} columns={2} />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={tab === "unread" ? CheckCheck : Inbox}
                title={
                  tab === "unread"
                    ? "No unread notifications"
                    : isFiltered
                      ? "No notifications match these filters"
                      : "No notifications yet"
                }
                description={
                  tab === "unread"
                    ? "You are all caught up."
                    : "Activity across the campus security system will be listed here."
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((notification) => (
                  <li key={notification.id} className="relative">
                    <NotificationItem
                      notification={notification}
                      onOpen={() => void act(() => api.markNotificationRead(notification.id, true))}
                      actions={
                        <>
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() =>
                              void act(() =>
                                api.markNotificationRead(notification.id, !notification.read),
                              )
                            }
                          >
                            {notification.read ? (
                              <>
                                <Bell className="h-3.5 w-3.5" />
                                Mark unread
                              </>
                            ) : (
                              <>
                                <CheckCheck className="h-3.5 w-3.5" />
                                Mark read
                              </>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => {
                              void act(() => api.deleteNotification(notification.id), {
                                success: "Notification removed.",
                                fallback: "Unable to remove this notification. Please try again.",
                              });
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </Button>
                        </>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
