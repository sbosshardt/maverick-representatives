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

const processVoteData = (voteData, roll_call_id = 'TBD') => {
  let votes = [];
  const voteRecords = voteData[0]['recorded-vote'];
  for (i in voteRecords) {
    const parsedLeg = voteRecords[i]['legislator'][0]['$'];
    const legislator = {
      'name_id': parsedLeg['name-id'],
      'legislator_name': parsedLeg['unaccented-name'],
      'state': parsedLeg['state'],
      'party': parsedLeg['party']
    };
    const vote = {
      'legislator_id': 'TBD',
      'roll_call_id': roll_call_id,
      'vote': voteRecords[i]['vote'][0],
    };
    //console.log(legislator);
    //console.log(vote);
    votes.push({
      'legislator': legislator,
      'vote': vote,
    });
  }
  return votes;
}

const getCols = (data) => {
  const keys = Object.keys(data);
  const names = keys.join(', ');
  const placeholders = Array(keys.length).fill('?').join(', ');
  return [names, placeholders];
};

// Function to process a single XML file
const processXMLFile = async (filePath) => {
  try {
      const result = await parseXMLFile(filePath);
      const rollcallVote = result['rollcall-vote'];
      const voteMetadata = rollcallVote['vote-metadata'];
      const voteData = rollcallVote['vote-data'];
      const [metadata, totals] = processVoteMetadata(voteMetadata);
      const parsedVotes = processVoteData(voteData);
      console.log(metadata);
      //console.log(totals);
      //console.log(parsedVotes[0]);
      console.log(getCols(metadata));
  } catch (error) {
    console.error('Error processing XML file:', error.message);
  }
};

// Path to the directory containing the XML files
const xmlDirPath = path.join(__dirname, 'votes');
const file = 'roll340.xml';
const filePath = path.join(xmlDirPath, file);
processXMLFile(filePath);

