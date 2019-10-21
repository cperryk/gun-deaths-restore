const getCsv = require('get-csv');
const path = require('path');
const fs = require('fs');

const LOCATIONS_LIMIT = 1000;

getCsv(path.join(__dirname, 'raw-data.csv'))
  .then(data => {
    writeVictims(data);
    writeLocations(data);
  });

function writeVictims(data) {
  data.forEach((row) => {
    const [day, month, year] = row.date.split('/');
    const date = new Date('20' + year, parseInt(month) - 1, parseInt(day));
    row.date = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    row.isNewtown = row.date === '2012-12-14' && row.city === 'Newtown';
    row.victimID = parseInt(row.victimID);
    row.ageGroup = parseInt(row.ageGroup);
  })

  fs.writeFileSync(path.join(__dirname, 'victims.js'), 'window.victims = ' + JSON.stringify(data));
}

function writeLocations(data) {
  const locationsMap = data.reduce((map, curr) => {
    const key = `${curr.city}, ${curr.state}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        count: 1,
        lat: parseFloat(curr.lat).toFixed(2),
        lng: parseFloat(curr.lng).toFixed(2),
        city: curr.city,
        state: curr.state
      });
    } else {
      existing.count++;
    }
    return map;
  }, new Map());

  const locationsArr = [...locationsMap.values()];
  
  locationsArr.sort((a, b) => {
    if (a.count > b.count) {
      return -1;
    }
    if (a.count === b.count) {
      return 0;
    }
    return 1;
  });

  const locationsArrLimited = locationsArr.slice(0, LOCATIONS_LIMIT);

  fs.writeFileSync(path.join(__dirname, 'locations.js'), 'window.gunDeathsLocations = ' + JSON.stringify(locationsArrLimited));
}