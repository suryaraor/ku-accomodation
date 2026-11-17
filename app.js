// KU Housing Fit. Helpers (api, el, show, money, ...) live in common.js; sample data in seed.js.
const DEFAULT_PREFS = {
    year: 'freshman', roommates: 'any', kitchen: 'nice', food: 'mix', area: 'any',
    bath: 'some', furnished: 'must', priority: 'balance', budget: 12000, scholarships: 0
};

const state = {
    housing: [], dining: [], costs: [], reviews: [],
    demo: true,
    view: 'fit',
    filter: 'all',
    prefs: loadPrefs(),
    planPick: {} // housing key -> meal plan key the user picked on a match card
};

function loadPrefs() {
    try {
        return { ...DEFAULT_PREFS, ...JSON.parse(safeGet('kuh_prefs') || '{}') };
    } catch (e) {
        return { ...DEFAULT_PREFS };
    }
}
const savePrefs = () => safeSet('kuh_prefs', JSON.stringify(state.prefs));

// ---------- Questions ----------
const QUESTIONS = [
    { key: 'year', title: 'Where are you in school?', icon: 'graduation-cap', opts: [
        ['freshman', 'Incoming freshman', 'sparkles'], ['returning', 'Returning student', 'repeat'], ['transfer', 'Transfer or other', 'plane']] },
    { key: 'roommates', title: 'How do you want to live?', icon: 'users', opts: [
        ['two', 'Just 1 roommate', 'user'], ['suite', 'Suite of 4', 'users'], ['apartment', 'Apartment', 'house'], ['any', 'No preference', 'check']] },
    { key: 'food', title: 'How will you mostly eat?', icon: 'utensils', opts: [
        ['hall', 'Dining hall, most meals', 'utensils'], ['mix', 'A mix', 'repeat'], ['cook', 'Cook for myself', 'cooking-pot']] },
    { key: 'kitchen', title: 'Do you want a kitchen?', icon: 'cooking-pot', opts: [
        ['must', 'Must have', 'cooking-pot'], ['nice', 'Nice to have', 'smile'], ['no', 'Not needed', 'x']] },
    { key: 'area', title: 'Where on campus?', icon: 'map-pin', opts: [
        ['daisy', 'Daisy Hill', 'map-pin'], ['central', 'Central campus', 'building-2'], ['any', 'No preference', 'check']] },
    { key: 'bath', title: 'Fewer people per bathroom?', icon: 'bath', opts: [
        ['high', 'Matters a lot', 'bath'], ['some', 'Somewhat', 'meh'], ['low', "Don't mind", 'smile']] },
    { key: 'furnished', title: 'Furniture?', icon: 'sofa', opts: [
        ['must', 'Move-in ready', 'sofa'], ['ok', 'I can bring or rent', 'package']] },
    { key: 'priority', title: 'What matters most?', icon: 'heart', opts: [
        ['cost', 'Lowest cost', 'wallet'], ['balance', 'Best overall fit', 'target'], ['reviews', 'What students say', 'message-square']] }
];

