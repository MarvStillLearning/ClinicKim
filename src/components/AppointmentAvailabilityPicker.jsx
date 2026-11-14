import { appointmentDateKey, appointmentDateLabel } from "../lib/format";

function currentManilaHour() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  return Number(parts.find((part) => part.type === "hour")?.value || 0);
}

function hourLabel(value) {
  const hour = Number(value.slice(0, 2));
  const formatHour = (number) => `${number % 12 || 12}:00 ${number < 12 ? "AM" : "PM"}`;
  return `${formatHour(hour)} – ${formatHour(hour + 1)}`;
}

export default function AppointmentAvailabilityPicker({
  dates,
  doctors,
  times = [],
  selectedDate,
  selectedDoctor,
  selectedTime,
  loading,
  onDateChange,
  onDoctorChange,
  onTimeChange,
}) {
  const today = appointmentDateKey(new Date());
  const nowHour = selectedDate === today ? currentManilaHour() : -1;

  return (
    <>
      <label>Available date
        <select value={selectedDate} onChange={(event) => onDateChange(event.target.value)} required>
          <option value="">Select an available date...</option>
          {dates.map((date) => <option key={date} value={date}>{appointmentDateLabel(`${date}T12:00:00+08:00`)}</option>)}
        </select>
      </label>
      <label>Doctor
        <select value={selectedDoctor} onChange={(event) => onDoctorChange(event.target.value)} disabled={!selectedDate || loading} required>
          <option value="">{loading ? "Loading available doctors..." : "Select an available doctor..."}</option>
          {doctors.map((doctor) => <option key={doctor} value={doctor}>{doctor}</option>)}
        </select>
      </label>
      <label>Available hour (8:00 AM–4:00 PM)
        <select
          value={selectedTime}
          onChange={(event) => onTimeChange(event.target.value)}
          disabled={!selectedDate || !selectedDoctor || loading || times.length === 0}
          required
        >
          <option value="">
            {!selectedDoctor ? "Select a doctor first..." : times.length === 0 ? "No hours available" : "Select an available hour..."}
          </option>
          {times.map(({ available_time: time, remaining_slots: remaining }) => {
            const hour = Number(time.slice(0, 2));
            const count = selectedDate === today && hour <= nowHour ? 0 : Number(remaining);
            return (
              <option key={time} value={time} disabled={count <= 0}>
                {hourLabel(time)} ({count <= 0 ? "FULL" : `${count} slot${count === 1 ? "" : "s"} left`})
              </option>
            );
          })}
        </select>
      </label>
    </>
  );
}
