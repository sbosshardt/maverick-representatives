// Node.js program to demonstrate the   
// Date.parse() method 
  
// Importing module 
const date = require('date-and-time') 
  
// Creating object of current date and time  
// by using Date()  
//const now  =  new Date('07-03-2021'); 
  
// Parsing the date and time 
// by using date.parse() method 
const parsed = date.parse('10-Mar-2023','D-MMM-YYYY'); 

const output = date.format(parsed, 'YYYY-MM-DD');

// Display the result 
console.log("parsed date and time : " + output)