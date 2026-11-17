// Shared helpers: config, DOM shortcuts and the Apps Script API (JSONP, same pattern as isha-kc-volunteers).
// Paste the deployed /exec URL into appsScriptUrl to bake it in for everyone; until then the page
// shows sample data and anyone can connect a sheet from the setup box (saved in their browser only).
const CONFIG = {
    appsScriptUrl: safeGet('kuh_appsScriptUrl') || 'https://script.google.com/macros/s/AKfycbysWF_mEwSYKb0O7DF6Lnkdl9fKI4-apI8a_SEhTG5pN_0VUxqeyZroHGSTgYSbIoh8kw/exec'
};
let jsonpCounter = 0;

function safeGet(k) {
    try { return localStorage.getItem(k); } catch (e) { return null; }
}
function safeSet(k, v) {
    try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* private mode */ }
}

const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
}

function show(id, on) {
    $(id).style.display = on ? '' : 'none';
}

function showError(msg) {
    const e = $('errorMessage');
    e.textContent = msg;
    show('errorMessage', !!msg);
}

let toastTimer;
function showToast(msg) {
    const e = $('toast');
    e.textContent = msg;
    show('toast', true);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => show('toast', false), 5000);
}

const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// ---------- API (JSONP so the static page works from GitHub Pages without CORS) ----------
function jsonpRequest(params) {
    return new Promise((resolve, reject) => {
        const cb = `kuhJsonpCb_${Date.now()}_${jsonpCounter++}`;
        const script = document.createElement('script');
        const cleanup = () => {
            delete window[cb];
            script.remove();
        };
        const timer = setTimeout(() => {
            cleanup();
            reject(new Error('Request timed out'));
        }, 20000);
        window[cb] = (data) => {
            clearTimeout(timer);
            cleanup();
            resolve(data);
        };
        script.onerror = () => {
            clearTimeout(timer);
            cleanup();
            reject(new Error('Unable to reach the Google Sheet'));
        };
        script.src = `${CONFIG.appsScriptUrl}?${new URLSearchParams({ ...params, callback: cb })}`;
        document.body.appendChild(script);
    });
}

async function api(params) {
    const data = await jsonpRequest(params);
    if (!data.success) throw new Error(data.error || 'Request failed');
    return data;
}
