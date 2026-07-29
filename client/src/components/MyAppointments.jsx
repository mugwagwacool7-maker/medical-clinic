import { cancelAppointment } from '../api';
import styles from './MyAppointments.module.css';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function MyAppointments({ appointments, onCancel, showToast }) {
  const handleCancel = async (code) => {
    try {
      await cancelAppointment(code);
      onCancel(code);
      showToast('Appointment cancelled.');
    } catch (e) {
      showToast(e.message || 'Failed to cancel');
    }
  };

  return (
    <section id="my-appointments">
      <div className="wrap">
        <div className="section-head">
          <div className="eyebrow">Session bookings</div>
          <h2>My appointments</h2>
          <p>Appointments you've booked in this browser session appear here, with the option to cancel.</p>
        </div>
        <div id="appt-list-wrap">
          {appointments.length === 0 ? (
            <div className="empty-state">
              <h3>No appointments yet</h3>
              <p>Once you book a visit above, it'll show up here.</p>
            </div>
          ) : (
            <div className={styles.list}>
              {appointments.map((a) => (
                <div key={a.code} className={styles.row}>
                  <div className={styles.left}>
                    <div className={styles.svc}>
                      {a.service_name} <span className="mono" style={{ color: 'var(--muted)', fontWeight: 400, fontSize: '0.8rem' }}>· {a.code}</span>
                    </div>
                    <div className={styles.sub}>{a.doctor_name} · {a.patient_name} · {a.phone}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className={styles.time}>{formatDate(a.date)} · {a.time}</span>
                    <button className={styles.cancelBtn} onClick={() => handleCancel(a.code)}>Cancel</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
