const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const csv = require('csv-parser');

// This script imports the CSV `drug-use-by-age.csv` into a sqlite database
// named `druguse.db`. It creates a table `drug_use` whose columns map to the
// CSV header fields (age, n, and the _use/_frequency pairs).

const DB_FILE = './druguse.db';
const CSV_FILE = 'drug-use-by-age.csv';

const db = new sqlite3.Database(DB_FILE);

// Columns based on the CSV header. Keep both *_use and *_frequency columns so
// we can present both types of routes (by use and by frequency).
const columns = [
  'age',
  'n',
  'alcohol_use', 'alcohol_frequency',
  'marijuana_use', 'marijuana_frequency',
  'cocaine_use', 'cocaine_frequency',
  'crack_use', 'crack_frequency',
  'heroin_use', 'heroin_frequency',
  'hallucinogen_use', 'hallucinogen_frequency',
  'inhalant_use', 'inhalant_frequency',
  'pain_releiver_use', 'pain_releiver_frequency',
  'oxycontin_use', 'oxycontin_frequency',
  'tranquilizer_use', 'tranquilizer_frequency',
  'stimulant_use', 'stimulant_frequency',
  'meth_use', 'meth_frequency',
  'sedative_use', 'sedative_frequency'
];

db.serialize(() => {
  db.run('DROP TABLE IF EXISTS drug_use');

  const createCols = columns.map(c => `${c} TEXT`).join(', ');
  db.run(`CREATE TABLE drug_use (${createCols})`);

  const placeholders = columns.map(() => '?').join(',');
  const insertSql = `INSERT INTO drug_use VALUES (${placeholders})`;
  const stmt = db.prepare(insertSql);

  fs.createReadStream(CSV_FILE)
    .pipe(csv())
    .on('data', (row) => {
      // Map CSV row to the columns order (some CSV values may be '-')
      const values = columns.map(col => {
        // CSV headers use the same names as our columns so this should match
        return row[col] !== undefined ? row[col] : null;
      });
      stmt.run(values);
    })
    .on('end', () => {
      stmt.finalize();
      db.close();
      console.log(`Database created successfully at ${DB_FILE}`);
    })
    .on('error', (err) => {
      console.error('Error reading CSV:', err);
    });
});
