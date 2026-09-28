// db.js — SQLite storage using Node's built-in `node:sqlite` module (no npm install needed).
// Node 22+ ships this behind an experimental flag; server.js starts node with --experimental-sqlite.
'use strict';
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const crypto = require('node:crypto');
const { hashPassword } = require('./auth');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.sqlite');
const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin','vendor','customer')),
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS vendors (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    business_name TEXT NOT NULL,
    commission_rate REAL NOT NULL DEFAULT 0.10,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS halls (
    id TEXT PRIMARY KEY,
    vendor_id TEXT NOT NULL REFERENCES vendors(id),
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    price INTEGER NOT NULL,
    generator INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    hall_id TEXT NOT NULL REFERENCES halls(id),
    vendor_id TEXT NOT NULL REFERENCES vendors(id),
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    event_date TEXT NOT NULL,
    event_type TEXT NOT NULL,
    guests INTEGER NOT NULL,
    total INTEGER NOT NULL,
    token_paid INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','completed','cancelled')),
    created_at TEXT NOT NULL
  );
`);

function seedIfEmpty() {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM users').get();
  if (count > 0) return;

  const now = new Date().toISOString();
  const insertUser = db.prepare(
    'INSERT INTO users (id, name, phone, password_hash, role, created_at) VALUES (?,?,?,?,?,?)'
  );
  const insertVendor = db.prepare(
    'INSERT INTO vendors (id, user_id, business_name, commission_rate, created_at) VALUES (?,?,?,?,?)'
  );
  const insertHall = db.prepare(
    'INSERT INTO halls (id, vendor_id, name, city, capacity, price, generator, created_at) VALUES (?,?,?,?,?,?,?,?)'
  );

  // Admin login: phone 03000000000 / password admin123 — change this immediately in production.
  const adminId = crypto.randomUUID();
  insertUser.run(adminId, 'Platform Admin', '03000000000', hashPassword('admin123'), 'admin', now);

  const vendorSeeds = [
    { name: 'Al-Barkat Group', phone: '03001111111', password: 'vendor123', halls: [
      { name: 'Al-Barkat Marquee', city: 'Lahore', capacity: 800, price: 2500, generator: 1 },
      { name: 'Grand Emporium Hall', city: 'Lahore', capacity: 400, price: 3200, generator: 1 },
    ]},
    { name: 'Sunset Events Pvt Ltd', phone: '03002222222', password: 'vendor123', halls: [
      { name: 'Sunset Banquet', city: 'Karachi', capacity: 600, price: 2800, generator: 0 },
    ]},
    { name: 'Regal Hospitality', phone: '03003333333', password: 'vendor123', halls: [
      { name: 'Regal Gardens', city: 'Islamabad', capacity: 1000, price: 3500, generator: 1 },
    ]},
  ];

  for (const v of vendorSeeds) {
    const userId = crypto.randomUUID();
    insertUser.run(userId, v.name, v.phone, hashPassword(v.password), 'vendor', now);
    const vendorId = crypto.randomUUID();
    insertVendor.run(vendorId, userId, v.name, 0.10, now);
    for (const h of v.halls) {
      insertHall.run(crypto.randomUUID(), vendorId, h.name, h.city, h.capacity, h.price, h.generator, now);
    }
  }
}

seedIfEmpty();

module.exports = { db };
