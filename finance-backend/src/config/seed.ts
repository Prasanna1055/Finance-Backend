
import bcrypt from "bcryptjs";
import db, { initSchema } from "./database";

initSchema();

const seedUsers = [
  { name: "Alice Admin",   email: "admin@finance.dev",   password: "Admin@123",   role: "admin"   },
  { name: "Alan Analyst",  email: "analyst@finance.dev", password: "Analyst@123", role: "analyst" },
  { name: "Victor Viewer", email: "viewer@finance.dev",  password: "Viewer@123",  role: "viewer"  },
] as const;

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (name, email, password_hash, role)
  VALUES (?, ?, ?, ?)
`);

for (const u of seedUsers) {
  const hash = bcrypt.hashSync(u.password, 10);
  insertUser.run(u.name, u.email, hash, u.role);
}


const adminRow = db.prepare("SELECT id FROM users WHERE email = ?").get("admin@finance.dev") as { id: number };
const adminId = adminRow.id;


const categories = {
  income:  ["Salary", "Freelance", "Dividends", "Rental Income"],
  expense: ["Rent", "Groceries", "Utilities", "Travel", "Software", "Marketing"],
};

const insertRecord = db.prepare(`
  INSERT INTO financial_records (user_id, amount, type, category, date, notes)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const existingCount = (db.prepare("SELECT COUNT(*) as c FROM financial_records").get() as { c: number }).c;

if (existingCount === 0) {
  const sampleRecords = [
    // Jan
    { amount: 500000, type: "income",  category: "Salary",        date: "2025-01-31", notes: "Monthly salary" },
    { amount: 120000, type: "expense", category: "Rent",           date: "2025-01-05", notes: "Office rent" },
    { amount:  45000, type: "expense", category: "Utilities",      date: "2025-01-10", notes: null },
    { amount:  80000, type: "income",  category: "Freelance",      date: "2025-01-20", notes: "Web project" },
    // Feb
    { amount: 500000, type: "income",  category: "Salary",        date: "2025-02-28", notes: "Monthly salary" },
    { amount: 120000, type: "expense", category: "Rent",           date: "2025-02-05", notes: "Office rent" },
    { amount:  30000, type: "expense", category: "Software",       date: "2025-02-12", notes: "SaaS subscriptions" },
    { amount:  25000, type: "expense", category: "Travel",         date: "2025-02-18", notes: "Client visit" },
    // Mar
    { amount: 500000, type: "income",  category: "Salary",        date: "2025-03-31", notes: "Monthly salary" },
    { amount: 120000, type: "expense", category: "Rent",           date: "2025-03-05", notes: "Office rent" },
    { amount:  60000, type: "income",  category: "Dividends",      date: "2025-03-15", notes: "Q1 dividends" },
    { amount:  40000, type: "expense", category: "Marketing",      date: "2025-03-22", notes: "Ad campaign" },
    // Apr
    { amount: 500000, type: "income",  category: "Salary",        date: "2025-04-30", notes: "Monthly salary" },
    { amount: 120000, type: "expense", category: "Rent",           date: "2025-04-05", notes: "Office rent" },
    { amount: 150000, type: "income",  category: "Freelance",      date: "2025-04-10", notes: "App development" },
    { amount:  55000, type: "expense", category: "Groceries",      date: "2025-04-18", notes: null },
    // May
    { amount: 500000, type: "income",  category: "Salary",        date: "2025-05-31", notes: "Monthly salary" },
    { amount: 120000, type: "expense", category: "Rent",           date: "2025-05-05", notes: "Office rent" },
    { amount: 200000, type: "income",  category: "Rental Income",  date: "2025-05-01", notes: "Property lease" },
    { amount:  70000, type: "expense", category: "Travel",         date: "2025-05-25", notes: "Conference" },
  ];

  const insertMany = db.transaction(() => {
    for (const r of sampleRecords) {
      insertRecord.run(adminId, r.amount, r.type, r.category, r.date, r.notes);
    }
  });
  insertMany();
}

console.log("✅  Database seeded successfully.");
console.log("\nTest credentials:");
for (const u of seedUsers) {
  console.log(`  ${u.role.padEnd(8)}  ${u.email}  /  ${u.password}`);
}
