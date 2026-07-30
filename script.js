const API = 'http://localhost:3000/api';

/* ============ STATE ============ */
let SERVICES = [];
let DOCTORS = [];
let TIME_SLOTS = [];
let booking = { serviceId:null, doctorId:null, date:null, time:null, name:'', phone:'', email:'', patientType:'New patient', notes:'' };
let appointments = [];

/* ============ FETCH HELPERS ============ */
async function apiGet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('GET ' + url + ' failed');
  return res.json();
}

async function apiPost(url, body) {
  const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    throw new Error(err.error || 'POST ' + url + ' failed');
  }
  return res.json();
}

async function apiDelete(url) {
  const res = await fetch(url, { method:'DELETE' });
  if (!res.ok) throw new Error('DELETE ' + url + ' failed');
  return res.json();
}

/* ============ INIT FETCH ============ */
async function loadData() {
  try {
    const [services, doctors] = await Promise.all([
      apiGet(API + '/services'),
      apiGet(API + '/doctors'),
    ]);
    SERVICES = services;
    DOCTORS = doctors;
    TIME_SLOTS = ['8:00 AM','8:40 AM','9:20 AM','10:00 AM','10:40 AM','11:20 AM','1:00 PM','1:40 PM','2:20 PM','3:00 PM','3:40 PM','4:20 PM'];
  } catch (e) {
    console.error('Failed to load data from API, using fallback', e);
    // fallback data so the UI still works offline
    SERVICES = [
      {id:'cleaning', tag:'PREVENTIVE', name:'Routine Cleaning & Exam', desc:'A full checkup and polish to keep things on track.', duration:'30 min', price:'$45'},
      {id:'whitening', tag:'COSMETIC', name:'Teeth Whitening', desc:'In-office whitening for a noticeably brighter smile.', duration:'60 min', price:'$120'},
      {id:'filling', tag:'RESTORATIVE', name:'Cavity Filling', desc:'Comfortable, tooth-colored fillings for minor decay.', duration:'45 min', price:'$80'},
      {id:'extraction', tag:'SURGICAL', name:'Tooth Extraction', desc:'Safe removal with local anesthesia and aftercare guidance.', duration:'45 min', price:'$95'},
      {id:'rootcanal', tag:'RESTORATIVE', name:'Root Canal Therapy', desc:'Relieve pain and save the tooth in a single focused visit.', duration:'90 min', price:'$260'},
      {id:'consult', tag:'GENERAL', name:'New Patient Consultation', desc:'A first visit to assess your dental health and plan next steps.', duration:'30 min', price:'$30'},
    ];
    DOCTORS = [
      {id:'Finity', name:'Dr. Finity', focus:'General & preventive care'},
      {id:'Mutenje', name:'Dr.  Mutenje', focus:'Cosmetic dentistry'},
      {id:'Gwenhamo', name:'Dr. Gwenhamo', focus:'Oral surgery'},
      {id:'Moyo', name:'Dr. Moyo', focus:'Endodontics (root canals)'},
    ];
    TIME_SLOTS = ['8:00 AM','8:40 AM','9:20 AM','10:00 AM','10:40 AM','11:20 AM','1:00 PM','1:40 PM','2:20 PM','3:00 PM','3:40 PM','4:20 PM'];
  }
  renderServices();
  renderServiceOptions();
  renderDoctorOptions();
  renderSlots();
}

/* ============ RENDER: services ============ */
function renderServices(){
  const grid = document.getElementById('services-grid');
  grid.innerHTML = SERVICES.map(s => `
    <div class="service-card">
      <div class="si">${s.tag}</div>
      <h3>${s.name}</h3>
      <p>${s.desc}</p>
      <div class="meta">
        <span>${s.duration}</span>
        <span>${s.price}</span>
      </div>
      <button class="btn-ghost" style="width:100%;margin-top:14px;" onclick="selectServiceAndScroll('${s.id}')">Book this</button>
    </div>
  `).join('');
}
function selectServiceAndScroll(id){
  booking.serviceId = id;
  renderServiceOptions();
  document.getElementById('book').scrollIntoView();
  goStep(1);
}

/* ============ RENDER: step 1 — service options ============ */
function renderServiceOptions(){
  const wrap = document.getElementById('service-options');
  wrap.innerHTML = SERVICES.map(s => `
    <button type="button" class="option-card ${booking.serviceId===s.id?'selected':''}" onclick="pickService('${s.id}')">
      <div class="oc-title">${s.name}</div>
      <div class="oc-sub">${s.duration} · ${s.price}</div>
    </button>
  `).join('');
}
function pickService(id){
  booking.serviceId = id;
  renderServiceOptions();
  document.getElementById('err-1').style.display='none';
}

