import { useCallback, useEffect } from "react";
import { CalendarDays, ClipboardList, RefreshCw, Users } from "lucide-react";
import { redirectToLoginIfRequired } from "@/lib/app-data";
import { isFramed } from "@/lib/app-data/login";
import { useRefetchWhenConnectorReady } from "@/lib/app-data/use-connector-readiness";
import { loadPracticeCalendar } from "@/lib/staffing/calendar.functions";
import { PRACTICE_CALENDAR_ID } from "@/lib/staffing/calendar-map";
import { useStaffing, weekRange } from "@/lib/staffing/store";
import type { PersonId, ViewId } from "@/lib/staffing/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DayBoard } from "@/components/day-board";
import { WeekBoard } from "@/components/week-board";
import { TeamSetup } from "@/components/team-setup";
import { cn } from "@/lib/utils";

const VIEWS: { id: ViewId; label: string }[] = [
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
  { id: "team", label: "Team & duties" },
];

async function pullCalendar(calendarId?: string) {
  const store = useStaffing.getState();
  store.setCalendarUi({
    calendarStatus: "loading",
    calendarMessage: "Reading the Appointments calendar\u2026",
  });
  try {
    const range = weekRange();
    const result = await loadPracticeCalendar({
      data: { ...range, calendarId: calendarId ?? store.calendarId ?? PRACTICE_CALENDAR_ID },
    });
    if (result.ok) {
      store.applyGoogle(result);
      return result;
    }
    if (result.pending) {
      if (!isFramed()) {
        store.setCalendarUi({
          calendarStatus: "error",
          calendarMessage: "Showing this week\u2019s board. Tap Load my calendar to pull Appointments.",
          calendars: result.calendars ?? [],
        });
        return result;
      }
      store.setCalendarUi({
        calendarStatus: "pending",
        calendarMessage: result.errorMessage,
        calendars: result.calendars ?? [],
      });
      return result;
    }
    if (result.loginRequired) {
      redirectToLoginIfRequired({
        ok: false,
        data: null,
        loginRequired: true,
        loginUrl: result.loginUrl,
      });
      store.setCalendarUi({
        calendarStatus: "login",
        calendarMessage: result.errorMessage,
        loginUrl: result.loginUrl,
        calendars: result.calendars ?? [],
      });
      return result;
    }
    store.setCalendarUi({
      calendarStatus: "error",
      calendarMessage: result.errorMessage,
      calendars: result.calendars ?? [],
    });
    return result;
  } catch {
    store.setCalendarUi({
      calendarStatus: "error",
      calendarMessage: "Could not reach Google Calendar. This week\u2019s board is still usable.",
    });
    return undefined;
  }
}

