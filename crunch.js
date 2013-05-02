#!/usr/bin/env node

/*
npm install fast-levenshtein
*/

var levenshtein = require('fast-levenshtein');

var fs = require('fs');

var files = process.argv.slice(2);
if (0 == files.length) {
    console.log('Usage: crunch.js bigtent.log another_bigtent.log');
    process.exit(1);
}

/*
10.148.37.10_bigtent.log:{"level":"error","message":"No email matched, claimed alice@yahoo.com, have bob1234@yahoo.com","timestamp":"2013-04-12T22:43:28.801Z"}
*/
function parsableLogLine(line) {
  if (line.indexOf('No email matched, claimed ') === -1) {
    return false;
  } else {
    return true;
  }
}

function parseLogLine(line) {
  var start = 'No email matched, claimed ';
  var claimedStart = line.indexOf(start) + start.length;
  var claimedEnd = line.indexOf(',', claimedStart);
  var claimed = line.substring(claimedStart, claimedEnd);
  var next = ', have ';
  var mismatchedStart = line.indexOf(next, claimedEnd) + next.length;
  var mismatchedEnd = line.indexOf('"', mismatchedStart);
  var mismatched = line.substring(mismatchedStart, mismatchedEnd);
  return [claimed, mismatched];
}

function recordUniqueOpenID(uniqueOpenID) {
  var key = uniqueOpenID.toLowerCase();
  if (! uniqueOpenIDMap[key]) {
    uniqueOpenIDMap[key] = 0;
  }
  uniqueOpenIDMap[key]++;
}

function recordWrongDomain(cDomain, mDomain) {
  var key = mDomain.toLowerCase();
  if (! wrongDomainMap[key]) {
    wrongDomainMap[key] = 0;
  }
  wrongDomainMap[key]++;
}

function recordUnclassified(claimed, mismatched) {
  var key = claimed.toLowerCase();
  if (! unclassifiedClaimedMap[key]) {
    unclassifiedClaimedMap[key] = 0;
  }
  unclassifiedClaimedMap[key]++;
  key = mismatched.toLowerCase();
  if (! unclassifiedMismatchedMap) {
    unclassifiedMismatchedMap[key] = 0;
  }
  unclassifiedMismatchedMap[key]++;
}

console.log('crunching numbers');

// What to track
var errors = 0;
var uniqueOpenIDMap = {};
var exactLocalMatches = 0;
var caseInsensitiveLocalMatches = 0;
var wrongDomain = 0;
var wrongDomainMap = {};
var unclassified = 0;
var unclassifiedClaimedMap = {};
var unclassifiedMismatchedMap = {};
// Local Domains match, edit distance is 2 or less
var typos = 0;
files.forEach(function(file, i) {
  console.log('Processing ', file);
  var logs = fs.readFileSync(file, 'utf8');
  logs.split('\n').forEach(function(line, i) {
    if (parsableLogLine(line)) {
      errors++;
      var emails = parseLogLine(line);
      var claimed = emails[0];
      var cLocal = claimed.split('@')[0];
      var cDomain = claimed.split('@')[1];

      var mismatched = emails[1];
      var mLocal = mismatched.split('@')[0];
      var mDomain = mismatched.split('@')[1];

      recordUniqueOpenID(mismatched);
      
      if (cLocal === mLocal) {
	exactLocalMatches++;
	recordWrongDomain(cDomain, mDomain);
	//console.log(claimed.split('@')[0], mismatched.split('@')[0]);
      } else if (cLocal.toLowerCase() === mLocal.toLowerCase()) {
	caseInsensitiveLocalMatches++;
	//console.log(cLocal, mLocal);

      } else if (cDomain.toLowerCase() !== mDomain.toLowerCase()) {
	wrongDomain++;
	recordWrongDomain(cDomain, mDomain);

      // Edit distance 1 or 2 is probably a typo
      } else if (cDomain.toLowerCase() === mDomain.toLowerCase() &&
		 2 >= levenshtein.get(cLocal, mLocal)) {

	typos++;
	//console.log('Typo?', levenshtein.get(claimed.split('@')[0], mismatched.split('@')[0]), claimed.split('@')[0], mismatched.split('@')[0]);

      } else {
	unclassified++;
	recordUnclassified(claimed, mismatched);
	//console.log(claimed, mismatched);
      }
    }
  });
});
console.log('REPORT');
console.log('Exact Local Matches (wrong domain):\t', exactLocalMatches);
console.log('Case-insensitive Local Matches:\t\t', caseInsensitiveLocalMatches);
console.log('Probably Typos (yahoo.com):\t\t', typos);
console.log('Different Local and Wrong Domain:\t', wrongDomain);
console.log(Object.keys(wrongDomainMap).length + ' domains:');
Object.keys(wrongDomainMap).forEach(function(domain) {
  console.log('\t', domain, wrongDomainMap[domain]);
});
console.log('Unclassified Errors:\t\t\t', unclassified);
console.log('\t', Object.keys(unclassifiedClaimedMap).length + ' unique un-classifed claimed');
console.log('\t', Object.keys(unclassifiedMismatchedMap).length + ' unique un-classified mismatched');
console.log('-----------------------------');
console.log('Total number of errors:\t', errors);
console.log('Total number unique OpenID emails', Object.keys(uniqueOpenIDMap).length);