/* ============ RENDER: step 2 — doctors + slots ============ */
function renderDoctorOptions(){
  const wrap = document.getElementById('doctor-options');
  wrap.innerHTML = DOCTORS.map(d => `
    <button type="button" class="option-card doctor-card ${booking.doctorId===d.id?'selected':''}" onclick="pickDoctor('${d.id}')">
      <div class="doc-avatar">${d.name.split(' ')[1][0]}</div>
      <div>
        <div class="oc-title">${d.name}</div>
        <div class="oc-sub">${d.focus}</div>
      </div>
    </button>
  `).join('');
}
function pickDoctor(id){
  booking.doctorId = id;
  renderDoctorOptions();
  document.getElementById('err-2').style.display='none';
  fetchSlots();
}

function todayStr(){
  const d = new Date();
  return d.toISOString().split('T')[0];
}
function initDateInput(){
  const input = document.getElementById('date-input');
  input.min = todayStr();
  if(!input.value) input.value = todayStr();
  booking.date = input.value;
  input.addEventListener('change', () => {
    booking.date = input.value;
    booking.time = null;
    fetchSlots();
  });
}

async function fetchSlots() {
  const date = booking.date || todayStr();
  const doctorId = booking.doctorId;
  if (!doctorId) return;
  try {
    const slots = await apiGet(API + '/slots?date=' + encodeURIComponent(date) + '&doctorId=' + encodeURIComponent(doctorId));
    renderSlotsFrom(slots);
  } catch (e) {
    // fallback to client-side computation
    const offset = dayOffsetFromToday(date);
    const localSlots = TIME_SLOTS.map((label, i) => ({
      label, taken: (i + offset) % 5 === 0, sort_order: i
    }));
    renderSlotsFrom(localSlots);
  }
}

function dayOffsetFromToday(dateStr){
  const a = new Date(dateStr + 'T00:00:00');
  const b = new Date();
  b.setHours(0, 0, 0, 0);
  return Math.round((a-b)/86400000);
}

function renderSlotsFrom(slots) {
  const wrap = document.getElementById('slot-grid');
  wrap.innerHTML = slots.map(s => {
    const selected = booking.time === s.label && !s.taken;
    return `<button type="button" class="slot mono ${s.taken?'taken':''} ${selected?'selected':''}"
      ${s.taken?'disabled':''} onclick="pickTime('${s.label}')">${s.label}</button>`;
  }).join('');
}

function renderSlots(){
  const wrap = document.getElementById('slot-grid');
  const offset = dayOffsetFromToday(booking.date || todayStr());
  wrap.innerHTML = TIME_SLOTS.map((t,i) => {
    const taken = (i + offset) % 5 === 0;
    const selected = booking.time === t && !taken;
    return `<button type="button" class="slot mono ${taken?'taken':''} ${selected?'selected':''}"
      ${taken?'disabled':''} onclick="pickTime('${t}')">${t}</button>`;
  }).join('');
}
function pickTime(t){
  booking.time = t;
  renderSlots();
  document.getElementById('err-2').style.display='none';
}

/* ============ STEP NAV ============ */
const STEP_LABELS = ['Service','Date & time','Your details','Confirm'];
function renderSteps(current){
  const wrap = document.getElementById('steps');
  wrap.innerHTML = STEP_LABELS.map((label,i)=>{
    const n = i+1;
    let cls = '';
    if(n < current) cls = 'done';
    if(n === current) cls = 'active';
    return `<div class="step ${cls}"><span class="stepnum">${n}</span>${label}</div>`;
  }).join('');
}

function goStep(n){
  if(n === 2 && !booking.serviceId){
    document.getElementById('err-1').style.display='block';
    return;
  }
  if(n === 3 && (!booking.doctorId || !booking.date || !booking.time)){
    document.getElementById('err-2').style.display='block';
    return;
  }
  if(n === 4){
    const name = document.getElementById('name-input').value.trim();
    const phone = document.getElementById('phone-input').value.trim();
    const email = document.getElementById('email-input').value.trim();
    if(!name || !phone || !email){
      document.getElementById('err-3').style.display='block';
      return;
    }
    booking.name = name; booking.phone = phone; booking.email = email;
    booking.patientType = document.getElementById('patient-type').value;
    booking.notes = document.getElementById('notes-input').value.trim();
    renderSummary();
  }
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`.panel[data-panel="${n}"]`).classList.add('active');
  if(n <= 4) renderSteps(n);
  if(n === 2){ renderDoctorOptions(); fetchSlots(); }
  document.getElementById('book').scrollIntoView({block:'start'});
}

