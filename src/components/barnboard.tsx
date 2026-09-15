import { useCallback, useEffect } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ClipboardList,
  Lock,
  MapPin,
  RefreshCw,
  Unlock,
  Users,
} from "lucide-react";
import { redirectToLoginIfRequired } from "@/lib/app-data";
import { isFramed } from "@/lib/app-data/login";
import { useRefetchWhenConnectorReady } from "@/lib/app-data/use-connector-readiness";
import { loadPracticeCalendar } from "@/lib/staffing/calendar.functions";
import { PRACTICE_CALENDAR_ID } from "@/lib/staffing/calendar-map";
import { STAFF } from "@/lib/staffing/seed";
import { apptsOn, personName, planDay, unknownOn, vetName } from "@/lib/staffing/scheduler";
import { coverageCounts, useStaffing, weekRange } from "@/lib/staffing/store";
import {
  attendanceLabel,
  coverageLabel,
  dayShort,
  dayTitle,
  serviceLabel,
} from "@/lib/staffing/format";
import type { AttendanceStatus, PersonId, ServiceKind, VetId } from "@/lib/staffing/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const VIEWS = [
  { id: "plan", label: "Plan" },
  { id: "board", label: "Day-of" },
  { id: "week", label: "Week" },
  { id: "roster", label: "Roster" },
] as const;

function dotClass(kind: ServiceKind | VetId | "unknown"): string {
  if (kind === "surgery") return "bg-dot-surgery";
  if (kind === "sports" || kind === "weston") return "bg-dot-sports";
  if (kind === "sidney" || kind === "field") return "bg-dot-sidney";
  return "bg-dot-doole";
}

async function pullCalendar(calendarId?: string) {
  const store = useStaffing.getState();
  store.setCalendarUi({
    calendarStatus: "loading",
    calendarMessage: "Reading the Appointments calendar…",
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
          calendarMessage: "Demo week is ready. Load my calendar once Google is connected.",
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
      calendarMessage: "Could not reach Google Calendar. Demo week is still usable.",
    });
    return undefined;
  }
}

export function Barnboard() {
  const setHydrated = useStaffing((s) => s.setHydrated);
  const view = useStaffing((s) => s.view);
  const selectedDate = useStaffing((s) => s.selectedDate);
  const plans = useStaffing((s) => s.plans);
  const appointments = useStaffing((s) => s.appointments);
  const roster = useStaffing((s) => s.roster);
  const calendarStatus = useStaffing((s) => s.calendarStatus);
  const waiting = calendarStatus === "pending";

  const refetch = useCallback(() => pullCalendar(), []);
  const waitStatus = useRefetchWhenConnectorReady(waiting, refetch);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve(useStaffing.persist.rehydrate()).finally(() => {
      if (!cancelled) setHydrated();
    });
    return () => {
      cancelled = true;
    };
  }, [setHydrated]);

  useEffect(() => {
    void pullCalendar();
  }, []);

  useEffect(() => {
    if (waitStatus === "not_embedded") {
      useStaffing.getState().setCalendarUi({
        calendarStatus: "error",
        calendarMessage: "Demo week is ready. Load my calendar once Google is connected.",
      });
    } else if (waitStatus === "timed_out") {
      useStaffing.getState().setCalendarUi({
        calendarStatus: "error",
        calendarMessage: "Calendar is still connecting. Tap Load my calendar in a moment.",
      });
    }
  }, [waitStatus]);

  const plan =
    plans[selectedDate] ??
    planDay(selectedDate, [], undefined, {
      appointments,
      rosterIds: roster.find((r) => r.date === selectedDate)?.personIds,
    });

  return (
    <div className="min-h-dvh bg-bg text-fg pb-24">
      <header className="border-b border-border bg-bg/90 px-4 pt-6 pb-4 backdrop-blur-sm sm:px-8">
        <p className="text-xs tracking-[0.18em] uppercase text-accent">Beta · tap a day to start</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-medium tracking-tight text-fg sm:text-4xl">
              Barnboard
            </h1>
            <p className="mt-1 text-sm text-muted">Coverage for the barn · this week</p>
          </div>
          <DateStrip />
        </div>
        <CalendarBar />
        <StatusStrip />
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
        {view === "plan" && <PlanView />}
        {view === "board" && <BoardView />}
        {view === "week" && <WeekView />}
        {view === "roster" && <RosterView />}
      </main>

      <nav className="fixed bottom-0 inset-x-0 border-t border-border bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto grid max-w-5xl grid-cols-4">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => useStaffing.getState().setView(v.id)}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 text-xs",
                view === v.id ? "text-fg" : "text-muted",
              )}
            >
              {v.id === "plan" && <ClipboardList className="size-4" />}
              {v.id === "board" && <Check className="size-4" />}
              {v.id === "week" && <CalendarDays className="size-4" />}
              {v.id === "roster" && <Users className="size-4" />}
              {v.label}
            </button>
          ))}
        </div>
      </nav>
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

  return (
    <div className="mt-4 rounded-lg border border-border bg-surface px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={source === "google" && status === "live" ? "ok" : status === "error" ? "danger" : "mute"}>
          {status === "loading" || status === "pending"
            ? "Connecting"
            : source === "google" && status === "live"
              ? `Live · ${name}`
              : "Demo week"}
        </Badge>
        {status === "live" && (
          <span className="text-xs text-muted">
            {count} stops this week
            {skipped ? ` · ${skipped} office/admin skipped` : ""}
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
            {source === "google" ? "Refresh" : "Load my calendar"}
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

function DateStrip() {
  const selectedDate = useStaffing((s) => s.selectedDate);
  const weekDates = useStaffing((s) => s.weekDates);
  return (
    <div className="flex gap-1 overflow-x-auto">
      {weekDates.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => useStaffing.getState().setDate(d)}
          className={cn(
            "min-h-11 shrink-0 rounded-md px-3 text-xs font-medium border",
            d === selectedDate
              ? "border-transparent bg-accent text-accent-fg"
              : "border-border bg-bg text-muted",
          )}
        >
          {dayShort(d)}
        </button>
      ))}
    </div>
  );
}

