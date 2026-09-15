import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RoleMark } from "@/components/role-mark";
import { useStaffing } from "@/lib/staffing/store";
import { roleLabel } from "@/lib/staffing/format";
import type { DutyWhen, Person, PersonId, Role, TeamKind } from "@/lib/staffing/types";

const DAYS = [
  { n: 1, l: "M" },
  { n: 2, l: "T" },
  { n: 3, l: "W" },
  { n: 4, l: "T" },
  { n: 5, l: "F" },
  { n: 6, l: "S" },
  { n: 0, l: "S" },
];

const ROLES: Role[] = ["primary", "secondary", "float", "office", "oncall"];
const TEAMS: { id: TeamKind; label: string }[] = [
  { id: "weston", label: "Dr. Davis" },
  { id: "sidney", label: "Dr. Chanutin" },
  { id: "michaela", label: "Dr. Doole" },
  { id: "float", label: "Float" },
  { id: "office", label: "Office" },
  { id: "oncall", label: "On call" },
];

export function TeamSetup() {
  const staff = useStaffing((s) => s.staff);
  const doctors = useStaffing((s) => s.doctors);
  const duties = useStaffing((s) => s.duties);
  const [newName, setNewName] = useState("");
  const [dutyDraft, setDutyDraft] = useState<Record<Role, string>>({
    primary: "",
    secondary: "",
    float: "",
    office: "",
    oncall: "",
  });
  const [personDuty, setPersonDuty] = useState("");
  const [personDutyWho, setPersonDutyWho] = useState<PersonId>(staff[0]?.id ?? "alejandro");

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs tracking-[0.16em] uppercase text-muted">Setup</p>
        <h2 className="font-display text-3xl tracking-tight text-fg">Team & duties</h2>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Changes save as you leave each field. Usual days and teams are what “Fill from usual days”
          uses on the Week board. Leave days empty for someone whose days vary. Write {"{truck}"} in
          a duty and it becomes that team’s truck.
        </p>
      </div>

      <section>
        <h3 className="text-xs tracking-[0.16em] uppercase text-muted">People</h3>
        <div className="mt-3 space-y-4">
          {staff.map((person) => (
            <PersonEditor key={person.id} person={person} />
          ))}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            useStaffing.getState().addPerson(newName);
            setNewName("");
          }}
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Add a person"
            className="min-h-11 flex-1 rounded-md border border-border bg-bg px-3 text-sm text-fg"
          />
          <Button type="submit" size="sm" variant="secondary">
            Add
          </Button>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h3 className="text-xs tracking-[0.16em] uppercase text-muted">Doctors’ teams</h3>
        <div className="mt-3 space-y-3">
          {doctors.map((d) => (
            <div key={d.vetId} className="flex flex-wrap items-center gap-3">
              <p className="w-28 text-sm text-fg">{d.label}</p>
              <input
                defaultValue={d.truck}
                onBlur={(e) => useStaffing.getState().updateDoctor(d.vetId, { truck: e.target.value })}
                className="min-h-11 min-w-48 flex-1 rounded-md border border-border bg-bg px-3 text-sm text-fg"
              />
              <label className="flex min-h-11 items-center gap-2 text-sm text-fg">
                <input
                  type="checkbox"
                  checked={d.needsTwo}
                  onChange={(e) =>
                    useStaffing.getState().updateDoctor(d.vetId, { needsTwo: e.target.checked })
                  }
                />
                Needs 2 techs
              </label>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          With one tech on a team, that tech gets the secondary duties too.
        </p>
      </section>

      <section className="space-y-6">
        <div>
          <h3 className="text-xs tracking-[0.16em] uppercase text-muted">Duties</h3>
          <p className="mt-1 text-sm text-muted">
            Role duties go to whoever has that role that day. Duties for one person follow them to
            whatever team they’re on.
          </p>
        </div>
        {ROLES.map((role) => (
          <div key={role}>
            <div className="mb-2 flex items-center gap-2">
              <RoleMark role={role} />
              <p className="text-sm text-fg">{roleLabel(role)}</p>
            </div>
            <ul className="space-y-2">
              {duties
                .filter((d) => d.role === role)
                .map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-2">
                    <input
                      defaultValue={d.label}
                      onBlur={(e) =>
                        useStaffing.getState().updateDuty(d.id, { label: e.target.value })
                      }
                      className="min-h-11 min-w-40 flex-1 rounded-md border border-border bg-bg px-3 text-sm text-fg"
                    />
                    <select
                      className="min-h-11 rounded-md border border-border bg-surface-2 px-3 text-sm text-fg"
                      value={d.when}
                      onChange={(e) =>
                        useStaffing.getState().updateDuty(d.id, { when: e.target.value as DutyWhen })
                      }
                    >
                      <option value="during">During the day</option>
                      <option value="eod">End of day</option>
                    </select>
                    <Button size="sm" variant="ghost" onClick={() => useStaffing.getState().removeDuty(d.id)}>
                      Delete
                    </Button>
                  </li>
                ))}
            </ul>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const label = dutyDraft[role].trim();
                if (!label) return;
                useStaffing.getState().addDuty({
                  id: `${role}-${Date.now()}`,
                  label,
                  when: "during",
                  role,
                });
                setDutyDraft((prev) => ({ ...prev, [role]: "" }));
              }}
            >
              <input
                value={dutyDraft[role]}
                onChange={(e) => setDutyDraft((prev) => ({ ...prev, [role]: e.target.value }))}
                placeholder={`Add a ${role.replace("oncall", "on call")} duty`}
                className="min-h-11 flex-1 rounded-md border border-border bg-bg px-3 text-sm text-fg"
              />
              <Button type="submit" size="sm" variant="secondary">
                Add
              </Button>
            </form>
          </div>
        ))}

        <div>
          <p className="mb-2 text-xs tracking-[0.16em] uppercase text-muted">Just for one person</p>
          <ul className="space-y-2">
            {duties
              .filter((d) => d.personId)
              .map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-2">
                  <select
                    className="min-h-11 rounded-md border border-border bg-surface-2 px-3 text-sm text-fg"
                    value={d.personId}
                    onChange={(e) =>
                      useStaffing.getState().updateDuty(d.id, { personId: e.target.value })
                    }
                  >
                    {staff.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    defaultValue={d.label}
                    onBlur={(e) => useStaffing.getState().updateDuty(d.id, { label: e.target.value })}
                    className="min-h-11 min-w-40 flex-1 rounded-md border border-border bg-bg px-3 text-sm text-fg"
                  />
                  <select
                    className="min-h-11 rounded-md border border-border bg-surface-2 px-3 text-sm text-fg"
                    value={d.when}
                    onChange={(e) =>
                      useStaffing.getState().updateDuty(d.id, { when: e.target.value as DutyWhen })
                    }
                  >
                    <option value="during">During the day</option>
                    <option value="eod">End of day</option>
                  </select>
                  <label className="flex min-h-11 items-center gap-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={Boolean(d.surgeryOnly)}
                      onChange={(e) =>
                        useStaffing.getState().updateDuty(d.id, { surgeryOnly: e.target.checked })
                      }
                    />
                    Surgery days only
                  </label>
                  <Button size="sm" variant="ghost" onClick={() => useStaffing.getState().removeDuty(d.id)}>
                    Delete
                  </Button>
                </li>
              ))}
          </ul>
          <form
            className="mt-2 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!personDuty.trim()) return;
              useStaffing.getState().addDuty({
                id: `person-${Date.now()}`,
                label: personDuty.trim(),
                when: "during",
                personId: personDutyWho,
              });
              setPersonDuty("");
            }}
          >
            <select
              className="min-h-11 rounded-md border border-border bg-surface-2 px-3 text-sm text-fg"
              value={personDutyWho}
              onChange={(e) => setPersonDutyWho(e.target.value)}
            >
              {staff.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              value={personDuty}
              onChange={(e) => setPersonDuty(e.target.value)}
              placeholder="Add a duty for this person"
              className="min-h-11 min-w-40 flex-1 rounded-md border border-border bg-bg px-3 text-sm text-fg"
            />
            <Button type="submit" size="sm" variant="secondary">
              Add
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}

