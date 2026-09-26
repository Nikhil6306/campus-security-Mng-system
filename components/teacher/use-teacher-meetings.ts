"use client";

import * as React from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { useData } from "@/components/providers/data-provider";
import { getMeetings } from "@/lib/selectors";
import type { Meeting, VisitRequest } from "@/lib/types";
import { todayISO } from "@/lib/utils";

/**
 * The signed-in teacher's meeting book, bucketed for the portal.
 *
 * The snapshot the server sends a teacher already contains only their own
 * bookings; the filter here is what keeps the view correct when an
 * administrator previews the portal and receives the campus-wide snapshot.
 */
export function useTeacherMeetings() {
  const { db } = useData();
  const { session } = useAuth();
  const today = todayISO();

  const meetings = React.useMemo(() => {
    const all = getMeetings(db);
    return session?.refId ? all.filter((m) => m.hostId === session.refId) : all;
  }, [db, session?.refId]);

  const buckets = React.useMemo(() => {
    const requests = meetings.filter((m) => m.meetingStatus === "Requested");
    const todays = meetings.filter((m) => m.date === today && m.meetingStatus !== "Rejected");
    const upcoming = meetings.filter((m) => m.date > today && m.meetingStatus !== "Rejected");
    const history = meetings
      .filter((m) => m.date < today || ["Checked Out", "Rejected"].includes(m.status))
      .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
    return { requests, todays, upcoming, history };
  }, [meetings, today]);

  /**
   * Runs an action against the booking behind a meeting.
   *
   * Every mutation needs the underlying `VisitRequest`, so this resolves it once
   * rather than each caller re-deriving it.
   */
  const act = React.useCallback(
    (meeting: Meeting, fn: (record: VisitRequest) => void) => {
      const record = db.visitRequests.find((v) => v.id === meeting.visitRequestId);
      if (record) fn(record);
    },
    [db.visitRequests],
  );

  return { meetings, ...buckets, act };
}
