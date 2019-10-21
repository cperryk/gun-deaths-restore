const getCsv = require('get-csv');
const path = require('path');
const fs = require('fs');

getCsv(path.join(__dirname, 'data.csv'))
  .then(data => {
    data.forEach((row) => {
      const [ day, month, year ] = row.date.split('/');
      const date = new Date('20' + year, parseInt(month) - 1, parseInt(day));
      row.date = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
      row.isNewtown = row.date === '2012-12-14' && row.city === 'Newtown';
      row.victimID = parseInt(row.victimID);
      row.ageGroup = parseInt(row.ageGroup);
    })
    fs.writeFileSync('../data/victims.js', 'window.victims = ' + JSON.stringify(data));
  });