// ---------- Data ----------
const num = (v) => Number(String(v ?? '').replace(/[$,\s]/g, '')) || 0;
const str = (v) => String(v ?? '').trim();
const yes = (v) => /^(y|yes|true|1)$/i.test(str(v));
const list = (v) => str(v).split(/\s*[;\n]\s*/).filter(Boolean);
const safeLink = (v) => (/^https?:\/\//i.test(str(v)) ? str(v) : '');

function normHousing(r) {
    const kitchen = str(r['Kitchen']).toLowerCase();
    return {
        key: str(r['Key']),
        name: str(r['Name']) || str(r['Key']),
        area: str(r['Area']),
        type: str(r['Type']).toLowerCase(),
        unit: num(r['Unit Size']),
        perBath: num(r['People Per Bath']),
        price: num(r['Price Per Year']),
        kitchen: kitchen.startsWith('in') ? 'in unit' : kitchen.startsWith('shared') ? 'shared' : 'none',
        furnished: yes(r['Furnished']),
        laundry: str(r['Laundry']),
        mealRequired: yes(r['Meal Plan Required']),
        dining: str(r['Closest Dining']),
        who: str(r['Who Can Live Here']) || 'All',
        freshmenOnly: /fresh/i.test(str(r['Who Can Live Here'])),
        availability: str(r['Availability']),
        style: str(r['Style']),
        pros: list(r['Pros']),
        cons: list(r['Cons']),
        details: str(r['Details']),
        link: safeLink(r['Link'])
    };
}

function normDining(r) {
    const meals = str(r['Meals Per Week']);
    return {
        key: str(r['Key']),
        name: str(r['Name']) || str(r['Key']),
        price: num(r['Price Per Semester']),
        mealsLabel: /unl/i.test(meals) ? 'Unlimited' : meals && meals !== '0' ? `${meals} a week` : 'No swipes',
        meals: /unl/i.test(meals) ? 21 : num(meals),
        dollars: num(r['Dining Dollars Per Semester']),
        halls: yes(r['Residence Halls']),
        notes: str(r['Notes'])
    };
}

function applyData(d) {
    state.housing = (d.housing || []).map(normHousing).filter((h) => h.key);
    state.dining = (d.dining || []).map(normDining).filter((p) => p.key);
    state.costs = (d.costs || []).map((c) => ({ item: str(c['Item']), amount: num(c['Per Year']), notes: str(c['Notes']) })).filter((c) => c.item);
    state.reviews = d.reviews || [];
}

// ---------- Ratings ----------
const RATINGS = [
    ['overall', 'Overall'], ['value', 'Value for money'], ['social', 'Social life'],
    ['quiet', 'Quiet / sleep'], ['clean', 'Clean'], ['location', 'Location']
];

function statsFor(key) {
    const rs = state.reviews.filter((r) => r.key === key);
    const avg = (f) => {
        const v = rs.map((r) => Number(r[f])).filter((n) => n >= 1);
        return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
    };
    const rec = rs.filter((r) => r.recommend);
    return {
        n: rs.length,
        avg: Object.fromEntries(RATINGS.map(([f]) => [f, avg(f)])),
        recommendPct: rec.length ? Math.round((100 * rec.filter((r) => r.recommend === 'Yes').length) / rec.length) : null
    };
}

// ---------- Meal plan pick for an option ----------
// Cheapest plan that meets the meals a week the student wants. Halls require a swipe plan;
// apartments can skip a plan when the student cooks.
function plansFor(h) {
    return state.dining.filter((p) => !h.mealRequired || p.halls);
}

function suggestedPlan(h) {
    const options = plansFor(h);
    const food = state.prefs.food;
    if (!h.mealRequired && food === 'cook') return null;
    if (!h.mealRequired && food === 'mix') {
        const ddOnly = options.filter((p) => !p.meals).sort((a, b) => a.price - b.price)[0];
        if (ddOnly) return ddOnly;
    }
    const target = food === 'hall' ? 14 : food === 'mix' ? 10 : 0;
    const fits = options.filter((p) => p.meals >= target && (h.mealRequired ? p.meals > 0 : true)).sort((a, b) => a.price - b.price);
    return fits[0] || options.sort((a, b) => a.price - b.price)[0] || null;
}

function planFor(h) {
    const picked = state.planPick[h.key];
    if (picked === 'none' && !h.mealRequired) return null;
    return plansFor(h).find((p) => p.key === picked) || suggestedPlan(h);
}

const yearlyFood = (plan) => (plan ? plan.price * 2 : 0);

// ---------- Scoring ----------
function score(h) {
    const p = state.prefs;
    const reasons = []; // [good?, text]
    const why = (good, text) => reasons.push([good, text]);
    const plan = planFor(h);
    const total = h.price + yearlyFood(plan);

    // How well the place matches each answer, 0..1, with a weight
    const fits = [];
    const fit = (w, v) => fits.push([w, v]);

    if (p.roommates === 'two') {
        fit(1.5, h.unit <= 2 ? 1 : 0.2);
        why(h.unit <= 2, h.unit <= 2 ? 'Just you and 1 roommate' : `${h.unit} people share the unit`);
    } else if (p.roommates === 'suite') {
        fit(1.5, h.type === 'suite' ? 1 : 0.5);
        if (h.type === 'suite') why(true, 'Suite-style living');
    } else if (p.roommates === 'apartment') {
        fit(1.5, h.type === 'apartment' ? 1 : 0.2);
        why(h.type === 'apartment', h.type === 'apartment' ? 'Apartment with a living room' : 'Not an apartment');
    }

    const k = { 'in unit': 1, shared: 0.6, none: 0 }[h.kitchen];
    if (p.kitchen === 'must') {
        fit(1.5, k);
        why(k > 0.5, h.kitchen === 'in unit' ? 'Your own kitchen' : h.kitchen === 'shared' ? 'Shared kitchen in the building' : 'No kitchen');
    } else if (p.kitchen === 'nice') {
        fit(0.7, 0.5 + k / 2);
        if (h.kitchen !== 'none') why(true, h.kitchen === 'in unit' ? 'Your own kitchen' : 'Shared kitchen in the building');
    }

    if (p.food === 'cook') {
        fit(1, k === 1 ? 1 : k ? 0.6 : 0.1);
        if (h.mealRequired) why(false, 'Meal plan required even if you cook');
        else why(true, 'Meal plan is optional');
    } else if (p.food === 'hall') {
        fit(1, h.dining ? 1 : 0.6);
        if (h.dining) why(true, `Near ${h.dining} dining`);
    }

    if (p.area !== 'any') {
        const want = p.area === 'daisy' ? /daisy/i : /central/i;
        const ok = want.test(h.area);
        fit(0.8, ok ? 1 : 0.3);
        why(ok, ok ? `On ${h.area}` : `In ${h.area}`);
    }

    if (p.bath !== 'low') {
        const v = h.perBath <= 2 ? 1 : p.bath === 'high' ? 0.25 : 0.65;
        fit(p.bath === 'high' ? 1.2 : 0.6, v);
        if (h.perBath) why(h.perBath <= 2, `${h.perBath} people per bathroom`);
    }

    if (p.furnished === 'must') {
        fit(1, h.furnished ? 1 : 0.1);
        if (!h.furnished) why(false, 'You may need to rent furniture');
    }

    const fitScore = fits.length ? fits.reduce((a, [w, v]) => a + w * v, 0) / fits.reduce((a, [w]) => a + w, 0) : 1;

    // Cost: full marks under budget (a little extra for cheaper), sliding to 0 at $3,000 over
    const totals = state.housing.map((x) => x.price + yearlyFood(planFor(x)));
    const lo = Math.min(...totals);
    const hi = Math.max(...totals);
    const cheap = hi > lo ? (hi - total) / (hi - lo) : 1;
    const over = Math.max(0, total - p.budget);
    const costScore = Math.max(0, 1 - over / 3000) * (0.75 + 0.25 * cheap);
    if (over) why(false, `${money(over)} over your budget`);
    else why(true, `${money(p.budget - total)} under your budget`);

    // Student reviews: neutral until someone has reviewed it
    const st = statsFor(h.key);
    const reviewScore = st.n ? (st.avg.overall - 1) / 4 : 0.6;
    if (st.n && st.avg.overall >= 4) why(true, `Students rate it ${st.avg.overall.toFixed(1)}/5`);
    if (st.n && st.avg.overall < 3) why(false, `Students rate it ${st.avg.overall.toFixed(1)}/5`);

    const W = { cost: [0.5, 0.35, 0.15], balance: [0.3, 0.5, 0.2], reviews: [0.25, 0.35, 0.4] }[p.priority] || [0.3, 0.5, 0.2];
    let s = W[0] * costScore + W[1] * fitScore + W[2] * reviewScore;
    const avail = h.availability.toLowerCase();
    if (avail === 'full') {
        s *= 0.5;
        why(false, 'Currently full');
    } else if (avail === 'waitlist') {
        s *= 0.85;
        why(false, 'Waitlist only');
    } else if (avail.startsWith('filling')) why(false, 'Filling fast: apply early');

    // Good news first
    reasons.sort((a, b) => Number(b[0]) - Number(a[0]));
    return { h, plan, total, pct: Math.round(100 * s), reasons, stats: st };
}

// ---------- Small UI pieces ----------
function stars(avg, cls) {
    const wrap = el('span', `stars ${cls || ''}`);
    wrap.setAttribute('aria-label', `${avg.toFixed(1)} out of 5`);
    for (let i = 1; i <= 5; i++) wrap.appendChild(icon('star', avg >= i - 0.25 ? 'on' : avg >= i - 0.75 ? 'half' : ''));
    return wrap;
}

function ratingLine(st) {
    const line = el('div', 'rating-line');
    if (!st.n) {
        line.append(icon('message-square'), el('span', 'muted', 'No student reviews yet'));
        return line;
    }
    line.append(stars(st.avg.overall), el('strong', '', st.avg.overall.toFixed(1)), el('span', 'muted', `· ${plural(st.n, 'review')}`));
    if (st.recommendPct !== null) line.appendChild(el('span', 'muted', `· ${st.recommendPct}% recommend`));
    return line;
}

function badge(text, cls) {
    return el('span', `badge ${cls || ''}`, text);
}

function availabilityBadge(h) {
    const a = h.availability.toLowerCase();
    if (!a) return null;
    return badge(h.availability, a === 'open' ? 'ok' : a === 'full' ? 'bad' : 'warn');
}

function facts(h) {
    const grid = el('div', 'facts');
    const add = (ic, label) => {
        const f = el('span', 'fact');
        f.append(icon(ic), el('span', '', label));
        grid.appendChild(f);
    };
    add('map-pin', h.area || '–');
    add('users', h.style || `${h.unit} people`);
    if (h.perBath) add('bath', `${h.perBath} per bathroom`);
    add('cooking-pot', h.kitchen === 'in unit' ? 'Own kitchen' : h.kitchen === 'shared' ? 'Shared kitchen' : 'No kitchen');
    add('sofa', h.furnished ? 'Furnished' : 'Not furnished');
    if (h.laundry) add('washing-machine', `Laundry: ${h.laundry}`);
    add('utensils', h.mealRequired ? 'Meal plan required' : 'Meal plan optional');
    if (h.dining) add('building-2', `Dining: ${h.dining}`);
    add('graduation-cap', h.who);
    return grid;
}

function prosCons(h) {
    const box = el('div', 'pc');
    const col = (items, cls, ic, title) => {
        if (!items.length) return;
        const c = el('div', `pc-col ${cls}`);
        const t = el('div', 'pc-title');
        t.append(icon(ic), el('span', '', title));
        const ul = el('ul');
        items.forEach((x) => ul.appendChild(el('li', '', x)));
        c.append(t, ul);
        box.appendChild(c);
    };
    col(h.pros, 'pro', 'thumbs-up', 'Pros');
    col(h.cons, 'con', 'thumbs-down', 'Cons');
    return box;
}

function linkButton(text, ic, onClick) {
    const b = el('button', 'link-btn');
    b.type = 'button';
    b.append(icon(ic), el('span', '', text));
    b.addEventListener('click', onClick);
    return b;
}

// ---------- Find my fit ----------
function renderQuestions() {
    const box = $('questions');
    box.replaceChildren();
    QUESTIONS.forEach((q) => {
        const wrap = el('div', 'q');
        const title = el('div', 'q-title');
        title.append(icon(q.icon), el('span', '', q.title));
        const opts = el('div', `opts n${q.opts.length}`);
        opts.setAttribute('role', 'group');
        opts.setAttribute('aria-label', q.title);
        q.opts.forEach(([val, label, ic]) => {
            const b = el('button', 'opt');
            b.type = 'button';
            b.setAttribute('aria-pressed', state.prefs[q.key] === val);
            const oi = el('span', 'opt-icon');
            oi.appendChild(icon(ic));
            b.append(oi, el('span', 'opt-label', label));
            b.addEventListener('click', () => {
                state.prefs[q.key] = val;
                savePrefs();
                opts.querySelectorAll('.opt').forEach((o) => o.setAttribute('aria-pressed', o === b));
                if (navigator.vibrate) navigator.vibrate(10);
                renderMatches();
            });
            opts.appendChild(b);
        });
        wrap.append(title, opts);
        box.appendChild(wrap);
    });
    $('budget').value = state.prefs.budget;
    $('budgetOut').textContent = money(state.prefs.budget);
    $('scholarships').value = state.prefs.scholarships || '';
}

function renderMatches() {
    const eligible = state.housing.filter((h) => !(h.freshmenOnly && state.prefs.year !== 'freshman'));
    const ranked = eligible.map(score).sort((a, b) => b.pct - a.pct || a.total - b.total);
    const box = $('matches');
    box.replaceChildren();
    $('matchesHint').textContent = ranked.length
        ? `Ranked for your answers. Housing + meal plan for a full year, ${state.prefs.food === 'cook' ? 'with the lightest meal plan allowed' : 'with the meal plan that fits how you eat'}.`
        : 'No options match yet.';
    ranked.forEach((r, i) => box.appendChild(matchCard(r, i)));

    const out = state.housing.filter((h) => !eligible.includes(h));
    const ne = $('notEligible');
    ne.replaceChildren();
    if (out.length) {
        ne.appendChild(el('strong', '', 'Not open to you: '));
        ne.appendChild(document.createTextNode(out.map((h) => `${h.name} (${h.who.toLowerCase()})`).join(', ')));
    }
    show('notEligible', out.length > 0);
}

function matchCard(r, i) {
    const { h, plan, total, pct, reasons, stats } = r;
    const card = el('details', `vcard match${i === 0 ? ' top' : ''}`);
    if (i === 0) card.open = true;
    const head = el('summary', 'vcard-head');
    head.appendChild(el('span', 'rank', String(i + 1)));
    const info = el('span', 'info');
    info.append(el('span', 'name', h.name), el('span', 'sub', `${money(total)}/yr with food · ${h.area}`));
    const pctEl = el('span', `pct ${pct >= 75 ? 'hi' : pct >= 55 ? 'mid' : 'lo'}`);
    pctEl.append(el('strong', '', `${pct}%`), el('small', '', 'match'));
    const chev = el('span', 'chev');
    chev.appendChild(icon('chevron-right'));
    head.append(info, pctEl, chev);

    const body = el('div', 'vcard-body');
    const why = el('div', 'why');
    reasons.slice(0, 6).forEach(([good, text]) => {
        const c = el('span', `why-chip ${good ? 'good' : 'bad'}`);
        c.append(icon(good ? 'check' : 'triangle-alert'), el('span', '', text));
        why.appendChild(c);
    });
    body.append(why, ratingLine(stats));

    // Cost breakdown with a meal plan picker
    const cost = el('div', 'costbox');
    const row = (label, val, cls) => {
        const d = el('div', `cost-row ${cls || ''}`);
        d.append(label instanceof Node ? label : el('span', '', label), el('span', 'amt', val));
        cost.appendChild(d);
        return d;
    };
    row('Housing', money(h.price));
    const sel = el('select', 'plan-select');
    sel.setAttribute('aria-label', `Meal plan for ${h.name}`);
    if (!h.mealRequired) sel.appendChild(new Option('No meal plan', 'none'));
    plansFor(h).forEach((p) => sel.appendChild(new Option(`${p.name} (${money(p.price)}/sem)`, p.key)));
    sel.value = plan ? plan.key : 'none';
    sel.addEventListener('change', () => {
        state.planPick[h.key] = sel.value;
        renderMatches();
    });
    const lab = el('span', 'plan-label');
    lab.append(el('span', '', 'Meal plan ×2 semesters'), sel);
    row(lab, money(yearlyFood(plan)));
    row('Housing + food', money(total), 'subtotal');
    const others = state.costs.reduce((a, c) => a + c.amount, 0);
    const schol = state.prefs.scholarships || 0;
    if (state.costs.length) {
        const det = el('details', 'allin');
        const sum = el('summary');
        sum.append(el('span', '', 'All-in estimate for the year'), el('strong', '', money(total + others - schol)));
        det.appendChild(sum);
        state.costs.forEach((c) => {
            const d = el('div', 'cost-row small');
            d.append(el('span', '', c.item), el('span', 'amt', money(c.amount)));
            det.appendChild(d);
        });
        if (schol) {
            const d = el('div', 'cost-row small minus');
            d.append(el('span', '', 'Scholarships'), el('span', 'amt', `−${money(schol)}`));
            det.appendChild(d);
        }
        cost.appendChild(det);
    }
    body.appendChild(cost);

    const actions = el('div', 'card-actions');
    actions.append(
        linkButton('Details & pros/cons', 'list', () => goToOption(h.key)),
        linkButton(stats.n ? `Read ${plural(stats.n, 'review')}` : 'Reviews', 'message-square', () => {
            state.filter = h.key;
            setView('reviews');
        })
    );
    body.appendChild(actions);
    card.append(head, body);
    return card;
}

// ---------- Compare ----------
function renderCompare() {
    const box = $('compareList');
    box.replaceChildren();
    [...state.housing].sort((a, b) => a.price - b.price).forEach((h) => {
        const st = statsFor(h.key);
        const card = el('details', 'vcard option');
        card.id = `opt-${h.key}`;
        const head = el('summary', 'vcard-head');
        const info = el('span', 'info');
        info.append(el('span', 'name', h.name), el('span', 'sub', h.style || h.area));
        const price = el('span', 'price');
        price.append(el('strong', '', money(h.price)), el('small', '', 'per year'));
        const chev = el('span', 'chev');
        chev.appendChild(icon('chevron-right'));
        head.append(info, price, chev);

        const body = el('div', 'vcard-body');
        const tags = el('div', 'tags');
        if (h.freshmenOnly) tags.appendChild(badge('Freshmen only', 'warn'));
        const ab = availabilityBadge(h);
        if (ab) tags.appendChild(ab);
        if (tags.children.length) body.appendChild(tags);
        body.append(ratingLine(st), facts(h), prosCons(h));
        if (h.details) body.appendChild(el('p', 'details', h.details));

        if (st.n) {
            const bars = el('div', 'bars');
            RATINGS.slice(1).forEach(([f, label]) => {
                if (!st.avg[f]) return;
                const b = el('div', 'bar');
                const track = el('span', 'bar-track');
                const fill = el('span', 'bar-fill');
                fill.style.width = `${(st.avg[f] / 5) * 100}%`;
                track.appendChild(fill);
                b.append(el('span', 'bar-label', label), track, el('span', 'bar-val', st.avg[f].toFixed(1)));
                bars.appendChild(b);
            });
            if (bars.children.length) body.appendChild(bars);
        }

        const actions = el('div', 'card-actions');
        actions.appendChild(linkButton(st.n ? `Read ${plural(st.n, 'review')}` : 'No reviews yet', 'message-square', () => {
            state.filter = h.key;
            setView('reviews');
        }));
        actions.appendChild(linkButton('I live here: review it', 'plus', () => openReview(h.key)));
        if (h.link) {
            const a = el('a', 'link-btn');
            a.href = h.link;
            a.target = '_blank';
            a.rel = 'noopener';
            a.append(icon('external-link'), el('span', '', 'KU Housing'));
            actions.appendChild(a);
        }
        body.appendChild(actions);
        card.append(head, body);
        box.appendChild(card);
    });

    const plans = $('diningList');
    plans.replaceChildren();
    state.dining.forEach((p) => {
        const c = el('div', 'plan');
        c.append(el('div', 'plan-name', p.name), el('div', 'plan-price', money(p.price)), el('div', 'plan-sub', `per semester · ${money(p.price * 2)}/yr`));
        const ul = el('ul', 'plan-facts');
        ul.append(el('li', '', `Swipes: ${p.mealsLabel}`), el('li', '', `Dining Dollars: ${money(p.dollars)}/sem`));
        if (!p.halls) ul.appendChild(el('li', '', 'Not for residence halls'));
        c.appendChild(ul);
        if (p.notes) c.appendChild(el('p', 'plan-note', p.notes));
        // What students on this plan said about the amount
        const said = state.reviews.filter((r) => r.mealPlan === p.name && r.mealPlanWas);
        if (said.length) {
            const counts = ['Too much', 'Just right', 'Not enough'].map((k) => [k, said.filter((r) => r.mealPlanWas === k).length]).filter(([, n]) => n);
            c.appendChild(el('p', 'plan-said', `Students: ${counts.map(([k, n]) => `${n} “${k.toLowerCase()}”`).join(', ')}`));
        }
        plans.appendChild(c);
    });

    const costs = $('costList');
    costs.replaceChildren();
    state.costs.forEach((c) => {
        const d = el('div', 'cost-row');
        const l = el('span', '', c.item);
        if (c.notes) l.appendChild(el('small', '', c.notes));
        d.append(l, el('span', 'amt', money(c.amount)));
        costs.appendChild(d);
    });
}

function goToOption(key) {
    setView('compare');
    const card = $(`opt-${key}`);
    if (!card) return;
    card.open = true;
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- Reviews ----------
const nameOf = (key) => (state.housing.find((h) => h.key === key) || {}).name || key;

function renderReviews() {
    const chips = $('reviewFilter');
    chips.replaceChildren();
    const chip = (key, label, n) => {
        const b = el('button', 'chip', `${label} (${n})`);
        b.type = 'button';
        b.setAttribute('aria-pressed', state.filter === key);
        b.addEventListener('click', () => {
            state.filter = key;
            renderReviews();
        });
        chips.appendChild(b);
    };
    chip('all', 'All', state.reviews.length);
    state.housing.forEach((h) => chip(h.key, h.name.split(':')[0], state.reviews.filter((r) => r.key === h.key).length));

    const sum = $('reviewSummary');
    sum.replaceChildren();
    if (state.filter !== 'all') {
        const st = statsFor(state.filter);
        const box = el('div', 'review-summary');
        box.append(el('h3', '', nameOf(state.filter)), ratingLine(st));
        sum.appendChild(box);
    }

    const box = $('reviewList');
    box.replaceChildren();
    const rs = state.reviews.filter((r) => state.filter === 'all' || r.key === state.filter);
    if (!rs.length) {
        const empty = el('div', 'no-results');
        empty.appendChild(el('p', '', state.demo
            ? 'Reviews appear here once the Google Sheet is connected.'
            : 'No reviews here yet. If you live there, be the first!'));
        box.appendChild(empty);
    }
    rs.forEach((r) => box.appendChild(reviewCard(r)));
}

function reviewCard(r) {
    const card = el('article', 'review');
    const top = el('div', 'review-top');
    const who = el('div', 'review-who');
    who.append(el('strong', '', nameOf(r.key)), el('span', 'muted', [r.name || 'Anonymous', r.iam, r.yearLived].filter(Boolean).join(' · ')));
    top.append(stars(Number(r.overall) || 0), who);
    card.appendChild(top);
    if (r.recommend) card.appendChild(badge(r.recommend === 'Yes' ? 'Recommends it' : r.recommend === 'No' ? "Doesn't recommend" : 'Maybe recommends', r.recommend === 'Yes' ? 'ok' : r.recommend === 'No' ? 'bad' : 'warn'));

    const subs = RATINGS.slice(1).filter(([f]) => Number(r[f]) >= 1);
    if (subs.length) {
        const s = el('div', 'review-subs');
        subs.forEach(([f, label]) => {
            const x = el('span', 'sub-rating');
            x.append(el('span', '', label), icon('star', 'on'), el('strong', '', String(r[f])));
            s.appendChild(x);
        });
        card.appendChild(s);
    }
    [['thumbs-up', 'pros', 'Great'], ['thumbs-down', 'cons', 'Not so great'], ['lightbulb', 'tips', 'Tip']].forEach(([ic, f, label]) => {
        if (!r[f]) return;
        const p = el('p', `review-text ${f}`);
        p.append(icon(ic), el('strong', '', `${label}: `), document.createTextNode(r[f]));
        card.appendChild(p);
    });
    if (r.mealPlan) card.appendChild(el('p', 'review-meal muted', `Meal plan: ${r.mealPlan}${r.mealPlanWas ? `, ${r.mealPlanWas.toLowerCase()}` : ''}`));

    const foot = el('div', 'review-foot');
    const when = r.at ? new Date(r.at) : null;
    foot.appendChild(el('span', 'muted', when && !isNaN(when) ? when.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : ''));
    if (!state.demo) {
        const rep = linkButton('Report', 'flag', async () => {
            if (rep.dataset.armed !== '1') {
                rep.dataset.armed = '1';
                rep.querySelector('span').textContent = 'Tap again to report';
                return;
            }
            rep.disabled = true;
            try {
                await api({ action: 'reportReview', id: r.id });
                rep.querySelector('span').textContent = 'Reported. Thanks!';
            } catch (err) {
                showToast(err.message);
                rep.disabled = false;
            }
        });
        rep.classList.add('quiet');
        foot.appendChild(rep);
    }
    card.appendChild(foot);
    return card;
}

// ---------- Review form ----------
const form = { ratings: {}, iam: '', recommend: '', planWas: '' };

function segButtons(id, values, field) {
    const box = $(id);
    box.replaceChildren();
    values.forEach((v) => {
        const b = el('button', 'seg-btn', v);
        b.type = 'button';
        b.setAttribute('aria-pressed', form[field] === v);
        b.addEventListener('click', () => {
            form[field] = form[field] === v ? '' : v;
            segButtons(id, values, field);
        });
        box.appendChild(b);
    });
}

function renderRatingInputs() {
    const box = $('rvRatings');
    box.replaceChildren();
    RATINGS.forEach(([f, label]) => {
        const row = el('div', `rating-row${f === 'overall' ? ' main' : ''}`);
        row.appendChild(el('span', 'rating-label', label));
        const starsBox = el('span', 'star-input');
        starsBox.setAttribute('role', 'group');
        starsBox.setAttribute('aria-label', label);
        for (let i = 1; i <= 5; i++) {
            const b = el('button', 'star-btn');
            b.type = 'button';
            b.setAttribute('aria-label', `${i} star${i === 1 ? '' : 's'}`);
            b.setAttribute('aria-pressed', form.ratings[f] === i);
            b.appendChild(icon('star', (form.ratings[f] || 0) >= i ? 'on' : ''));
            b.addEventListener('click', () => {
                form.ratings[f] = form.ratings[f] === i ? 0 : i;
                if (navigator.vibrate) navigator.vibrate(8);
                renderRatingInputs();
            });
            starsBox.appendChild(b);
        }
        row.appendChild(starsBox);
        box.appendChild(row);
    });
}

function schoolYears() {
    const now = new Date();
    const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1; // school year starts in August
    return Array.from({ length: 5 }, (_, i) => `${start - i}-${String((start - i + 1) % 100).padStart(2, '0')}`);
}

function openReview(key) {
    if (state.demo) {
        setView('reviews');
        showToast('Connect the Google Sheet first (setup box at the bottom of Reviews).');
        $('setupInstructions').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    const sel = $('rvKey');
    sel.replaceChildren(new Option('Choose a place…', ''));
    state.housing.forEach((h) => sel.appendChild(new Option(h.name, h.key)));
    sel.value = key || (state.filter !== 'all' ? state.filter : '');
    const yr = $('rvYear');
    yr.replaceChildren(new Option('–', ''));
    schoolYears().forEach((y) => yr.appendChild(new Option(y, y)));
    yr.selectedIndex = 1;
    const plan = $('rvPlan');
    plan.replaceChildren(new Option('–', ''), new Option('None', 'none'));
    state.dining.forEach((p) => plan.appendChild(new Option(p.name, p.key)));
    segButtons('rvIam', ['Living there now', 'Lived there before'], 'iam');
    segButtons('rvRecommend', ['Yes', 'Maybe', 'No'], 'recommend');
    segButtons('rvPlanWas', ['Too much', 'Just right', 'Not enough'], 'planWas');
    renderRatingInputs();
    show('sheetBackdrop', true);
    show('reviewSheet', true);
    document.body.classList.add('sheet-open');
    requestAnimationFrame(() => $('reviewSheet').classList.add('up'));
}

function closeReview() {
    $('reviewSheet').classList.remove('up');
    show('sheetBackdrop', false);
    show('reviewSheet', false);
    document.body.classList.remove('sheet-open');
}

function resetForm() {
    form.ratings = {};
    form.iam = form.recommend = form.planWas = '';
    ['rvName', 'rvPros', 'rvCons', 'rvTips', 'rvWebsite'].forEach((id) => { $(id).value = ''; });
}

async function submitReview(e) {
    e.preventDefault();
    const key = $('rvKey').value;
    const need = !key ? 'Choose where you live or lived.' : !form.iam ? 'Tap whether you live there now or before.' : !form.ratings.overall ? 'Give an overall star rating.' : '';
    if (need) {
        showToast(need);
        return;
    }
    const btn = $('rvSubmit');
    btn.disabled = true;
    btn.textContent = 'Posting…';
    try {
        const params = {
            action: 'addReview', key, iam: form.iam, yearLived: $('rvYear').value, name: $('rvName').value.trim(),
            mealPlan: $('rvPlan').value, mealPlanWas: form.planWas, recommend: form.recommend,
            pros: $('rvPros').value.trim(), cons: $('rvCons').value.trim(), tips: $('rvTips').value.trim(),
            website: $('rvWebsite').value
        };
        RATINGS.forEach(([f]) => { if (form.ratings[f]) params[f] = form.ratings[f]; });
        const d = await api(params);
        if (d.housing) applyData(d);
        closeReview();
        resetForm();
        state.filter = key;
        renderAll();
        setView('reviews');
        showToast('Thank you! Your review is live.');
    } catch (err) {
        showToast(err.message);
    }
    btn.disabled = false;
    btn.textContent = 'Post review';
}

// ---------- Views ----------
function setView(v) {
    state.view = v;
    safeSet('kuh_view', v);
    document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', t.dataset.view === v));
    ['fit', 'compare', 'reviews'].forEach((x) => show(`view-${x}`, x === v));
    if (v === 'reviews') renderReviews();
    window.scrollTo({ top: 0 });
}

function renderAll() {
    $('reviewCount').textContent = state.demo ? '–' : state.reviews.length;
    show('demoBanner', state.demo);
    show('setupInstructions', state.demo);
    renderQuestions();
    renderMatches();
    renderCompare();
    renderReviews();
}

async function load() {
    show('loadingIndicator', true);
    showError('');
    if (CONFIG.appsScriptUrl) {
        try {
            applyData(await api({ action: 'getData' }));
            state.demo = false;
        } catch (err) {
            showError(`Couldn't load the Google Sheet (${err.message}). Showing sample data.`);
            applyData(SEED);
            state.demo = true;
        }
    } else {
        applyData(SEED);
        state.demo = true;
    }
    show('loadingIndicator', false);
    renderAll();
    setView(state.view);
}

document.addEventListener('DOMContentLoaded', () => {
    const saved = safeGet('kuh_view');
    if (['fit', 'compare', 'reviews'].includes(saved)) state.view = saved;
    document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => setView(t.dataset.view)));
    $('budget').addEventListener('input', () => {
        state.prefs.budget = Number($('budget').value);
        $('budgetOut').textContent = money(state.prefs.budget);
        savePrefs();
        renderMatches();
    });
    $('scholarships').addEventListener('input', () => {
        state.prefs.scholarships = Math.max(0, Number($('scholarships').value) || 0);
        savePrefs();
        renderMatches();
    });
    $('seeMatches').addEventListener('click', () => $('matchesHead').scrollIntoView({ behavior: 'smooth', block: 'start' }));
    $('openReview').addEventListener('click', () => openReview());
    $('sheetClose').addEventListener('click', closeReview);
    $('sheetBackdrop').addEventListener('click', closeReview);
    $('reviewSheet').addEventListener('submit', submitReview);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeReview();
    });
    $('saveUrlBtn').addEventListener('click', () => {
        const url = $('urlInput').value.trim();
        if (!/^https:\/\/script\.google\.com\//.test(url)) {
            showToast('That should be a https://script.google.com/... /exec URL.');
            return;
        }
        safeSet('kuh_appsScriptUrl', url);
        CONFIG.appsScriptUrl = url;
        load();
    });
    load();
});
