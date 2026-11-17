// Resident check-in (?resident). Residents confirm or fix each detail with one tap, review with taps and quick tags,
// and add an optional first name at the end. Uses helpers from common.js and app.js (el, icon, state, segButtons, ...).

const RC_IAM = [['Living there now', 'I live here now'], ['Lived there before', 'I lived here last year']];

// Detail questions: [value, tile label, icon]. Values match the sheet's spelling (see CHECK_FIELDS in apps-script.js).
const RC_DETAILS = [
    { f: 'mealRequired', q: 'Is a meal plan required here?', icon: 'utensils', opts: [['yes', 'Required', 'utensils'], ['no', 'Optional', 'check']] },
    { f: 'kitchen', q: 'Kitchen?', icon: 'cooking-pot', opts: [['in unit', 'In our unit', 'cooking-pot'], ['shared', 'Shared in building', 'users'], ['none', 'No kitchen', 'x']] },
    { f: 'furnished', q: 'Was it furnished?', icon: 'sofa', opts: [['yes', 'Furnished', 'sofa'], ['no', 'Bring or rent', 'package']] },
    { f: 'laundry', q: 'Laundry?', icon: 'washing-machine', opts: [['In unit', 'In our unit', 'washing-machine'], ['In building', 'In the building', 'building-2'], ['Nearby', 'Next door', 'map-pin'], ['None', 'None', 'x']] },
    { f: 'perBath', q: 'How many people share your bathroom?', icon: 'bath', opts: [['1', 'Just me', 'user'], ['2', '2 people', 'users'], ['3', '3 people', 'users'], ['4', '4 or more', 'users']] },
    { f: 'commuteMin', q: 'Usual trip to class?', icon: 'clock', opts: [['5', '5 min', 'clock'], ['10', '10 min', 'clock'], ['15', '15 min', 'clock'], ['20', '20 min', 'bus'], ['30', '30+ min', 'bus']] },
    { f: 'car', q: 'Do you need a car living here?', icon: 'car', opts: [['no', 'No', 'map-pin'], ['helpful', 'It helps', 'bus'], ['yes', 'Yes', 'car']] },
    { f: 'lease', q: 'Lease length?', icon: 'calendar', opts: [['Academic year', 'Academic year', 'calendar'], ['12 months (Aug-Jul)', '12 months', 'calendar'], ['Other', 'Other', 'list']] }
];

const RC_PROS = ['Quiet', 'Social', 'Close to class', 'Clean', 'Good value', 'Roomy', 'Good dining nearby', 'Helpful staff', 'Safe', 'Fast Wi-Fi'];
const RC_CONS = ['Noisy', 'Long walk', 'Small rooms', 'Thin walls', 'Pricey', 'Hard to park', 'Laundry hassle', 'Old building', 'Slow maintenance', 'Far from dining'];

const rc = { key: '', iam: '', checks: {}, price: { mode: '', amount: '', per: 'semester' }, ratings: {}, recommend: '', mealPlan: '', planWas: '', pros: new Set(), cons: new Set(), tips: '', name: '', done: null, busy: false };

// The sheet value of a detail for an option, in the same spelling as the tiles
function listedValue(h, f) {
    switch (f) {
        case 'mealRequired': return h.mealRequired ? 'yes' : 'no';
        case 'kitchen': return h.kitchen;
        case 'furnished': return h.furnished ? 'yes' : 'no';
        case 'laundry': return /unit/i.test(h.laundry) ? 'In unit' : /build/i.test(h.laundry) ? 'In building' : h.laundry ? 'Nearby' : '';
        case 'perBath': return h.perBath ? String(Math.min(4, h.perBath)) : '';
        case 'commuteMin': {
            if (!h.commuteMin) return '';
            const steps = [5, 10, 15, 20, 30];
            return String(steps.reduce((a, b) => (Math.abs(b - h.commuteMin) < Math.abs(a - h.commuteMin) ? b : a)));
        }
        case 'car': return h.car;
        case 'lease': return /12/.test(h.lease) ? '12 months (Aug-Jul)' : /academic/i.test(h.lease) ? 'Academic year' : h.lease ? 'Other' : '';
        default: return '';
    }
}

// Human words for a detail's value (also used on the Compare cards)
function detailLabel(f, v) {
    const s = String(v);
    switch (f) {
        case 'price': return `${money(Number(s))}/yr`;
        case 'mealRequired': return s === 'yes' ? 'Meal plan required' : 'Meal plan optional';
        case 'kitchen': return s === 'in unit' ? 'Own kitchen' : s === 'shared' ? 'Shared kitchen' : 'No kitchen';
        case 'furnished': return s === 'yes' ? 'Furnished' : 'Not furnished';
        case 'laundry': return `Laundry: ${s.toLowerCase()}`;
        case 'perBath': return s === '1' ? 'Private bathroom' : `${s} per bathroom`;
        case 'commuteMin': return `About ${s} min to class`;
        case 'car': return s === 'yes' ? 'Car needed' : s === 'helpful' ? 'Car helpful' : 'No car needed';
        case 'lease': return `Lease: ${s}`;
        default: return s;
    }
}

