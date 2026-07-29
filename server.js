const express = require('express');
const path = require('path');
const cors = require('cors');
const { getDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
  });
}

const db = getDb();

/* ──────────── HELPERS ──────────── */
function dayOffsetFromToday(dateStr) {
  const a = new Date(dateStr + 'T00:00:00');
  const b = new Date();
  b.setHours(0, 0, 0, 0);
  return Math.round((a - b) / 86400000);
}

function generateCode() {
  const last = db.prepare('SELECT code FROM appointments ORDER BY code DESC LIMIT 1').get();
  const num = last ? parseInt(last.code.replace('WB-', ''), 10) + 1 : 1001;
  return 'WB-' + num;
}

/* ──────────── SERVICES ──────────── */
app.get('/api/services', (req, res) => {
  const services = db.prepare('SELECT * FROM services ORDER BY id').all();
  res.json(services);
});

/* ──────────── DOCTORS ──────────── */
app.get('/api/doctors', (req, res) => {
  const doctors = db.prepare('SELECT * FROM doctors ORDER BY name').all();
  res.json(doctors);
});

/* ──────────── SLOTS ──────────── */
app.get('/api/slots', (req, res) => {
  const { date, doctorId } = req.query;
  if (!date || !doctorId) {
    return res.status(400).json({ error: 'date and doctorId are required' });
  }

  const allSlots = db.prepare('SELECT * FROM time_slots ORDER BY sort_order').all();
  const offset = dayOffsetFromToday(date);

  const blocked = new Set(
    db.prepare('SELECT slot_label FROM blocked_slots WHERE doctor_id = ? AND date = ?')
      .all(doctorId, date)
      .map(r => r.slot_label)
  );

  const slots = allSlots.map((slot, i) => {
    const taken = blocked.has(slot.label) || (i + offset) % 5 === 0;
    return { label: slot.label, taken, sort_order: slot.sort_order };
  });

  res.json(slots);
});

/* ──────────── APPOINTMENTS ──────────── */
app.post('/api/appointments', (req, res) => {
  const { serviceId, doctorId, date, time, patientName, phone, email, patientType, notes } = req.body;

  if (!serviceId || !doctorId || !date || !time || !patientName || !phone || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // validate service and doctor exist
  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
  const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(doctorId);
  if (!service) return res.status(400).json({ error: 'Invalid service' });
  if (!doctor) return res.status(400).json({ error: 'Invalid doctor' });

  // check slot availability
  const allSlots = db.prepare('SELECT * FROM time_slots ORDER BY sort_order').all();
  const slotIndex = allSlots.findIndex(s => s.label === time);
  const offset = dayOffsetFromToday(date);
  const slotTaken = (slotIndex + offset) % 5 === 0;
  const blocked = db.prepare('SELECT id FROM blocked_slots WHERE doctor_id = ? AND date = ? AND slot_label = ?').get(doctorId, date, time);

  if (slotTaken || blocked) {
    return res.status(409).json({ error: 'Time slot is no longer available' });
  }

  // check double-booking for same doctor/time
  const existing = db.prepare('SELECT code FROM appointments WHERE doctor_id = ? AND date = ? AND time = ?').get(doctorId, date, time);
  if (existing) {
    return res.status(409).json({ error: 'This slot is already booked' });
  }

  const code = generateCode();

  db.prepare(`
    INSERT INTO appointments (code, service_id, doctor_id, date, time, patient_name, phone, email, patient_type, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(code, serviceId, doctorId, date, time, patientName, phone, email, patientType || 'New patient', notes || '');

  res.status(201).json({
    code,
    service: service.name,
    doctor: doctor.name,
    date,
    time,
    patientName,
    phone,
    price: service.price,
  });
});

app.get('/api/appointments', (req, res) => {
  const { phone, email } = req.query;

  let query = `
    SELECT a.*, s.name as service_name, s.price, d.name as doctor_name
    FROM appointments a
    JOIN services s ON s.id = a.service_id
    JOIN doctors d ON d.id = a.doctor_id
  `;
  const params = [];

  if (phone) {
    query += ' WHERE a.phone = ?';
    params.push(phone);
  } else if (email) {
    query += ' WHERE a.email = ?';
    params.push(email);
  }

  query += ' ORDER BY a.created_at DESC';

  const appointments = db.prepare(query).all(...params);
  res.json(appointments);
});

app.delete('/api/appointments/:code', (req, res) => {
  const { code } = req.params;
  const existing = db.prepare('SELECT code FROM appointments WHERE code = ?').get(code);
  if (!existing) {
    return res.status(404).json({ error: 'Appointment not found' });
  }
  db.prepare('DELETE FROM appointments WHERE code = ?').run(code);
  res.json({ message: 'Appointment cancelled', code });
});

app.listen(PORT, () => {
  console.log(`Rhodes Dental backend running on http://localhost:${PORT}`);
});
