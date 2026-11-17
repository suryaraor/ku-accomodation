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
  'Pros', 'Cons', 'Details', 'Link', 'Active'];
const RATES_LINK = 'https://housing.ku.edu/2026-2027-rates';
const HOUSING_SEED = [
  ['self-2', 'Self Hall: 2-person room', 'Daisy Hill', 'room', 2, 2, 9568, 'none', 'yes', 'In building', 'yes', "Mrs. E's", 'Freshmen only', '',
    '2-person room with bath',
    'Only one roommate;Bathroom shared with just your roommate;Laundry provided;Furnished',
    'No kitchen;One of the pricier options;New freshmen only',
    'Rate is for a randomly assigned roommate. Extra-long twin beds (36" x 80"), desk, desk chair and dresser. About 3 ft of closet space per person.',
    RATES_LINK, 'yes'],
  ['oswald-self-suite', 'Oswald or Self: 4-person suite', 'Daisy Hill', 'suite', 4, 4, 10600, 'none', 'yes', 'In building', 'yes', "Mrs. E's", 'All', '',
    '4-person suite with bath',
    "Suite has its own bathroom;Furnished;Close to Mrs. E's dining",
    'Most expensive option;No kitchen;4 people share a bathroom',
    '', RATES_LINK, 'yes'],
  ['downs', 'Downs Hall', 'Central District', 'suite', 4, 2, 9568, 'shared', 'yes', 'In building', 'yes', 'South Commons', 'All', '',
    '4-person, 2 baths, shared bedrooms, no living room',
    'Kitchen on the main floor;South Commons dining close by;Laundry provided;Furnished;2 bathrooms for 4 people',
    'Pricier;Shared kitchen;No living room',
    'Extra-long twin beds, desk, desk chair and dresser. Bedrooms in the 4-person rooms are about 11.5 x 15.5 ft.',
    RATES_LINK, 'yes'],
  ['templin-ellsworth-lewis', 'Templin, Ellsworth or Lewis: 4-person suite', 'Daisy Hill', 'suite', 4, 4, 8460, 'none', 'yes', 'In building', 'yes', "Mrs. E's (inside Lewis)", 'All', '',
    '4-person suite with bath',
    "Cheaper than Self and Oswald;Mrs. E's dining is inside Lewis;Suite has its own bathroom",
    'No kitchen;4 people share a bathroom',
    '', RATES_LINK, 'yes'],
  ['jayhawker-towers', 'Jayhawker Towers A or D', 'Daisy Hill (edge)', 'apartment', 4, 4, 6090, 'in unit', 'no', 'Tower Gallery', 'no', '', 'All', '',
    'Apartment: living room, kitchen, bathroom and 2 shared bedrooms',
    'Cheapest option;Full kitchen with dishwasher and refrigerator;Living room;Meal plan is optional;Laundry in the Tower Gallery',
    'May need to rent furniture;Bring more of your own things;No laundry in the apartment;1 bathroom for 4 people',
    'Popular with upperclassmen, transfer and non-traditional students. Dining plans are optional for apartment residents.',
    RATES_LINK, 'yes']
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
  'Pros', 'Cons', 'Tips', 'Hidden', 'Reports'];
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
    tips: String(r['Tips'] || '')
  })).reverse(); // newest first
  return {
    success: true,
    housing: housing.map(strip),
    dining: dining.map(strip),
    costs: costs.map(strip),
    reviews: reviews
  };
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

function addReview(p) {
  if (p.website) return { success: true }; // honeypot field: bots fill it, people never see it
  const housing = readObjects(HOUSING_SHEET, HOUSING_HEADERS, HOUSING_SEED).filter(r => r['Key'] && !isNo(r['Active']));
  const option = housing.find(h => String(h['Key']) === String(p.key));
  if (!option) return { success: false, error: 'Pick where you live or lived' };
  const overall = rating(p.overall);
  if (!overall) return { success: false, error: 'Give an overall rating' };
  const iam = oneOf(p.iam, I_AM);
  if (!iam) return { success: false, error: 'Tell us if you live there now or lived there before' };

  const sheet = ensureSheet(REVIEWS_SHEET, REVIEW_HEADERS);
  const pros = clean(p.pros, TEXT_MAX);
  const cons = clean(p.cons, TEXT_MAX);
  const tips = clean(p.tips, TEXT_MAX);

  // Brake on floods and double-taps
  const recent = readObjects(REVIEWS_SHEET, REVIEW_HEADERS);
  const hourAgo = Date.now() - 3600 * 1000;
  if (recent.filter(r => new Date(r['Submitted At']).getTime() > hourAgo).length >= MAX_REVIEWS_PER_HOUR) {
    return { success: false, error: 'Lots of reviews just came in. Please try again in a little while.' };
  }
  const dupe = recent.some(r => String(r['Option Key']) === option['Key'] &&
    String(r['Pros']) === pros && String(r['Cons']) === cons && String(r['Tips']) === tips && Number(r['Overall']) === overall);
  if (dupe) return { success: false, error: 'This review is already posted' };

  const dining = readObjects(DINING_SHEET, DINING_HEADERS, DINING_SEED);
  const plan = dining.find(d => String(d['Key']) === String(p.mealPlan));
  const id = Utilities.getUuid().slice(0, 8);
  sheet.appendRow([
    new Date(), id, option['Key'], option['Name'], clean(p.name, NAME_MAX), iam, clean(p.yearLived, 12),
    plan ? plan['Name'] : (p.mealPlan === 'none' ? 'None' : ''), oneOf(p.mealPlanWas, MEAL_PLAN_WAS),
    overall, rating(p.value), rating(p.social), rating(p.quiet), rating(p.clean), rating(p.location),
    oneOf(p.recommend, RECOMMEND), pros, cons, tips, '', ''
  ]);
  SpreadsheetApp.flush();
  const out = getData();
  out.added = id;
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
