import { DOCTORS, DUTY_TEMPLATES, STAFF } from "./seed.ts";
import { makeDuties, mergeTasks } from "./duties.ts";
import type {
  Appointment,
  Assignment,
  Attendance,
  DayPlan,
  DoctorTeam,
  DoctorWork,
  DutyTemplate,
  Person,
  PersonId,
  Role,
  Task,
  TeamKind,
  VetId,
  Warning,
} from "./types";

const SUPPORT_ORDER: PersonId[] = ["kaycee", "alice", "becca"];
const DROPPED: Array<"no_show" | "call_out" | "left_early"> = [
  "no_show",
  "call_out",
  "left_early",
];
const VET_IDS: VetId[] = ["weston", "sidney", "michaela"];

export function weekday(date: string): number {
  return new Date(`${date}T12:00:00`).getDay();
}

export function apptsOn(date: string, all: Appointment[]): Appointment[] {
  return all.filter((a) => a.date === date && a.vetId !== "unknown");
}

export function unknownOn(date: string, all: Appointment[]): Appointment[] {
  return all.filter((a) => a.date === date && a.vetId === "unknown");
}

export type PlanContext = {
  appointments?: Appointment[];
  rosterIds?: PersonId[];
  staff?: Person[];
  doctors?: DoctorTeam[];
  duties?: DutyTemplate[];
  doctorWork?: Partial<Record<VetId, DoctorWork>>;
  officeId?: PersonId | null;
  onCallIds?: PersonId[];
};

function staffOf(ctx: PlanContext): Person[] {
  return ctx.staff ?? STAFF;
}

function doctorsOf(ctx: PlanContext): DoctorTeam[] {
  return ctx.doctors ?? DOCTORS;
}

function needsTwo(vetId: VetId, doctors: DoctorTeam[]): boolean {
  return doctors.find((d) => d.vetId === vetId)?.needsTwo ?? vetId === "weston";
}

