import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { personName, unknownOn, vetName } from "@/lib/staffing/scheduler";
import { coverageCounts, useStaffing } from "@/lib/staffing/store";
import { addWorkingDays, focusDate, skipSunday } from "@/lib/staffing/dates";
import { COVER_OPTIONS } from "@/lib/staffing/seed";
import {
  attendanceLabel,
  dayLong,
  doctorWorkLabel,
  monthDay,
  roleLabel,
  serviceLabel,
} from "@/lib/staffing/format";
import { kitEmpty } from "@/lib/staffing/kit";
import type {
  Appointment,
  AttendanceStatus,
  CoverId,
  DoctorWork,
  Kit,
  Person,
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
  const appointments = useStaffing((s) => s.appointments);
  const staff = useStaffing((s) => s.staff);
  const doctors = useStaffing((s) => s.doctors);
  const me = useStaffing((s) => s.me);
  const [crewOpen, setCrewOpen] = useState(false);
  const [addStop, setAddStop] = useState(false);
  const [openStill, setOpenStill] = useState(false);
  if (!plan) return null;

  const counts = coverageCounts(plan);
  const unknown = unknownOn(plan.date, appointments);
  const appts = appointments
    .filter((a) => a.date === plan.date)
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
  const offNames = plan.offIds.map((id) => personName(id, staff)).join(" · ");
  const surgery = plan.doctorWork.weston === "surgery";
  const cards = peopleOnDay(plan, me);
  const openByPerson = groupOpen(plan, staff);

  const jump = (delta: number) => {
    useStaffing.getState().setDate(addWorkingDays(selectedDate, delta));
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div>
          <p className="text-xs tracking-[0.16em] text-muted">{dayLong(plan.date)}</p>
          <h2 className="font-display text-3xl tracking-tight text-fg">{monthDay(plan.date)}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {surgery && <Badge tone="danger">Surgery</Badge>}
          {counts.checks > 0 && <Badge tone="warn">Check · {counts.checks}</Badge>}
          <span className="ml-auto flex gap-1">
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-border text-sm text-fg"
              onClick={() => jump(-1)}
            >
              <ChevronLeft className="size-4" />
              <span className="sr-only">Previous day</span>
            </button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => useStaffing.getState().setDate(skipSunday(focusDate(), 1))}
            >
              Today
            </Button>
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-border text-sm text-fg"
              onClick={() => jump(1)}
            >
              <ChevronRight className="size-4" />
              <span className="sr-only">Next day</span>
            </button>
          </span>
          {plan.status === "suggested" ? (
            <Button size="sm" onClick={() => useStaffing.getState().approve()}>
              Approve day
            </Button>
          ) : (
            <Badge tone="ok">Approved</Badge>
          )}
        </div>
      </div>

      <div className="divide-y divide-border rounded-md border border-border bg-surface">
        {doctors.map((d) => (
          <label key={d.vetId} className="flex min-h-11 items-center justify-between gap-3 px-3 py-1 text-sm">
            <span className="text-muted">{d.label}</span>
            <select
              className="min-h-11 rounded-sm border border-border bg-bg px-2 text-sm text-fg"
              value={plan.doctorWork[d.vetId]}
              onChange={(e) => useStaffing.getState().setDoctorWork(d.vetId, e.target.value as DoctorWork)}
            >
              {WORK_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {doctorWorkLabel(opt)}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {offNames && <p className="text-sm text-muted">Day off: {offNames}</p>}

      {plan.warnings
        .filter((w) => w.severity === "block")
        .map((w) => (
          <div key={w.id} className="rounded-md border-l-4 border-danger bg-surface px-3 py-2 text-sm text-fg">
            {w.text}
          </div>
        ))}
      {plan.warnings
        .filter((w) => w.severity === "warn")
        .map((w) => (
          <div key={w.id} className="rounded-md border-l-4 border-warn bg-surface px-3 py-2 text-sm text-fg">
            {w.text}
          </div>
        ))}

      {unknown.length > 0 && (
        <p className="text-sm text-muted">
          {unknown.length} {unknown.length === 1 ? "stop needs" : "stops need"} a tap. Color is not
          on this feed — pick Davis, Chanutin, Dooley, or Alejandro.
        </p>
      )}

      <section className="space-y-2">
        <h3 className="text-xs tracking-[0.16em] uppercase text-muted">Stops</h3>
        <ul className="space-y-2">
          {appts.map((a) => (
            <StopCard key={a.id} appt={a} />
          ))}
        </ul>
        {addStop ? (
          <AddStopForm onDone={() => setAddStop(false)} />
        ) : (
          <button type="button" className="min-h-11 text-sm text-accent" onClick={() => setAddStop(true)}>
            Add a stop
          </button>
        )}
      </section>

      <div className="flex items-center justify-between gap-2 border-y border-border py-3">
        <p className="text-xs tracking-[0.14em] uppercase text-muted">
          {counts.done} of {counts.total} duties done
        </p>
        <button type="button" className="min-h-11 text-sm text-accent" onClick={() => setCrewOpen((v) => !v)}>
          {crewOpen ? "Close crew" : "Edit crew"}
        </button>
      </div>

      {crewOpen && <CrewEditor />}

      <div className="space-y-3">
        {cards.map((card) => (
          <PersonCard key={card.personId} {...card} />
        ))}
      </div>

      {counts.open > 0 && (
        <section className="rounded-md border border-border bg-surface">
          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-between px-3 text-left"
            onClick={() => setOpenStill((v) => !v)}
          >
            <span className="text-xs tracking-[0.16em] uppercase text-muted">Still open</span>
            <span className="text-sm text-fg">{counts.open}</span>
          </button>
          <ul className="border-t border-border px-3 py-2 text-sm text-muted">
            {openByPerson.map((row) => (
              <li key={row.id} className="flex min-h-9 items-center justify-between gap-2">
                <span>{row.name}</span>
                <span className="text-fg">{row.open}</span>
              </li>
            ))}
          </ul>
          {openStill && (
            <ul className="space-y-1 border-t border-border px-3 py-2">
              {plan.tasks
                .filter((t) => t.state !== "done")
                .map((t) => (
                  <li key={t.id}>
                    <label className="flex min-h-11 items-center gap-3 text-sm text-fg">
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => useStaffing.getState().setTask(t.id, "done")}
                      />
                      <span className="w-20 shrink-0 text-muted">{personName(t.ownerId, staff)}</span>
                      <span>{t.label}</span>
                    </label>
                  </li>
                ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function StopCard({ appt }: { appt: Appointment }) {
  const doctors = useStaffing((s) => s.doctors);
  const me = useStaffing((s) => s.me);
  const canKit = !me || me === "alejandro" || me === "kate";
  const kit = appt.kit;
  return (
    <li className="rounded-md border border-border bg-surface p-3">
      <p className="text-xs text-muted">
        {appt.start}–{appt.end}
        {appt.vetId === "unknown"
          ? " · Doctor?"
          : ` · ${serviceLabel(appt.service)} · ${vetName(appt.vetId, doctors)}`}
      </p>
      <p className="mt-1 text-sm text-fg">{appt.title}</p>
      {appt.location && appt.location !== "Location TBD" && (
        <p className="text-xs text-muted">{appt.location}</p>
      )}
      <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-4">
        {COVER_OPTIONS.map((d) => (
          <button
            key={d.id}
            type="button"
            className={cn(
              "min-h-11 rounded-sm border px-1 text-xs",
              appt.vetId === d.id ? "border-accent bg-accent/15 text-fg" : "border-border text-muted",
            )}
            onClick={() => useStaffing.getState().tagAppointment(appt.id, d.id)}
          >
            {d.short}
          </button>
        ))}
      </div>
      {!kitEmpty(kit) && (
        <div className="mt-2 space-y-2">
          {kit && kit.equipment.length > 0 && (
            <div>
              <p className="text-[11px] tracking-[0.14em] uppercase text-muted">Bring</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {kit.equipment.map((item) => (
                  <span key={item} className="rounded-sm border border-border px-2 py-1 text-xs text-fg">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
          {kit && kit.meds.length > 0 && (
            <div>
              <p className="text-[11px] tracking-[0.14em] uppercase text-muted">Meds</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {kit.meds.map((item) => (
                  <span key={item} className="rounded-sm border border-border px-2 py-1 text-xs text-fg">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {kitEmpty(kit) && (
        <p className="mt-2 text-xs text-subtle">No extra equipment noted for this stop.</p>
      )}
      {canKit && <KitEditor appt={appt} />}
    </li>
  );
}

function KitEditor({ appt }: { appt: Appointment }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [kind, setKind] = useState<"equipment" | "meds">("equipment");
  const kit: Kit = appt.kit ?? { equipment: [], meds: [] };
  const add = () => {
    const label = draft.trim();
    if (!label) return;
    const next: Kit = {
      equipment: kind === "equipment" ? [...kit.equipment, label] : kit.equipment,
      meds: kind === "meds" ? [...kit.meds, label] : kit.meds,
    };
    useStaffing.getState().updateKit(appt.id, next);
    setDraft("");
  };
  return (
    <div className="mt-2">
      <button type="button" className="text-xs text-accent" onClick={() => setOpen((v) => !v)}>
        {open ? "Close kit" : "Add equipment or meds"}
      </button>
      {open && (
        <form
          className="mt-2 grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <div className="flex gap-2">
            <select
              className="min-h-11 rounded-sm border border-border bg-bg px-2 text-sm text-fg"
              value={kind}
              onChange={(e) => setKind(e.target.value as "equipment" | "meds")}
            >
              <option value="equipment">Equipment</option>
              <option value="meds">Meds</option>
            </select>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={kind === "meds" ? "e.g. Saline" : "e.g. Shockwave"}
              className="min-h-11 min-w-0 flex-1 rounded-sm border border-border bg-bg px-3 text-sm text-fg"
            />
          </div>
          <Button type="submit" size="sm" variant="secondary">
            Save on this stop
          </Button>
        </form>
      )}
    </div>
  );
}

function CrewEditor() {
  const plan = useStaffing((s) => s.plans[s.selectedDate]);
  const staff = useStaffing((s) => s.staff);
  const doctors = useStaffing((s) => s.doctors);
  if (!plan) return null;
  const techs = staff.filter((p) => p.kind !== "office");
  return (
    <div className="space-y-3 rounded-md border border-border bg-surface p-3">
      {doctors
        .filter((d) => d.vetId !== "michaela")
        .map((d) => {
          const asg = plan.assignments.find((a) => a.vetId === d.vetId);
          if (!asg) return null;
          return (
            <div key={d.vetId} className="grid gap-2">
              <label className="text-xs text-muted">
                {d.label} {d.needsTwo ? "primary" : "tech"}
                <select
                  className="mt-1 min-h-11 w-full rounded-sm border border-border bg-bg px-3 text-sm text-fg"
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
                    className="mt-1 min-h-11 w-full rounded-sm border border-border bg-bg px-3 text-sm text-fg"
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

function peopleOnDay(
  plan: NonNullable<ReturnType<typeof useStaffing.getState>["plans"][string]>,
  me: PersonId | null,
) {
  const rows: { personId: PersonId; role: Role; team: string }[] = [];
  const seen = new Set<PersonId>();
  const push = (row: { personId: PersonId; role: Role; team: string }) => {
    if (seen.has(row.personId)) return;
    seen.add(row.personId);
    rows.push(row);
  };
  for (const asg of plan.assignments) {
    if (asg.primaryId) push({ personId: asg.primaryId, role: "primary", team: asg.vetId });
    if (asg.secondaryId) push({ personId: asg.secondaryId, role: "secondary", team: asg.vetId });
    if (asg.floatId) push({ personId: asg.floatId, role: "float", team: "float" });
  }
  if (plan.officeId) push({ personId: plan.officeId, role: "office", team: "office" });
  for (const id of plan.onCallIds) push({ personId: id, role: "oncall", team: "oncall" });
  if (me) rows.sort((a, b) => Number(b.personId === me) - Number(a.personId === me));
  return rows;
}

function groupOpen(
  plan: NonNullable<ReturnType<typeof useStaffing.getState>["plans"][string]>,
  staff: Person[],
) {
  const counts = new Map<PersonId, number>();
  for (const t of plan.tasks) {
    if (t.state === "done") continue;
    counts.set(t.ownerId, (counts.get(t.ownerId) ?? 0) + 1);
  }
  return [...counts.entries()].map(([id, open]) => ({
    id,
    name: personName(id, staff),
    open,
  }));
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
          : team === "alejandro"
            ? "Alejandro’s stops"
            : `${roleLabel(role)} · ${vetName(team as CoverId, doctors)}`;
  const hot = att && (att.status === "late" || att.status === "no_show" || att.status === "call_out");

  return (
    <article
      className={cn(
        "rounded-md border bg-surface p-3",
        hot ? "border-danger/50" : me === personId ? "border-accent/40" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">{teamLabel}</p>
          <h3 className="font-display text-2xl tracking-tight text-fg">{person?.name}</h3>
        </div>
        <label className="text-xs text-muted">
          Status
          <select
            className="mt-1 min-h-11 min-w-36 rounded-sm border border-border bg-bg px-3 text-sm text-fg"
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
          placeholder="Add a task"
          className="min-h-11 flex-1 rounded-sm border border-border bg-bg px-3 text-sm text-fg"
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
    <div className="mt-3">
      <p className="text-[11px] tracking-[0.16em] uppercase text-muted">{title}</p>
      <ul className="mt-1">
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

function AddStopForm({ onDone }: { onDone?: () => void }) {
  const [title, setTitle] = useState("");
  const [vetId, setVetId] = useState<CoverId>("weston");
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        useStaffing.getState().addAppointment({ title, start: "08:00", end: "09:00", vetId });
        setTitle("");
        onDone?.();
      }}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Stop title"
        className="min-h-11 rounded-sm border border-border bg-bg px-3 text-sm text-fg"
      />
      <select
        className="min-h-11 rounded-sm border border-border bg-bg px-3 text-sm text-fg"
        value={vetId}
        onChange={(e) => setVetId(e.target.value as CoverId)}
      >
        {COVER_OPTIONS.map((d) => (
          <option key={d.id} value={d.id}>
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
