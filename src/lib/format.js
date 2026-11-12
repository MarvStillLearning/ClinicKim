// Small helper functions used by many pages.
export const CLINIC_NAME = "ClinicKim"; // <-- change this to your clinic's name

export const peso = (n) =>
  "₱" + Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const dateTime = (d) =>
  new Date(d).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });

export const appointmentDateKey = (value) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};

export const appointmentDateLabel = (value) =>
  new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeZone: "Asia/Manila",
  }).format(new Date(value));

export const appointmentDateTime = (value) =>
  new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));

export const appointmentDateTimeLocal = (value) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
};

export const appointmentDateTimeTimestamp = (dateTime) =>
  new Date(`${dateTime}:00+08:00`).toISOString();

export const appointmentDateBoundary = (date) =>
  new Date(`${date}T00:00:00+08:00`).toISOString();

export const nextAppointmentDateKey = (date) => {
  const nextDate = new Date(`${date}T12:00:00+08:00`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  return appointmentDateKey(nextDate);
};

export function ageFrom(birthdate) {
  if (!birthdate) return "";
  const diff = Date.now() - new Date(birthdate).getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

export const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
