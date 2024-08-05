const sqlite = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const date = require('date-and-time');
const sdb = require('./setupDatabase')
const gd = require('./getDirectories')
const dv = require('./downloadVotes')

//const xml2js = require('xml2js');
const { XMLParser } = require("fast-xml-parser");
const xmlParser = new XMLParser({ignoreAttributes: false});

// Function to parse an XML file
const parseXMLFile = (filePath) => {
  console.log('In parseXMLFile for filePath:', filePath)
  const data = fs.readFileSync(filePath)
  let returnVal = xmlParser.parse(data);
  return returnVal
}

const xml_db_name_mapping = {
  "majority": "majority",
  "congress": "congress",
  "session": "session",
  "chamber": "chamber",
  "committee": "committee",
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

const processHouseVoteMetadata = (voteMetadata) => {
  //console.log(voteMetadata);
  let rollcallValues = {};
  Object.entries(xml_db_name_mapping).map(obj => {
    const xml_key = obj[0];
    const db_key = obj[1];
    if (voteMetadata[xml_key]) {
      rollcallValues[db_key] = voteMetadata[xml_key];
    }
  });
  if (rollcallValues['action_date']) {
    const parsed = date.parse(rollcallValues['action_date'],'D-MMM-YYYY'); 
    rollcallValues['action_date'] = date.format(parsed, 'YYYY-MM-DD');
  }
  if (rollcallValues['action_time']?.['#text']) {
    rollcallValues['action_time'] = rollcallValues['action_time']['#text'];
  }
  rollcallValues['chamber'] = 'House'
  //console.log(rollcallValues);
  let totalsRows = [];
  if (voteMetadata['vote-totals']) {
    const totals_by_party = voteMetadata['vote-totals']['totals-by-party']
    //console.log("totals_by_party:", totals_by_party)
    for (i in totals_by_party) {
      totalsRows.push({
        'party': totals_by_party[i]['party'],
        'yea': totals_by_party[i]['yea-total'],
        'nay': totals_by_party[i]['nay-total'],
        'present': totals_by_party[i]['present-total'],
        'not_voting': totals_by_party[i]['not-voting-total'],
      });
    }
    if (voteMetadata['vote-totals']['totals-by-vote']) {
      let totals = voteMetadata['vote-totals']['totals-by-vote'];
      totalsRows.push({
        'party': '(All)',
        'yea': totals['yea-total'],
        'nay': totals['nay-total'],
        'present': totals['present-total'],
        'not_voting': totals['not-voting-total'],
      })
    }
    //console.log(totalsRows);
  }
  return [rollcallValues, totalsRows];
}

const processVoteData = (voteData, metadata) => {
  let votes = [];
  //console.log('voteData:', voteData)
  const voteRecords = voteData['recorded-vote'];
  //console.log('voteRecords:', voteRecords)
  for (i in voteRecords) {
    const legislator = voteRecords[i]['legislator']
    const vote = {
      'name_id': legislator['@_name-id'],
      'legislator_name': legislator['@_unaccented-name'],
      'state': legislator['@_state'],
      'vote': voteRecords[i]['vote'],
      'party': legislator['@_party'],
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

// Function to process a single XML file
const processRollcallXmlFile = (filePath, db) => {
  const data = parseXMLFile(filePath)
  if (Object.hasOwn(data, 'rollcall-vote')) {
    processHouseRollcallXmlData(data, db)
  } else if (Object.hasOwn(data, 'roll_call_vote')) {
    processSenateRollcallXmlData(data, db)
  }
}

const processSenateRollcallXmlData = (data, db) => {
  // todo: implement this
  console.error('processSenateRollcallXmlData is under construction.')
}

const processHouseRollcallXmlData = (data, db) => {
  try {
    //const voteMetadata = data['vote-metadata'];
    //const voteData = data['vote-data'];
    const [metadata, totals] = processHouseVoteMetadata(data['rollcall-vote']['vote-metadata']);

    // Begin a transaction
    db.prepare('BEGIN TRANSACTION').run();
    const [rc_names, rc_phs] = getCols(metadata);
    //console.log('rc_names:', rc_names)
    //console.log('rc_phs:', rc_phs)
    //console.log('metadata:', metadata)
    // Insert into roll_calls table
    const insertRollCallSQL = `INSERT INTO roll_calls (`+rc_names+`) VALUES (`+rc_phs+`)`;
    const rollInfo = db.prepare(insertRollCallSQL).run(metadata);
    const rollCallId = rollInfo.lastInsertRowid;
    const parsedVotes = processVoteData(data['rollcall-vote']['vote-data'], metadata);
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
          voteInfo['party'],
          "House"
        ];
        const insertLegislatorSQL = `INSERT INTO legislators (name_id, legislator_name, state, party, chamber) VALUES (?, ?, ?, ?, ?)
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
    console.error(error);
    process.exit();
  }
};

const processRollCalls = async () => {
  await sdb.setupDb(true)
  await dv.downloadAllFiles();
  // Path to the SQLite database file
  const dbPath = path.join(__dirname, 'data/congress_votes.db');
  const db = new sqlite(dbPath);

  // Path to the directory containing the XML files
  const rcPath = path.join(__dirname, 'data/rollcalls');
  const dirs = gd.getDirectoriesRecursive(rcPath)

  for (const xmlDirPath of dirs) {
    // Process all XML files
    files = fs.readdirSync(xmlDirPath)
    //files = files.slice(100, 104);
    for (file of files) {
      // If the filename does not have ".xml" in it, skip it.
      if (!file.includes('.xml')) {
        continue
      }
      const filePath = path.join(xmlDirPath, file);
      processRollcallXmlFile(filePath, db);
    }
  }

  // const testProcess = async () => {
  //   const file = 'roll340.xml';
  //   const filePath = path.join(xmlDirPath, file);
  //   await processRollcallXmlFile(filePath);
  //   closeDb();
  // }
  // //testProcess()
  db.close()
}
processRollCalls()

const testProcess = () => {
  const xmlDirPath = 'data/rollcalls/house/118/1'
  const file = 'roll340.xml'
  const filePath = path.join(xmlDirPath, file);
  parseXMLFile(filePath)
}
//testProcess()
