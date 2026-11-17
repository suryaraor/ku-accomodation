// Google Apps Script backend for KU Housing Fit
// Open the Google Sheet > Extensions > Apps Script > paste this file > Deploy as Web app
// (Execute as: Me, Who has access: Anyone). Every tab below is created and seeded on first load,
// so an empty spreadsheet is enough. Edit the Housing, Dining and Costs tabs to keep prices current.

const HOUSING_SHEET = 'Housing';
const DINING_SHEET = 'Dining';
const COSTS_SHEET = 'Costs';
const REVIEWS_SHEET = 'Reviews';

// ---------- Housing options (one row per option) ----------
// Type: room | suite | apartment. Kitchen: in unit | shared | none.
// Who Can Live Here: "All" or "Freshmen only". Availability: Open, Filling fast, Waitlist or Full (blank = unknown).
// Pros and Cons: separate items with ";". Set Active to "no" to hide an option.
// Don't change a Key once students have reviewed that option.
const HOUSING_HEADERS = ['Key', 'Name', 'Area', 'Type', 'Unit Size', 'People Per Bath', 'Price Per Year', 'Kitchen',
  'Furnished', 'Laundry', 'Meal Plan Required', 'Closest Dining', 'Who Can Live Here', 'Availability', 'Style',
  'Pros', 'Cons', 'Details', 'Link', 'Active',
  'Commute Minutes', 'Commute', 'Car Needed', 'Lease', 'Minutes Without Car'];
