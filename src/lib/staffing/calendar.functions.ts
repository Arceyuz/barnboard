import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  classifyCallToolError,
  ConnectorType,
  GoogleCalendarTools,
  isConnectorPending,
  isLoginRequired,
} from "@/lib/app-data";
import {
  extractCalendars,
  extractEventList,
  mapPracticeEvents,
  PRACTICE_CALENDAR_ID,
  PRACTICE_CALENDAR_NAME,
  type RawCalendarEvent,
} from "./calendar-map";
import { dayWindows } from "./dates";
import type { Appointment, CalendarInfo, RosterDay } from "./types";

export type CalendarLoadResult =
  | {
      ok: true;
      pending?: false;
      calendars: CalendarInfo[];
      calendarId: string;
      calendarName: string;
      appointments: Appointment[];
      roster: RosterDay[];
      skipped: number;
    }
  | {
      ok: false;
      pending?: boolean;
      loginRequired?: boolean;
      loginUrl?: string;
      errorKind?: string;
      errorMessage: string;
      calendars?: CalendarInfo[];
    };

function failFrom(
  listed: {
    loginUrl?: string;
    errorMessage?: string;
  } & Parameters<typeof classifyCallToolError>[0],
  calendars?: CalendarInfo[],
): CalendarLoadResult {
  const classified = classifyCallToolError(listed);
  return {
    ok: false,
    pending: isConnectorPending(listed) || undefined,
    loginRequired: isLoginRequired(listed) || undefined,
    loginUrl: listed.loginUrl,
    errorKind: classified?.kind,
    errorMessage: classified?.message ?? listed.errorMessage ?? "Could not read the calendar.",
    calendars,
  };
}

export const loadPracticeCalendar = createServerFn({ method: "POST" })
  .validator(
    z.object({
      calendarId: z.string().optional(),
      timeMin: z.string(),
      timeMax: z.string(),
    }),
  )
  .handler(async ({ data }): Promise<CalendarLoadResult> => {
    try {
      const { callTool } = await import("@/lib/app-data/client.server");
      const opts = { connectorType: ConnectorType.GoogleCalendar };

      const listed = await callTool(
        GoogleCalendarTools.listCalendars,
        { max_results: 100 },
        opts,
      );
      if (!listed.ok) return failFrom(listed);

      const calendars = extractCalendars(listed.data);
      const preferred =
        (data.calendarId && calendars.some((c) => c.id === data.calendarId)
          ? data.calendarId
          : "") ||
        calendars.find((c) => c.id === PRACTICE_CALENDAR_ID)?.id ||
        calendars.find((c) => /appointment/i.test(c.name))?.id ||
        calendars.find((c) => c.primary)?.id ||
        calendars[0]?.id;

      if (!preferred) {
        return { ok: false, errorMessage: "No calendars found on this Google account.", calendars };
      }

      const windows = dayWindows(data.timeMin, data.timeMax);
      const searches = await Promise.all(
        windows.map((window) =>
          callTool(
            GoogleCalendarTools.search,
            {
              calendar_id: preferred,
              time_min: window.timeMin,
              time_max: window.timeMax,
              max_results: 100,
            },
            opts,
          ),
        ),
      );

      const failed = searches.find((s) => !s.ok);
      if (failed) return failFrom(failed, calendars);

      const events: RawCalendarEvent[] = [];
      for (const result of searches) {
        events.push(...extractEventList(result.data));
      }

      const mapped = mapPracticeEvents(events);
      const calendarName =
        calendars.find((c) => c.id === preferred)?.name || PRACTICE_CALENDAR_NAME;

      return {
        ok: true,
        calendars,
        calendarId: preferred,
        calendarName,
        appointments: mapped.appointments,
        roster: mapped.roster,
        skipped: mapped.skipped,
      };
    } catch (error) {
      return {
        ok: false,
        errorMessage:
          error instanceof Error ? error.message : "Could not read the calendar.",
      };
    }
  });
