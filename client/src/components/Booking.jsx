import { useState, useEffect, useCallback } from 'react';
import { fetchSlots as apiFetchSlots, createAppointment } from '../api';
import styles from './Booking.module.css';

const STEP_LABELS = ['Service', 'Date & time', 'Your details', 'Confirm'];
const FALLBACK_SLOTS = [
  '8:00 AM','8:40 AM','9:20 AM','10:00 AM','10:40 AM',
  '11:20 AM','1:00 PM','1:40 PM','2:20 PM','3:00 PM','3:40 PM','4:20 PM',
];

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayOffsetFromToday(dateStr) {
  const a = new Date(dateStr + 'T00:00:00');
  const b = new Date();
  b.setHours(0, 0, 0, 0);
  return Math.round((a - b) / 86400000);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function Booking({ services, doctors, preselectedService, onAppointmentBooked, showToast }) {
  const [step, setStep] = useState(1);
  const [booking, setBooking] = useState({
    serviceId: preselectedService,
    doctorId: null,
    date: todayStr(),
    time: null,
    name: '',
    phone: '',
    email: '',
    patientType: 'New patient',
    notes: '',
  });
  const [timeSlots, setTimeSlots] = useState([]);
  const [errors, setErrors] = useState({ 1: false, 2: false, 3: false });
  const [confirmData, setConfirmData] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchSlotsForDate = useCallback(async (date, doctorId) => {
    if (!doctorId) return;
    try {
      const slots = await apiFetchSlots(date, doctorId);
      setTimeSlots(slots);
    } catch {
      const offset = dayOffsetFromToday(date);
      const localSlots = FALLBACK_SLOTS.map((label, i) => ({
        label, taken: (i + offset) % 5 === 0, sort_order: i,
      }));
      setTimeSlots(localSlots);
    }
  }, []);

  useEffect(() => {
    fetchSlotsForDate(booking.date, booking.doctorId);
  }, [booking.date, booking.doctorId, fetchSlotsForDate]);

  const serviceById = (id) => services.find((s) => s.id === id);
  const doctorById = (id) => doctors.find((d) => d.id === id);

  const pickService = (id) => {
    setBooking((prev) => ({ ...prev, serviceId: id }));
    setErrors((prev) => ({ ...prev, 1: false }));
  };

  const pickDoctor = (id) => {
    setBooking((prev) => ({ ...prev, doctorId: id, time: null }));
    setErrors((prev) => ({ ...prev, 2: false }));
  };

  const pickTime = (label) => {
    setBooking((prev) => ({ ...prev, time: label }));
    setErrors((prev) => ({ ...prev, 2: false }));
  };

  const scrollToBook = () => {
    setTimeout(() => {
      document.getElementById('book')?.scrollIntoView({ block: 'start' });
    }, 0);
  };

  const goStep = (n) => {
    if (n === 2 && !booking.serviceId) {
      setErrors((prev) => ({ ...prev, 1: true }));
      return;
    }
    if (n === 3 && (!booking.doctorId || !booking.date || !booking.time)) {
      setErrors((prev) => ({ ...prev, 2: true }));
      return;
    }
    if (n === 4) {
      if (!booking.name.trim() || !booking.phone.trim() || !booking.email.trim()) {
        setErrors((prev) => ({ ...prev, 3: true }));
        return;
      }
    }
    setStep(n);
    scrollToBook();
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const result = await createAppointment({
        serviceId: booking.serviceId,
        doctorId: booking.doctorId,
        date: booking.date,
        time: booking.time,
        patientName: booking.name,
        phone: booking.phone,
        email: booking.email,
        patientType: booking.patientType,
        notes: booking.notes,
      });
      setConfirmData(result);
      setStep(5);
      onAppointmentBooked();
    } catch (e) {
      showToast(e.message || 'Failed to book appointment');
    } finally {
      setSubmitting(false);
    }
  };

  const renderSteps = () => {
    if (step > 4) return null;
    return (
      <div className={styles.steps}>
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          let cls = styles.step;
          if (n < step) cls += ` ${styles.done}`;
          if (n === step) cls += ` ${styles.active}`;
          return (
            <div key={n} className={cls}>
              <span className={styles.stepnum}>{n}</span>{label}
            </div>
          );
        })}
      </div>
    );
  };

  const renderSlotsGrid = () => {
    return (
      <div className={styles.slotGrid}>
        {timeSlots.map((s) => {
          const selected = booking.time === s.label && !s.taken;
          return (
            <button
              key={s.label}
              type="button"
              className={`mono ${styles.slot} ${s.taken ? styles.taken : ''} ${selected ? styles.selected : ''}`}
              disabled={s.taken}
              onClick={() => pickTime(s.label)}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <section id="book" className={styles.bookSection}>
      <div className="wrap">
        <div className="section-head">
          <div className="eyebrow">Schedule a visit</div>
          <h2>Book your appointment</h2>
          <p>Four quick steps. Your details are securely sent to our server to confirm your appointment.</p>
        </div>

        <div className={styles.shell}>
          {renderSteps()}

          {step === 1 && (
            <div className={`${styles.panel} ${styles.active}`}>
              <h3 className={styles.panelTitle}>Choose a service</h3>
              <div className={styles.optionGrid}>
                {services.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`${styles.optionCard} ${booking.serviceId === s.id ? styles.selected : ''}`}
                    onClick={() => pickService(s.id)}
                  >
                    <div className={styles.ocTitle}>{s.name}</div>
                    <div className={styles.ocSub}>{s.duration} · {s.price}</div>
                  </button>
                ))}
              </div>
              {errors[1] && <div className={styles.err}>Please select a service to continue.</div>}
              <div className={styles.panelNav}>
                <span></span>
                <button className="btn-primary" onClick={() => goStep(2)}>Continue</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className={`${styles.panel} ${styles.active}`}>
              <h3 className={styles.panelTitle}>Choose a dentist</h3>
              <div className={styles.optionGrid}>
                {doctors.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className={`${styles.optionCard} ${styles.doctorCard} ${booking.doctorId === d.id ? styles.selected : ''}`}
                    onClick={() => pickDoctor(d.id)}
                  >
                    <div className={styles.docAvatar}>{d.name.split(' ')[1]?.[0] || d.name[0]}</div>
                    <div>
                      <div className={styles.ocTitle}>{d.name}</div>
                      <div className={styles.ocSub}>{d.focus}</div>
                    </div>
                  </button>
                ))}
              </div>

              <h3 className={styles.sectionTitle}>Pick a date</h3>
              <div className={styles.dateFieldWrap}>
                <div>
                  <label htmlFor="date-input">Appointment date</label>
                  <input
                    type="date"
                    id="date-input"
                    value={booking.date}
                    min={todayStr()}
                    onChange={(e) => {
                      setBooking((prev) => ({ ...prev, date: e.target.value, time: null }));
                      setErrors((prev) => ({ ...prev, 2: false }));
                    }}
                  />
                </div>
              </div>

              <h3 className={styles.sectionTitle}>Available times</h3>
              {renderSlotsGrid()}
              {errors[2] && <div className={styles.err}>Please select a dentist, date, and time slot.</div>}

              <div className={styles.panelNav}>
                <button className="btn-ghost" onClick={() => setStep(1)}>Back</button>
                <button className="btn-primary" onClick={() => goStep(3)}>Continue</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className={`${styles.panel} ${styles.active}`}>
              <h3 className={styles.panelTitle}>Your details</h3>
              <div className={styles.fieldRow}>
                <div>
                  <label htmlFor="name-input">Full name</label>
                  <input
                    type="text"
                    id="name-input"
                    placeholder="e.g. Tendai Moyo"
                    value={booking.name}
                    onChange={(e) => setBooking((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label htmlFor="phone-input">Phone number</label>
                  <input
                    type="tel"
                    id="phone-input"
                    placeholder="e.g. 077 123 4567"
                    value={booking.phone}
                    onChange={(e) => setBooking((prev) => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
              </div>
              <div className={styles.fieldRow}>
                <div>
                  <label htmlFor="email-input">Email</label>
                  <input
                    type="email"
                    id="email-input"
                    placeholder="you@example.com"
                    value={booking.email}
                    onChange={(e) => setBooking((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label htmlFor="patient-type">Patient type</label>
                  <select
                    id="patient-type"
                    value={booking.patientType}
                    onChange={(e) => setBooking((prev) => ({ ...prev, patientType: e.target.value }))}
                  >
                    <option>New patient</option>
                    <option>Returning patient</option>
                  </select>
                </div>
              </div>
              <label htmlFor="notes-input">Notes for the dentist (optional)</label>
              <textarea
                id="notes-input"
                placeholder="Any symptoms, concerns, or accessibility needs..."
                value={booking.notes}
                onChange={(e) => setBooking((prev) => ({ ...prev, notes: e.target.value }))}
              />
              {errors[3] && <div className={styles.err}>Please fill in your name, phone, and email.</div>}

              <div className={styles.panelNav}>
                <button className="btn-ghost" onClick={() => setStep(2)}>Back</button>
                <button className="btn-primary" onClick={() => goStep(4)}>Review booking</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className={`${styles.panel} ${styles.active}`}>
              <h3 className={styles.panelTitle}>Review &amp; confirm</h3>
              <div className={styles.summaryBox}>
                <div className="summary-row"><span className="k">Service</span><span className="v">{serviceById(booking.serviceId)?.name} ({serviceById(booking.serviceId)?.duration})</span></div>
                <div className="summary-row"><span className="k">Dentist</span><span className="v">{doctorById(booking.doctorId)?.name}</span></div>
                <div className="summary-row"><span className="k">Date</span><span className="v">{formatDate(booking.date)}</span></div>
                <div className="summary-row"><span className="k">Time</span><span className="v">{booking.time}</span></div>
                <div className="summary-row"><span className="k">Patient</span><span className="v">{booking.name} · {booking.patientType}</span></div>
                <div className="summary-row"><span className="k">Contact</span><span className="v">{booking.phone} · {booking.email}</span></div>
                <div className="summary-row"><span className="k">Estimated cost</span><span className="v">{serviceById(booking.serviceId)?.price}</span></div>
              </div>
              <div className={styles.panelNav}>
                <button className="btn-ghost" onClick={() => setStep(3)}>Back</button>
                <button className="btn-primary" onClick={handleConfirm} disabled={submitting}>
                  {submitting ? 'Booking...' : 'Confirm appointment'}
                </button>
              </div>
            </div>
          )}

          {step === 5 && confirmData && (
            <div className={`${styles.panel} ${styles.active}`}>
              <div className={styles.confirmWrap}>
                <div className={`ticket ${styles.confirmTicket}`}>
                  <div className="ticket-top" style={{ textAlign: 'center' }}>
                    <div className={styles.checkCircle}>✓</div>
                    <h3 className={styles.confirmTitle}>You're booked in</h3>
                    <p className={styles.confirmSub}>
                      A confirmation has been added under "My appointments" below.
                    </p>
                    <div className={styles.codeBlock}>{confirmData.code}</div>
                  </div>
                  <div className="perf"></div>
                  <div className="ticket-bottom">
                    <div className="summary-row"><span className="k">Service</span><span className="v">{confirmData.service}</span></div>
                    <div className="summary-row"><span className="k">Dentist</span><span className="v">{confirmData.doctor}</span></div>
                    <div className="summary-row"><span className="k">When</span><span className="v">{formatDate(confirmData.date)} · {confirmData.time}</span></div>
                  </div>
                </div>
              </div>
              <div className={styles.panelNavCentered}>
                <button className="btn-primary" onClick={() => document.getElementById('my-appointments')?.scrollIntoView()}>
                  View my appointments
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