// Commute Minutes: typical door-to-class time (walk on campus, drive off campus). Minutes Without Car: the trip by bus or on
// foot for students without a car (blank = same as Commute Minutes). Car Needed: no, helpful or yes.
// Bump SEED_VERSION when adding columns or options: a live sheet gets the new columns (filled in for the options
// already there, blank cells only) and the new options appended once, without touching anything you edited.
const SEED_VERSION = 3;
const RATES_LINK = 'https://housing.ku.edu/2026-2027-rates';
const HOUSING_SEED = [
  ['self-2', 'Self Hall: 2-person room', 'Daisy Hill', 'room', 2, 2, 9568, 'none', 'yes', 'In building', 'yes', "Mrs. E's", 'Freshmen only', '',
    '2-person room with bath',
    'Only one roommate;Bathroom shared with just your roommate;Laundry provided;Furnished',
    'No kitchen;One of the pricier options;New freshmen only',
    'Rate is for a randomly assigned roommate. Extra-long twin beds (36" x 80"), desk, desk chair and dresser. About 3 ft of closet space per person.',
    RATES_LINK, 'yes', 12, 'About 12 min walk to Jayhawk Blvd', 'no', 'Academic year', ''],
  ['oswald-self-suite', 'Oswald or Self: 4-person suite', 'Daisy Hill', 'suite', 4, 4, 10600, 'none', 'yes', 'In building', 'yes', "Mrs. E's", 'All', '',
    '4-person suite with bath',
    "Suite has its own bathroom;Furnished;Close to Mrs. E's dining",
    'Most expensive option;No kitchen;4 people share a bathroom',
    '', RATES_LINK, 'yes', 12, 'About 12 min walk to Jayhawk Blvd', 'no', 'Academic year', ''],
  ['downs', 'Downs Hall', 'Central District', 'suite', 4, 2, 9568, 'shared', 'yes', 'In building', 'yes', 'South Commons', 'All', '',
    '4-person, 2 baths, shared bedrooms, no living room',
    'Kitchen on the main floor;South Commons dining close by;Laundry provided;Furnished;2 bathrooms for 4 people',
    'Pricier;Shared kitchen;No living room',
    'Extra-long twin beds, desk, desk chair and dresser. Bedrooms in the 4-person rooms are about 11.5 x 15.5 ft.',
    RATES_LINK, 'yes', 15, 'About 15 min walk; KU buses nearby', 'no', 'Academic year', ''],
  ['templin-ellsworth-lewis', 'Templin, Ellsworth or Lewis: 4-person suite', 'Daisy Hill', 'suite', 4, 4, 8460, 'none', 'yes', 'In building', 'yes', "Mrs. E's (inside Lewis)", 'All', '',
    '4-person suite with bath',
    "Cheaper than Self and Oswald;Mrs. E's dining is inside Lewis;Suite has its own bathroom",
    'No kitchen;4 people share a bathroom',
    '', RATES_LINK, 'yes', 12, 'About 12 min walk to Jayhawk Blvd', 'no', 'Academic year', ''],
  ['jayhawker-towers', 'Jayhawker Towers A or D', 'Daisy Hill (edge)', 'apartment', 4, 4, 6090, 'in unit', 'no', 'Tower Gallery', 'no', '', 'All', '',
    'Apartment: living room, kitchen, bathroom and 2 shared bedrooms',
    'Cheapest option;Full kitchen with dishwasher and refrigerator;Living room;Meal plan is optional;Laundry in the Tower Gallery',
    'May need to rent furniture;Bring more of your own things;No laundry in the apartment;1 bathroom for 4 people',
    'Popular with upperclassmen, transfer and non-traditional students. Dining plans are optional for apartment residents.',
    RATES_LINK, 'yes', 8, 'About 8 min walk to Jayhawk Blvd', 'no', 'Academic year', ''],
  ['stouffer-2', 'Stouffer Place: 2-person apartment', 'Central District', 'apartment', 2, 1, 13564, 'in unit', 'yes', '', 'yes', 'South Commons', 'Freshmen only', '', '2-person apartment, private bedroom and private bath', 'Your own bedroom and bathroom;Full-size bed;Full kitchen (stove, refrigerator, dishwasher);Furnished living room;All utilities included', 'Most expensive option;First-year students only', 'KU lists Stouffer under both residence halls (dining plan required) and apartments (dining plan optional); confirm which applies. Not on the 2027-28 returning-student list. 1835 Ousdahl Rd.', RATES_LINK, 'yes', 15, 'About 15 min walk; KU buses nearby', 'no', 'Academic year', ''],
  ['stouffer-private', 'Stouffer Place: 4 or 6-person, private rooms', 'Central District', 'apartment', 4, 1, 12500, 'in unit', 'yes', '', 'yes', 'South Commons', 'Freshmen only', '', '4- or 6-person apartment, private bedroom and private bath', 'Your own bedroom and bathroom;Full-size bed;Full kitchen (stove, refrigerator, dishwasher);Furnished living room;All utilities included', 'Pricey;First-year students only', 'Same price for the 4- and 6-person private-room layouts. KU lists Stouffer under both residence halls (dining plan required) and apartments (dining plan optional); confirm which applies. Not on the 2027-28 returning-student list. 1835 Ousdahl Rd.', RATES_LINK, 'yes', 15, 'About 15 min walk; KU buses nearby', 'no', 'Academic year', ''],
  ['stouffer-6-shared', 'Stouffer Place: 6-person, shared bedroom', 'Central District', 'apartment', 6, 2, 10546, 'in unit', 'yes', '', 'yes', 'South Commons', 'Freshmen only', '', '6-person apartment, shared bedroom and shared bath', 'Cheapest way into Stouffer;Full kitchen (stove, refrigerator, dishwasher);Furnished living room;All utilities included', 'Shared bedroom;6 people in the apartment;First-year students only', 'Extra-long twin beds that can be lofted or bunked. KU lists Stouffer under both residence halls (dining plan required) and apartments (dining plan optional); confirm which applies. Not on the 2027-28 returning-student list. 1835 Ousdahl Rd.', RATES_LINK, 'yes', 15, 'About 15 min walk; KU buses nearby', 'no', 'Academic year', ''],
  ['connection-lawrence', 'The Connection at Lawrence (4-bed)', 'Off campus, south', 'apartment', 4, 1, 8580, 'in unit', 'yes', 'In unit', 'no', '', 'All', '', 'Off-campus 4 bed / 4 bath apartment, individual lease', 'Your own bedroom and bathroom;Washer and dryer in the apartment;Fully furnished;Full kitchen with dishwasher;Pool, gym and study rooms;Water, trash and internet included', '12-month lease, so you pay for summer;About 2 miles from campus;Price is an estimate;Electricity may be extra;Lease cannot be broken (you must re-let)', 'Price is an estimate: KU off-campus housing lists $1,200 to $2,860 a month for 1 to 4 bed units, about $715 a bed for a 4-bed. Confirm with the leasing office, (785) 842-3336. 3100 Ousdahl Rd. One assigned parking space. A KU ID rides Lawrence buses free; check which route stops nearby. Meal plan optional (KU offers a $440 Dining Dollars plan).', 'https://www.connectionatlawrence.com/', 'yes', 10, 'About 10 min drive (2 mi); about 25 min by bus (estimate, check the route); about 50 min walk', 'helpful', '12 months (Aug-Jul), individual lease', 25]
];