const DETAIL_NAMES = { price: 'Price', mealRequired: 'Meal plan', kitchen: 'Kitchen', furnished: 'Furniture', laundry: 'Laundry', perBath: 'Bathroom', commuteMin: 'Commute', car: 'Car', lease: 'Lease' };

// "What residents told us" box on a Compare card
function residentBox(h) {
    const info = state.residentInfo[h.key];
    if (!info || !Object.keys(info).length) return null;
    const box = el('div', 'resident-box');
    const t = el('div', 'pc-title');
    t.append(icon('house'), el('span', '', 'What residents told us'));
    box.appendChild(t);
    const ul = el('ul');
    Object.keys(info).forEach((f) => {
        const o = info[f];
        const shown = o.applied || o.listed;
        const agree = (o.votes.find((v) => v.value === shown) || {}).n || 0;
        const others = o.votes.filter((v) => v.value !== shown);
        const parts = [];
        if (o.applied) parts.push(`${DETAIL_NAMES[f]}: updated to ${detailLabel(f, o.applied)} (${plural(agree, 'resident')})`);
        else if (agree) parts.push(`${DETAIL_NAMES[f]}: ✓ confirmed by ${plural(agree, 'resident')}`);
        if (others.length) parts.push(`${o.applied ? 'others said' : `${DETAIL_NAMES[f]}: reported`} ${others.map((v) => `${detailLabel(f, v.value)} (${v.n})`).join(', ')}`);
        ul.appendChild(el('li', '', parts.join('; ')));
    });
    box.appendChild(ul);
    return box;
}