export function availableStaff(
  date: string,
  attendance: Attendance[] = [],
  ctx: PlanContext = {},
): Person[] {
  const people = staffOf(ctx);
  const dow = weekday(date);
  const dropped = new Set(
    attendance
      .filter((a) => DROPPED.includes(a.status as (typeof DROPPED)[number]))
      .map((a) => a.personId),
  );
  if (ctx.rosterIds && ctx.rosterIds.length) {
    return people.filter((p) => ctx.rosterIds!.includes(p.id) && !dropped.has(p.id));
  }
  return people.filter((p) => {
    if (dropped.has(p.id)) return false;
    if (p.onCallDays.includes(dow) && !p.workdays.includes(dow)) return false;
    return p.workdays.includes(dow);
  });
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

function inferDoctorWork(
  vetId: VetId,
  appts: Appointment[],
  explicit?: DoctorWork,
): DoctorWork {
  if (explicit && explicit !== "not_set") return explicit;
  const mine = appts.filter((a) => a.vetId === vetId);
  if (!mine.length) return explicit && explicit !== "not_set" ? explicit : "off";
  if (mine.some((a) => a.service === "surgery")) return "surgery";
  if (vetId === "weston") return "sports";
  return "working";
}

export function doctorWorkLabel(work: DoctorWork): string {
  if (work === "surgery") return "Surgery";
  if (work === "sports") return "Sports medicine";
  if (work === "working") return "Working";
  if (work === "off") return "Off";
  return "not set";
}

export function emptyDoctorWork(): Record<VetId, DoctorWork> {
  return { weston: "not_set", sidney: "not_set", michaela: "not_set" };
}

function leftoverPeople(
  clinical: Person[],
  taken: Set<PersonId>,
): PersonId[] {
  return clinical.filter((p) => !taken.has(p.id)).map((p) => p.id);
}

export function fillUsualDay(date: string, ctx: PlanContext = {}): {
  assignments: Assignment[];
  officeId: PersonId | null;
  onCallIds: PersonId[];
  offIds: PersonId[];
} {
  const people = staffOf(ctx);
  const doctors = doctorsOf(ctx);
  const dow = weekday(date);
  const assignments: Assignment[] = VET_IDS.map((vetId) => ({
    vetId,
    primaryId: null,
    secondaryId: null,
    floatId: null,
    appointmentIds: [],
    coverage: needsTwo(vetId, doctors) ? "none" : "none",
  }));
  let officeId: PersonId | null = null;
  const onCallIds: PersonId[] = [];
  const offIds: PersonId[] = [];

  const slot = (vetId: VetId) => assignments.find((a) => a.vetId === vetId)!;

  for (const person of people) {
    const onCall = person.onCallDays.includes(dow);
    const works = person.workdays.includes(dow);
    if (onCall && !works) {
      onCallIds.push(person.id);
      continue;
    }
    if (!works) {
      offIds.push(person.id);
      continue;
    }
    if (person.usualTeam === "office" || person.kind === "office") {
      officeId = officeId ?? person.id;
      continue;
    }
    if (person.usualTeam === "oncall") {
      onCallIds.push(person.id);
      continue;
    }
    if (person.usualTeam === "float") {
      const host = assignments.find((a) => a.vetId === "weston") ?? assignments[0];
      if (host && !host.floatId) host.floatId = person.id;
      continue;
    }
    const asg = slot(person.usualTeam);
    if (person.usualRole === "secondary" && !asg.secondaryId) asg.secondaryId = person.id;
    else if (!asg.primaryId) asg.primaryId = person.id;
    else if (needsTwo(asg.vetId, doctors) && !asg.secondaryId) asg.secondaryId = person.id;
    else if (!asg.floatId) asg.floatId = person.id;
  }

  for (const asg of assignments) {
    asg.coverage = coverageOf(asg.primaryId, asg.secondaryId, needsTwo(asg.vetId, doctors));
    if (asg.vetId === "michaela" && !asg.primaryId && !asg.secondaryId) asg.coverage = "covered";
  }

  return { assignments, officeId, onCallIds, offIds };
}

export function planDay(
  date: string,
  attendance: Attendance[] = [],
  previous?: DayPlan,
  ctx: PlanContext = {},
): DayPlan {
  const people = staffOf(ctx);
  const doctors = doctorsOf(ctx);
  const duties = ctx.duties ?? DUTY_TEMPLATES;
  const allAppts = ctx.appointments ?? [];
  const appts = apptsOn(date, allAppts);
  const unknown = unknownOn(date, allAppts);
  const availablePeople = availableStaff(date, attendance, ctx);
  const clinical = availablePeople.filter((p) => p.kind !== "office");
  const available = new Set(clinical.map((p) => p.id));
  const taken = new Set<PersonId>();
  const warnings: Warning[] = [];
  const assignments: Assignment[] = [];

  const byVet = (id: VetId) => appts.filter((a) => a.vetId === id);
  const weston = byVet("weston");
  const sidney = byVet("sidney");
  const doole = byVet("michaela");
  const hasAppts = weston.length + sidney.length + doole.length > 0;

  const doctorWork: Record<VetId, DoctorWork> = {
    weston: inferDoctorWork("weston", appts, ctx.doctorWork?.weston ?? previous?.doctorWork.weston),
    sidney: inferDoctorWork("sidney", appts, ctx.doctorWork?.sidney ?? previous?.doctorWork.sidney),
    michaela: inferDoctorWork("michaela", appts, ctx.doctorWork?.michaela ?? previous?.doctorWork.michaela),
  };

  if (hasAppts) {
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
      const reserved = new Set<PersonId>();
      if (sidney.length) {
        const usualSidney = staffOf(ctx).find(
          (p) => p.usualTeam === "sidney" && p.usualRole === "primary",
        );
        if (usualSidney && available.has(usualSidney.id)) reserved.add(usualSidney.id);
      }
      const secondary = firstFree(
        SUPPORT_ORDER.filter((id) => !reserved.has(id)),
        taken,
        available,
      );
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
        coverage: coverageOf(alejandroHere ? "alejandro" : null, secondary, needsTwo("weston", doctors)),
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
        coverage: coverageOf(tech, null, needsTwo("sidney", doctors)),
      });
      if (doole.length) {
        warnings.push({
          id: `${date}-doole-follows`,
          severity: "info",
          text: "Dr. Dooley is with Sidney. She does not get a separate tech line.",
        });
      }
    } else if (doole.length && weston.length) {
      warnings.push({
        id: `${date}-doole-weston`,
        severity: "info",
        text: "Dr. Dooley is following Weston. No extra tech assigned.",
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
  } else {
    const usual = fillUsualDay(date, ctx);
    for (const asg of usual.assignments) {
      const work = doctorWork[asg.vetId];
      if (work === "off") {
        assignments.push({
          ...asg,
          primaryId: null,
          secondaryId: null,
          floatId: null,
          coverage: "covered",
        });
        continue;
      }
      assignments.push({
        ...asg,
        coverage:
          asg.vetId === "michaela"
            ? "covered"
            : coverageOf(asg.primaryId, asg.secondaryId, needsTwo(asg.vetId, doctors)),
      });
      if (asg.primaryId) taken.add(asg.primaryId);
      if (asg.secondaryId) taken.add(asg.secondaryId);
      if (asg.floatId) taken.add(asg.floatId);
    }
  }

  for (const vetId of VET_IDS) {
    if (!assignments.some((a) => a.vetId === vetId)) {
      assignments.push({
        vetId,
        primaryId: null,
        secondaryId: null,
        floatId: null,
        appointmentIds: byVet(vetId).map((a) => a.id),
        coverage: vetId === "michaela" ? "covered" : "none",
      });
    }
  }

  const leftover = leftoverPeople(clinical, taken);
  if (leftover.length) {
    const host =
      assignments.find((a) => a.vetId === "weston" && (a.primaryId || a.appointmentIds.length)) ??
      assignments.find((a) => a.vetId === "sidney" && (a.primaryId || a.appointmentIds.length));
    if (host && !host.floatId) {
      host.floatId = leftover[0];
      taken.add(leftover[0]);
    }
    if (leftover.length > 1) {
      warnings.push({
        id: `${date}-extra-float`,
        severity: "info",
        text: `${leftover
          .slice(host && leftover[0] === host.floatId ? 1 : 0)
          .map((id) => people.find((s) => s.id === id)?.name)
          .filter(Boolean)
          .join(", ")} can take operational work or a second float.`,
      });
    }
  }

  const dow = weekday(date);
  const used = new Set(
    assignments.flatMap((a) => [a.primaryId, a.secondaryId, a.floatId]).filter(Boolean) as PersonId[],
  );
  const officeFromAvailable = availablePeople.find((p) => p.kind === "office");
  const officeId =
    ctx.officeId ??
    previous?.officeId ??
    officeFromAvailable?.id ??
    people.find((p) => p.kind === "office" && p.workdays.includes(dow))?.id ??
    null;
  if (officeId) used.add(officeId);

  const onCallIds =
    ctx.onCallIds ??
    people.filter((p) => p.onCallDays.includes(dow) && !used.has(p.id) && !p.workdays.includes(dow)).map((p) => p.id);

  const offIds = people
    .filter((p) => !used.has(p.id) && !onCallIds.includes(p.id) && p.id !== officeId)
    .map((p) => p.id);

  if (officeId) {
    warnings.push({
      id: `${date}-kate-office`,
      severity: "info",
      text: `${people.find((p) => p.id === officeId)?.name ?? "Office"} is in the office. Not counted as clinical coverage.`,
    });
  }

  if (unknown.length) {
    warnings.push({
      id: `${date}-unknown`,
      severity: "info",
      text: `Color is not on this calendar feed. Tap the doctor on ${unknown.length} untagged stop${unknown.length === 1 ? "" : "s"}.`,
    });
  }

  for (const vetId of VET_IDS) {
    if (doctorWork[vetId] === "not_set") {
      warnings.push({
        id: `${date}-work-${vetId}`,
        severity: "warn",
        text: `Set whether ${doctors.find((d) => d.vetId === vetId)?.label ?? vetId} is working.`,
      });
    }
  }

  const generated = makeDuties(date, assignments, appts, {
    staff: people,
    doctors,
    duties,
    officeId,
    surgery: doctorWork.weston === "surgery" || weston.some((a) => a.service === "surgery"),
  });
  const tasks: Task[] = mergeTasks(previous?.date === date ? previous.tasks : undefined, generated);

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
    doctorWork,
    officeId,
    onCallIds,
    offIds,
  };
}