// ---------- Meal plans (prices per semester) ----------
// Meals Per Week: a number, or "Unlimited". Residence Halls: "yes" if hall residents may choose it
// (a KU dining plan is required with a residence hall contract).
const DINING_HEADERS = ['Key', 'Name', 'Price Per Semester', 'Meals Per Week', 'Dining Dollars Per Semester', 'Residence Halls', 'Notes', 'Active'];
const DINING_SEED = [
  ['14', '14 meals a week', 2501, 14, 600, 'yes', '', 'yes'],
  ['10', '10 meals a week', 2331, 10, 1000, 'yes', 'Fewer swipes, more Dining Dollars for cafes and markets', 'yes'],
  ['premium', 'Premium (unlimited)', 2572, 'Unlimited', 300, 'yes', '', 'yes'],
  ['440', '440 Dining Dollars', 440, 0, 440, 'no', 'Dining Dollars only, no swipes. For apartment residents who mostly cook.', 'yes']
];

// ---------- Other yearly costs, used for the all-in estimate ----------
const COSTS_HEADERS = ['Item', 'Per Year', 'Notes'];
const COSTS_SEED = [
  ['Tuition', 11844, 'Estimate. Check KU tuition for your program and residency.'],
  ['Fees', 1065, ''],
  ['Books and supplies', 778, ''],
  ['Transportation', 2600, '']
];

// ---------- Student reviews (one row per review) ----------
// Type "yes" in Hidden to take a review down. Reviews reported by readers REPORT_HIDE_AT times are hidden too;
// clear the Reports cell to bring one back.
const REVIEW_HEADERS = ['Submitted At', 'Review ID', 'Option Key', 'Option', 'Name', 'I Am', 'Year Lived There',
  'Meal Plan', 'Meal Plan Was', 'Overall', 'Value', 'Social', 'Quiet', 'Clean', 'Location', 'Recommend',
  'Pros', 'Cons', 'Tips', 'Hidden', 'Reports', 'Source'];
// Source "Resident check-in" = sent from the resident link (?resident); those reviews count double and show first.
const RESIDENT_SOURCE = 'Resident check-in';
const RESIDENT_WEIGHT = 2;

// ---------- Resident check-ins: residents confirm or correct an option's details ----------
// One row per detail per check-in. A correction is used on the page once APPLY_AT residents report the same
// new value and they outnumber the residents who confirmed the current one. Status: "approved" uses that row's
// value right away; "rejected" ignores the row.
const UPDATES_SHEET = 'Resident Updates';
const UPDATE_HEADERS = ['Submitted At', 'Check-in ID', 'Option Key', 'Option', 'Detail', 'Column', 'Listed Value',
  'Resident Value', 'Resident Said', 'As Entered', 'Name', 'Status'];
const APPLY_AT = 2;
const CHECK_FIELDS = {
  price: { col: 'Price Per Year', min: 1000, max: 40000 },
  mealRequired: { col: 'Meal Plan Required', values: ['yes', 'no'] },
  kitchen: { col: 'Kitchen', values: ['in unit', 'shared', 'none'] },
  furnished: { col: 'Furnished', values: ['yes', 'no'] },
  laundry: { col: 'Laundry', values: ['In unit', 'In building', 'Nearby', 'None'] },
  perBath: { col: 'People Per Bath', min: 1, max: 8 },
  commuteMin: { col: 'Commute Minutes', min: 1, max: 120 },
  car: { col: 'Car Needed', values: ['no', 'helpful', 'yes'] },
  lease: { col: 'Lease', values: ['Academic year', '12 months (Aug-Jul)', 'Other'] }
};
const RATING_FIELDS = ['overall', 'value', 'social', 'quiet', 'clean', 'location'];
const I_AM = ['Living there now', 'Lived there before'];
const MEAL_PLAN_WAS = ['Too much', 'Just right', 'Not enough'];
const RECOMMEND = ['Yes', 'Maybe', 'No'];
const TEXT_MAX = 500;
const NAME_MAX = 40;
const REPORT_HIDE_AT = 3;
const MAX_REVIEWS_PER_HOUR = 40; // simple brake on spam across everyone

