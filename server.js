const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// The DB file created by create-db.js
const db = new sqlite3.Database(path.join(__dirname, 'druguse.db'));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Simple list of drugs (base names); we'll map to columns like `${drug}_use` or `${drug}_frequency`.
const DRUGS = [
  'alcohol', 'marijuana', 'cocaine', 'crack', 'heroin', 'hallucinogen',
  'inhalant', 'pain_releiver', 'oxycontin', 'tranquilizer', 'stimulant', 'meth', 'sedative'
];

// Helper: get list of ages in CSV order (rowid preserves insert order)
function getAllAges(callback) {
  db.all('SELECT rowid, age FROM drug_use ORDER BY rowid', (err, rows) => {
    callback(err, rows);
  });
}

app.get('/', (req, res) => {
  res.redirect('/ages');
});

// List ages
app.get('/ages', (req, res) => {
  getAllAges((err, rows) => {
    if (err) return res.status(500).send('Database error');
    res.render('ages', { ages: rows });
  });
});

// Detail for a specific age (e.g., /age/18)
app.get('/age/:age', (req, res) => {
  const ageParam = req.params.age;
  db.get('SELECT rowid, * FROM drug_use WHERE age = ?', [ageParam], (err, row) => {
    if (err) return res.status(500).send('Database error');
    if (!row) {
      return res.status(404).render('404', { message: `Error: no data for age ${ageParam}` });
    }

    // build an array of drugs with their use values for the template/chart
    const drugs = DRUGS.map(d => ({
      key: d,
      value: parseFloat(row[`${d}_use`]) || 0
    }));

    // precompute JSON strings for labels/data to avoid complex expressions in EJS templates
    const labelsJson = JSON.stringify(drugs.map(d => d.key));
    const dataJson = JSON.stringify(drugs.map(d => d.value));

    // compute prev/next ages for navigation
    getAllAges((err2, allAges) => {
      if (err2) return res.status(500).send('Database error');
      const idx = allAges.findIndex(r => r.rowid === row.rowid || r.age === row.age);
      const prev = allAges[(idx - 1 + allAges.length) % allAges.length];
      const next = allAges[(idx + 1) % allAges.length];
      res.render('age', { row, drugs, prevAge: prev.age, nextAge: next.age, labelsJson, dataJson });
    });
  });
});

// List of drugs
app.get('/drugs', (req, res) => {
  res.render('drugs', { drugs: DRUGS });
});

// Detail for a specific drug across ages (e.g., /drug/alcohol)
app.get('/drug/:drug', (req, res) => {
  const drug = req.params.drug;
  if (!DRUGS.includes(drug)) {
    return res.status(404).render('404', { message: `Error: no data for drug ${drug}` });
  }
  const col = `${drug}_use`;
  db.all(`SELECT rowid, age, ${col} AS value FROM drug_use ORDER BY rowid`, (err, rows) => {
    if (err) return res.status(500).send('Database error');
    if (!rows || rows.length === 0) return res.status(404).render('404', { message: `Error: no data for drug ${drug}` });

    // prev/next drug for navigation
    const idx = DRUGS.indexOf(drug);
    const prevDrug = DRUGS[(idx - 1 + DRUGS.length) % DRUGS.length];
    const nextDrug = DRUGS[(idx + 1) % DRUGS.length];

    // pass JSON strings for client-side charts
    const labelsJson = JSON.stringify(rows.map(r => r.age));
    const dataJson = JSON.stringify(rows.map(r => parseFloat(r.value) || 0));

    res.render('drug', { drug, rows, prevDrug, nextDrug, labelsJson, dataJson });
  });
});

// Frequency routes: show frequency series for a drug (default: alcohol)
app.get('/frequency', (req, res) => {
  const drug = req.query.drug || 'alcohol';
  if (!DRUGS.includes(drug)) {
    return res.status(404).render('404', { message: `Error: no data for frequency of ${drug}` });
  }
  const col = `${drug}_frequency`;
  db.all(`SELECT rowid, age, ${col} AS value FROM drug_use ORDER BY rowid`, (err, rows) => {
    if (err) return res.status(500).send('Database error');
    const labelsJson = JSON.stringify(rows.map(r => r.age));
    const dataJson = JSON.stringify(rows.map(r => parseFloat(r.value) || 0));
    res.render('frequency', { drug, rows, drugs: DRUGS, labelsJson, dataJson });
  });
});

// Generic 404 for other routes
app.use((req, res) => {
  res.status(404).render('404', { message: `Error: No data found for ${req.url}` });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