export function personName(id: PersonId | null, staff: Person[] = STAFF): string {
  if (!id) return "Unassigned";
  return staff.find((s) => s.id === id)?.name ?? id;
}

export function vetName(id: VetId, doctors: DoctorTeam[] = DOCTORS): string {
  return doctors.find((d) => d.vetId === id)?.label ?? id;
}

export function reassignSecondary(plan: DayPlan, vetId: VetId, personId: PersonId | null, ctx: PlanContext = {}): DayPlan {
  const doctors = doctorsOf(ctx);
  const people = staffOf(ctx);
  const assignments = plan.assignments.map((a) => {
    if (a.vetId !== vetId) return a;
    if (needsTwo(vetId, doctors)) {
      return { ...a, secondaryId: personId, coverage: coverageOf(a.primaryId, personId, true) };
    }
    return { ...a, primaryId: personId, coverage: coverageOf(personId, null, false) };
  });
  const warnings = plan.warnings.filter((w) => !w.id.includes("swap") && !w.id.includes("weston-second") && !w.id.includes("sidney-short"));
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
      text: `${personName(sidney.primaryId, people)} is on two doctors. One person cannot cover overlapping teams.`,
    });
  }
  if (weston && needsTwo("weston", doctors) && !weston.secondaryId && (weston.primaryId || weston.appointmentIds.length)) {
    warnings.push({
      id: `${plan.date}-weston-second`,
      severity: "block",
      text: "Weston needs a second tech (Kaycee, Alice, or Becca).",
    });
  }
  if (sidney && !sidney.primaryId && sidney.appointmentIds.length) {
    warnings.push({
      id: `${plan.date}-sidney-short`,
      severity: "block",
      text: "Sidney is under-covered.",
    });
  }
  const generated = makeDuties(plan.date, assignments, apptsOn(plan.date, ctx.appointments ?? []), {
    staff: people,
    doctors,
    duties: ctx.duties,
    officeId: plan.officeId,
  });
  return { ...plan, assignments, warnings, tasks: mergeTasks(plan.tasks, generated) };
}

