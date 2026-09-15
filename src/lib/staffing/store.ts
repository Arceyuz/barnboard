import { create } from "zustand";
import { persist } from "zustand/middleware";
import { APPOINTMENTS, DEMO_FOCUS_DATE, WEEK_DATES } from "./seed";
import { currentWeekDates, focusDate, rfcRangeForWeek } from "./dates";
import { PRACTICE_CALENDAR_ID } from "./calendar-map";
import { nextSupport, planDay, reassignSecondary, type PlanContext } from "./scheduler";
import type {
  Appointment,
  AttendanceStatus,
  CalendarInfo,
  CalendarSource,
  DayPlan,
  PersonId,
  RosterDay,
  TaskState,
  VetId,
  ViewId,
} from "./types";

type StaffingState = {
  hydrated: boolean;
  selectedDate: string;
  view: ViewId;
  weekDates: string[];
  appointments: Appointment[];
  roster: RosterDay[];
  source: CalendarSource;
  calendarId: string;
  calendarName: string;
  calendars: CalendarInfo[];
  calendarStatus: "idle" | "loading" | "live" | "pending" | "login" | "error";
  calendarMessage: string;
  loginUrl?: string;
  skipped: number;
  plans: Record<string, DayPlan>;
  setHydrated: () => void;
  setDate: (date: string) => void;
  setView: (view: ViewId) => void;
  ctxFor: (date: string) => PlanContext;
  generate: (date?: string) => void;
  swap: (vetId: VetId, personId: PersonId | null) => void;
  approve: () => void;
  lock: () => void;
  unlock: () => void;
  setAttendance: (personId: PersonId, status: AttendanceStatus, note?: string) => void;
  setTask: (taskId: string, state: TaskState, blocker?: string) => void;
  assignSuggested: (vetId: VetId) => void;
  tagAppointment: (id: string, vetId: VetId | "unknown") => void;
  applyGoogle: (payload: {
    calendarId: string;
    calendarName: string;
    calendars: CalendarInfo[];
    appointments: Appointment[];
    roster: RosterDay[];
    skipped: number;
  }) => void;
  setCalendarUi: (patch: Partial<Pick<StaffingState, "calendarStatus" | "calendarMessage" | "loginUrl" | "calendars">>) => void;
  resetDemo: () => void;
};

function buildPlans(
  dates: string[],
  appointments: Appointment[],
  roster: RosterDay[],
  previous: Record<string, DayPlan> = {},
): Record<string, DayPlan> {
  const plans: Record<string, DayPlan> = {};
  for (const d of dates) {
    const prev = previous[d];
    const next = planDay(d, prev?.attendance ?? [], prev, {
      appointments,
      rosterIds: roster.find((r) => r.date === d)?.personIds,
    });
    if (prev?.status && prev.status !== "suggested") next.status = prev.status;
    plans[d] = next;
  }
  return plans;
}

function seedState(): Pick<
  StaffingState,
  "selectedDate" | "view" | "weekDates" | "appointments" | "roster" | "source" | "calendarId" | "calendarName" | "plans" | "skipped" | "calendarStatus" | "calendarMessage"
> {
  return {
    selectedDate: DEMO_FOCUS_DATE,
    view: "plan",
    weekDates: WEEK_DATES,
    appointments: APPOINTMENTS,
    roster: [],
    source: "demo",
    calendarId: PRACTICE_CALENDAR_ID,
    calendarName: "Demo week",
    skipped: 0,
    calendarStatus: "idle",
    calendarMessage: "",
    plans: buildPlans(WEEK_DATES, APPOINTMENTS, []),
  };
}

