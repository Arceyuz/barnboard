export type PersonId = string;
export type VetId = "weston" | "sidney" | "michaela";
export type Role = "primary" | "secondary" | "float" | "office" | "oncall";
export type TeamKind = VetId | "float" | "office" | "oncall";
export type AttendanceStatus =
  | "expected"
  | "on_site"
  | "late"
  | "no_show"
  | "call_out"
  | "left_early"
  | "done";
export type DayStatus = "suggested" | "approved" | "locked";
export type TaskState = "open" | "done" | "handed_off" | "blocked";
export type ViewId = "week" | "day" | "team";
export type ServiceKind = "sports" | "surgery" | "field";
export type CalendarSource = "demo" | "google";
export type DutyWhen = "during" | "eod";
export type DoctorWork = "not_set" | "off" | "working" | "sports" | "surgery";

export type Person = {
  id: PersonId;
  name: string;
  short: string;
  kind: "primary-tech" | "support-tech" | "office";
  workdays: number[];
  onCallDays: number[];
  usualTeam: TeamKind;
  usualRole: Role;
  surgery: boolean;
  hoursPerWeek?: number;
  notes: string;
};

export type DoctorTeam = {
  vetId: VetId;
  name: string;
  label: string;
  truck: string;
  needsTwo: boolean;
};

export type DutyTemplate = {
  id: string;
  label: string;
  when: DutyWhen;
  role?: Role;
  personId?: PersonId;
  surgeryOnly?: boolean;
};

export type Appointment = {
  id: string;
  date: string;
  start: string;
  end: string;
  title: string;
  location: string;
  vetId: VetId | "unknown";
  service: ServiceKind;
  colorLabel: string;
  notes?: string;
  custom?: boolean;
};

export type Assignment = {
  vetId: VetId;
  primaryId: PersonId | null;
  secondaryId: PersonId | null;
  floatId: PersonId | null;
  appointmentIds: string[];
  coverage: "covered" | "short" | "none";
};

export type Warning = {
  id: string;
  severity: "block" | "warn" | "info";
  text: string;
};

export type Task = {
  id: string;
  ownerId: PersonId;
  label: string;
  required: boolean;
  state: TaskState;
  blocker?: string;
  vetId: VetId | "office";
  when: DutyWhen;
  custom?: boolean;
};

export type Attendance = {
  personId: PersonId;
  status: AttendanceStatus;
  note?: string;
};

export type DayPlan = {
  date: string;
  status: DayStatus;
  assignments: Assignment[];
  warnings: Warning[];
  attendance: Attendance[];
  tasks: Task[];
  doctorWork: Record<VetId, DoctorWork>;
  officeId: PersonId | null;
  onCallIds: PersonId[];
  offIds: PersonId[];
};

export type CalendarInfo = {
  id: string;
  name: string;
  primary: boolean;
};

export type RosterDay = {
  date: string;
  personIds: PersonId[];
};
