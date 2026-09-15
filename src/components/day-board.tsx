import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { RoleMark } from "@/components/role-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { addDays, format, parseISO } from "date-fns";
import { apptsOn, personName, unknownOn, vetName } from "@/lib/staffing/scheduler";
import { coverageCounts, useStaffing } from "@/lib/staffing/store";
import { focusDate } from "@/lib/staffing/dates";
import {
  attendanceLabel,
  dayLong,
  doctorWorkLabel,
  monthDay,
  roleLabel,
  serviceLabel,
} from "@/lib/staffing/format";
import type {
  AttendanceStatus,
  DoctorWork,
  PersonId,
  Role,
  VetId,
} from "@/lib/staffing/types";
import { cn } from "@/lib/utils";

const WORK_OPTIONS: DoctorWork[] = ["not_set", "working", "sports", "surgery", "off"];
const ATTEND: AttendanceStatus[] = ["expected", "on_site", "late", "no_show", "call_out", "left_early"];

export function DayBoard() {
  const plan = useStaffing((s) => s.plans[s.selectedDate]);
  const selectedDate = useStaffing((s) => s.selectedDate);
  const weekDates = useStaffing((s) => s.weekDates);
  const appointments = useStaffing((s) => s.appointments);
  const staff = useStaffing((s) => s.staff);
  const doctors = useStaffing((s) => s.doctors);
  const me = useStaffing((s) => s.me);
  const [crewOpen, setCrewOpen] = useState(false);
  if (!plan) return null;

  const counts = coverageCounts(plan);
  const unknown = unknownOn(plan.date, appointments);
  const appts = apptsOn(plan.date, appointments);
  const offNames = plan.offIds.map((id) => personName(id, staff)).join(" · ");
  const surgery = plan.doctorWork.weston === "surgery";

  const cards = peopleOnDay(plan, me);

  const jump = (delta: number) => {
    const next = format(addDays(parseISO(selectedDate), delta), "yyyy-MM-dd");
    if (weekDates.includes(next)) useStaffing.getState().setDate(next);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.16em] text-muted">{dayLong(plan.date)}</p>
          <h2 className="font-display text-3xl tracking-tight text-fg sm:text-4xl">{monthDay(plan.date)}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {counts.checks > 0 && (
            <Badge tone="warn">Check · {counts.checks}</Badge>
          )}
          {surgery && <Badge tone="danger">Surgery</Badge>}
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-md border border-border text-muted"
            onClick={() => jump(-1)}
            aria-label="Previous day"
          >
            <ChevronLeft className="size-4" />
          </button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const today = focusDate();
              useStaffing.getState().setDate(weekDates.includes(today) ? today : selectedDate);
            }}
          >
            Today
          </Button>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-md border border-border text-muted"
            onClick={() => jump(1)}
            aria-label="Next day"
          >
            <ChevronRight className="size-4" />
          </button>
          {plan.status === "suggested" ? (
            <Button size="sm" onClick={() => useStaffing.getState().approve()}>
              Approve day
            </Button>
          ) : (
            <Badge tone="ok">Approved</Badge>
          )}
        </div>
      </div>

      <p className="text-sm text-muted">
        {doctors.map((d) => (
          <span key={d.vetId}>
            {d.label}:{" "}
            <WorkSelect vetId={d.vetId} value={plan.doctorWork[d.vetId]} />
            {d.vetId !== "michaela" ? " · " : ""}
          </span>
        ))}
      </p>
      {offNames && <p className="text-sm text-muted">Day off: {offNames}</p>}

      {plan.warnings
        .filter((w) => w.severity === "warn" || w.severity === "block")
        .map((w) => (
          <div
            key={w.id}
            className={cn(
              "rounded-md border-l-4 px-3 py-2 text-sm",
              w.severity === "block"
                ? "border-danger bg-surface text-fg"
                : "border-warn bg-surface text-fg",
            )}
          >
            {w.text}
          </div>
        ))}

      {unknown.length > 0 && (
        <section className="rounded-xl border border-warn/40 bg-surface p-4">
          <h3 className="font-display text-lg text-fg">Needs a doctor tag</h3>
          <ul className="mt-3 space-y-2">
            {unknown.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <p className="flex-1 text-sm text-fg">
                  {a.start}–{a.end} · {a.title}
                </p>
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
                  <option value="sidney">Dr. Chanutin</option>
                  <option value="michaela">Dr. Doole</option>
                </select>
              </li>
            ))}
          </ul>
        </section>
      )}

      {appts.length > 0 && (
        <ul className="space-y-1 text-sm text-muted">
          {appts.map((a) => (
            <li key={a.id}>
              <span className="text-fg">
                {a.start}–{a.end}
              </span>{" "}
              · {serviceLabel(a.service)} · {a.title} · {vetName(a.vetId === "unknown" ? "weston" : a.vetId, doctors)}
            </li>
          ))}
        </ul>
      )}
      <AddStopForm />

      <div className="flex flex-wrap items-center justify-between gap-2 border-y border-border py-3">
        <p className="text-xs tracking-[0.14em] uppercase text-muted">
          {counts.done} of {counts.total} duties done
        </p>
        <button
          type="button"
          className="min-h-11 text-sm text-accent"
          onClick={() => setCrewOpen((v) => !v)}
        >
          {crewOpen ? "Close crew" : "Edit crew"}
        </button>
      </div>

      {crewOpen && <CrewEditor />}

      <div className="space-y-4">
        {cards.map((card) => (
          <PersonCard key={card.personId} {...card} />
        ))}
      </div>

      {plan.tasks.some((t) => t.state !== "done") && (
        <section className="rounded-xl border border-border bg-surface p-4">
          <h3 className="text-xs tracking-[0.16em] uppercase text-muted">Still open</h3>
          <ul className="mt-3 space-y-2">
            {plan.tasks
              .filter((t) => t.state !== "done")
              .map((t) => (
                <li key={t.id} className="flex items-start gap-3 text-sm">
                  <RoleMark role={roleFor(plan, t.ownerId)} />
                  <span className="text-muted">{personName(t.ownerId, staff)}</span>
                  <span className="text-fg">{t.label}</span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function WorkSelect({ vetId, value }: { vetId: VetId; value: DoctorWork }) {
  return (
    <select
      className="min-h-11 rounded-md border border-border bg-transparent px-2 text-sm text-fg"
      value={value}
      onChange={(e) => useStaffing.getState().setDoctorWork(vetId, e.target.value as DoctorWork)}
    >
      {WORK_OPTIONS.map((opt) => (
        <option key={opt} value={opt}>
          {doctorWorkLabel(opt)}
        </option>
      ))}
    </select>
  );
}

function CrewEditor() {
  const plan = useStaffing((s) => s.plans[s.selectedDate]);
  const staff = useStaffing((s) => s.staff);
  const doctors = useStaffing((s) => s.doctors);
  if (!plan) return null;
  const techs = staff.filter((p) => p.kind !== "office");
  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
      {doctors
        .filter((d) => d.vetId !== "michaela")
        .map((d) => {
          const asg = plan.assignments.find((a) => a.vetId === d.vetId);
          if (!asg) return null;
          return (
            <div key={d.vetId} className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-muted">
                {d.label} {d.needsTwo ? "primary" : "tech"}
                <select
                  className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-fg"
                  value={asg.primaryId ?? ""}
                  onChange={(e) =>
                    useStaffing.getState().place(d.vetId, "primary", e.target.value || null)
                  }
                >
                  <option value="">Unassigned</option>
                  {techs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              {d.needsTwo && (
                <label className="text-xs text-muted">
                  Secondary
                  <select
                    className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-fg"
                    value={asg.secondaryId ?? ""}
                    onChange={(e) =>
                      useStaffing.getState().place(d.vetId, "secondary", e.target.value || null)
                    }
                  >
                    <option value="">Unassigned</option>
                    {techs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          );
        })}
    </div>
  );
}

function peopleOnDay(plan: NonNullable<ReturnType<typeof useStaffing.getState>["plans"][string]>, me: PersonId | null) {
  const rows: { personId: PersonId; role: Role; team: string }[] = [];
  for (const asg of plan.assignments) {
    if (asg.primaryId) {
      rows.push({
        personId: asg.primaryId,
        role: "primary",
        team: asg.vetId,
      });
    }
    if (asg.secondaryId) {
      rows.push({
        personId: asg.secondaryId,
        role: "secondary",
        team: asg.vetId,
      });
    }
    if (asg.floatId) {
      rows.push({ personId: asg.floatId, role: "float", team: "float" });
    }
  }
  if (plan.officeId) rows.push({ personId: plan.officeId, role: "office", team: "office" });
  for (const id of plan.onCallIds) rows.push({ personId: id, role: "oncall", team: "oncall" });
  if (me) rows.sort((a, b) => Number(b.personId === me) - Number(a.personId === me));
  return rows;
}

function roleFor(plan: NonNullable<ReturnType<typeof useStaffing.getState>["plans"][string]>, personId: PersonId): Role {
  for (const asg of plan.assignments) {
    if (asg.primaryId === personId) return "primary";
    if (asg.secondaryId === personId) return "secondary";
    if (asg.floatId === personId) return "float";
  }
  if (plan.officeId === personId) return "office";
  return "oncall";
}

function PersonCard({
  personId,
  role,
  team,
}: {
  personId: PersonId;
  role: Role;
  team: string;
}) {
  const plan = useStaffing((s) => s.plans[s.selectedDate]);
  const staff = useStaffing((s) => s.staff);
  const doctors = useStaffing((s) => s.doctors);
  const me = useStaffing((s) => s.me);
  const [adding, setAdding] = useState("");
  if (!plan) return null;
  const person = staff.find((p) => p.id === personId);
  const tasks = plan.tasks.filter((t) => t.ownerId === personId);
  const during = tasks.filter((t) => t.when === "during");
  const eod = tasks.filter((t) => t.when === "eod");
  const att = plan.attendance.find((a) => a.personId === personId);
  const teamLabel =
    team === "office"
      ? "Office"
      : team === "float"
        ? "Float"
        : team === "oncall"
          ? "On call"
          : `${roleLabel(role)} · ${vetName(team as VetId, doctors)}`;
  const hot = att && (att.status === "late" || att.status === "no_show" || att.status === "call_out");

  return (
    <article
      className={cn(
        "rounded-xl border bg-surface p-4",
        hot ? "border-danger/50" : me === personId ? "border-accent/40" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <RoleMark role={role} />
          <div>
            <p className="text-xs text-muted">{person?.name}</p>
            <h3 className="font-display text-2xl tracking-tight text-fg">{person?.name.toUpperCase()}</h3>
            <p className="text-xs text-muted">{teamLabel}</p>
          </div>
        </div>
        <label className="text-xs text-muted">
          Status
          <select
            className="mt-1 min-h-11 min-w-36 rounded-md border border-border bg-surface-2 px-3 text-sm text-fg"
            value={att?.status === "done" ? "expected" : (att?.status ?? "expected")}
            onChange={(e) =>
              useStaffing.getState().setAttendance(personId, e.target.value as AttendanceStatus)
            }
          >
            {ATTEND.map((st) => (
              <option key={st} value={st}>
                {attendanceLabel(st)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {during.length > 0 && <DutyList title="During the day" ids={during.map((t) => t.id)} />}
      {eod.length > 0 && <DutyList title="End of day" ids={eod.map((t) => t.id)} />}
      {tasks.length === 0 && (
        <p className="mt-3 text-sm text-muted">No duties for this role yet. Add them in Team & duties.</p>
      )}

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!adding.trim()) return;
          useStaffing.getState().addTask(personId, adding, "during");
          setAdding("");
        }}
      >
        <input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          placeholder="Add an appointment or task"
          className="min-h-11 flex-1 rounded-md border border-border bg-bg px-3 text-sm text-fg"
        />
        <Button type="submit" size="sm" variant="ghost" aria-label="Add task">
          <Plus className="size-4" />
        </Button>
      </form>
    </article>
  );
}

function DutyList({ title, ids }: { title: string; ids: string[] }) {
  const plan = useStaffing((s) => s.plans[s.selectedDate]);
  if (!plan) return null;
  const tasks = ids.map((id) => plan.tasks.find((t) => t.id === id)).filter(Boolean);
  return (
    <div className="mt-4">
      <p className="text-[11px] tracking-[0.16em] uppercase text-muted">{title}</p>
      <ul className="mt-2 space-y-1">
        {tasks.map((t) =>
          t ? (
            <li key={t.id}>
              <label className="flex min-h-11 items-center gap-3 text-sm text-fg">
                <input
                  type="checkbox"
                  checked={t.state === "done"}
                  onChange={() =>
                    useStaffing.getState().setTask(t.id, t.state === "done" ? "open" : "done")
                  }
                />
                <span className={t.state === "done" ? "text-muted line-through" : ""}>{t.label}</span>
              </label>
            </li>
          ) : null,
        )}
      </ul>
    </div>
  );
}

export function AddStopForm() {
  const doctors = useStaffing((s) => s.doctors);
  const [title, setTitle] = useState("");
  const [vetId, setVetId] = useState<VetId>("weston");
  return (
    <form
      className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        useStaffing.getState().addAppointment({ title, start: "08:00", end: "09:00", vetId });
        setTitle("");
      }}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a stop on this board (does not write to Google)"
        className="min-h-11 rounded-md border border-border bg-bg px-3 text-sm text-fg"
      />
      <select
        className="min-h-11 rounded-md border border-border bg-surface-2 px-3 text-sm text-fg"
        value={vetId}
        onChange={(e) => setVetId(e.target.value as VetId)}
      >
        {doctors.map((d) => (
          <option key={d.vetId} value={d.vetId}>
            {d.label}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm">
        Add stop
      </Button>
    </form>
  );
}
