import { DOCTORS, DUTY_TEMPLATES, STAFF } from "./seed.ts";
import type {
  Appointment,
  Assignment,
  DoctorTeam,
  DutyTemplate,
  Person,
  PersonId,
  Task,
  VetId,
} from "./types.ts";

function truckFor(vetId: VetId, doctors: DoctorTeam[]): string {
  return doctors.find((d) => d.vetId === vetId)?.truck ?? "the truck";
}

function needsTwo(vetId: VetId, doctors: DoctorTeam[]): boolean {
  return doctors.find((d) => d.vetId === vetId)?.needsTwo ?? vetId === "weston";
}

function interpolate(label: string, vetId: VetId, doctors: DoctorTeam[]): string {
  return label.replace(/\{truck\}/g, truckFor(vetId, doctors));
}

function pushDuty(
  tasks: Task[],
  date: string,
  ownerId: PersonId,
  vetId: VetId | "office",
  template: DutyTemplate,
  doctors: DoctorTeam[],
) {
  const label =
    vetId === "office" ? template.label : interpolate(template.label, vetId, doctors);
  tasks.push({
    id: `${date}-${ownerId}-${template.id}-${vetId}`,
    ownerId,
    label,
    required: true,
    state: "open",
    vetId,
    when: template.when,
  });
}

export function isSurgeryDay(
  assignments: Assignment[],
  appts: Appointment[],
  flagged?: boolean,
): boolean {
  if (flagged) return true;
  return assignments.some((asg) =>
    asg.appointmentIds.some((id) => appts.find((a) => a.id === id)?.service === "surgery"),
  );
}

export function makeDuties(
  date: string,
  assignments: Assignment[],
  appts: Appointment[],
  extras: {
    staff?: Person[];
    doctors?: DoctorTeam[];
    duties?: DutyTemplate[];
    officeId?: PersonId | null;
    surgery?: boolean;
  } = {},
): Task[] {
  const staff = extras.staff ?? STAFF;
  const doctors = extras.doctors ?? DOCTORS;
  const duties = extras.duties ?? DUTY_TEMPLATES;
  const tasks: Task[] = [];
  const assigned = new Set<PersonId>();
  const surgery = isSurgeryDay(assignments, appts, extras.surgery);

  for (const asg of assignments) {
    if (asg.vetId === "michaela") continue;
    const two = needsTwo(asg.vetId, doctors);
    const oneTechGetsSecondary = !two || !asg.secondaryId;

    const give = (personId: PersonId | null, role: DutyTemplate["role"]) => {
      if (!personId) return;
      assigned.add(personId);
      for (const t of duties) {
        if (t.role !== role) continue;
        if (t.surgeryOnly && !surgery) continue;
        pushDuty(tasks, date, personId, asg.vetId, t, doctors);
      }
    };

    give(asg.primaryId, "primary");
    give(asg.secondaryId, "secondary");
    if (oneTechGetsSecondary && asg.primaryId) give(asg.primaryId, "secondary");
    give(asg.floatId, "float");
  }

  if (extras.officeId) {
    assigned.add(extras.officeId);
    for (const t of duties) {
      if (t.role !== "office") continue;
      pushDuty(tasks, date, extras.officeId, "office", t, doctors);
    }
  }

  for (const person of staff) {
    if (!assigned.has(person.id)) continue;
    const host =
      assignments.find(
        (a) => a.primaryId === person.id || a.secondaryId === person.id || a.floatId === person.id,
      ) ?? assignments.find((a) => a.vetId === "weston") ?? assignments[0];
    const vetId = host?.vetId ?? "weston";
    for (const t of duties) {
      if (t.personId !== person.id) continue;
      if (t.surgeryOnly && !surgery) continue;
      pushDuty(tasks, date, person.id, vetId, t, doctors);
    }
  }

  return tasks;
}

export function mergeTasks(previous: Task[] | undefined, next: Task[]): Task[] {
  if (!previous?.length) return next;
  const prevByKey = new Map(previous.map((t) => [`${t.ownerId}|${t.label}|${t.vetId}`, t]));
  const merged = next.map((t) => {
    const old = prevByKey.get(`${t.ownerId}|${t.label}|${t.vetId}`);
    if (!old) return t;
    return { ...t, state: old.state, blocker: old.blocker, custom: t.custom };
  });
  const nextKeys = new Set(merged.map((t) => `${t.ownerId}|${t.label}|${t.vetId}`));
  for (const t of previous) {
    if (t.custom && !nextKeys.has(`${t.ownerId}|${t.label}|${t.vetId}`)) merged.push(t);
  }
  return merged;
}
