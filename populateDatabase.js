const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const xml2js = require('xml2js');

// Function to parse an XML file
const parseXMLFile = async (filePath) => {
  const parser = new xml2js.Parser();
  const data = fs.readFileSync(filePath);
  return parser.parseStringPromise(data);
};

// Path to the SQLite database file
const dbPath = path.join(__dirname, 'congress_votes.db');
const db = new sqlite3.Database(dbPath);

// Function to process a single XML file
const processXMLFile = async (filePath) => {
  try {
    const result = await parseXMLFile(filePath);
    const voteMetadata = result['vote-metadata'];
    const voteData = result['vote-data'];

    // Begin a transaction
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      // Insert into roll_calls table
      const insertRollCallSQL = `INSERT INTO roll_calls (congress, session, chamber, ...) VALUES (?, ?, ?, ...)`;
      // You need to replace ... with the actual columns and values based on voteMetadata
      db.run(insertRollCallSQL, [...values from voteMetadata...], function(err) {
        if (err) {
          console.error(err.message);
          db.run('ROLLBACK');
          return;
        }

        const rollCallId = this.lastID;

        // Insert into legislators and votes tables
        voteData.forEach((vote) => {
          // Extract legislator data
          const legislator = vote.legislator;
          const voteValue = vote.vote;

          // Insert or update legislator in legislators table
          const insertLegislatorSQL = `INSERT INTO legislators (name_id, legislator_name, state, party) VALUES (?, ?, ?, ?)
            ON CONFLICT(name_id) DO UPDATE SET legislator_name = excluded.legislator_name, state = excluded.state, party = excluded.party`;
          db.run(insertLegislatorSQL, [legislator.name_id, legislator.name, legislator.state, legislator.party], function(err) {
            if (err) {
              console.error(err.message);
              db.run('ROLLBACK');
              return;
            }

            const legislatorId = this.lastID;

            // Insert into votes table
            const insertVoteSQL = `INSERT INTO votes (legislator_id, roll_call_id, vote) VALUES (?, ?, ?)`;
            db.run(insertVoteSQL, [legislatorId, rollCallId, voteValue], (err) => {
              if (err) {
                console.error(err.message);
                db.run('ROLLBACK');
                return;
              }
            });
          });
        });

        db.run('COMMIT');
      });
    });
  } catch (error) {
    console.error('Error processing XML file:', error.message);
  }
};

// Path to the directory containing the XML files
const xmlDirPath = path.join(__dirname, 'votes');

// Process all XML files
fs.readdir(xmlDirPath, (err, files) => {
  if (err) {
    console.error('Error reading the directory:', err.message);
    return;
  }

  files.forEach((file) => {
    const filePath = path.join(xmlDirPath, file);
    processXMLFile(filePath);
  });
});

// Remember to close the database connection when all files are processed
// You may want to set this up in a more sophisticated way to ensure that
// the connection is closed only after all files have been processed
db.close();