export function Barnboard() {
  const setHydrated = useStaffing((s) => s.setHydrated);
  const hydrated = useStaffing((s) => s.hydrated);
  const view = useStaffing((s) => s.view);
  const calendarStatus = useStaffing((s) => s.calendarStatus);
  const weekKey = useStaffing((s) => s.weekDates.join(","));
  const waiting = calendarStatus === "pending";

  const refetch = useCallback(() => pullCalendar(), []);
  const waitStatus = useRefetchWhenConnectorReady(waiting, refetch);

  useEffect(() => {
    void Promise.resolve(useStaffing.persist.rehydrate()).finally(() => {
      setHydrated();
    });
  }, [setHydrated]);

  useEffect(() => {
    if (!hydrated || !weekKey) return;
    void pullCalendar();
  }, [hydrated, weekKey]);

  useEffect(() => {
    if (waitStatus === "not_embedded") {
      useStaffing.getState().setCalendarUi({
        calendarStatus: "error",
        calendarMessage: "Showing this week\u2019s board. Tap Load my calendar to pull Appointments.",
      });
    } else if (waitStatus === "timed_out") {
      useStaffing.getState().setCalendarUi({
        calendarStatus: "error",
        calendarMessage: "Calendar is still connecting. Tap Load my calendar in a moment.",
      });
    }
  }, [waitStatus]);

  return (
    <div className="min-h-dvh bg-bg text-fg pb-8">
      <header className="border-b border-border bg-bg/90 px-4 pt-6 pb-4 backdrop-blur-sm sm:px-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-9 items-center justify-center rounded-md bg-accent text-accent-fg">
              <span className="block size-4 rotate-45 border-2 border-accent-fg" />
            </span>
            <div>
              <h1 className="text-sm font-semibold tracking-[0.18em] uppercase text-fg">Barnboard</h1>
              <p className="text-xs text-muted">Coverage, surgery days, and close-out</p>
            </div>
          </div>
          <WhoAmI />
        </div>
        <div className="mx-auto mt-4 max-w-5xl">
          <CalendarBar />
        </div>
        <nav className="mx-auto mt-4 flex max-w-5xl gap-1 rounded-lg bg-surface p-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => useStaffing.getState().setView(v.id)}
              className={cn(
                "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md text-sm",
                view === v.id ? "bg-surface-2 text-fg" : "text-muted",
              )}
            >
              {v.id === "week" && <CalendarDays className="size-4" />}
              {v.id === "day" && <ClipboardList className="size-4" />}
              {v.id === "team" && <Users className="size-4" />}
              {v.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
        {view === "week" && <WeekBoard />}
        {view === "day" && <DayBoard />}
        {view === "team" && <TeamSetup />}
      </main>
    </div>
  );
}

function WhoAmI() {
  const me = useStaffing((s) => s.me);
  const staff = useStaffing((s) => s.staff);
  const boardScope = (useStaffing((s) => (s as { boardScope?: "mine" | "all" }).boardScope) ?? "mine");
  const setScope = useStaffing.getState() as { setBoardScope?: (scope: "mine" | "all") => void };
  const author = me === "alejandro";
  return (
    <div className="flex flex-col items-end gap-2">
      <label className="flex items-center gap-2 text-sm text-muted">
        I am
        <select
          className="min-h-11 min-w-40 rounded-md border border-border bg-surface px-3 text-sm text-fg"
          value={me ?? ""}
          onChange={(e) => useStaffing.getState().setMe((e.target.value || null) as PersonId | null)}
        >
          <option value="">Choose\u2026</option>
          {staff.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {me && (
        <div className="flex rounded-md border border-border bg-surface p-0.5 text-xs">
          <button
            type="button"
            className={`min-h-9 rounded-sm px-3 ${boardScope === "mine" ? "bg-surface-2 text-fg" : "text-muted"}`}
            onClick={() => setScope.setBoardScope?.("mine")}
          >
            My work
          </button>
          {author && (
            <button
              type="button"
              className={`min-h-9 rounded-sm px-3 ${boardScope === "all" ? "bg-surface-2 text-fg" : "text-muted"}`}
              onClick={() => setScope.setBoardScope?.("all")}
            >
              Everyone
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CalendarBar() {
  const source = useStaffing((s) => s.source);
  const status = useStaffing((s) => s.calendarStatus);
  const message = useStaffing((s) => s.calendarMessage);
  const name = useStaffing((s) => s.calendarName);
  const calendars = useStaffing((s) => s.calendars);
  const calendarId = useStaffing((s) => s.calendarId);
  const skipped = useStaffing((s) => s.skipped);
  const loginUrl = useStaffing((s) => s.loginUrl);
  const count = useStaffing((s) => s.appointments.length);
  const live = source === "google" && status === "live";

  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={live ? "ok" : status === "error" ? "danger" : "mute"}>
          {status === "loading" || status === "pending"
            ? "Connecting"
            : live
              ? `Live \u00b7 ${name}`
              : "This week"}
        </Badge>
        {live && (
          <span className="text-xs text-muted">
            {count} stops
            {skipped ? ` \u00b7 ${skipped} office/admin skipped` : ""}
          </span>
        )}
        {message && status !== "live" && <span className="text-xs text-muted">{message}</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          {status === "login" && loginUrl && (
            <Button size="sm" onClick={() => window.open(loginUrl, "_blank", "noopener")}>
              Continue with Grok
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void pullCalendar()}
            disabled={status === "loading" || status === "pending"}
          >
            <RefreshCw className="size-4" />
            {live ? "Refresh" : "Load my calendar"}
          </Button>
        </div>
      </div>
      {calendars.length > 1 && (
        <label className="mt-2 block text-xs text-muted">
          Calendar
          <select
            className="mt-1 min-h-11 w-full max-w-md rounded-md border border-border bg-surface-2 px-3 text-sm text-fg"
            value={calendarId}
            onChange={(e) => void pullCalendar(e.target.value)}
          >
            {calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="mt-2 text-xs text-subtle">
        Read-only. Medical notes, phones, and card numbers stay off this board.
      </p>
    </div>
  );
}
