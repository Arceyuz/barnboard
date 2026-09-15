import { create } from "zustand";
import { persist } from "zustand/middleware";
import { APPOINTMENTS, DEMO_FOCUS_DATE, DOCTORS, DUTY_TEMPLATES, STAFF, WEEK_DATES } from "./seed";
import { currentWeekDates, focusDate, rfcRangeForWeek } from "./dates";
import { PRACTICE_CALENDAR_ID } from "./calendar-map";
import {
  fillUsualDay,
  nextSupport,
  placePerson,
  planDay,
  reassignSecondary,
  type PlanContext,
} from "./scheduler";
import { makeDuties, mergeTasks } from "./duties";
import { inferKit } from "./kit";
import type {
  Appointment,
  AttendanceStatus,
  CalendarInfo,
  CalendarSource,
  DayPlan,
  DoctorTeam,
  DoctorWork,
  DutyTemplate,
  DutyWhen,
  Person,
  PersonId,
  Role,
  RosterDay,
  TaskState,
  TeamKind,
  VetId,
  ViewId,
} from "./types";

type StaffingState = {
  hydrated: boolean;
  selectedDate: string;
  view: ViewId;
  me: PersonId | null;
  weekDates: string[];
  appointments: Appointment[];
  roster: RosterDay[];
  staff: Person[];
  doctors: DoctorTeam[];
  duties: DutyTemplate[];
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
  setMe: (id: PersonId | null) => void;
  ctxFor: (date: string) => PlanContext;
  generate: (date?: string) => void;
  fillUsual: () => void;
  swap: (vetId: VetId, personId: PersonId | null) => void;
  place: (target: TeamKind, role: Role, personId: PersonId | null) => void;
  approve: () => void;
  lock: () => void;
  unlock: () => void;
  setAttendance: (personId: PersonId, status: AttendanceStatus, note?: string) => void;
  setTask: (taskId: string, state: TaskState, blocker?: string) => void;
  addTask: (ownerId: PersonId, label: string, when: DutyWhen) => void;
  addAppointment: (input: { title: string; start: string; end: string; vetId: VetId }) => void;
  updateKit: (id: string, kit: Appointment["kit"]) => void;
  setDoctorWork: (vetId: VetId, work: DoctorWork) => void;
  assignSuggested: (vetId: VetId) => void;
  tagAppointment: (id: string, vetId: VetId | "unknown") => void;
  updatePerson: (id: PersonId, patch: Partial<Person>) => void;
  addPerson: (name: string) => void;
  updateDoctor: (vetId: VetId, patch: Partial<DoctorTeam>) => void;
  addDuty: (template: DutyTemplate) => void;
  updateDuty: (id: string, patch: Partial<DutyTemplate>) => void;
  removeDuty: (id: string) => void;
  applyGoogle: (payload: {
    calendarId: string;
    calendarName: string;
    calendars: CalendarInfo[];
    appointments: Appointment[];
    roster: RosterDay[];
    skipped: number;
    doctorOff?: Array<{ date: string; vetId: VetId }>;
  }) => void;
  setCalendarUi: (
    patch: Partial<Pick<StaffingState, "calendarStatus" | "calendarMessage" | "loginUrl" | "calendars">>,
  ) => void;
  resetDemo: () => void;
};

function buildPlans(
  dates: string[],
  appointments: Appointment[],
  roster: RosterDay[],
  previous: Record<string, DayPlan> = {},
  extras: { staff?: Person[]; doctors?: DoctorTeam[]; duties?: DutyTemplate[] } = {},
): Record<string, DayPlan> {
  const plans: Record<string, DayPlan> = {};
  for (const d of dates) {
    const prev = previous[d];
    const next = planDay(d, prev?.attendance ?? [], prev, {
      appointments,
      rosterIds: roster.find((r) => r.date === d)?.personIds,
      staff: extras.staff,
      doctors: extras.doctors,
      duties: extras.duties,
      doctorWork: prev?.doctorWork,
    });
    if (prev?.status && prev.status !== "suggested") next.status = prev.status;
    plans[d] = next;
  }
  return plans;
}

function seedState(): Pick<
  StaffingState,
  | "selectedDate"
  | "view"
  | "me"
  | "weekDates"
  | "appointments"
  | "roster"
  | "staff"
  | "doctors"
  | "duties"
  | "source"
  | "calendarId"
  | "calendarName"
  | "plans"
  | "skipped"
  | "calendarStatus"
  | "calendarMessage"