function doGet(e) {
  const p = e.parameter || {};
  let result;
  try {
    upgradeSheets();
    switch (p.action) {
      case 'getData':
        result = getData();
        break;
      case 'addReview':
        result = withLock(() => addReview(p));
        break;
      case 'reportReview':
        result = withLock(() => reportReview(p.id));
        break;
      case 'residentSubmit':
        result = withLock(() => residentSubmit(p));
        break;
      default:
        result = { success: false, error: 'Unknown action' };
    }
  } catch (err) {
    result = { success: false, error: String(err) };
  }

  // JSONP so the static page works from GitHub Pages / any host without CORS issues
  if (p.callback && /^[\w.]+$/.test(p.callback)) {
    return ContentService.createTextOutput(`${p.callback}(${JSON.stringify(result)})`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function spreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet() ||
    SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
}

// Adds any header in `headers` that the sheet's first row is missing, at the end. Returns the full header row.
function addMissingColumns(sheet, headers) {
  const head = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0].map(h => String(h).trim());
  const added = headers.filter(h => head.indexOf(h) === -1);
  if (added.length) {
    sheet.getRange(1, head.length + 1, 1, added.length).setValues([added]).setFontWeight('bold');
    added.forEach(h => head.push(h));
  }
  return { head: head, added: added };
}

// One-time upgrade of an existing sheet to SEED_VERSION: adds new Housing and Reviews columns (Housing ones filled
// in for the options already there, blank cells only) and appends options never seeded before. An option you
// delete is not added back (keys already seeded are remembered); set Active to "no" to hide one.
function upgradeSheets() {
  const props = PropertiesService.getScriptProperties();
  if (Number(props.getProperty('SEED_VERSION') || 1) >= SEED_VERSION) return;
  withLock(() => {
    if (Number(props.getProperty('SEED_VERSION') || 1) >= SEED_VERSION) return;
    const reviews = spreadsheet().getSheetByName(REVIEWS_SHEET);
    if (reviews) addMissingColumns(reviews, REVIEW_HEADERS);
    const seeded = JSON.parse(props.getProperty('SEEDED_KEYS') || '[]');
    const sheet = spreadsheet().getSheetByName(HOUSING_SHEET);
    if (sheet) {
      const { head, added } = addMissingColumns(sheet, HOUSING_HEADERS);
      const data = sheet.getDataRange().getValues();
      const keyCol = head.indexOf('Key');
      const rowOf = {};
      for (let i = 1; i < data.length; i++) rowOf[String(data[i][keyCol]).trim()] = i + 1;
      HOUSING_SEED.forEach(seed => {
        const o = {};
        HOUSING_HEADERS.forEach((h, j) => { o[h] = seed[j]; });
        const row = rowOf[o['Key']];
        if (!row) {
          if (seeded.indexOf(o['Key']) === -1) sheet.appendRow(head.map(h => (h in o ? o[h] : '')));
          return;
        }
        added.forEach(h => {
          const cell = sheet.getRange(row, head.indexOf(h) + 1);
          if (cell.getValue() === '') cell.setValue(o[h]);
        });
      });
      SpreadsheetApp.flush();
    }
    props.setProperty('SEEDED_KEYS', JSON.stringify(HOUSING_SEED.map(s => s[0])));
    props.setProperty('SEED_VERSION', String(SEED_VERSION));
  });
}

function ensureSheet(name, headers, seed) {
  const ss = spreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    if (seed && seed.length) sheet.getRange(2, 1, seed.length, seed[0].length).setValues(seed);
  }
  return sheet;
}

