const { neon } = require('@neondatabase/serverless');
const { Resend } = require('resend');

const services = [
  ['cleaning', 'PREVENTIVE', 'Routine Cleaning & Exam', 'A full checkup and polish to keep things on track.', '30 min', '$45'],
  ['whitening', 'COSMETIC', 'Teeth Whitening', 'In-office whitening for a noticeably brighter smile.', '60 min', '$120'],
  ['filling', 'RESTORATIVE', 'Cavity Filling', 'Comfortable, tooth-colored fillings for minor decay.', '45 min', '$80'],
  ['extraction', 'SURGICAL', 'Tooth Extraction', 'Safe removal with local anesthesia and aftercare guidance.', '45 min', '$95'],
  ['rootcanal', 'RESTORATIVE', 'Root Canal Therapy', 'Relieve pain and save the tooth in a single focused visit.', '90 min', '$260'],
  ['consult', 'GENERAL', 'New Patient Consultation', 'A first visit to assess your dental health and plan next steps.', '30 min', '$30'],
];

const doctors = [
  ['Finity', 'Dr. Finity', 'General & preventive care'],
  ['Mutenje', 'Dr. Mutenje', 'Cosmetic dentistry'],
  ['Gwenhamo', 'Dr. Gwenhamo', 'Oral surgery'],
  ['Moyo', 'Dr. Moyo', 'Endodontics (root canals)'],
];

const timeSlots = ['8:00 AM', '8:40 AM', '9:20 AM', '10:00 AM', '10:40 AM', '11:20 AM', '1:00 PM', '1:40 PM', '2:20 PM', '3:00 PM', '3:40 PM', '4:20 PM'];

let schemaPromise;

async function initializeDatabase(sql) {
  await Promise.all([
    sql`
      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        tag TEXT NOT NULL,
        name TEXT NOT NULL,
        "desc" TEXT NOT NULL,
        duration TEXT NOT NULL,
        price TEXT NOT NULL
      )
    `,
    sql`
      CREATE TABLE IF NOT EXISTS doctors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        focus TEXT NOT NULL
      )
    `,
    sql`
      CREATE TABLE IF NOT EXISTS time_slots (
        id SERIAL PRIMARY KEY,
        label TEXT NOT NULL UNIQUE,
        sort_order INTEGER NOT NULL
      )
    `,
  ]);
  await Promise.all([
    sql`
      CREATE TABLE IF NOT EXISTS appointments (
        code TEXT PRIMARY KEY,
        service_id TEXT NOT NULL REFERENCES services(id),
        doctor_id TEXT NOT NULL REFERENCES doctors(id),
        date DATE NOT NULL,
        time TEXT NOT NULL,
        patient_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL,
        patient_type TEXT NOT NULL DEFAULT 'New patient',
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (doctor_id, date, time)
      )
    `,
    sql`
      CREATE TABLE IF NOT EXISTS blocked_slots (
        id SERIAL PRIMARY KEY,
        doctor_id TEXT NOT NULL REFERENCES doctors(id),
        date DATE NOT NULL,
        slot_label TEXT NOT NULL
      )
    `,
  ]);
  await sql`CREATE SEQUENCE IF NOT EXISTS appointment_code_seq START WITH 1001`;

  await Promise.all([
    ...services.map((service) => sql`
      INSERT INTO services (id, tag, name, "desc", duration, price)
      VALUES (${service[0]}, ${service[1]}, ${service[2]}, ${service[3]}, ${service[4]}, ${service[5]})
      ON CONFLICT (id) DO NOTHING
    `),
    ...doctors.map((doctor) => sql`
      INSERT INTO doctors (id, name, focus)
      VALUES (${doctor[0]}, ${doctor[1]}, ${doctor[2]})
      ON CONFLICT (id) DO NOTHING
    `),
    ...timeSlots.map((label, index) => sql`
      INSERT INTO time_slots (label, sort_order)
      VALUES (${label}, ${index})
      ON CONFLICT (label) DO NOTHING
    `),
  ]);
}