export const useStaffing = create<StaffingState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      calendars: [],
      loginUrl: undefined,
      ...seedState(),
      setHydrated: () => set({ hydrated: true }),
      setDate: (date) => set({ selectedDate: date }),
      setView: (view) => set({ view }),
      ctxFor: (date) => ({
        appointments: get().appointments,
        rosterIds: get().roster.find((r) => r.date === date)?.personIds,
      }),
      generate: (date) => {
        const d = date ?? get().selectedDate;
        const prev = get().plans[d];
        const next = planDay(d, prev?.attendance ?? [], undefined, get().ctxFor(d));
        next.status = "suggested";
        set({ plans: { ...get().plans, [d]: next } });
      },
      swap: (vetId, personId) => {
        const d = get().selectedDate;
        const plan = get().plans[d];
        if (!plan || plan.status === "locked") return;
        set({ plans: { ...get().plans, [d]: reassignSecondary(plan, vetId, personId) } });
      },
      approve: () => {
        const d = get().selectedDate;
        const plan = get().plans[d];
        if (!plan) return;
        set({
          view: "board",
          plans: { ...get().plans, [d]: { ...plan, status: "approved" } },
        });
      },
      lock: () => {
        const d = get().selectedDate;
        const plan = get().plans[d];
        if (!plan) return;
        set({ plans: { ...get().plans, [d]: { ...plan, status: "locked" } } });
      },
      unlock: () => {
        const d = get().selectedDate;
        const plan = get().plans[d];
        if (!plan) return;
        set({ plans: { ...get().plans, [d]: { ...plan, status: "approved" } } });
      },
      setAttendance: (personId, status, note) => {
        const d = get().selectedDate;
        const plan = get().plans[d];
        if (!plan) return;
        const attendance = plan.attendance.map((a) =>
          a.personId === personId ? { ...a, status, note } : a,
        );
        if (!attendance.some((a) => a.personId === personId)) {
          attendance.push({ personId, status, note });
        }
        let next = { ...plan, attendance };
        if (status === "no_show" || status === "call_out") {
          const rebuilt = planDay(d, attendance, { ...next, status: plan.status }, get().ctxFor(d));
          rebuilt.tasks = plan.tasks;
          rebuilt.status = plan.status;
          next = rebuilt;
        }
        set({ plans: { ...get().plans, [d]: next } });
      },
      setTask: (taskId, state, blocker) => {
        const d = get().selectedDate;
        const plan = get().plans[d];
        if (!plan) return;
        const tasks = plan.tasks.map((t) =>
          t.id === taskId ? { ...t, state, blocker: state === "blocked" ? blocker : undefined } : t,
        );
        set({ plans: { ...get().plans, [d]: { ...plan, tasks } } });
      },
      assignSuggested: (vetId) => {
        const d = get().selectedDate;
        const plan = get().plans[d];
        if (!plan) return;
        const asg = plan.assignments.find((a) => a.vetId === vetId);
        if (!asg) return;
        const exclude = [asg.primaryId, asg.secondaryId, asg.floatId].filter(Boolean) as PersonId[];
        const pick = nextSupport(plan, exclude, get().ctxFor(d).rosterIds);
        if (!pick) return;
        set({ plans: { ...get().plans, [d]: reassignSecondary(plan, vetId, pick) } });
      },
      tagAppointment: (id, vetId) => {
        const appointments = get().appointments.map((a) =>
          a.id === id ? { ...a, vetId, colorLabel: vetId === "unknown" ? "Needs review" : vetId } : a,
        );
        set({
          appointments,
          plans: buildPlans(get().weekDates, appointments, get().roster, get().plans),
        });
      },
      applyGoogle: (payload) => {
        const weekDates = currentWeekDates();
        const selected =
          weekDates.includes(focusDate()) ? focusDate() : (weekDates[0] ?? focusDate());
        set({
          source: "google",
          calendarStatus: "live",
          calendarMessage: "",
          loginUrl: undefined,
          calendarId: payload.calendarId,
          calendarName: payload.calendarName,
          calendars: payload.calendars,
          appointments: payload.appointments,
          roster: payload.roster,
          skipped: payload.skipped,
          weekDates,
          selectedDate: selected,
          view: "plan",
          plans: buildPlans(weekDates, payload.appointments, payload.roster, {}),
        });
      },
      setCalendarUi: (patch) => set(patch),
      resetDemo: () => set({ ...seedState(), calendars: get().calendars }),
    }),
    {
      name: "barnboard-v4",
      skipHydration: true,
      partialize: (s) => ({
        selectedDate: s.selectedDate,
        view: s.view,
        weekDates: s.weekDates,
        appointments: s.appointments,
        roster: s.roster,
        source: s.source,
        calendarId: s.calendarId,
        calendarName: s.calendarName,
        skipped: s.skipped,
        plans: s.plans,
      }),
    },
  ),
);

export function coverageCounts(plan: DayPlan) {
  const short = plan.assignments.filter((a) => a.vetId !== "michaela" && a.coverage !== "covered").length;
  const late = plan.attendance.filter((a) => a.status === "late").length;
  const out = plan.attendance.filter((a) => a.status === "no_show" || a.status === "call_out").length;
  const open = plan.tasks.filter((t) => t.required && t.state === "open").length;
  return { short, late, out, open };
}

export function weekRange(): { timeMin: string; timeMax: string } {
  return rfcRangeForWeek(currentWeekDates());
}
