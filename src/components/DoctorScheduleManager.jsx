import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "../supabaseClient";
import { appointmentDateKey, appointmentDateLabel } from "../lib/format";
import Modal from "./Modal";

const LOCATIONS = ["Sta. Ana, Cagayan", "Gattaran, Cagayan"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const emptyForm = {
  doctor: "Monique Nolasco - Pet",
  location: LOCATIONS[0],
};

function dateKeyFromUtc(date) {
  return date.toISOString().slice(0, 10);
}

function calendarMonthLabel(month) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(month);
}

function calendarDays(month) {
  const firstDay = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
  const offset = (firstDay.getUTCDay() + 6) % 7;
  const dayCount = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  const cellCount = Math.ceil((offset + dayCount) / 7) * 7;

  return Array.from({ length: cellCount }, (_, index) => {
    const day = index - offset + 1;
    if (day < 1 || day > dayCount) return null;
    return dateKeyFromUtc(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day)));
  });
}

export default function DoctorScheduleManager({ onBack }) {
  const [availableDates, setAvailableDates] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [selectedDates, setSelectedDates] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = appointmentDateKey(new Date());
    return new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const today = appointmentDateKey(new Date());

  async function loadSchedule() {
    setLoading(true);
    setMessage("");
    const { data, error } = await supabase
      .from("doctor_schedule_dates")
      .select("*")
      .order("available_date")
      .order("doctor");
    if (error) setMessage(error.message);
    else setAvailableDates(data || []);
    setLoading(false);
  }

  useEffect(() => { loadSchedule(); }, []);

  function toggleDate(date) {
    setSelectedDates((current) => current.includes(date)
      ? current.filter((value) => value !== date)
      : [...current, date].sort());
  }

  function openCalendar() {
    setSelectedDates(availableDates
      .filter((item) => item.doctor === form.doctor.trim() && item.location === form.location)
      .map((item) => item.available_date));
    setCalendarOpen(true);
  }

  async function saveDates() {
    if (!form.doctor.trim()) {
      setMessage("Enter the doctor's name.");
      return;
    }

    setSaving(true);
    setMessage("");
    const allCurrentDates = availableDates.filter((item) =>
      item.doctor === form.doctor.trim()
      && item.location === form.location
    );
    const currentDates = availableDates.filter((item) =>
      item.doctor === form.doctor.trim()
      && item.location === form.location
      && item.available_date >= today
    );
    const datesToRemove = currentDates.filter((item) => !selectedDates.includes(item.available_date));
    const rows = selectedDates
      .filter((available_date) => !allCurrentDates.some((item) => item.available_date === available_date))
      .map((available_date) => ({
        ...form,
        available_date,
        available_from: "08:00:00",
        available_until: "17:00:00",
      }));
    if (rows.length > 0) {
      const { error } = await supabase
        .from("doctor_schedule_dates")
        .upsert(rows, {
          onConflict: "doctor,location,available_date",
          ignoreDuplicates: true,
        });
      if (error) {
        setMessage(error.message);
        setSaving(false);
        return;
      }
    }
    if (datesToRemove.length > 0) {
      const { error } = await supabase
        .from("doctor_schedule_dates")
        .delete()
        .in("id", datesToRemove.map((item) => item.id));
      if (error) {
        setMessage(error.message);
        setSaving(false);
        return;
      }
    }
    setSelectedDates([]);
    setCalendarOpen(false);
    await loadSchedule();
    setSaving(false);
  }

  async function removeDate(date) {
    if (!window.confirm(`Remove availability for ${appointmentDateLabel(`${date.available_date}T12:00:00+08:00`)}?`)) return;
    setSaving(true);
    setMessage("");
    const { error } = await supabase.from("doctor_schedule_dates").delete().eq("id", date.id);
    if (error) setMessage(error.message);
    else await loadSchedule();
    setSaving(false);
  }

  const currentAvailableDates = availableDates
    .filter((item) => item.doctor === form.doctor.trim() && item.location === form.location)
    .map((item) => item.available_date);
  const hasChanges = selectedDates.some((date) => !currentAvailableDates.includes(date))
    || currentAvailableDates.some((date) => date >= today && !selectedDates.includes(date));
  const datesInCalendar = calendarDays(calendarMonth);

  return (
    <section className="card">
      <div className="page-header">
        <div>
          <h1>Manage doctor schedule</h1>
          <p className="muted">Select available dates on the calendar. The doctor is available from 8:00 AM to 5:00 PM.</p>
        </div>
        {onBack && <button className="btn" type="button" onClick={onBack}>Back to appointments</button>}
      </div>
      {message && <p className="error">{message}</p>}

      <div className="schedule-setup">
        <label className="schedule-field">Doctor
          <input maxLength={100} value={form.doctor} onChange={(event) => setForm({ ...form, doctor: event.target.value })} required />
        </label>
        <label className="schedule-field">Clinic location
          <select value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })}>
            {LOCATIONS.map((location) => <option key={location}>{location}</option>)}
          </select>
        </label>
        <div className="schedule-hours">
          <span className="schedule-hours-label">Standard hours</span>
          <strong>8:00 AM – 5:00 PM</strong>
        </div>
        <button className="btn primary schedule-manage-btn" type="button" onClick={openCalendar}>
          Manage available dates
        </button>
      </div>

      {loading ? <p className="muted">Loading doctor availability...</p> : availableDates.length === 0 ? (
        <p className="muted">No available dates yet. Select dates on the calendar to make them available for patient bookings.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Doctor</th><th>Location</th><th>Available date</th><th>Available hours</th><th className="right">Action</th></tr></thead>
            <tbody>{availableDates.map((date) => (
              <tr key={date.id}>
                <td>{date.doctor}</td>
                <td>{date.location}</td>
                <td>{appointmentDateLabel(`${date.available_date}T12:00:00+08:00`)}</td>
                <td>8:00 AM – 5:00 PM</td>
                <td className="right">
                  <button className="btn small danger" type="button" disabled={saving} onClick={() => removeDate(date)}>Remove</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      <Modal title="Select available dates" open={calendarOpen} onClose={() => setCalendarOpen(false)} className="schedule-calendar-modal">
        <p className="muted">Check each date when the doctor is available. Saturday and Sunday can also be selected. Uncheck dates to remove availability.</p>
        <div className="calendar-month-nav">
          <button
            type="button"
            className="btn"
            aria-label="Previous month"
            onClick={() => setCalendarMonth(new Date(Date.UTC(calendarMonth.getUTCFullYear(), calendarMonth.getUTCMonth() - 1, 1)))}
            disabled={dateKeyFromUtc(calendarMonth) <= `${today.slice(0, 7)}-01`}
          >
            <ChevronLeft size={18} />
          </button>
          <h3>{calendarMonthLabel(calendarMonth)}</h3>
          <button
            type="button"
            className="btn"
            aria-label="Next month"
            onClick={() => setCalendarMonth(new Date(Date.UTC(calendarMonth.getUTCFullYear(), calendarMonth.getUTCMonth() + 1, 1)))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="availability-calendar" role="group" aria-label="Available dates">
          {WEEKDAYS.map((day) => <span className="availability-calendar-weekday" key={day}>{day}</span>)}
          {datesInCalendar.map((date, index) => {
            if (!date) return <span className="availability-calendar-empty" key={`empty-${index}`} />;
            const alreadyAvailable = availableDates.some((item) =>
              item.doctor === form.doctor.trim()
                && item.location === form.location
                && item.available_date === date
            );
            const disabled = date < today;
            return (
              <label className={`availability-calendar-day${disabled ? " disabled" : ""}`} key={date}>
                <input
                  type="checkbox"
                  checked={selectedDates.includes(date) || (disabled && alreadyAvailable)}
                  disabled={disabled}
                  onChange={() => toggleDate(date)}
                />
                <span>{Number(date.slice(-2))}</span>
              </label>
            );
          })}
        </div>
        <p className="muted">{selectedDates.length} date(s) selected · 8:00 AM–5:00 PM</p>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={() => setCalendarOpen(false)}>Cancel</button>
          <button type="button" className="btn primary" disabled={saving || !hasChanges} onClick={saveDates}>
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </Modal>
    </section>
  );
}