function shareResidentLink() {
    const url = `${location.origin}${location.pathname}?resident`;
    const text = `Do you live in KU housing (or near campus)? Help future Jayhawks pick a place: check our prices and details for where you live and leave a quick review. Takes 2 minutes, no sign-in: ${url}`;
    if (navigator.share) {
        navigator.share({ title: 'KU Housing Fit: resident check-in', text: text }).catch(() => {});
        return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

// ---------- Rendering ----------
function rcStep(n, title, sub) {
    const s = el('div', 'rc-step');
    const h = el('h3', 'rc-step-title');
    h.append(el('span', 'rc-num', String(n)), el('span', '', title));
    s.appendChild(h);
    if (sub) s.appendChild(el('p', 'rc-sub', sub));
    return s;
}

// Icon tiles like the fit questions. `listed` marks the value we currently show.
function rcTiles(opts, current, onPick, listed) {
    const box = el('div', `opts n${Math.min(opts.length, 5)}`);
    opts.forEach(([val, label, ic]) => {
        const b = el('button', 'opt');
        b.type = 'button';
        b.setAttribute('aria-pressed', current === val);
        const oi = el('span', 'opt-icon');
        oi.appendChild(icon(ic || 'check'));
        b.append(oi, el('span', 'opt-label', label));
        if (listed === val) {
            b.classList.add('listed');
            b.appendChild(el('span', 'listed-tag', 'listed'));
        }
        b.addEventListener('click', () => {
            onPick(current === val ? '' : val);
            if (navigator.vibrate) navigator.vibrate(10);
        });
        box.appendChild(b);
    });
    return box;
}

function renderResident() {
    const body = $('rcBody');
    body.replaceChildren();
    if (rc.done) return renderThanks(body);
    if (state.demo) {
        body.appendChild(el('p', 'no-results', 'The resident check-in needs the Google Sheet connected.'));
        return;
    }

    // 1. Where
    const s1 = rcStep(1, 'Where do you live?', '');
    const places = el('div', 'rc-places');
    state.housing.forEach((h) => {
        const b = el('button', 'rc-place');
        b.type = 'button';
        b.setAttribute('aria-pressed', rc.key === h.key);
        b.append(el('strong', '', h.name), el('span', '', h.style || h.area));
        b.addEventListener('click', () => {
            rc.key = rc.key === h.key ? '' : h.key;
            rc.checks = {};
            rc.price = { mode: '', amount: '', per: 'semester' };
            renderResident();
            if (rc.key) setTimeout(() => $('rcIam') && $('rcIam').scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
        });
        places.appendChild(b);
    });
    s1.appendChild(places);
    const iam = el('div', 'seg');
    iam.id = 'rcIam';
    s1.appendChild(iam);
    segButtons(iam, RC_IAM, 'iam', rc);
    body.appendChild(s1);

    const h = state.housing.find((x) => x.key === rc.key);
    if (!h) return;

    // 2. Details
    const s2 = rcStep(2, 'Is this right?', 'Tap the true answer. "listed" is what we show now; tap it to confirm. Skip anything you\'re not sure about.');
    s2.appendChild(rcPrice(h));
    RC_DETAILS.forEach((d) => {
        const q = el('div', 'q');
        const title = el('div', 'q-title');
        title.append(icon(d.icon), el('span', '', d.q));
        q.append(title, rcTiles(d.opts, rc.checks[d.f] || '', (v) => {
            if (v) rc.checks[d.f] = v;
            else delete rc.checks[d.f];
            renderResident();
        }, listedValue(h, d.f)));
        s2.appendChild(q);
    });
    body.appendChild(s2);

    // 3. Review
    const s3 = rcStep(3, `How is ${h.name.split(':')[0]}?`, 'Tap the stars and anything that fits.');
    const ratings = el('div', 'rating-rows');
    s3.appendChild(ratings);
    renderRatingInputs(ratings, rc.ratings);

    const rec = el('div', 'q');
    rec.appendChild(el('div', 'q-title', 'Would you recommend it?'));
    rec.appendChild(rcTiles([['Yes', 'Yes', 'thumbs-up'], ['Maybe', 'Maybe', 'meh'], ['No', 'No', 'thumbs-down']], rc.recommend, (v) => { rc.recommend = v; renderResident(); }));
    s3.appendChild(rec);

    s3.appendChild(rcTagGroup('What\'s great?', 'thumbs-up', RC_PROS, rc.pros, 'good'));
    s3.appendChild(rcTagGroup('What\'s not?', 'thumbs-down', RC_CONS, rc.cons, 'bad'));

    const plan = el('div', 'q');
    const pt = el('div', 'q-title');
    pt.append(icon('utensils'), el('span', '', 'Your meal plan'));
    plan.appendChild(pt);
    const planOpts = [['none', 'None', 'x']].concat(state.dining.map((p) => [p.key, p.name, 'utensils']));
    plan.appendChild(rcTiles(planOpts, rc.mealPlan, (v) => { rc.mealPlan = v; if (!v || v === 'none') rc.planWas = ''; renderResident(); }));
    if (rc.mealPlan && rc.mealPlan !== 'none') {
        plan.appendChild(el('div', 'q-title small', 'It was…'));
        plan.appendChild(rcTiles([['Too much', 'Too much', 'frown'], ['Just right', 'Just right', 'smile'], ['Not enough', 'Not enough', 'meh']], rc.planWas, (v) => { rc.planWas = v; renderResident(); }));
    }
    s3.appendChild(plan);

    const tips = el('label', 'field');
    tips.appendChild(el('span', 'field-label', 'Anything else? A tip for new students (optional)'));
    const ta = el('textarea');
    ta.rows = 2;
    ta.maxLength = 500;
    ta.placeholder = 'e.g. Ask for a top floor, bring a fan';
    ta.value = rc.tips;
    ta.addEventListener('input', () => { rc.tips = ta.value; });
    tips.appendChild(ta);
    s3.appendChild(tips);
    body.appendChild(s3);

    // 4. Name and save
    const s4 = rcStep(4, 'Save', '');
    const nm = el('label', 'field');
    nm.appendChild(el('span', 'field-label', 'Your first name (optional, just to save your review)'));
    const ni = el('input');
    ni.type = 'text';
    ni.maxLength = 40;
    ni.autocomplete = 'given-name';
    ni.placeholder = 'Anonymous';
    ni.value = rc.name;
    ni.addEventListener('input', () => { rc.name = ni.value; });
    nm.appendChild(ni);
    const hp = el('input', 'hp');
    hp.id = 'rcWebsite';
    hp.tabIndex = -1;
    hp.setAttribute('aria-hidden', 'true');
    const save = el('button', 'primary-btn');
    save.type = 'button';
    const n = Object.keys(rc.checks).length + (rc.price.mode ? 1 : 0);
    save.textContent = rc.busy ? 'Saving…' : `Save my check-in${n ? ` · ${plural(n, 'detail')}` : ''}`;
    save.disabled = rc.busy;
    save.addEventListener('click', submitResident);
    s4.append(nm, hp, save);
    body.appendChild(s4);
}

function rcPrice(h) {
    const q = el('div', 'q');
    const title = el('div', 'q-title');
    title.append(icon('wallet'), el('span', '', `What you pay for housing (we list ${money(h.price)} a year)`));
    q.appendChild(title);
    q.appendChild(rcTiles([['ok', `${money(h.price)}/yr is right`, 'check'], ['diff', 'It\'s different', 'calculator']], rc.price.mode, (v) => {
        rc.price.mode = v;
        renderResident();
    }));
    if (rc.price.mode === 'diff') {
        const row = el('div', 'rc-price');
        const wrap = el('span', 'money-input');
        const inp = el('input');
        inp.type = 'number';
        inp.inputMode = 'numeric';
        inp.min = '0';
        inp.placeholder = 'Amount';
        inp.value = rc.price.amount;
        inp.addEventListener('input', () => { rc.price.amount = inp.value; });
        wrap.append(el('span', '', '$'), inp);
        const per = el('div', 'seg small');
        segButtons(per, [['month', 'a month'], ['semester', 'a semester'], ['year', 'a year']], 'per', rc.price);
        row.append(wrap, per);
        q.appendChild(row);
        q.appendChild(el('p', 'rc-sub', 'Housing only, per person. No meal plan.'));
    }
    return q;
}

function rcTagGroup(title, ic, tags, set, cls) {
    const q = el('div', 'q');
    const t = el('div', 'q-title');
    t.append(icon(ic), el('span', '', title));
    const box = el('div', 'tag-row');
    tags.forEach((tag) => {
        const b = el('button', `tag ${cls}`, tag);
        b.type = 'button';
        b.setAttribute('aria-pressed', set.has(tag));
        b.addEventListener('click', () => {
            if (set.has(tag)) set.delete(tag);
            else set.add(tag);
            b.setAttribute('aria-pressed', set.has(tag));
        });
        box.appendChild(b);
    });
    q.append(t, box);
    return q;
}

async function submitResident() {
    const h = state.housing.find((x) => x.key === rc.key);
    if (!h) return showToast('Tap where you live first.');
    if (!rc.iam) {
        showToast('Tap whether you live there now or lived there last year.');
        $('rcIam').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    const checks = { ...rc.checks };
    let pricePer = 'year';
    if (rc.price.mode === 'ok') checks.price = h.price;
    if (rc.price.mode === 'diff') {
        const amt = Number(rc.price.amount);
        if (!amt) return showToast('Type what you pay, or tap "is right".');
        checks.price = amt;
        pricePer = rc.price.per || 'semester';
    }
    const pros = [...rc.pros].join(', ');
    const cons = [...rc.cons].join(', ');
    if (!Object.keys(checks).length && !rc.ratings.overall && !pros && !cons && !rc.tips.trim()) {
        return showToast('Tap at least one answer before saving.');
    }
    const params = {
        action: 'residentSubmit', key: rc.key, iam: rc.iam, checks: JSON.stringify(checks), pricePer,
        recommend: rc.recommend, mealPlan: rc.mealPlan, mealPlanWas: rc.planWas,
        pros, cons, tips: rc.tips.trim(), name: rc.name.trim(), website: ($('rcWebsite') || {}).value || '',
        yearLived: rc.iam === 'Living there now' ? schoolYears()[0] : schoolYears()[1]
    };
    RATINGS.forEach(([f]) => { if (rc.ratings[f]) params[f] = rc.ratings[f]; });
    rc.busy = true;
    renderResident();
    try {
        const d = await api(params);
        if (d.housing) applyData(d);
        rc.done = { name: h.name, details: (d.added || {}).details || 0, review: !!(d.added || {}).review };
        renderAll();
    } catch (err) {
        showToast(err.message);
    }
    rc.busy = false;
    renderResident();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderThanks(body) {
    const box = el('div', 'rc-thanks');
    const ic = el('span', 'rc-thanks-icon');
    ic.appendChild(icon('circle-check'));
    const bits = [];
    if (rc.done.details) bits.push(`checked ${plural(rc.done.details, 'detail')}`);
    if (rc.done.review) bits.push('left a review');
    box.append(ic, el('h3', '', `Thank you${rc.name.trim() ? `, ${rc.name.trim()}` : ''}!`),
        el('p', '', `You ${bits.join(' and ') || 'checked in'} for ${rc.done.name}. Future Jayhawks will see it right away.`));
    const again = el('button', 'primary-btn', 'Check in for another place');
    again.type = 'button';
    again.addEventListener('click', () => {
        Object.assign(rc, { key: '', checks: {}, price: { mode: '', amount: '', per: 'semester' }, ratings: {}, recommend: '', mealPlan: '', planWas: '', pros: new Set(), cons: new Set(), tips: '', done: null });
        renderResident();
    });
    const explore = el('button', 'ghost-btn', 'Explore the app');
    explore.type = 'button';
    explore.addEventListener('click', () => setView('fit'));
    const share = el('button', 'ghost-btn');
    share.type = 'button';
    share.append(icon('message-circle'), document.createTextNode(' Send this check-in to a friend at KU'));
    share.addEventListener('click', shareResidentLink);
    box.append(again, share, explore);
    body.appendChild(box);
}