// Rows as { header: value } objects, skipping blank rows
function readObjects(name, headers, seed) {
  const data = ensureSheet(name, headers, seed).getDataRange().getValues();
  const head = data[0].map(h => String(h).trim());
  const out = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i].every(v => v === '')) continue;
    const o = { _row: i + 1 };
    head.forEach((h, j) => { if (h) o[h] = data[i][j] instanceof Date ? data[i][j].toISOString() : data[i][j]; });
    out.push(o);
  }
  return out;
}

const isNo = v => String(v || '').trim().toLowerCase() === 'no';
const isYes = v => /^(y|yes|true|1)$/i.test(String(v || '').trim());
const strip = o => { const c = Object.assign({}, o); delete c._row; return c; };

function visibleReviews() {
  return readObjects(REVIEWS_SHEET, REVIEW_HEADERS)
    .filter(r => r['Review ID'] && !isYes(r['Hidden']) && (Number(r['Reports']) || 0) < REPORT_HIDE_AT);
}

function getData() {
  const housing = readObjects(HOUSING_SHEET, HOUSING_HEADERS, HOUSING_SEED).filter(r => r['Key'] && !isNo(r['Active']));
  const dining = readObjects(DINING_SHEET, DINING_HEADERS, DINING_SEED).filter(r => r['Key'] && !isNo(r['Active']));
  const costs = readObjects(COSTS_SHEET, COSTS_HEADERS, COSTS_SEED).filter(r => r['Item']);
  // Only what the page shows: no Hidden/Reports columns
  const reviews = visibleReviews().map(r => ({
    id: String(r['Review ID']),
    at: r['Submitted At'],
    key: String(r['Option Key']),
    name: String(r['Name'] || ''),
    iam: String(r['I Am'] || ''),
    yearLived: String(r['Year Lived There'] || ''),
    mealPlan: String(r['Meal Plan'] || ''),
    mealPlanWas: String(r['Meal Plan Was'] || ''),
    overall: Number(r['Overall']) || 0,
    value: Number(r['Value']) || 0,
    social: Number(r['Social']) || 0,
    quiet: Number(r['Quiet']) || 0,
    clean: Number(r['Clean']) || 0,
    location: Number(r['Location']) || 0,
    recommend: String(r['Recommend'] || ''),
    pros: String(r['Pros'] || ''),
    cons: String(r['Cons'] || ''),
    tips: String(r['Tips'] || ''),
    resident: String(r['Source'] || '') === RESIDENT_SOURCE
  })).reverse(); // newest first
  return {
    success: true,
    housing: housing.map(strip),
    dining: dining.map(strip),
    costs: costs.map(strip),
    reviews: reviews,
    residentInfo: residentInfo(housing),
    residentWeight: RESIDENT_WEIGHT
  };
}

// Same value, same spelling: numbers rounded, choices matched to the allowed list
function normField(f, v) {
  const def = CHECK_FIELDS[f];
  if (!def) return '';
  if (def.values) {
    const s = String(v === undefined || v === null ? '' : v).trim().toLowerCase();
    const hit = def.values.find(x => x.toLowerCase() === s || (s && x.toLowerCase().indexOf(s) === 0) || (s && s.indexOf(x.toLowerCase()) === 0));
    if (hit) return hit;
    if (f === 'mealRequired' || f === 'furnished') return /^(y|true|1)/.test(s) ? 'yes' : s ? 'no' : '';
    if (f === 'lease' && /12/.test(s)) return '12 months (Aug-Jul)';
    return '';
  }
  const n = Math.round(Number(String(v).replace(/[$,\s]/g, '')));
  return n >= def.min && n <= def.max ? String(n) : '';
}

