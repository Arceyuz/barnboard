import { APPOINTMENTS, STAFF, TASK_TEMPLATES, VETS } from "./seed";
import type {
  Appointment,
  Assignment,
  Attendance,
  DayPlan,
  Person,
  PersonId,
  Task,
  VetId,
  Warning,
} from "./types";

const SUPPORT_ORDER: PersonId[] = ["kaycee", "alice", "becca"];
const DROPPED: Array<"no_show" | "call_out" | "left_early"> = [
  "no_show",
  "call_out",
  "left_early",
];

function weekday(date: string): number {
  return new Date(`${date}T12:00:00`).getDay();
}

export function apptsOn(date: string, all: Appointment[] = APPOINTMENTS): Appointment[] {
  return all.filter((a) => a.date === date && a.vetId !== "unknown");
}

export function unknownOn(date: string, all: Appointment[] = APPOINTMENTS): Appointment[] {
  return all.filter((a) => a.date === date && a.vetId === "unknown");
}

export function availableStaff(
  date: string,
  attendance: Attendance[] = [],
  rosterIds?: PersonId[],
): Person[] {
  const dow = weekday(date);
  const dropped = new Set(
    attendance
      .filter((a) => DROPPED.includes(a.status as (typeof DROPPED)[number]))
      .map((a) => a.personId),
  );
  if (rosterIds && rosterIds.length) {
    return STAFF.filter((p) => rosterIds.includes(p.id) && !dropped.has(p.id));
  }
  return STAFF.filter((p) => p.workdays.includes(dow) && !dropped.has(p.id));
}

function firstFree(ids: PersonId[], taken: Set<PersonId>, available: Set<PersonId>): PersonId | null {
  return ids.find((id) => available.has(id) && !taken.has(id)) ?? null;
}

function timesOverlap(a: Appointment[], b: Appointment[]): boolean {
  for (const x of a) {
    for (const y of b) {
      if (x.start < y.end && y.start < x.end) return true;
    }
  }
  return false;
}

function coverageOf(
  primary: PersonId | null,
  secondary: PersonId | null,
  requiredTwo: boolean,
): Assignment["coverage"] {
  if (requiredTwo) {
    if (primary && secondary) return "covered";
    if (primary || secondary) return "short";
    return "none";
  }
  if (primary) return "covered";
  return "none";
}

function makeTasks(date: string, assignments: Assignment[], appts: Appointment[]): Task[] {
  const tasks: Task[] = [];
  for (const asg of assignments) {
    if (asg.vetId === "michaela") continue;
    const owner = asg.secondaryId ?? asg.primaryId;
    if (!owner) continue;
    const hasSurgery = asg.appointmentIds.some(
      (id) => appts.find((a) => a.id === id)?.service === "surgery",
    );
    for (const t of TASK_TEMPLATES) {
      if (t.surgeryOnly && !hasSurgery) continue;
      tasks.push({
        id: `${date}-${asg.vetId}-${t.label}`,
        ownerId: owner,
        label: t.label,
        required: t.required,
        state: "open",
        vetId: asg.vetId,
      });
    }
  }
  return tasks;
}

export type PlanContext = {
  appointments?: Appointment[];
  rosterIds?: PersonId[];
};