function getDatabase() {
  if (!process.env.DATABASE_URL) {
    const error = new Error('DATABASE_URL is not configured');
    error.statusCode = 503;
    throw error;
  }

  return neon(process.env.DATABASE_URL);
}

function ensureDatabase(sql) {
  if (!schemaPromise) {
    schemaPromise = initializeDatabase(sql).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

function dayOffsetFromToday(dateString) {
  const requested = Date.parse(`${dateString}T00:00:00Z`);
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((requested - todayUtc) / 86400000);
}

function isValidDate(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === dateString;
}

function sendConfirmationEmail({ to, code, service, doctor, date, time, patientName, price }) {
  if (!process.env.RESEND_API_KEY) return;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
  const details = [
    ['Reference Code', code],
    ['Service', service],
    ['Doctor', doctor],
    ['Date', date],
    ['Time', time],
    ['Price', price],
  ];
  const rows = details.map(([label, value]) =>
    `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`
  ).join('');

  return resend.emails.send({
    from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
    to,
    subject: `Appointment Confirmed - ${code}`,
    html: `<div style="font-family:Arial,sans-serif"><h1>Rhodes Dental</h1><p>Hi ${escapeHtml(patientName)}, your appointment is confirmed.</p><table>${rows}</table></div>`,
  });
}

function respond(res, status, body) {
  return res.status(status).json(body);
}

async function handleRequest(req, res, sql) {
  const requestUrl = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const route = requestUrl.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');

  if (req.method === 'GET' && route === 'services') {
    return respond(res, 200, await sql`SELECT * FROM services ORDER BY id`);
  }

  if (req.method === 'GET' && route === 'doctors') {
    return respond(res, 200, await sql`SELECT * FROM doctors ORDER BY name`);
  }

  if (req.method === 'GET' && route === 'slots') {
    const date = requestUrl.searchParams.get('date');
    const doctorId = requestUrl.searchParams.get('doctorId');
    if (!date || !doctorId || !isValidDate(date)) {
      return respond(res, 400, { error: 'A valid date and doctorId are required' });
    }

    const slots = await sql`SELECT * FROM time_slots ORDER BY sort_order`;
    const blocked = await sql`
      SELECT slot_label FROM blocked_slots WHERE doctor_id = ${doctorId} AND date = ${date}
    `;
    const booked = await sql`
      SELECT time FROM appointments WHERE doctor_id = ${doctorId} AND date = ${date}
    `;
    const unavailable = new Set([
      ...blocked.map((slot) => slot.slot_label),
      ...booked.map((appointment) => appointment.time),
    ]);
    const offset = dayOffsetFromToday(date);

    return respond(res, 200, slots.map((slot, index) => ({
      label: slot.label,
      taken: unavailable.has(slot.label) || (index + offset) % 5 === 0,
      sort_order: slot.sort_order,
    })));
  }

  if (req.method === 'POST' && route === 'appointments') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { serviceId, doctorId, date, time, patientName, phone, email, patientType, notes } = body;
    if (!serviceId || !doctorId || !date || !time || !patientName || !phone || !email) {
      return respond(res, 400, { error: 'Missing required fields' });
    }
    if (!isValidDate(date)) {
      return respond(res, 400, { error: 'Invalid appointment date' });
    }

    const [service] = await sql`SELECT * FROM services WHERE id = ${serviceId}`;
    const [doctor] = await sql`SELECT * FROM doctors WHERE id = ${doctorId}`;
    if (!service) return respond(res, 400, { error: 'Invalid service' });
    if (!doctor) return respond(res, 400, { error: 'Invalid doctor' });

    const slots = await sql`SELECT label FROM time_slots ORDER BY sort_order`;
    const slotIndex = slots.findIndex((slot) => slot.label === time);
    if (slotIndex === -1) return respond(res, 400, { error: 'Invalid time slot' });

    const offset = dayOffsetFromToday(date);
    const [blocked] = await sql`
      SELECT id FROM blocked_slots
      WHERE doctor_id = ${doctorId} AND date = ${date} AND slot_label = ${time}
    `;
    const [existing] = await sql`
      SELECT code FROM appointments WHERE doctor_id = ${doctorId} AND date = ${date} AND time = ${time}
    `;
    if ((slotIndex + offset) % 5 === 0 || blocked || existing) {
      return respond(res, 409, { error: 'Time slot is no longer available' });
    }

    const [sequence] = await sql`SELECT nextval('appointment_code_seq') AS number`;
    const code = `WB-${sequence.number}`;
    try {
      await sql`
        INSERT INTO appointments
          (code, service_id, doctor_id, date, time, patient_name, phone, email, patient_type, notes)
        VALUES
          (${code}, ${serviceId}, ${doctorId}, ${date}, ${time}, ${patientName}, ${phone}, ${email},
           ${patientType || 'New patient'}, ${notes || ''})
      `;
    } catch (error) {
      if (error.code === '23505') {
        return respond(res, 409, { error: 'Time slot is no longer available' });
      }
      throw error;
    }

    const response = {
      code,
      service: service.name,
      doctor: doctor.name,
      date,
      time,
      patientName,
      phone,
      price: service.price,
    };
    try {
      await sendConfirmationEmail({
        to: email,
        code,
        service: service.name,
        doctor: doctor.name,
        date,
        time,
        patientName,
        price: service.price,
      });
    } catch (error) {
      console.error('Failed to send appointment confirmation email:', error);
    }
    return respond(res, 201, response);
  }

  if (req.method === 'GET' && route === 'appointments') {
    const phone = requestUrl.searchParams.get('phone');
    const email = requestUrl.searchParams.get('email');
    let appointments;
    if (phone) {
      appointments = await sql`
        SELECT a.*, s.name AS service_name, s.price, d.name AS doctor_name
        FROM appointments a
        JOIN services s ON s.id = a.service_id
        JOIN doctors d ON d.id = a.doctor_id
        WHERE a.phone = ${phone}
        ORDER BY a.created_at DESC
      `;
    } else if (email) {
      appointments = await sql`
        SELECT a.*, s.name AS service_name, s.price, d.name AS doctor_name
        FROM appointments a
        JOIN services s ON s.id = a.service_id
        JOIN doctors d ON d.id = a.doctor_id
        WHERE a.email = ${email}
        ORDER BY a.created_at DESC
      `;
    } else {
      appointments = await sql`
        SELECT a.*, s.name AS service_name, s.price, d.name AS doctor_name
        FROM appointments a
        JOIN services s ON s.id = a.service_id
        JOIN doctors d ON d.id = a.doctor_id
        ORDER BY a.created_at DESC
      `;
    }
    return respond(res, 200, appointments);
  }

  const appointmentMatch = route.match(/^appointments\/([^/]+)$/);
  if (req.method === 'DELETE' && appointmentMatch) {
    const code = decodeURIComponent(appointmentMatch[1]);
    const [appointment] = await sql`SELECT code FROM appointments WHERE code = ${code}`;
    if (!appointment) return respond(res, 404, { error: 'Appointment not found' });
    await sql`DELETE FROM appointments WHERE code = ${code}`;
    return respond(res, 200, { message: 'Appointment cancelled', code });
  }

  if (route.startsWith('appointments') || route === 'services' || route === 'doctors' || route === 'slots') {
    res.setHeader('Allow', route === 'appointments' ? 'GET, POST' : 'GET, DELETE');
    return respond(res, 405, { error: 'Method not allowed' });
  }

  return respond(res, 404, { error: 'API route not found' });
}

module.exports = async function apiHandler(req, res) {
  let sql;
  try {
    sql = getDatabase();
    await ensureDatabase(sql);
  } catch (error) {
    console.error('Failed to initialize the appointments database:', error);
    return respond(res, error.statusCode || 500, {
      error: error.statusCode === 503
        ? 'The appointments database is not configured. Set DATABASE_URL in Vercel.'
        : 'The appointments database is unavailable.',
    });
  }

  try {
    return await handleRequest(req, res, sql);
  } catch (error) {
    console.error('Vercel API request failed:', error);
    return respond(res, 500, { error: 'The request could not be completed. Please try again.' });
  }
};
