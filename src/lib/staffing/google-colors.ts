import { PRACTICE_CALENDAR_ID, mapPracticeEvents, type RawCalendarEvent } from "./calendar-map";
import { useStaffing, weekRange } from "./store";

export const TECH_CALENDAR_CLIENT_ID =
  "1065328191178-pkfe03v77njrmdchd05i8hv5vtth53cj.apps.googleusercontent.com";

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
        };
      };
    };
  }
}

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-gis="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.dataset.gis = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Google sign-in"));
    document.head.appendChild(s);
  });
}

async function fetchColored(token: string): Promise<RawCalendarEvent[]> {
  const range = weekRange();
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(PRACTICE_CALENDAR_ID)}/events`,
  );
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "250");
  url.searchParams.set("timeMin", range.timeMin);
  url.searchParams.set("timeMax", range.timeMax);
  url.searchParams.set(
    "fields",
    "items(id,summary,description,location,start,end,status,colorId)",
  );
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Google would not return Appointments with colors.");
  const json = (await res.json()) as { items?: RawCalendarEvent[] };
  return json.items ?? [];
}

export async function signInForColors(): Promise<string> {
  await loadGis();
  const token = await new Promise<string>((resolve, reject) => {
    const client = window.google?.accounts.oauth2.initTokenClient({
      client_id: TECH_CALENDAR_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/calendar.readonly",
      callback: (resp) => {
        if (resp.access_token) resolve(resp.access_token);
        else reject(new Error(resp.error || "Sign-in was cancelled"));
      },
    });
    if (!client) {
      reject(new Error("Google sign-in is not available in this browser"));
      return;
    }
    client.requestAccessToken({ prompt: "consent" });
  });
  const events = await fetchColored(token);
  const mapped = mapPracticeEvents(events);
  useStaffing.getState().applyGoogle({
    ok: true,
    calendarId: PRACTICE_CALENDAR_ID,
    calendarName: "Appointments",
    calendars: useStaffing.getState().calendars,
    appointments: mapped.appointments,
    roster: mapped.roster,
    skipped: mapped.skipped,
    doctorOff: mapped.doctorOff,
  });
  const colored = mapped.appointments.filter((a) =>
    /peacock|flamingo|wisteria|banana|tomato|lavender/i.test(a.colorLabel),
  ).length;
  return colored
    ? `Colors on ${colored} stops`
    : "Signed in. If stops are still gray, add your Gmail as a test user on the OAuth consent screen.";
}