export function planDay(
  date: string,
  attendance: Attendance[] = [],
  previous?: DayPlan,
  ctx: PlanContext = {},
): DayPlan {
  const appts = apptsOn(date, ctx.appointments ?? APPOINTMENTS);
  const people = availableStaff(date, attendance, ctx.rosterIds);
  const clinical = people.filter((p) => p.kind !== "office");
  const available = new Set(clinical.map((p) => p.id));
  const taken = new Set<PersonId>();
  const warnings: Warning[] = [];
  const assignments: Assignment[] = [];

  const byVet = (id: VetId) => appts.filter((a) => a.vetId === id);
  const weston = byVet("weston");
  const sidney = byVet("sidney");
  const doole = byVet("michaela");
  const unknown = unknownOn(date, ctx.appointments ?? APPOINTMENTS);

  if (weston.length) {
    const alejandroHere = available.has("alejandro");
    if (alejandroHere) taken.add("alejandro");
    else {
      warnings.push({
        id: `${date}-weston-primary`,
        severity: "block",
        text: "Weston requires Alejandro as primary. Alejandro is not available today.",
      });
    }
    const secondary = firstFree(SUPPORT_ORDER, taken, available);
    if (secondary) taken.add(secondary);
    else {
      warnings.push({
        id: `${date}-weston-second`,
        severity: "block",
        text: "Weston needs a second tech (Kaycee, Alice, or Becca). None are free.",
      });
    }
    const hasSurgery = weston.some((a) => a.service === "surgery");
    assignments.push({
      vetId: "weston",
      primaryId: alejandroHere ? "alejandro" : null,
      secondaryId: secondary,
      floatId: null,
      appointmentIds: weston.map((a) => a.id),
      coverage: coverageOf(alejandroHere ? "alejandro" : null, secondary, true),
    });
    if (hasSurgery && alejandroHere) {
      warnings.push({
        id: `${date}-surgery-note`,
        severity: "info",
        text: "Surgery on the book: Alejandro stays primary. Do not pull him onto another doctor.",
      });
    }
  }

  if (sidney.length) {
    const prefer =
      available.has("becca") && !taken.has("becca")
        ? (["becca", ...SUPPORT_ORDER] as PersonId[])
        : SUPPORT_ORDER;
    const tech = firstFree(prefer, taken, available);
    if (tech) taken.add(tech);
    else {
      const overlap = weston.length && timesOverlap(weston, sidney);
      warnings.push({
        id: `${date}-sidney-short`,
        severity: "block",
        text: overlap
          ? "Sidney is under-covered. Weston already has the only free support tech for the overlapping window. Do not put one person on both doctors."
          : "Sidney needs one tech. No support tech is free.",
      });
    }
    assignments.push({
      vetId: "sidney",
      primaryId: tech,
      secondaryId: null,
      floatId: null,
      appointmentIds: sidney.map((a) => a.id),
      coverage: coverageOf(tech, null, false),
    });
    if (doole.length) {
      warnings.push({
        id: `${date}-doole-follows`,
        severity: "info",
        text: "Dr. Doole is with Sidney. She does not get a separate tech line.",
      });
    }
  } else if (doole.length && weston.length) {
    warnings.push({
      id: `${date}-doole-weston`,
      severity: "info",
      text: "Dr. Doole is following Weston. No extra tech assigned.",
    });
  }

  if (doole.length) {
    assignments.push({
      vetId: "michaela",
      primaryId: null,
      secondaryId: null,
      floatId: null,
      appointmentIds: doole.map((a) => a.id),
      coverage: "covered",
    });
  }

  const leftover = clinical.filter((p) => !taken.has(p.id)).map((p) => p.id);
  if (leftover.length) {
    const host =
      assignments.find((a) => a.vetId === "weston") ??
      assignments.find((a) => a.vetId === "sidney");
    if (host && !host.floatId) host.floatId = leftover[0];
    if (leftover.length > 1) {
      warnings.push({
        id: `${date}-extra-float`,
        severity: "info",
        text: `${leftover
          .slice(1)
          .map((id) => STAFF.find((s) => s.id === id)?.name)
          .join(", ")} can take operational work or a second float.`,
      });
    }
  }

  const kate = people.find((p) => p.id === "kate");
  if (kate) {
    warnings.push({
      id: `${date}-kate-office`,
      severity: "info",
      text: "Kate is in the office. She is not counted as clinical coverage.",
    });
  }

  for (const u of unknown) {
    warnings.push({
      id: `${date}-unknown-${u.id}`,
      severity: "warn",
      text: `Needs a doctor tag: “${u.title}” at ${u.start}. Color was not in the feed, so it was not assigned automatically.`,
    });
  }

  const existingTasks = previous?.date === date ? previous.tasks : [];
  const tasks = existingTasks.length ? existingTasks : makeTasks(date, assignments, appts);

  const att: Attendance[] =
    attendance.length > 0
      ? attendance
      : clinical.map((p) => ({ personId: p.id, status: "expected" as const }));

  return {
    date,
    status: previous?.status ?? "suggested",
    assignments,
    warnings,
    attendance: att,
    tasks,
  };
}

export function personName(id: PersonId | null): string {
  if (!id) return "Unassigned";
  return STAFF.find((s) => s.id === id)?.name ?? id;
}

export function vetName(id: VetId): string {
  return VETS[id].label;
}

export function reassignSecondary(plan: DayPlan, vetId: VetId, personId: PersonId | null): DayPlan {
  const assignments = plan.assignments.map((a) => {
    if (a.vetId !== vetId) return a;
    if (vetId === "weston") {
      const coverage = coverageOf(a.primaryId, personId, true);
      return { ...a, secondaryId: personId, coverage };
    }
    const coverage = coverageOf(personId, null, false);
    return { ...a, primaryId: personId, coverage };
  });
  const warnings = plan.warnings.filter((w) => !w.id.includes("swap"));
  const weston = assignments.find((a) => a.vetId === "weston");
  const sidney = assignments.find((a) => a.vetId === "sidney");
  if (weston?.primaryId && weston.secondaryId && weston.primaryId === weston.secondaryId) {
    warnings.push({
      id: `${plan.date}-swap-dup`,
      severity: "block",
      text: "The same person cannot be primary and secondary on Weston.",
    });
  }
  if (
    weston &&
    sidney &&
    sidney.primaryId &&
    (sidney.primaryId === weston.primaryId || sidney.primaryId === weston.secondaryId)
  ) {
    warnings.push({
      id: `${plan.date}-swap-double`,
      severity: "block",
      text: `${personName(sidney.primaryId)} is on two doctors. One person cannot cover overlapping teams.`,
    });
  }
  if (weston && !weston.secondaryId) {
    warnings.push({
      id: `${plan.date}-weston-second`,
      severity: "block",
      text: "Weston needs a second tech (Kaycee, Alice, or Becca).",
    });
  }
  if (sidney && !sidney.primaryId) {
    warnings.push({
      id: `${plan.date}-sidney-short`,
      severity: "block",
      text: "Sidney is under-covered.",
    });
  }
  return { ...plan, assignments, warnings };
}

export function nextSupport(plan: DayPlan, exclude: PersonId[], rosterIds?: PersonId[]): PersonId | null {
  const available = availableStaff(plan.date, plan.attendance, rosterIds)
    .filter((p) => p.kind === "support-tech")
    .map((p) => p.id)
    .filter((id) => !exclude.includes(id));
  return available[0] ?? null;
}