function serviceById(id){ return SERVICES.find(s=>s.id===id); }
function doctorById(id){ return DOCTORS.find(d=>d.id===id); }
function formatDate(dateStr){
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, {weekday:'short', month:'short', day:'numeric'});
}

function renderSummary(){
  const s = serviceById(booking.serviceId), d = doctorById(booking.doctorId);
  document.getElementById('summary-box').innerHTML = `
    <div class="summary-row"><span class="k">Service</span><span class="v">${s.name} (${s.duration})</span></div>
    <div class="summary-row"><span class="k">Dentist</span><span class="v">${d.name}</span></div>
    <div class="summary-row"><span class="k">Date</span><span class="v">${formatDate(booking.date)}</span></div>
    <div class="summary-row"><span class="k">Time</span><span class="v">${booking.time}</span></div>
    <div class="summary-row"><span class="k">Patient</span><span class="v">${booking.name} · ${booking.patientType}</span></div>
    <div class="summary-row"><span class="k">Contact</span><span class="v">${booking.phone} · ${booking.email}</span></div>
    <div class="summary-row"><span class="k">Estimated cost</span><span class="v">${s.price}</span></div>
  `;
}

/* ============ CONFIRM & APPOINTMENTS LIST ============ */
async function confirmBooking(){
  try {
    const result = await apiPost(API + '/appointments', {
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

    document.getElementById('confirm-code').textContent = result.code;
    document.getElementById('confirm-summary').innerHTML = `
      <div class="summary-row"><span class="k">Service</span><span class="v">${result.service}</span></div>
      <div class="summary-row"><span class="k">Dentist</span><span class="v">${result.doctor}</span></div>
      <div class="summary-row"><span class="k">When</span><span class="v">${formatDate(result.date)} · ${result.time}</span></div>
    `;

    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelector('.panel[data-panel="5"]').classList.add('active');
    document.getElementById('steps').innerHTML = '';

    await loadAppointments();
    showToast('Appointment confirmed — see you then!');

    booking = { serviceId:null, doctorId:null, date:null, time:null, name:'', phone:'', email:'', patientType:'New patient', notes:'' };
    document.getElementById('name-input').value='';
    document.getElementById('phone-input').value='';
    document.getElementById('email-input').value='';
    document.getElementById('notes-input').value='';
  } catch (e) {
    showToast(e.message || 'Failed to book appointment');
  }
}

async function loadAppointments() {
  try {
    const appts = await apiGet(API + '/appointments');
    appointments = appts;
  } catch (e) {
    // keep existing
  }
  renderAppointments();
}

function renderAppointments(){
  const wrap = document.getElementById('appt-list-wrap');
  if(appointments.length === 0){
    wrap.innerHTML = `
      <div class="empty-state">
        <h3>No appointments yet</h3>
        <p>Once you book a visit above, it'll show up here.</p>
      </div>`;
    return;
  }
  wrap.innerHTML = `<div class="appt-list">` + appointments.map(a => `
    <div class="appt-row">
      <div class="appt-left">
        <div class="svc">${a.service_name} <span class="mono" style="color:var(--muted);font-weight:400;font-size:0.8rem;">· ${a.code}</span></div>
        <div class="sub">${a.doctor_name} · ${a.patient_name} · ${a.phone}</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <span class="appt-time mono">${formatDate(a.date)} · ${a.time}</span>
        <button class="cancel-btn" onclick="cancelAppt('${a.code}')">Cancel</button>
      </div>
    </div>
  `).join('') + `</div>`;
}

async function cancelAppt(code){
  try {
    await apiDelete(API + '/appointments/' + code);
    await loadAppointments();
    showToast('Appointment cancelled.');
  } catch (e) {
    showToast(e.message || 'Failed to cancel');
  }
}

/* ============ TOAST ============ */
let toastTimer;
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> t.classList.remove('show'), 2600);
}

/* ============ INIT ============ */
async function init(){
  await loadData();
  renderServiceOptions();
  renderSteps(1);
  initDateInput();
  renderDoctorOptions();
  renderSlots();
  await loadAppointments();
}
init();