export function nextSupport(plan: DayPlan, exclude: PersonId[], ctx: PlanContext = {}): PersonId | null {
  return availableStaff(plan.date, plan.attendance, ctx)
    .filter((p) => p.kind === "support-tech")
    .map((p) => p.id)
    .filter((id) => !exclude.includes(id))[0] ?? null;
}

export function placePerson(
  plan: DayPlan,
  target: TeamKind,
  role: Role,
  personId: PersonId | null,
  ctx: PlanContext = {},
): DayPlan {
  const doctors = doctorsOf(ctx);
  const people = staffOf(ctx);
  let officeId = plan.officeId;
  let onCallIds = [...plan.onCallIds];
  let offIds = [...plan.offIds];
  const assignments = plan.assignments.map((a) => ({ ...a }));

  const clearFrom = (id: PersonId | null) => {
    if (!id) return;
    for (const a of assignments) {
      if (a.primaryId === id) a.primaryId = null;
      if (a.secondaryId === id) a.secondaryId = null;
      if (a.floatId === id) a.floatId = null;
    }
    if (officeId === id) officeId = null;
    onCallIds = onCallIds.filter((x) => x !== id);
    offIds = offIds.filter((x) => x !== id);
  };
  if (personId) clearFrom(personId);

  if (target === "office") officeId = personId;
  else if (target === "oncall") {
    if (personId && !onCallIds.includes(personId)) onCallIds.push(personId);
  }
  else if (target === "float") {
    const host = assignments.find((a) => a.vetId === "weston") ?? assignments[0];
    if (host) host.floatId = personId;
  } else {
    const asg = assignments.find((a) => a.vetId === target);
    if (asg) {
      if (role === "secondary") asg.secondaryId = personId;
      else if (role === "float") asg.floatId = personId;
      else asg.primaryId = personId;
    }
  }

  for (const asg of assignments) {
    asg.coverage =
      asg.vetId === "michaela"
        ? "covered"
        : coverageOf(asg.primaryId, asg.secondaryId, needsTwo(asg.vetId, doctors));
  }

  const used = new Set(
    [
      ...assignments.flatMap((a) => [a.primaryId, a.secondaryId, a.floatId]),
      officeId,
      ...onCallIds,
    ].filter(Boolean) as PersonId[],
  );
  offIds = people.filter((p) => !used.has(p.id)).map((p) => p.id);

  const generated = makeDuties(plan.date, assignments, apptsOn(plan.date, ctx.appointments ?? []), {
    staff: people,
    doctors,
    duties: ctx.duties,
    officeId,
  });
  return {
    ...plan,
    assignments,
    officeId,
    onCallIds,
    offIds,
    tasks: mergeTasks(plan.tasks, generated),
  };
}

export function attentionItems(plan: DayPlan, doctors: DoctorTeam[] = DOCTORS): { id: string; text: string }[] {
  return plan.warnings
    .filter((w) => w.severity === "warn" || w.severity === "block")
    .map((w) => ({ id: w.id, text: w.text.replace(/^Set whether /, "Set whether ") }));
}

export function weekSummary(
  plans: Record<string, DayPlan>,
  dates: string[],
  staff: Person[] = STAFF,
): string {
  const bits: string[] = [];
  for (const person of staff) {
    let days = 0;
    let onCall = 0;
    for (const d of dates) {
      const plan = plans[d];
      if (!plan) continue;
      const used = [
        ...plan.assignments.flatMap((a) => [a.primaryId, a.secondaryId, a.floatId]),
        plan.officeId,
      ];
      if (used.includes(person.id)) days += 1;
      else if (plan.onCallIds.includes(person.id)) onCall += 1;
    }
    if (!days && !onCall && person.hoursPerWeek) {
      bits.push(`${person.name} 0 days, 0 of ${person.hoursPerWeek} h`);
      continue;
    }
    if (!days && !onCall) continue;
    let text = `${person.name} ${days} day${days === 1 ? "" : "s"}`;
    if (onCall) text += `, ${onCall} on call`;
    if (person.hoursPerWeek && days) text += `, 0 of ${person.hoursPerWeek} h`;
    bits.push(text);
  }
  return bits.join(" · ");
}
