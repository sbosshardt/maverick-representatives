const sqlite = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const xml2js = require('xml2js');
const date = require('date-and-time');

// Function to parse an XML file
const parseXMLFile = async (filePath) => {
  const parser = new xml2js.Parser();
  const data = fs.readFileSync(filePath);
  return parser.parseStringPromise(data);
};

const xml_db_name_mapping = {
  "majority": "majority",
  "congress": "congress",
  "session": "session",
  "chamber": "chamber",
  "committee-name": "committee_name",
  "rollcall-num": "rollcall_num",
  "legis-num": "legis_num",
  "vote-issue": "vote_issue",
  "vote-question": "vote_question",
  "vote-correction": "vote_correction",
  "amendment-num": "amendment_num",
  "amendment-author": "amendment_author",
  "vote-type": "vote_type",
  "vote-result": "vote_result",
  "action-date": "action_date",
  "action-time": "action_time",
  "vote-desc": "vote_desc",
}

global.leg_name_id_id_map = {};

const processVoteMetadata = (voteMetadata) => {
  //console.log(voteMetadata);
  //console.log(voteMetadata[0]['vote-totals'][0])
  let rollcallValues = {};
  Object.entries(xml_db_name_mapping).map(obj => {
    const xml_key = obj[0];
    const db_key = obj[1];
    if (voteMetadata[0][xml_key]) {
      rollcallValues[db_key] = voteMetadata[0][xml_key][0];
    }
  });
  if (rollcallValues['action_date']) {
    const parsed = date.parse(rollcallValues['action_date'],'D-MMM-YYYY'); 
    rollcallValues['action_date'] = date.format(parsed, 'YYYY-MM-DD');
  }
  if (rollcallValues['action_time']?.['_']) {
    rollcallValues['action_time'] = rollcallValues['action_time']['_'];
  }
  //console.log(rollcallValues);
  let partyRows = [];
  if (voteMetadata[0]['vote-totals']) {
    const totals_by_party = voteMetadata[0]['vote-totals'][0]['totals-by-party']
    for (i in totals_by_party) {
      partyRows.push({
        'party': totals_by_party[i]['party'][0],
        'yea': totals_by_party[i]['yea-total'][0],
        'nay': totals_by_party[i]['nay-total'][0],
        'present': totals_by_party[i]['present-total'][0],
        'not_voting': totals_by_party[i]['not-voting-total'][0],
      });
    }
    if (voteMetadata[0]['vote-totals'][0]['totals-by-vote']?.[0]) {
      let totals = voteMetadata[0]['vote-totals'][0]['totals-by-vote'][0];
      partyRows.push({
        'party': '(All)',
        'yea': totals['yea-total'][0],
        'nay': totals['nay-total'][0],
        'present': totals['present-total'][0],
        'not_voting': totals['not-voting-total'][0],
      })
    }
    //console.log(partyRows);
  }
  return [rollcallValues, partyRows];
}

const processVoteData = (voteData) => {
  let votes = [];
  const voteRecords = voteData[0]['recorded-vote'];
  for (i in voteRecords) {
    const parsedLeg = voteRecords[i]['legislator'][0]['$'];
    const vote = {
      'name_id': parsedLeg['name-id'],
      'legislator_name': parsedLeg['unaccented-name'],
      'state': parsedLeg['state'],
      'party': parsedLeg['party'],
      'vote': voteRecords[i]['vote'][0]
    };
    //console.log(legislator);
    //console.log(vote);
    votes.push(vote);
  }
  return votes;
}

const getCols = (data) => {
  const keys = Object.keys(data);
  const names = keys.join(', ');
  const placeholders = '@' + keys.join(', @');
  return [names, placeholders];
};

// Path to the SQLite database file
const dbPath = path.join(__dirname, 'congress_votes.db');
const db = new sqlite(dbPath);

