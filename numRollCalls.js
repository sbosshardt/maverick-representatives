const axios = require('axios');
const fs = require('fs');
const path = require('path');

// URL for the roll call info
const VOTES_URL = 'https://clerk.house.gov/Votes/MemberVotes';

function parseForTotalRollCalls(htmlContent) {
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

async function getNumRollcallsByCongressNumAndSession(congressNum, session) {
  let sess = (session == 1) ? '1st' : '2nd'
  let url = VOTES_URL + '?CongressNum=' + congressNum + '&Session=' + sess
  console.log(url)
  const response = await axios.get(url);
  //fs.writeFileSync('./response.txt', JSON.stringify(response.data, null, 2) , 'utf-8');
  //console.log(response)
  let numRollCalls = parseForTotalRollCalls(response.data)
  //console.log('Number of roll calls: ', numRollCalls)
  return numRollCalls
}

async function getNumRollcallsByYear(year) {
  let {congressNum, session} = getCongressNumAndSessionByYear(year)
  console.log(congressNum)
  console.log(session)
  return await getNumRollcallsByCongressNumAndSession(congressNum, session)
}

//getNumRollcallsByYear(2024)

// console.log(getCongressNumAndSessionByYear(2020))
// console.log(getCongressNumAndSessionByYear(2021))
// console.log(getCongressNumAndSessionByYear(2022))
// console.log(getCongressNumAndSessionByYear(2023))
// console.log(getCongressNumAndSessionByYear(2024))

module.exports.getCongressNumAndSessionByYear = getCongressNumAndSessionByYear
module.exports.getNumRollcallsByCongressNumAndSession = getNumRollcallsByCongressNumAndSession
module.exports.getNumRollcallsByYear = getNumRollcallsByYear
