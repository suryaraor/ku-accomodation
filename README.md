# KU Housing Fit

Helps prospective and current KU students pick where to live, and lets students who live there share what it's really like.

Static web app (HTML/CSS/JS) with a Google Sheet as the backend, via a Google Apps Script web app. It's the same pattern as `isha-kc-volunteers`: JSONP calls, tabs created and seeded automatically, and writes serialized with a script lock.

The starting data (housing options, prices, meal plans and yearly costs) comes from the students' "College Costs" research doc, using KU Housing's 2026-27 rates.

## What it does

- **Find my fit**: ten tap-to-answer questions (year in school, roommates, how you eat, kitchen, area including off campus, commute time, whether you'll have a car, bathroom sharing, furniture, what matters most), plus a budget slider and optional scholarships. Matches update live as you tap. Each match shows:
  - a match %
  - reasons it fits or doesn't (green ✓ / red ⚠)
  - housing + meal plan cost for the year, with the meal plan picked for how you eat (you can change it)
  - an all-in yearly estimate (tuition, fees, books, transport, minus scholarships)

  Freshmen-only halls are left out for returning and transfer students.
- **Compare**: every option, cheapest first. Each shows its facts, pros and cons, details, availability, average student ratings and a link to KU Housing. Meal plans and other yearly costs are listed below the options.
- **Reviews**: current and past residents post a review without signing in. A review has:
  - overall stars (required), plus value, social, quiet, clean and location
  - would-recommend
  - meal plan, and whether it was too much, just right or not enough
  - what's great, what's not, and tips

  Ratings feed into the match score and the Compare cards. Readers can filter by place and report a review.

- **Resident check-in** (`?resident`, or `?resident=<option key>` to preselect a place): a dedicated link for students who live there now, all tap-to-answer. It's also on the Reviews tab ("Send the resident check-in link").
  1. Pick the place, and "I live here now" or "last year".
  2. **Is this right?**: price (tap "is right", or type what you pay per month, semester or year), meal plan, kitchen, furniture, laundry, bathroom, trip to class, car, lease. Each shows the current value tagged "listed".
  3. Stars, recommend, quick tags for what's great and what's not, meal plan and whether it was enough, an optional tip.
  4. Optional first name, then save.

  Residents get priority. Their reviews count double in the ratings and are listed first with a "Resident check-in" badge. Their corrections replace the listed value once 2 residents report the same new value and they outnumber those who confirmed the old one. Compare cards show "What residents told us", and match cards show "Price confirmed by N residents".

Answers, budget and the last tab are remembered in the browser. Nothing personal is collected: the first name is optional and there's no email or login.

## How matching works

Score = cost × weight + fit × weight + student rating × weight. The weights depend on "What matters most":

| Priority | Cost | Fit | Ratings |
|---|---|---|---|
| Lowest cost | 50% | 35% | 15% |
| Best overall fit | 30% | 50% | 20% |
| What students say | 25% | 35% | 40% |

- **Cost** is full under budget and slides to 0 at $3,000 over.
- **Fit** averages how well the option matches each answer.
- **Ratings** count as neutral until a place has reviews.
- Places marked Full or Waitlist are pushed down.

Tune it in `score()` in `app.js`.

## Sheet tabs (all created on first load)

- `Housing`: one row per option. Columns: Key, Name, Area, Type (room / suite / apartment), Unit Size, People Per Bath, Price Per Year, Kitchen (in unit / shared / none), Furnished, Laundry, Meal Plan Required, Closest Dining, Who Can Live Here ("All" or "Freshmen only"), Availability (Open / Filling fast / Waitlist / Full), Style, Pros, Cons, Details, Link, Active.
  - Commute columns: **Commute Minutes** (typical trip to class: walking on campus, driving off campus), **Minutes Without Car** (bus or walk for students without a car; blank = same), **Commute** (the description shown), **Car Needed** (no / helpful / yes) and **Lease** (e.g. "Academic year" or "12 months (Aug-Jul), individual lease"). These drive the commute and car questions.
  - Separate pros and cons with `;`.
  - Set Active to `no` to hide an option.
  - Don't change a Key once it has reviews.
- `Dining`: meal plans, priced **per semester**. Residence Halls = `yes` if hall residents can pick it.
- `Costs`: other yearly costs for the all-in estimate (tuition, fees, books, transportation).
- `Reviews`: one row per review.
  - Type `yes` in **Hidden** to take a review down.
  - A review reported 3 times hides itself. Clear its **Reports** cell to bring it back.

- `Resident Updates`: one row per detail per resident check-in: the option, the detail, the listed value, what the resident said (confirmed or corrected), the price as they typed it, and their first name.
  - Type `approved` in **Status** to use that value right away.
  - Type `rejected` to ignore a row.
  - To make a correction permanent, type it into the `Housing` tab.
- `Reviews` has a **Source** column: "Review form" or "Resident check-in".

Edit prices in the sheet each year; the page picks them up on the next load.

## Setup

1. **Create the sheet.** Make an empty Google Sheet.
2. **Add the backend.** Extensions > Apps Script, delete the default code, paste `apps-script.js`, save.
3. **Deploy.** Deploy > New deployment > type Web app > Execute as: Me > Who has access: Anyone > Deploy. Authorize when prompted and copy the `/exec` URL.
4. **Connect the page.** Open the site, go to Reviews, and paste the URL into the setup box at the bottom (it's saved in that browser). To bake it in for everyone, set `appsScriptUrl` in `common.js`.
5. **Host it** on GitHub Pages (Settings > Pages > deploy from the main branch) or any static host.

After changing `apps-script.js`, use Deploy > Manage deployments > Edit > New version.

To add columns or options to a sheet that's already live, add them to `HOUSING_HEADERS` / `HOUSING_SEED` and bump `SEED_VERSION`. On the next page load the backend adds the new columns, fills them in for the options already there (blank cells only), and appends the new options once. Nothing you've edited is overwritten.

Until a sheet is connected, the page shows sample data from `seed.js` and posting reviews is off. `seed.js` is generated from the seed rows in `apps-script.js`. After editing those, run `node tools/make-seed.js`.

To try it locally: `python -m http.server 8765`, then open http://localhost:8765.

## Look and feel

The layout and components match `isha-kc-volunteers`:
- cream card on a sand background
- Trirong headings and Inter body text
- icon answer tiles
- collapsible cards
- a bottom-sheet form

Colors are KU blue, crimson and yellow, set as tokens at the top of `style.css`. Icons are [Lucide](https://lucide.dev) (ISC licence), bundled in `icons.js`.

## Notes

- Anyone with the link can post a review (no login, same as the reference app). Spam guards:
  - a hidden honeypot field
  - duplicate check
  - 40 reviews an hour across everyone
  - 500-character limits
  - text starting with `=`, `+`, `-` or `@` is stored as plain text, not as a formula
- Prices are estimates. Always confirm with KU Housing before signing.