// { optionKey: { detail: { votes: [{ value, n }], listed, applied } } } from the Resident Updates tab
function residentInfo(housing) {
  const sheet = spreadsheet().getSheetByName(UPDATES_SHEET);
  if (!sheet) return {};
  const out = {};
  readObjects(UPDATES_SHEET, UPDATE_HEADERS).forEach(r => {
    const status = String(r['Status'] || '').trim().toLowerCase();
    const k = String(r['Option Key']);
    const f = String(r['Detail']);
    const v = normField(f, r['Resident Value']);
    if (status === 'rejected' || !CHECK_FIELDS[f] || !v) return;
    const o = ((out[k] = out[k] || {})[f] = out[k][f] || { tally: {}, approved: '' });
    o.tally[v] = (o.tally[v] || 0) + 1;
    if (status === 'approved') o.approved = v;
  });
  Object.keys(out).forEach(k => {
    const row = housing.find(h => String(h['Key']) === k) || {};
    Object.keys(out[k]).forEach(f => {
      const o = out[k][f];
      const listed = normField(f, row[CHECK_FIELDS[f].col]);
      const votes = Object.keys(o.tally).map(value => ({ value: value, n: o.tally[value] })).sort((a, b) => b.n - a.n);
      const best = votes.find(x => x.value !== listed);
      const forListed = o.tally[listed] || 0;
      out[k][f] = {
        votes: votes,
        listed: listed,
        applied: o.approved || (best && best.n >= APPLY_AT && best.n > forListed ? best.value : '')
      };
    });
  });
  return out;
}

