const axios = require('axios');
const fs = require('fs');
const path = require('path');
const nrc = require('./numRollCalls')

// Base URL for the XML files
const BASE_URL = 'https://clerk.house.gov/evs/2023/roll';

// Function to download a single file
const downloadFile = async (rollNumber, saveDir) => {
  const url = `${BASE_URL}${rollNumber.toString().padStart(3, '0')}.xml`;
  try {
    const savePath = path.join(saveDir, `roll${rollNumber.toString().padStart(3, '0')}.xml`);
    if (fs.existsSync(savePath)) {
      console.log("Skipping download of existing file:", savePath)
      return
    }
    console.log("Downloading roll call xml file to: ", savePath)
    const response = await axios.get(url, { responseType: 'stream' });
    const writer = fs.createWriteStream(savePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  } catch (error) {
    console.error(`Error downloading roll call ${rollNumber}:`, error.message);
    return null;
  }
};

// Function to download all files, given a congress number and sessions
const downloadAllFiles = async (congresses = [118], sessions = [1, 2]) => {
  //let congressInfo = nrc.getCongressNumAndSessionByYear(2024)
  //console.log(congressInfo)
  rcCounts = {}
  for (congress of congresses) {
    for (sess of sessions) {
      rcCounts[congress+"/"+sess] = await nrc.getNumRollcallsByCongressNumAndSession(congress, sess)
    }
  }
  console.log(rcCounts)
  for (const folder in rcCounts) {
    const totalRollCalls = rcCounts[folder]
    const rollCalls = Array.from({ length: totalRollCalls }, (_, i) => i + 1); // Assuming 640 roll calls
    // Directory to save the XML files
    const saveDir = path.join(__dirname, 'data/rollcalls/'+folder);
    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true });
      console.log('Created save directory for xml files download:', saveDir)
    }
    else {
      console.log('Downloading xml files to existing save directory:', saveDir)
    }
    for (const rollNumber of rollCalls) {
      console.log(`Downloading roll call ${rollNumber} for congress `+folder+`...`);
      await downloadFile(rollNumber, saveDir);
    }
  }
  console.log('File downloads completed.');
};

// Start the download process
downloadAllFiles();
