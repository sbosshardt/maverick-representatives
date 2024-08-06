const fs = require('fs');
const sqlite = require('better-sqlite3');
const path = require('path');

const setupDb = async (overwriteExisting = false) => {
  const saveDir = path.join(__dirname,'data')
  if (!fs.existsSync(saveDir)) {
    fs.mkdirSync(saveDir, { recursive: true });
    console.log('Created data directory (for storing SQLite database in):', saveDir)
  }

  // Path to the SQLite database file
  const dbPath = path.join(saveDir, '/congress_votes.db');

  if (fs.existsSync(dbPath)) {
    if (overwriteExisting) {
      console.log('Removing existing db (overwriteExisting is true):', dbPath)
      fs.unlinkSync(dbPath)
    }
    else {
      console.log('Skipping DB setup - overwriteExisting is false and a db file exists:', dbPath)
      return
    }
  }

  // Create a new database instance
  const db = new sqlite(dbPath);
  db.pragma('journal_mode = WAL');

  // Run SQL statements to create the tables

    // Create the roll_calls table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS roll_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        majority TEXT,
        congress INTEGER,
        session INTEGER,
        chamber TEXT,
        committee TEXT,
        rollcall_num INTEGER,
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
    `).run();

    // Create the totals table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS totals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        roll_call_id INTEGER,
        party TEXT,
        yea INTEGER,
        nay INTEGER,
        present INTEGER,
        not_voting INTEGER,
        FOREIGN KEY (roll_call_id) REFERENCES roll_calls (id)
      );
    `).run();

    // Create the legislators table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS legislators (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name_id TEXT UNIQUE,
        legislator_name TEXT,
        state TEXT,
        party TEXT,
        chamber TEXT
      );
    `).run();

    // Create the votes table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        legislator_id INTEGER,
        roll_call_id INTEGER,
        vote TEXT,
        FOREIGN KEY (legislator_id) REFERENCES legislators (id),
        FOREIGN KEY (roll_call_id) REFERENCES roll_calls (id)
        CONSTRAINT legislator_roll_call UNIQUE(legislator_id, roll_call_id) ON CONFLICT REPLACE
      );
    `).run();

  // Close the database connection
  db.close((err) => {
    if (err) {
      console.error(err.message);
    } else {
      console.log('Closed the database connection.');
    }
  });
}

module.exports.setupDb = setupDb
