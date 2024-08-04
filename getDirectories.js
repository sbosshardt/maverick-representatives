// Based on code under "List all directories in a directory recursively in Node.js":
// https://bobbyhadz.com/blog/list-all-directories-in-directory-in-node-js#list-all-directories-in-a-directory-recursively-in-nodejs

const fs = require('fs');
const path = require('path');

function getDirectories(dirpath) {
  const directoriesToExclude = ['./'];

  return fs
    .readdirSync(dirpath)
    .map(file => path.join(dirpath, file))
    .filter(
      pth =>
        fs.statSync(pth).isDirectory() &&
        !directoriesToExclude.includes(pth),
    );
}

function getDirectoriesRecursive(dirpath) {
  return [
    dirpath,
    ...flatten(
      getDirectories(dirpath).map(getDirectoriesRecursive),
    ),
  ];
}

function flatten(arr) {
  return arr.slice().flat();
}

module.exports.getDirectories = getDirectories
module.exports.getDirectoriesRecursive = getDirectoriesRecursive