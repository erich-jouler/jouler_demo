// Reads the full 39MB CSV once and emits a compact columnar JSON that
// the browser can JSON.parse() in milliseconds (vs minutes for d3.csv + autoType).
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const csvPath = path.join(root, 'public', 'heat_pump_comparison_results.csv');
const outPath = path.join(root, 'public', 'thermal-data.json');

console.log(`Reading ${csvPath}...`);
const text = fs.readFileSync(csvPath, 'utf8');
const lines = text.split(/\r?\n/).filter(Boolean);
const header = lines[0].split(',');
console.log(`Columns: ${header.length}, Rows: ${lines.length - 1}`);

const buildingIds = [];
const seen = new Set();
for (const col of header) {
  const m = col.match(/^b_(\d+)_/);
  if (m && !seen.has(m[1])) {
    seen.add(m[1]);
    buildingIds.push(`b_${m[1]}`);
  }
}
buildingIds.sort((a, b) => +a.slice(2) - +b.slice(2));
console.log(`Buildings: ${buildingIds.length}`);

// Fields we actually use downstream:
const systemFields = [
  'outdoor_air_temp_c', 'outdoor_air_temp_f',
  'mass_flow_kgs',
  'borefield_1_heat_w', 'borefield_2_heat_w', 'borefield_3_heat_w', 'total_borefield_heat_w'
];
const buildingFieldSuffixes = [
  'inlet_temp_c', 'inlet_temp_f',
  'load_w', 'geo_cop', 'geo_electric_w', 'air_cop', 'air_electric_w'
];

const allFields = [...systemFields];
for (const b of buildingIds) {
  for (const s of buildingFieldSuffixes) allFields.push(`${b}_${s}`);
}

const colIndex = {};
header.forEach((name, i) => { colIndex[name] = i; });

const missing = allFields.filter(f => colIndex[f] === undefined);
if (missing.length) {
  console.error('Missing columns:', missing.slice(0, 10));
  process.exit(1);
}

const n = lines.length - 1;
const columns = {};
for (const f of allFields) columns[f] = new Array(n);

for (let i = 0; i < n; i++) {
  const cells = lines[i + 1].split(',');
  for (const f of allFields) {
    const v = +cells[colIndex[f]];
    columns[f][i] = Number.isNaN(v) ? 0 : Math.round(v * 1000) / 1000;
  }
}

const payload = {
  numHours: n,
  buildingIds,
  columns
};

const json = JSON.stringify(payload);
fs.writeFileSync(outPath, json);
const bytes = fs.statSync(outPath).size;
console.log(`Wrote ${outPath} (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
