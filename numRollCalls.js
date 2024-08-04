const axios = require('axios');
const fs = require('fs');
const path = require('path');

function parseForTotalHouseRollCalls(htmlContent) {
  // Check for "No Votes Found" text
  if (htmlContent.includes('No Votes Found')) {
    return 0;
  }

  // Define a regular expression to extract the number of results
  const regex = /<div class="pagination_info">[^<]*of (\d+) Results<\/div>/;
  const match = htmlContent.match(regex);

  if (match && match[1]) {
    return parseInt(match[1], 10);
  }

  // If no match is found, return 0
  return 0;
}

function parseForTotalSenateRollCalls(xmlContent) {
  // Define a regular expression to extract the number of results
  // <vote_number>00230</vote_number>
  const regex = /<vote_number>[0]*(\d+)<\/vote_number>/;
  const match = xmlContent.match(regex);

  if (match && match[1]) {
    return parseInt(match[1], 10);
  }

  // If no match is found, return 0
  return 0;
}

// Invalid for 76th Congress and earlier
// https://www.senate.gov/legislative/DatesofSessionsofCongress.htm
function getCongressNumAndSessionByYear(year) {
  // FYI: 2024 is 118th congress, 2nd session
  //      2023 is 118th congress, 1st session
  return data = {
    congressNum: Math.floor((year - 1787) / 2),
    session: (year % 2 == 0) ? 2 : 1,
  }
}

function getCongressYearByNumAndSession(congressNum, session) {
  let year = Math.floor(1787 + (congressNum * 2))
  if ((session === 2) || (session === '2') || (session == '2nd')) {
    year = year + 1
  }
  return year
}

async function getNumRollcallsHouse(congressNum, session) {
  const sess = (session == 1) ? '1st' : '2nd'
  // URL for the roll call info
  const endpoint = 'https://clerk.house.gov/Votes/MemberVotes';
  const url = endpoint + '?CongressNum=' + congressNum + '&Session=' + sess
  console.log("url for house rollcalls:", url)
  const response = await axios.get(url);
  //fs.writeFileSync('./response-house.txt', JSON.stringify(response.data, null, 2) , 'utf-8');
  //console.log(response)
  const numRollCalls = parseForTotalHouseRollCalls(response.data)
  //console.log('Number of roll calls: ', numRollCalls)
  return numRollCalls
}

async function getNumRollcallsSenate(congressNum, session) {
  const url = "https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_"+congressNum+"_"+session+".xml"
  console.log("url for senate rollcalls:", url)
  const response = await axios.get(url);
  //fs.writeFileSync('./response-senate.txt', JSON.stringify(response.data, null, 2) , 'utf-8');
  const numRollCalls = parseForTotalSenateRollCalls(response.data)
  return numRollCalls
}

async function getNumRollcallsByCongressNumAndSession(chamber, congressNum, session) {
  if (chamber.toLowerCase() === 'senate') {
    const num = await getNumRollcallsSenate(congressNum, session)
    return num
  }
  else if (chamber.toLowerCase() === 'house') {
    const num = await getNumRollcallsHouse(congressNum, session)
    return num
  }
  else {
    console.error('Unsupported value for chamber:', chamber)
    return false
  }
}

async function getNumRollcallsByYear(chamber, year) {
  let {congressNum, session} = getCongressNumAndSessionByYear(year)
  //console.log(congressNum)
  //console.log(session)
  const numRCs = await getNumRollcallsByCongressNumAndSession(chamber, congressNum, session)
  return numRCs
}

async function testGetRCs() {
  const houseRCs = await getNumRollcallsByYear("House", 2024)
  console.log(houseRCs)
  const senateRCs = await getNumRollcallsByYear("Senate", 2024)
  console.log(senateRCs)
}
//testGetRCs()

function testGetYear() {
  console.log(getCongressYearByNumAndSession(118, 2))
  console.log(getCongressYearByNumAndSession('118', '1st'))
}
//testGetYear()

// console.log(getCongressNumAndSessionByYear("House", 2020))
// console.log(getCongressNumAndSessionByYear("House", 2021))
// console.log(getCongressNumAndSessionByYear("House", 2022))
// console.log(getCongressNumAndSessionByYear("House", 2023))
// console.log(getCongressNumAndSessionByYear("House", 2024))

module.exports.getCongressNumAndSessionByYear = getCongressNumAndSessionByYear
module.exports.getCongressYearByNumAndSession = getCongressYearByNumAndSession
module.exports.getNumRollcallsByCongressNumAndSession = getNumRollcallsByCongressNumAndSession
module.exports.getNumRollcallsByYear = getNumRollcallsByYear
