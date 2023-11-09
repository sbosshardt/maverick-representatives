const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Base URL for the XML files
const BASE_URL = 'https://clerk.house.gov/evs/2023/roll';

// Directory to save the XML files
const SAVE_DIR = path.join(__dirname, 'votes');
if (!fs.existsSync(SAVE_DIR)) {
  fs.mkdirSync(SAVE_DIR, { recursive: true });
}

// Function to download a single file
const downloadFile = async (rollNumber) => {
  const url = `${BASE_URL}${rollNumber.toString().padStart(3, '0')}.xml`;
  try {
    const response = await axios.get(url, { responseType: 'stream' });
    const savePath = path.join(SAVE_DIR, `roll${rollNumber.toString().padStart(3, '0')}.xml`);
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

// Function to download all files
const downloadAllFiles = async () => {
  const rollCalls = Array.from({ length: 640 }, (_, i) => i + 1); // Assuming 640 roll calls
  for (const rollNumber of rollCalls) {
    console.log(`Downloading roll call ${rollNumber}...`);
    await downloadFile(rollNumber);
  }
  console.log('All files downloaded.');
};

// Start the download process
downloadAllFiles();