// Free text from the page: trimmed, capped, and never read by the sheet as a formula
function clean(v, max) {
  let s = String(v || '').replace(/\s+\n/g, '\n').trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function rating(v) {
  const n = Math.round(Number(v));
  return n >= 1 && n <= 5 ? n : '';
}

function oneOf(v, list) {
  return list.indexOf(String(v || '')) !== -1 ? String(v) : '';
}

function activeOption(key) {
  return readObjects(HOUSING_SHEET, HOUSING_HEADERS, HOUSING_SEED)
    .filter(r => r['Key'] && !isNo(r['Active']))
    .find(h => String(h['Key']) === String(key));
}

// Brake on floods across everyone: reviews plus check-ins in the last hour
function tooBusy() {
  const hourAgo = Date.now() - 3600 * 1000;
  const recent = r => new Date(r['Submitted At']).getTime() > hourAgo;
  const n = readObjects(REVIEWS_SHEET, REVIEW_HEADERS).filter(recent).length +
    (spreadsheet().getSheetByName(UPDATES_SHEET) ? new Set(readObjects(UPDATES_SHEET, UPDATE_HEADERS).filter(recent).map(r => r['Check-in ID'])).size : 0);
  return n >= MAX_REVIEWS_PER_HOUR;
}

// Writes one review row; returns its id, or an { error } when it's a duplicate
function writeReview(p, option, iam, overall, source, id) {
  const sheet = ensureSheet(REVIEWS_SHEET, REVIEW_HEADERS);
  const pros = clean(p.pros, TEXT_MAX);
  const cons = clean(p.cons, TEXT_MAX);
  const tips = clean(p.tips, TEXT_MAX);
  const dupe = readObjects(REVIEWS_SHEET, REVIEW_HEADERS).some(r => String(r['Option Key']) === option['Key'] &&
    String(r['Pros']) === pros && String(r['Cons']) === cons && String(r['Tips']) === tips && Number(r['Overall']) === Number(overall));
  if (dupe) return { error: 'This review is already posted' };
  const dining = readObjects(DINING_SHEET, DINING_HEADERS, DINING_SEED);
  const plan = dining.find(d => String(d['Key']) === String(p.mealPlan));
  // Write by header so the row lines up even if columns were added later
  const head = addMissingColumns(sheet, REVIEW_HEADERS).head;
  const v = {
    'Submitted At': new Date(), 'Review ID': id, 'Option Key': option['Key'], 'Option': option['Name'],
    'Name': clean(p.name, NAME_MAX), 'I Am': iam, 'Year Lived There': clean(p.yearLived, 12),
    'Meal Plan': plan ? plan['Name'] : (p.mealPlan === 'none' ? 'None' : ''), 'Meal Plan Was': oneOf(p.mealPlanWas, MEAL_PLAN_WAS),
    'Overall': overall, 'Value': rating(p.value), 'Social': rating(p.social), 'Quiet': rating(p.quiet),
    'Clean': rating(p.clean), 'Location': rating(p.location), 'Recommend': oneOf(p.recommend, RECOMMEND),
    'Pros': pros, 'Cons': cons, 'Tips': tips, 'Hidden': '', 'Reports': '', 'Source': source
  };
  sheet.appendRow(head.map(h => (h in v ? v[h] : '')));
  return { id: id };
}

function addReview(p) {
  if (p.website) return { success: true }; // honeypot field: bots fill it, people never see it
  const option = activeOption(p.key);
  if (!option) return { success: false, error: 'Pick where you live or lived' };
  const overall = rating(p.overall);
  if (!overall) return { success: false, error: 'Give an overall rating' };
  const iam = oneOf(p.iam, I_AM);
  if (!iam) return { success: false, error: 'Tell us if you live there now or lived there before' };
  if (tooBusy()) return { success: false, error: 'Lots of reviews just came in. Please try again in a little while.' };
  const w = writeReview(p, option, iam, overall, 'Review form', Utilities.getUuid().slice(0, 8));
  if (w.error) return { success: false, error: w.error };
  SpreadsheetApp.flush();
  const out = getData();
  out.added = w.id;
  return out;
}

// Resident link: confirmed/corrected details (p.checks, JSON { detail: value }) plus an optional review.
// Price can be entered per month or per semester (p.pricePer); it's stored per year.
function residentSubmit(p) {
  if (p.website) return { success: true };
  const option = activeOption(p.key);
  if (!option) return { success: false, error: 'Pick where you live' };
  const iam = oneOf(p.iam, I_AM);
  if (!iam) return { success: false, error: 'Tell us if you live there now or lived there last year' };
  let checks = {};
  try { checks = JSON.parse(String(p.checks || '{}').slice(0, 2000)) || {}; } catch (e) { checks = {}; }
  const overall = rating(p.overall);
  const hasReview = overall || p.pros || p.cons || p.tips;
  const fields = Object.keys(checks).filter(f => CHECK_FIELDS[f]);
  if (!fields.length && !hasReview) return { success: false, error: 'Tap at least one answer before saving' };
  if (tooBusy()) return { success: false, error: 'Lots of check-ins just came in. Please try again in a little while.' };

  const id = Utilities.getUuid().slice(0, 8);
  const now = new Date();
  const name = clean(p.name, NAME_MAX);
  const rows = [];
  fields.forEach(f => {
    let entered = checks[f];
    let asEntered = '';
    if (f === 'price') {
      const per = String(p.pricePer || 'year');
      const n = Number(String(entered).replace(/[$,\s]/g, ''));
      asEntered = `$${Math.round(n)} per ${per}`;
      entered = per === 'month' ? n * 12 : per === 'semester' ? n * 2 : n;
    }
    const value = normField(f, entered);
    if (!value) return;
    const listed = normField(f, option[CHECK_FIELDS[f].col]);
    rows.push([now, id, option['Key'], option['Name'], f, CHECK_FIELDS[f].col, listed, value,
      value === listed ? 'confirmed' : 'corrected', clean(asEntered, 40), name, '']);
  });
  if (!rows.length && !hasReview) return { success: false, error: 'Tap at least one answer before saving' };
  if (rows.length) {
    const sheet = ensureSheet(UPDATES_SHEET, UPDATE_HEADERS);
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  }
  let reviewId = '';
  if (hasReview) {
    const w = writeReview(p, option, iam, overall || '', RESIDENT_SOURCE, id);
    if (!w.error) reviewId = w.id;
  }
  SpreadsheetApp.flush();
  const out = getData();
  out.added = { details: rows.length, review: reviewId };
  return out;
}

// Readers can flag a review; at REPORT_HIDE_AT reports it stops showing until you clear the cell
function reportReview(id) {
  const sheet = ensureSheet(REVIEWS_SHEET, REVIEW_HEADERS);
  const r = readObjects(REVIEWS_SHEET, REVIEW_HEADERS).find(x => String(x['Review ID']) === String(id));
  if (!r) return { success: false, error: 'Review not found' };
  const col = REVIEW_HEADERS.indexOf('Reports') + 1;
  sheet.getRange(r._row, col).setValue((Number(r['Reports']) || 0) + 1);
  SpreadsheetApp.flush();
  return { success: true };
}