> {
  const staff = STAFF.map((p) => ({ ...p }));
  const doctors = DOCTORS.map((d) => ({ ...d }));
  const duties = DUTY_TEMPLATES.map((d) => ({ ...d }));
  return {
    selectedDate: DEMO_FOCUS_DATE,
    view: "day",
    me: null,
    weekDates: WEEK_DATES,
    appointments: APPOINTMENTS,
    roster: [],
    staff,
    doctors,
    duties,
    source: "demo",
    calendarId: PRACTICE_CALENDAR_ID,
    calendarName: "Demo week",
    skipped: 0,
    calendarStatus: "idle",
    calendarMessage: "",
    plans: buildPlans(WEEK_DATES, APPOINTMENTS, [], {}, { staff, doctors, duties }),
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
      setMe: (id) => set({ me: id }),
      ctxFor: (date) => {
        const s = get();
        return {
          appointments: s.appointments,
          rosterIds: s.roster.find((r) => r.date === date)?.personIds,
          staff: s.staff,
          doctors: s.doctors,
          duties: s.duties,
          doctorWork: s.plans[date]?.doctorWork,
        };
      },
      generate: (date) => {
        const d = date ?? get().selectedDate;
        const prev = get().plans[d];
        const next = planDay(d, prev?.attendance ?? [], undefined, get().ctxFor(d));
        next.status = "suggested";
        set({ plans: { ...get().plans, [d]: next } });
      },
      fillUsual: () => {
        const s = get();
        const plans = { ...s.plans };
        for (const d of s.weekDates) {
          const prev = plans[d];
          if (prev?.status === "locked") continue;
          const ctx = s.ctxFor(d);
          const filled = fillUsualDay(d, ctx);
          const rebuilt = planDay(d, prev?.attendance ?? [], prev, ctx);
          rebuilt.assignments = filled.assignments.map((a) => ({
            ...a,
            appointmentIds:
              rebuilt.assignments.find((x) => x.vetId === a.vetId)?.appointmentIds ?? [],
          }));
          rebuilt.officeId = filled.officeId;
          rebuilt.onCallIds = filled.onCallIds;
          rebuilt.offIds = filled.offIds;
          rebuilt.tasks = mergeTasks(
            prev?.tasks,
            makeDuties(
              d,
              rebuilt.assignments,
              s.appointments.filter((a) => a.date === d),
              {
                staff: s.staff,
                doctors: s.doctors,
                duties: s.duties,
                officeId: rebuilt.officeId,
                surgery: rebuilt.doctorWork.weston === "surgery",
              },
            ),
          );
          rebuilt.status = prev?.status ?? "suggested";
          plans[d] = rebuilt;
        }
        set({ plans });
      },
      swap: (vetId, personId) => {
        const d = get().selectedDate;
        const plan = get().plans[d];
        if (!plan || plan.status === "locked") return;
        set({ plans: { ...get().plans, [d]: reassignSecondary(plan, vetId, personId, get().ctxFor(d)) } });
      },
      place: (target, role, personId) => {
        const d = get().selectedDate;
        const plan = get().plans[d];
        if (!plan || plan.status === "locked") return;
        set({ plans: { ...get().plans, [d]: placePerson(plan, target, role, personId, get().ctxFor(d)) } });
      },
      approve: () => {
        const d = get().selectedDate;
        const plan = get().plans[d];
        if (!plan) return;
        set({
          view: "day",
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
          rebuilt.tasks = mergeTasks(plan.tasks, rebuilt.tasks);
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
      addTask: (ownerId, label, when) => {
        const d = get().selectedDate;
        const plan = get().plans[d];
        if (!plan || !label.trim()) return;
        const host =
          plan.assignments.find(
            (a) => a.primaryId === ownerId || a.secondaryId === ownerId || a.floatId === ownerId,
          ) ?? plan.assignments[0];
        const task = {
          id: `${d}-custom-${Date.now()}`,
          ownerId,
          label: label.trim(),
          required: false,
          state: "open" as const,
          vetId: host?.vetId ?? ("weston" as const),
          when,
          custom: true,
        };
        set({ plans: { ...get().plans, [d]: { ...plan, tasks: [...plan.tasks, task] } } });
      },
      addAppointment: (input) => {
        const d = get().selectedDate;
        const appt: Appointment = {
          id: `custom-${Date.now()}`,
          date: d,
          start: input.start || "08:00",
          end: input.end || "09:00",
          title: input.title.trim(),
          location: "Added on board",
          vetId: input.vetId,
          service: input.vetId === "weston" ? "sports" : "field",
          colorLabel: input.vetId,
          custom: true,
          kit: inferKit(input.title.trim()),
        };
        const appointments = [...get().appointments, appt];
        set({
          appointments,
          plans: buildPlans(get().weekDates, appointments, get().roster, get().plans, {
            staff: get().staff,
            doctors: get().doctors,
            duties: get().duties,
          }),
        });
      },
      updateKit: (id, kit) => {
        const appointments = get().appointments.map((a) =>
          a.id === id ? { ...a, kit, kitCustom: true } : a,
        );
        set({ appointments });
      },
      setDoctorWork: (vetId, work) => {
        const s = get();
        const d = s.selectedDate;
        const plan = s.plans[d];
        if (!plan) return;
        const doctorWork = { ...plan.doctorWork, [vetId]: work };
        const appts = s.appointments.filter((a) => a.date === d);
        const surgery =
          doctorWork.weston === "surgery" ||
          appts.some((a) => a.vetId === "weston" && a.service === "surgery");
        const tasks = mergeTasks(
          plan.tasks,
          makeDuties(d, plan.assignments, appts, {
            staff: s.staff,
            doctors: s.doctors,
            duties: s.duties,
            officeId: plan.officeId,
            surgery,
          }),
        );
        const warnings = plan.warnings.filter((w) => w.id !== `${d}-work-${vetId}`);
        if (vetId === "weston" && work === "surgery") {
          if (!warnings.some((w) => w.id === `${d}-surgery-note`)) {
            warnings.push({
              id: `${d}-surgery-note`,
              severity: "info",
              text: "Surgery day: Alejandro stays primary. Stage the surgery pack is on his list.",
            });
          }
        }
        set({
          plans: {
            ...s.plans,
            [d]: { ...plan, doctorWork, tasks, warnings },
          },
        });
      },
      assignSuggested: (vetId) => {
        const d = get().selectedDate;
        const plan = get().plans[d];
        if (!plan) return;
        const asg = plan.assignments.find((a) => a.vetId === vetId);
        if (!asg) return;
        const exclude = [asg.primaryId, asg.secondaryId, asg.floatId].filter(Boolean) as PersonId[];
        const pick = nextSupport(plan, exclude, get().ctxFor(d));
        if (!pick) return;
        set({ plans: { ...get().plans, [d]: reassignSecondary(plan, vetId, pick, get().ctxFor(d)) } });
      },
      tagAppointment: (id, vetId) => {
        const appointments = get().appointments.map((a) =>
          a.id === id ? { ...a, vetId, colorLabel: vetId === "unknown" ? "Needs review" : vetId } : a,
        );
        set({
          appointments,
          plans: buildPlans(get().weekDates, appointments, get().roster, get().plans, {
            staff: get().staff,
            doctors: get().doctors,
            duties: get().duties,
          }),
        });
      },
      updatePerson: (id, patch) => {
        const staff = get().staff.map((p) => (p.id === id ? { ...p, ...patch, id } : p));
        set({
          staff,
          plans: buildPlans(get().weekDates, get().appointments, get().roster, get().plans, {
            staff,
            doctors: get().doctors,
            duties: get().duties,
          }),
        });
      },
      addPerson: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const id = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `tech-${Date.now()}`;
        if (get().staff.some((p) => p.id === id)) return;
        const person: Person = {
          id,
          name: trimmed,
          short: trimmed,
          kind: "support-tech",
          workdays: [],
          onCallDays: [],
          usualTeam: "float",
          usualRole: "float",
          surgery: false,
          notes: "",
        };
        const staff = [...get().staff, person];
        set({ staff });
      },
      updateDoctor: (vetId, patch) => {
        const doctors = get().doctors.map((d) => (d.vetId === vetId ? { ...d, ...patch, vetId } : d));
        set({
          doctors,
          plans: buildPlans(get().weekDates, get().appointments, get().roster, get().plans, {
            staff: get().staff,
            doctors,
            duties: get().duties,
          }),
        });
      },
      addDuty: (template) => {
        if (!template.label.trim()) return;
        const duties = [...get().duties, template];
        set({
          duties,
          plans: buildPlans(get().weekDates, get().appointments, get().roster, get().plans, {
            staff: get().staff,
            doctors: get().doctors,
            duties,
          }),
        });
      },
      updateDuty: (id, patch) => {
        const duties = get().duties.map((d) => (d.id === id ? { ...d, ...patch } : d));
        set({
          duties,
          plans: buildPlans(get().weekDates, get().appointments, get().roster, get().plans, {
            staff: get().staff,
            doctors: get().doctors,
            duties,
          }),
        });
      },
      removeDuty: (id) => {
        const duties = get().duties.filter((d) => d.id !== id);
        set({
          duties,
          plans: buildPlans(get().weekDates, get().appointments, get().roster, get().plans, {
            staff: get().staff,
            doctors: get().doctors,
            duties,
          }),
        });
      },
      applyGoogle: (payload) => {
        const weekDates = currentWeekDates();
        const selected = weekDates.includes(focusDate()) ? focusDate() : (weekDates[0] ?? focusDate());
        const previous = get().plans;
        const prior = get().appointments;
        const appointments = payload.appointments.map((a) => {
          const old =
            prior.find((p) => p.id === a.id) ??
            prior.find((p) => p.date === a.date && p.start === a.start && p.title === a.title);
          if (old?.kitCustom) return { ...a, kit: old.kit, kitCustom: true };
          return a;
        });
        const plans = buildPlans(weekDates, appointments, payload.roster, {}, {
          staff: get().staff,
          doctors: get().doctors,
          duties: get().duties,
        });
        for (const off of payload.doctorOff ?? []) {
          const plan = plans[off.date];
          if (!plan) continue;
          plan.doctorWork = { ...plan.doctorWork, [off.vetId]: "off" };
          plan.warnings = plan.warnings.filter((w) => w.id !== `${off.date}-work-${off.vetId}`);
        }
        for (const d of weekDates) {
          if (previous[d]?.status && previous[d]!.status !== "suggested" && plans[d]) {
            plans[d]!.status = previous[d]!.status;
            plans[d]!.tasks = mergeTasks(previous[d]!.tasks, plans[d]!.tasks);
            plans[d]!.attendance = previous[d]!.attendance;
          }
        }
        set({
          source: "google",
          calendarStatus: "live",
          calendarMessage: "",
          loginUrl: undefined,
          calendarId: payload.calendarId,
          calendarName: payload.calendarName,
          calendars: payload.calendars,
          appointments,
          roster: payload.roster,
          skipped: payload.skipped,
          weekDates,
          selectedDate: selected,
          view: "day",
          plans,
        });
      },
      setCalendarUi: (patch) => set(patch),
      resetDemo: () => set({ ...seedState(), calendars: get().calendars, me: get().me }),
    }),
    {
      name: "barnboard-v6",
      skipHydration: true,
      partialize: (s) => ({
        selectedDate: s.selectedDate,
        view: s.view,
        me: s.me,
        weekDates: s.weekDates,
        appointments: s.appointments,
        roster: s.roster,
        staff: s.staff,
        doctors: s.doctors,
        duties: s.duties,
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
  const short = plan.assignments.filter((a) => a.vetId !== "michaela" && a.coverage !== "covered" && (a.primaryId || a.appointmentIds.length)).length;
  const late = plan.attendance.filter((a) => a.status === "late").length;
  const out = plan.attendance.filter((a) => a.status === "no_show" || a.status === "call_out").length;
  const open = plan.tasks.filter((t) => t.required && t.state === "open").length;
  const done = plan.tasks.filter((t) => t.state === "done").length;
  const checks = plan.warnings.filter((w) => w.severity === "warn" || w.severity === "block").length;
  return { short, late, out, open, done, total: plan.tasks.length, checks };
}

export function weekRange(): { timeMin: string; timeMax: string } {
  return rfcRangeForWeek(currentWeekDates());
}

export function surgeryDates(plans: Record<string, DayPlan>, dates: string[]): string[] {
  return dates.filter((d) => plans[d]?.doctorWork.weston === "surgery" || plans[d]?.assignments.some((a) => a.vetId === "weston" && a.appointmentIds.length && plans[d]?.doctorWork.weston === "surgery"));
}