function StatusStrip() {
  const plan = useStaffing((s) => s.plans[s.selectedDate]);
  if (!plan) return null;
  const c = coverageCounts(plan);
  const pills = [
    { n: c.short, label: "short", tone: c.short ? "danger" : "ok" },
    { n: c.late, label: "late", tone: c.late ? "warn" : "mute" },
    { n: c.out, label: "out", tone: c.out ? "danger" : "mute" },
    { n: c.open, label: "open tasks", tone: c.open ? "warn" : "ok" },
  ] as const;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Badge tone={plan.status === "locked" ? "accent" : plan.status === "approved" ? "ok" : "mute"}>
        {plan.status === "suggested" ? "Suggested" : plan.status === "approved" ? "Approved" : "Locked"}
      </Badge>
      {pills.map((p) => (
        <Badge key={p.label} tone={p.tone}>
          {p.n} {p.label}
        </Badge>
      ))}
    </div>
  );
}

function PlanView() {
  const plan = useStaffing((s) => s.plans[s.selectedDate]);
  const appointments = useStaffing((s) => s.appointments);
  if (!plan) return null;
  const locked = plan.status === "locked";
  const blocks = plan.warnings.filter((w) => w.severity === "block");
  const unknown = unknownOn(plan.date, appointments);
  const teams = plan.assignments.filter((a) => a.vetId !== "michaela");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-fg">{dayTitle(plan.date)}</h2>
          <p className="text-sm text-muted">
            Weston always gets Alejandro plus one support. Sidney gets one tech. Doole follows.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => useStaffing.getState().generate()} disabled={locked}>
            <RefreshCw className="size-4" />
            Recalculate
          </Button>
          {plan.status === "suggested" && (
            <Button size="sm" onClick={() => useStaffing.getState().approve()}>
              Approve plan
            </Button>
          )}
          {plan.status === "approved" && (
            <Button size="sm" onClick={() => useStaffing.getState().lock()}>
              <Lock className="size-4" />
              Lock
            </Button>
          )}
          {plan.status === "locked" && (
            <Button variant="secondary" size="sm" onClick={() => useStaffing.getState().unlock()}>
              <Unlock className="size-4" />
              Unlock
            </Button>
          )}
        </div>
      </div>

      {blocks.length > 0 && (
        <div className="rounded-xl border border-danger/40 bg-surface p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-danger">
            <AlertTriangle className="size-4" />
            Coverage problems
          </p>
          <ul className="mt-2 space-y-1 text-sm text-fg">
            {blocks.map((w) => (
              <li key={w.id}>{w.text}</li>
            ))}
          </ul>
        </div>
      )}

      {teams.length === 0 && unknown.length === 0 && (
        <p className="rounded-xl border border-border bg-surface p-5 text-sm text-muted">
          No doctor appointments mapped for this day. Office notes and teching lists are hidden on purpose.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {teams.map((asg) => (
          <TeamCard key={asg.vetId} vetId={asg.vetId} />
        ))}
      </div>

      {unknown.length > 0 && (
        <section className="rounded-xl border border-warn/40 bg-surface p-4">
          <h3 className="font-display text-lg text-fg">Needs a doctor tag</h3>
          <p className="mb-3 text-xs text-muted">
            Google did not send event color, so these were not auto-assigned. Tag them and the plan rebuilds.
          </p>
          <ul className="space-y-2">
            {unknown.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 rounded-md bg-surface-2 px-3 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-fg">
                    {a.start}–{a.end} · {a.title}
                  </p>
                  <p className="truncate text-xs text-muted">{a.location}</p>
                </div>
                <select
                  className="min-h-11 rounded-md border border-border bg-bg px-3 text-sm text-fg"
                  defaultValue=""
                  onChange={(e) => {
                    const v = e.target.value as VetId;
                    if (v) useStaffing.getState().tagAppointment(a.id, v);
                  }}
                >
                  <option value="">Assign doctor</option>
                  <option value="weston">Dr. Davis</option>
                  <option value="sidney">Dr. Sidney</option>
                  <option value="michaela">Dr. Doole</option>
                </select>
              </li>
            ))}
          </ul>
        </section>
      )}

      {plan.warnings.filter((w) => w.severity !== "block" && w.severity !== "warn").length > 0 && (
        <ul className="space-y-2 text-sm text-muted">
          {plan.warnings
            .filter((w) => w.severity === "info")
            .map((w) => (
              <li key={w.id} className="rounded-lg bg-surface px-3 py-2">
                {w.text}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function TeamCard({ vetId }: { vetId: VetId }) {
  const plan = useStaffing((s) => s.plans[s.selectedDate]);
  const appointments = useStaffing((s) => s.appointments);
  if (!plan) return null;
  const asg = plan.assignments.find((a) => a.vetId === vetId);
  if (!asg) return null;
  const appts = asg.appointmentIds
    .map((id) => appointments.find((a) => a.id === id))
    .filter(Boolean);
  const locked = plan.status === "locked";
  const support = STAFF.filter((p) => p.kind === "support-tech");
  const doole = plan.assignments.find((a) => a.vetId === "michaela");
  const showDoole = vetId === "sidney" && doole && doole.appointmentIds.length > 0;

  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-panel)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">{vetName(vetId)}</p>
          <h3 className="font-display text-xl text-fg">
            {vetId === "weston" ? "Two-tech team" : "One-tech team"}
          </h3>
        </div>
        <Badge tone={asg.coverage === "covered" ? "ok" : "danger"}>{coverageLabel(asg.coverage)}</Badge>
      </div>

      <div className="mt-4 space-y-2">
        {appts.map((a) =>
          a ? (
            <div key={a.id} className="flex gap-3 rounded-md bg-surface-2 px-3 py-2">
              <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", dotClass(a.service))} />
              <div className="min-w-0">
                <p className="text-sm text-fg">
                  {a.start}–{a.end} · {serviceLabel(a.service)}
                </p>
                <p className="truncate text-xs text-muted">
                  {a.title} · <MapPin className="inline size-3" /> {a.location}
                </p>
              </div>
            </div>
          ) : null,
        )}
        {showDoole && (
          <p className="text-xs text-muted">Dr. Doole is riding along. No extra tech.</p>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted">{vetId === "weston" ? "Primary" : "Tech"}</dt>
          <dd className="text-fg">{personName(asg.primaryId)}</dd>
        </div>
        {vetId === "weston" && (
          <div>
            <dt className="text-xs text-muted">Secondary</dt>
            <dd className="text-fg">{personName(asg.secondaryId)}</dd>
          </div>
        )}
        {asg.floatId && (
          <div>
            <dt className="text-xs text-muted">Float</dt>
            <dd className="text-fg">{personName(asg.floatId)}</dd>
          </div>
        )}
      </dl>

      {!locked && (
        <label className="mt-4 block text-xs text-muted">
          {vetId === "weston" ? "Swap secondary" : "Assign tech"}
          <select
            className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-fg"
            value={vetId === "weston" ? (asg.secondaryId ?? "") : (asg.primaryId ?? "")}
            onChange={(e) =>
              useStaffing.getState().swap(vetId, (e.target.value || null) as PersonId | null)
            }
          >
            <option value="">Unassigned</option>
            {support.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </section>
  );
}

function BoardView() {
  const plan = useStaffing((s) => s.plans[s.selectedDate]);
  if (!plan) return null;
  if (plan.status === "suggested") {
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-2xl">Approve first</h2>
        <p className="mt-2 max-w-md text-sm text-muted">
          The day-of board stays quiet until you accept the plan. That keeps an unreviewed roster
          from going out to the team.
        </p>
        <Button className="mt-4" onClick={() => useStaffing.getState().approve()}>
          Approve {dayTitle(plan.date)}
        </Button>
      </div>
    );
  }

  const assignedIds = new Set(
    plan.assignments.flatMap((a) => [a.primaryId, a.secondaryId, a.floatId]).filter(Boolean),
  );
  const rows = plan.attendance.filter((a) => assignedIds.has(a.personId) || a.status !== "expected");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl text-fg">Day-of board</h2>
        <p className="text-sm text-muted">
          Late, no-show, and call-out never silently delete coverage. They turn the row red and
          rebuild the rest of the day.
        </p>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <AttendanceRow key={row.personId} personId={row.personId} />
        ))}
      </div>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h3 className="font-display text-lg">End-of-day work</h3>
        <p className="mb-3 text-xs text-muted">Required items stay open until done, handed off, or blocked.</p>
        <ul className="space-y-2">
          {plan.tasks.map((t) => (
            <li
              key={t.id}
              className="flex flex-col gap-2 rounded-md bg-surface-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm text-fg">{t.label}</p>
                <p className="text-xs text-muted">
                  {personName(t.ownerId)} · {vetName(t.vetId)}
                  {t.required ? " · required" : ""}
                  {t.blocker ? ` · blocked: ${t.blocker}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant={t.state === "done" ? "primary" : "secondary"}
                  onClick={() =>
                    useStaffing.getState().setTask(t.id, t.state === "done" ? "open" : "done")
                  }
                >
                  {t.state === "done" ? "Done" : "Mark done"}
                </Button>
                <Button
                  size="sm"
                  variant={t.state === "blocked" ? "danger" : "ghost"}
                  onClick={() =>
                    useStaffing
                      .getState()
                      .setTask(
                        t.id,
                        t.state === "blocked" ? "open" : "blocked",
                        "Could not finish today",
                      )
                  }
                >
                  {t.state === "blocked" ? "Blocked" : "Block"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function AttendanceRow({ personId }: { personId: PersonId }) {
  const plan = useStaffing((s) => s.plans[s.selectedDate]);
  if (!plan) return null;
  const row = plan.attendance.find((a) => a.personId === personId);
  if (!row) return null;
  const roles = plan.assignments.flatMap((a) => {
    const bits: string[] = [];
    if (a.primaryId === personId) bits.push(`${vetName(a.vetId)} ${a.vetId === "weston" ? "primary" : "tech"}`);
    if (a.secondaryId === personId) bits.push(`${vetName(a.vetId)} secondary`);
    if (a.floatId === personId) bits.push("Float");
    return bits;
  });
  const hot = row.status === "late" || row.status === "no_show" || row.status === "call_out";
  const actions: AttendanceStatus[] = ["expected", "on_site", "late", "no_show", "call_out", "left_early"];

  return (
    <article className={cn("rounded-xl border bg-surface p-4", hot ? "border-danger/50" : "border-border")}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-medium text-fg">{personName(personId)}</p>
          <p className="text-xs text-muted">{roles.join(" · ") || "On the roster"}</p>
        </div>
        <label className="text-xs text-muted">
          Status
          <select
            className="mt-1 min-h-11 min-w-40 rounded-md border border-border bg-surface-2 px-3 text-sm text-fg"
            value={row.status === "done" ? "expected" : row.status}
            onChange={(e) =>
              useStaffing.getState().setAttendance(personId, e.target.value as AttendanceStatus)
            }
          >
            {actions.map((st) => (
              <option key={st} value={st}>
                {attendanceLabel(st)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {(row.status === "no_show" || row.status === "call_out") && (
        <p className="mt-3 text-xs text-warn">
          Coverage rebuilt without {personName(personId)}. Open Plan to see who is now short.
        </p>
      )}
    </article>
  );
}

function WeekView() {
  const plans = useStaffing((s) => s.plans);
  const weekDates = useStaffing((s) => s.weekDates);
  const appointments = useStaffing((s) => s.appointments);
  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl">Week</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {weekDates.map((d) => {
          const plan = plans[d];
          if (!plan) return null;
          const c = coverageCounts(plan);
          const n = apptsOn(d, appointments).length;
          return (
            <button
              key={d}
              type="button"
              onClick={() => {
                useStaffing.getState().setDate(d);
                useStaffing.getState().setView("plan");
              }}
              className="rounded-xl border border-border bg-surface p-4 text-left"
            >
              <p className="text-xs uppercase tracking-wider text-muted">{dayTitle(d)}</p>
              <div className="mt-2 space-y-1 text-sm">
                {plan.assignments
                  .filter((a) => a.vetId !== "michaela")
                  .map((a) => (
                    <p key={a.vetId} className="text-fg">
                      {vetName(a.vetId)} · {personName(a.primaryId)}
                      {a.secondaryId ? ` + ${personName(a.secondaryId)}` : ""}
                    </p>
                  ))}
                {n === 0 && <p className="text-muted">No mapped doctor stops</p>}
              </div>
              <div className="mt-3 flex gap-2">
                <Badge tone={c.short ? "danger" : "ok"}>{c.short ? `${c.short} short` : "Covered"}</Badge>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RosterView() {
  const roster = useStaffing((s) => s.roster);
  const selectedDate = useStaffing((s) => s.selectedDate);
  const todayRoster = roster.find((r) => r.date === selectedDate);
  const working = STAFF.map((p) => ({
    ...p,
    days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].filter((_, i) => p.workdays.includes(i)),
  }));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">Roster and rules</h2>
          <p className="text-sm text-muted">
            When the calendar has a “teching” note, that day’s lineup overrides the usual workdays.
          </p>
        </div>
        <Button variant="secondary" onClick={() => useStaffing.getState().resetDemo()}>
          Use demo week
        </Button>
      </div>
      {todayRoster && (
        <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-fg">
          Calendar lineup for {dayTitle(selectedDate)}:{" "}
          {todayRoster.personIds.map((id) => personName(id)).join(", ")}
        </p>
      )}
      <div className="grid gap-3">
        {working.map((p) => (
          <article key={p.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-display text-xl">{p.name}</h3>
              <span className="text-xs uppercase tracking-wider text-muted">
                {p.kind === "primary-tech" ? "Primary tech" : p.kind === "office" ? "Office" : "Support"}
              </span>
            </div>
            <p className="mt-1 text-sm text-fg">{p.notes}</p>
            <p className="mt-2 text-xs text-muted">{p.days.join(" · ")}</p>
          </article>
        ))}
      </div>
      <section className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
        <h3 className="font-display text-lg text-fg">Hard rules</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Dr. Davis always has Alejandro plus Kaycee, Alice, or Becca.</li>
          <li>Dr. Sidney has one tech. Becca is preferred when she is free.</li>
          <li>Dr. Doole follows. She does not create a second team.</li>
          <li>Kate is office only.</li>
          <li>The medical calendar is not overwritten. Notes stay off this screen.</li>
        </ul>
      </section>
    </div>
  );
}
