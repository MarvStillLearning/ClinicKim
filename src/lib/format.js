// Small helper functions used by many pages.
export const CLINIC_NAME = "ClinicKim"; // <-- change this to your clinic's name

export const peso = (n) =>
  "₱" + Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const dateTime = (d) =>
  new Date(d).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });

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
