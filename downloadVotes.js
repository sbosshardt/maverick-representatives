const axios = require('axios');
const fs = require('fs');
const path = require('path');
const nrc = require('./numRollCalls')

function parseCongressAndSessionFromPath(path) {
  const regex = /\/(\d+)\/(\d+)$/;
  const match = path.match(regex);

  if (match && match.length === 3) {
    const congress = parseInt(match[1], 10);
    const session = parseInt(match[2], 10);
    console.log(`Congress: ${congress}, Session: ${session}`);
    return {congressNum: congress, session: session}
  } else {
    console.error("The string does not match the expected pattern.");
  }
  return false
}

const downloadFileCommon = async (url, savePath) => {
  if (fs.existsSync(savePath)) {
    //console.log("Skipping download of existing file:", savePath)
    return null
  }
  try {
    console.log("Downloading roll call xml file to: ", savePath)
    const response = await axios.get(url, { responseType: 'stream' })
    const writer = fs.createWriteStream(savePath)
    response.data.pipe(writer)

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve)
      writer.on('error', reject)
    });
  } catch (error) {
    console.error(`Error downloading roll call ${rollNumber}:`, error.message)
    return null
  }
}

// Function to download a single file
const downloadFileHouse = async (rollNumber, saveDir) => {
  const {congressNum, session} = parseCongressAndSessionFromPath(saveDir)
  const year = nrc.getCongressYearByNumAndSession(congressNum, session)
  // Base URL for the XML files
  const endpoint = `https://clerk.house.gov/evs/${year}/roll`;
  const url = `${endpoint}${rollNumber.toString().padStart(3, '0')}.xml`;
  const savePath = path.join(saveDir, `roll${rollNumber.toString().padStart(3, '0')}.xml`);
  return await downloadFileCommon(url, savePath)
};

const downloadFileSenate = async (rollNumber, saveDir) => {
  const {congressNum, session} = parseCongressAndSessionFromPath(saveDir)
  const urlBegin = "https://www.senate.gov/legislative/LIS/roll_call_votes/"
  const rcNum = rollNumber.toString().padStart(5, '0')
  const urlEnd = `vote${congressNum}${session}/vote_${congressNum}_${session}_${rcNum}.xml`
  // Sample: https://www.senate.gov/legislative/LIS/roll_call_votes/vote1171/vote_117_1_00528.xml
  const url = urlBegin + urlEnd
  const savePath = path.join(saveDir, `vote_${congressNum}_${session}_${rcNum}.xml`);
  return await downloadFileCommon(url, savePath)
}

const downloadFile = async (chamber, rollNumber, saveDir) => {
  cha = chamber.toLowerCase()
  if (cha === 'house') {
    return downloadFileHouse(rollNumber, saveDir)
  }
  else if (cha === 'senate') {
    return downloadFileSenate(rollNumber, saveDir)
  }
  else {
    console.error('Unsupported value for chamber:', chamber)
    return false
  }
}

// Function to download all files, given a congress number and sessions
const downloadAllFiles = async (chambers = ["House", "Senate"], congresses = [118], sessions = [1, 2]) => {
  //let congressInfo = nrc.getCongressNumAndSessionByYear(2024)
  //console.log(congressInfo)
  rcCounts = {}
  for (const chamber of chambers) {
    const cha = chamber.toLowerCase()
    for (const congress of congresses) {
      for (const sess of sessions) {
        rcCounts[cha+"/"+congress+"/"+sess] = await nrc.getNumRollcallsByCongressNumAndSession(chamber, congress, sess)
      }
    }
  }
  console.log(rcCounts)
  for (const folder in rcCounts) {
    const totalRollCalls = rcCounts[folder]
    const rollCalls = Array.from({ length: totalRollCalls }, (_, i) => i + 1); // Assuming 640 roll calls
    // Directory to save the XML files
    const saveDir = path.join(__dirname, 'data/rollcalls/'+folder);
    const chamber = saveDir.includes('senate') ? 'senate' : (saveDir.includes('house') ? 'house' : null)
    console.log("saveDir:", saveDir, "chamber:", chamber)
    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true });
      console.log('Created save directory for xml files download:', saveDir)
    }
    else {
      console.log('Downloading xml files to existing save directory:', saveDir)
    }
    for (const rollNumber of rollCalls) {
      //console.log(`Downloading roll call ${rollNumber} for congress `+folder+`...`);
      await downloadFile(chamber, rollNumber, saveDir);
    }
  }
  console.log('File downloads completed.');
};

// Start the download process
//downloadAllFiles();

module.exports.downloadAllFiles = downloadAllFiles
