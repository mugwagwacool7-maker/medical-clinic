const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'clinic.db');

const DB_DIR = path.dirname(DB_PATH);
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initTables();
    seedData();
  }
  return db;
}

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      tag TEXT NOT NULL,
      name TEXT NOT NULL,
      desc TEXT NOT NULL,
      duration TEXT NOT NULL,
      price TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS doctors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      focus TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS time_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS appointments (
      code TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      doctor_id TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      patient_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      patient_type TEXT NOT NULL DEFAULT 'New patient',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (service_id) REFERENCES services(id),
      FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    );

    CREATE TABLE IF NOT EXISTS blocked_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id TEXT NOT NULL,
      date TEXT NOT NULL,
      slot_label TEXT NOT NULL,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    );
  `);
}

function seedData() {
  const svcCount = db.prepare('SELECT COUNT(*) as c FROM services').get().c;
  if (svcCount === 0) {
    const insertSvc = db.prepare('INSERT INTO services (id, tag, name, desc, duration, price) VALUES (?, ?, ?, ?, ?, ?)');
    const services = [
      ['cleaning', 'PREVENTIVE', 'Routine Cleaning & Exam', 'A full checkup and polish to keep things on track.', '30 min', '$45'],
      ['whitening', 'COSMETIC', 'Teeth Whitening', 'In-office whitening for a noticeably brighter smile.', '60 min', '$120'],
      ['filling', 'RESTORATIVE', 'Cavity Filling', 'Comfortable, tooth-colored fillings for minor decay.', '45 min', '$80'],
      ['extraction', 'SURGICAL', 'Tooth Extraction', 'Safe removal with local anesthesia and aftercare guidance.', '45 min', '$95'],
      ['rootcanal', 'RESTORATIVE', 'Root Canal Therapy', 'Relieve pain and save the tooth in a single focused visit.', '90 min', '$260'],
      ['consult', 'GENERAL', 'New Patient Consultation', 'A first visit to assess your dental health and plan next steps.', '30 min', '$30'],
    ];
    for (const s of services) insertSvc.run(...s);
  }

  const docCount = db.prepare('SELECT COUNT(*) as c FROM doctors').get().c;
  if (docCount === 0) {
    const insertDoc = db.prepare('INSERT INTO doctors (id, name, focus) VALUES (?, ?, ?)');
    const doctors = [
      ['Finity', 'Dr. Finity', 'General & preventive care'],
      ['Mutenje', 'Dr. Mutenje', 'Cosmetic dentistry'],
      ['Gwenhamo', 'Dr. Gwenhamo', 'Oral surgery'],
      ['Moyo', 'Dr. Moyo', 'Endodontics (root canals)'],
    ];
    for (const d of doctors) insertDoc.run(...d);
  }

  const slotCount = db.prepare('SELECT COUNT(*) as c FROM time_slots').get().c;
  if (slotCount === 0) {
    const insertSlot = db.prepare('INSERT INTO time_slots (label, sort_order) VALUES (?, ?)');
    const slots = ['8:00 AM','8:40 AM','9:20 AM','10:00 AM','10:40 AM','11:20 AM','1:00 PM','1:40 PM','2:20 PM','3:00 PM','3:40 PM','4:20 PM'];
    slots.forEach((label, i) => insertSlot.run(label, i));
  }
}

module.exports = { getDb };