// Function to process a single XML file
const processXMLFile = async (filePath) => {
  try {
    const result = await parseXMLFile(filePath);
    //const voteMetadata = result['vote-metadata'];
    //const voteData = result['vote-data'];
    const [metadata, totals] = processVoteMetadata(result['rollcall-vote']['vote-metadata']);

    // Begin a transaction
    db.prepare('BEGIN TRANSACTION').run();
    const [rc_names, rc_phs] = getCols(metadata);
    // Insert into roll_calls table
    const insertRollCallSQL = `INSERT INTO roll_calls (`+rc_names+`) VALUES (`+rc_phs+`)`;
    // You need to replace ... with the actual columns and values based on voteMetadata
    const rollInfo = db.prepare(insertRollCallSQL).run(metadata);
    const rollCallId = rollInfo.lastInsertRowid;
    const parsedVotes = processVoteData(result['rollcall-vote']['vote-data']);
    db.prepare('COMMIT').run();

    db.prepare('BEGIN TRANSACTION').run();
    // Insert into totals table
    if (totals.length > 0) {
      const updatedTotals = totals.map((element, index) => {
        element['roll_call_id'] = rollCallId;
        return element;
      });
      let total_sample = updatedTotals[0];
      const [totals_names, tot_phs] = getCols(total_sample);
      const insertTotalsSQL = `INSERT INTO totals (`+totals_names+`) VALUES (`+tot_phs+`)`;
      //console.log(insertTotalsSQL);
      //console.log(updatedTotals);
      const insertTotals = db.prepare(insertTotalsSQL);
      const insertManyTotals = db.transaction((tots) => {
        for (const tot of tots) insertTotals.run(tot);
      });
      insertManyTotals(updatedTotals);
    }
    db.prepare('COMMIT').run();

    db.prepare('BEGIN TRANSACTION').run();
    // Insert into the legislators and votes tables
    let votesValues = [];
    // Ensure that our map of known legislator name ids => primary ids
    // has an entry for the legislator (and upsert a row if not).
    for (const voteInfo of parsedVotes) {
      const nameId = voteInfo['name_id'];
      if (!leg_name_id_id_map[nameId]) {
        const legislatorValues = [
          nameId,
          voteInfo['legislator_name'],
          voteInfo['state'],
          voteInfo['party']
        ];
        const insertLegislatorSQL = `INSERT INTO legislators (name_id, legislator_name, state, party) VALUES (?, ?, ?, ?)
        ON CONFLICT(name_id) DO UPDATE SET legislator_name = excluded.legislator_name, state = excluded.state, party = excluded.party`;
        const legInfo = db.prepare(insertLegislatorSQL).run(legislatorValues);
        const legislatorId = legInfo.lastInsertRowid;
        //console.log('Legislator id:', legislatorId);
        leg_name_id_id_map[nameId] = legislatorId;
      }
      const legislatorId = leg_name_id_id_map[nameId];
      votesValues = votesValues.concat([legislatorId, rollCallId, voteInfo['vote']]);
    }
    db.prepare('COMMIT').run();

    db.prepare('BEGIN TRANSACTION').run();
    
    const votes_phs = parsedVotes.map(() => '?, ?, ?').join('), (');
    const insertVoteSQL = `INSERT INTO votes (legislator_id, roll_call_id, vote) VALUES (`+votes_phs+`)`;
    //console.log(insertVoteSQL);
    //console.log(votesValues);
    //console.log(leg_name_id_id_map);
    db.prepare(insertVoteSQL).run(votesValues);

    db.prepare('COMMIT').run();
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
  //files = files.slice(100, 104);
  files.forEach((file) => {
    const filePath = path.join(xmlDirPath, file);
    processXMLFile(filePath);
  });
});


const closeDb = () => {
  // Remember to close the database connection when all files are processed
  // You may want to set this up in a more sophisticated way to ensure that
  // the connection is closed only after all files have been processed
  //db.close();
}

const testProcess = async () => {
  const file = 'roll340.xml';
  const filePath = path.join(xmlDirPath, file);
  await processXMLFile(filePath);
  closeDb();
}
//testProcess();