function PersonEditor({ person }: { person: Person }) {
  const toggleDay = (key: "workdays" | "onCallDays", n: number) => {
    const current = person[key];
    const next = current.includes(n) ? current.filter((d) => d !== n) : [...current, n];
    useStaffing.getState().updatePerson(person.id, { [key]: next });
  };
  return (
    <article className="rounded-xl border border-border bg-surface p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          defaultValue={person.name}
          onBlur={(e) => useStaffing.getState().updatePerson(person.id, { name: e.target.value })}
          className="min-h-11 min-w-40 flex-1 rounded-md border border-border bg-bg px-3 text-sm text-fg"
        />
        <select
          className="min-h-11 rounded-md border border-border bg-surface-2 px-3 text-sm text-fg"
          value={person.kind}
          onChange={(e) =>
            useStaffing.getState().updatePerson(person.id, {
              kind: e.target.value as Person["kind"],
              usualTeam: e.target.value === "office" ? "office" : person.usualTeam,
              usualRole: e.target.value === "office" ? "office" : person.usualRole,
            })
          }
        >
          <option value="primary-tech">Tech</option>
          <option value="support-tech">Tech</option>
          <option value="office">Office</option>
        </select>
        <label className="flex min-h-11 items-center gap-2 text-sm text-fg">
          <input
            type="checkbox"
            checked={person.surgery}
            onChange={(e) => useStaffing.getState().updatePerson(person.id, { surgery: e.target.checked })}
          />
          Surgery
        </label>
      </div>
      <DayRow label="Works" selected={person.workdays} onToggle={(n) => toggleDay("workdays", n)} />
      <DayRow label="On call" selected={person.onCallDays} onToggle={(n) => toggleDay("onCallDays", n)} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-16 text-[11px] uppercase tracking-wider text-muted">Usually</span>
        <select
          className="min-h-11 rounded-md border border-border bg-surface-2 px-3 text-sm text-fg"
          value={person.usualTeam}
          onChange={(e) =>
            useStaffing.getState().updatePerson(person.id, { usualTeam: e.target.value as TeamKind })
          }
        >
          {TEAMS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          className="min-h-11 rounded-md border border-border bg-surface-2 px-3 text-sm text-fg"
          value={person.usualRole}
          onChange={(e) =>
            useStaffing.getState().updatePerson(person.id, { usualRole: e.target.value as Role })
          }
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {roleLabel(r)}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          placeholder="hrs/week"
          defaultValue={person.hoursPerWeek ?? ""}
          onBlur={(e) =>
            useStaffing.getState().updatePerson(person.id, {
              hoursPerWeek: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          className="min-h-11 w-28 rounded-md border border-border bg-bg px-3 text-sm text-fg"
        />
      </div>
    </article>
  );
}

function DayRow({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: number[];
  onToggle: (n: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16 text-[11px] uppercase tracking-wider text-muted">{label}</span>
      {DAYS.map((d) => (
        <button
          key={`${label}-${d.n}`}
          type="button"
          onClick={() => onToggle(d.n)}
          className={`inline-flex size-11 items-center justify-center rounded-md text-sm ${
            selected.includes(d.n) ? "bg-accent text-accent-fg" : "border border-border text-muted"
          }`}
        >
          {d.l}
        </button>
      ))}
    </div>
  );
}
