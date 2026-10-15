// Shared handler for Vercel projects rooted at the repository or client directory.
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

let supabase;

function getClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    const error = new Error('Supabase is not configured');
    error.statusCode = 503;
    throw error;
  }

  if (!supabase) {
    supabase = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabase;
}

function unwrap({ data, error }, context) {
  if (error) {
    const wrapped = new Error(`${context} failed: ${error.message}`);
    wrapped.code = error.code;
    throw wrapped;
  }
  return data;
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

function flattenAppointment(row) {
  const { services, doctors, ...rest } = row;
  return {
    ...rest,
    service_name: services?.name ?? null,
    price: services?.price ?? null,
    doctor_name: doctors?.name ?? null,
  };
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

async function handleRequest(req, res, db) {
  const requestUrl = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const route = requestUrl.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');

  if (req.method === 'GET' && route === 'services') {
    const services = unwrap(await db.from('services').select('*').order('id'), 'services');
    return respond(res, 200, services);
  }

  if (req.method === 'GET' && route === 'doctors') {
    const doctors = unwrap(await db.from('doctors').select('*').order('name'), 'doctors');
    return respond(res, 200, doctors);
  }

  if (req.method === 'GET' && route === 'slots') {
    const date = requestUrl.searchParams.get('date');
    const doctorId = requestUrl.searchParams.get('doctorId');
    if (!date || !doctorId || !isValidDate(date)) {
      return respond(res, 400, { error: 'A valid date and doctorId are required' });
    }

    const slots = unwrap(
      await db.from('time_slots').select('*').order('sort_order'),
      'time_slots',
    );
    const blocked = unwrap(
      await db.from('blocked_slots').select('slot_label').eq('doctor_id', doctorId).eq('date', date),
      'blocked_slots',
    );
    const booked = unwrap(
      await db.from('appointments').select('time').eq('doctor_id', doctorId).eq('date', date),
      'appointments',
    );
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

    const service = unwrap(
      await db.from('services').select('*').eq('id', serviceId).maybeSingle(),
      'services',
    );
    const doctor = unwrap(
      await db.from('doctors').select('*').eq('id', doctorId).maybeSingle(),
      'doctors',
    );
    if (!service) return respond(res, 400, { error: 'Invalid service' });
    if (!doctor) return respond(res, 400, { error: 'Invalid doctor' });

    const slots = unwrap(
      await db.from('time_slots').select('label').order('sort_order'),
      'time_slots',
    );
    const slotIndex = slots.findIndex((slot) => slot.label === time);
    if (slotIndex === -1) return respond(res, 400, { error: 'Invalid time slot' });

    const offset = dayOffsetFromToday(date);
    const blocked = unwrap(
      await db.from('blocked_slots').select('id')
        .eq('doctor_id', doctorId).eq('date', date).eq('slot_label', time)
        .maybeSingle(),
      'blocked_slots',
    );
    const existing = unwrap(
      await db.from('appointments').select('code')
        .eq('doctor_id', doctorId).eq('date', date).eq('time', time)
        .maybeSingle(),
      'appointments',
    );
    if ((slotIndex + offset) % 5 === 0 || blocked || existing) {
      return respond(res, 409, { error: 'Time slot is no longer available' });
    }

    const { data: inserted, error: insertError } = await db
      .from('appointments')
      .insert({
        service_id: serviceId,
        doctor_id: doctorId,
        date,
        time,
        patient_name: patientName,
        phone,
        email,
        patient_type: patientType || 'New patient',
        notes: notes || '',
      })
      .select('code')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return respond(res, 409, { error: 'Time slot is no longer available' });
      }
      throw new Error(`appointments insert failed: ${insertError.message}`);
    }

    const code = inserted.code;
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
    let query = db
      .from('appointments')
      .select('*, services(name, price), doctors(name)')
      .order('created_at', { ascending: false });
    if (phone) {
      query = query.eq('phone', phone);
    } else if (email) {
      query = query.eq('email', email);
    }
    const appointments = unwrap(await query, 'appointments');
    return respond(res, 200, appointments.map(flattenAppointment));
  }

  const appointmentMatch = route.match(/^appointments\/([^/]+)$/);
  if (req.method === 'DELETE' && appointmentMatch) {
    const code = decodeURIComponent(appointmentMatch[1]);
    const appointment = unwrap(
      await db.from('appointments').select('code').eq('code', code).maybeSingle(),
      'appointments',
    );
    if (!appointment) return respond(res, 404, { error: 'Appointment not found' });
    unwrap(await db.from('appointments').delete().eq('code', code), 'appointments delete');
    return respond(res, 200, { message: 'Appointment cancelled', code });
  }

  if (route.startsWith('appointments') || route === 'services' || route === 'doctors' || route === 'slots') {
    res.setHeader('Allow', route === 'appointments' ? 'GET, POST' : 'GET, DELETE');
    return respond(res, 405, { error: 'Method not allowed' });
  }

  return respond(res, 404, { error: 'API route not found' });
}

export default async function apiHandler(req, res) {
  let db;
  try {
    db = getClient();
  } catch (error) {
    console.error('Failed to initialize the Supabase client:', error);
    return respond(res, error.statusCode || 500, {
      error: error.statusCode === 503
        ? 'The appointments database is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.'
        : 'The appointments database is unavailable.',
    });
  }

  try {
    return await handleRequest(req, res, db);
  } catch (error) {
    console.error('Vercel API request failed:', error);
    return respond(res, 500, { error: 'The request could not be completed. Please try again.' });
  }
}
