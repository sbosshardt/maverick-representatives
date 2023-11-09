const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Path to the SQLite database file
const dbPath = path.join(__dirname, 'congress_votes.db');

// Create a new database instance
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(err.message);
    throw err;
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Run SQL statements to create the tables
db.serialize(() => {
  // Create the roll_calls table
  db.run(`
    CREATE TABLE IF NOT EXISTS roll_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      majority TEXT,
      congress INTEGER,
      session INTEGER,
      chamber TEXT,
      committee_name TEXT,
      rollcall_num INTEGER UNIQUE,
      legis_num TEXT,
      vote_issue TEXT,
      vote_question TEXT,
      vote_correction TEXT,
      amendment_num TEXT,
      amendment_author TEXT,
      vote_type TEXT,
      vote_result TEXT,
      action_date TEXT,
      action_time TEXT,
      vote_desc TEXT
    );
  `);

  // Create the legislators table
  db.run(`
    CREATE TABLE IF NOT EXISTS legislators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_id TEXT UNIQUE,
      legislator_name TEXT,
      state TEXT,
      party TEXT
    );
  `);

  // Create the votes table
  db.run(`
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      legislator_id INTEGER,
      roll_call_id INTEGER,
      vote TEXT,
      FOREIGN KEY (legislator_id) REFERENCES legislators (id),
      FOREIGN KEY (roll_call_id) REFERENCES roll_calls (id)
    );
  `);
});

// Close the database connection
db.close((err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log('Closed the database connection.');
  }
});
