export type PersonId = "alejandro" | "becca" | "kaycee" | "alice" | "kate";
export type VetId = "weston" | "sidney" | "michaela";
export type Role = "primary" | "secondary" | "float" | "office";
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
export type ViewId = "plan" | "board" | "week" | "roster";
export type ServiceKind = "sports" | "surgery" | "field";
export type CalendarSource = "demo" | "google";

export type Person = {
  id: PersonId;
  name: string;
  short: string;
  kind: "primary-tech" | "support-tech" | "office";
  workdays: number[];
  notes: string;
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
  vetId: VetId;
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
