const API = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export async function apiGet(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `GET ${url} failed (${res.status})`);
  }
  return res.json();
}

export async function apiPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `POST ${url} failed (${res.status})`);
  }
  return res.json();
}

export async function apiDelete(url) {
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `DELETE ${url} failed (${res.status})`);
  }
  return res.json();
}

export async function fetchServices() {
  return apiGet(API + '/services');
}

export async function fetchDoctors() {
  return apiGet(API + '/doctors');
}

export async function fetchSlots(date, doctorId) {
  return apiGet(
    API + '/slots?date=' + encodeURIComponent(date) + '&doctorId=' + encodeURIComponent(doctorId),
  );
}

export async function createAppointment(data) {
  return apiPost(API + '/appointments', data);
}

export async function fetchAppointments() {
  return apiGet(API + '/appointments');
}

export async function cancelAppointment(code) {
  return apiDelete(API + '/appointments/' + code);
}
