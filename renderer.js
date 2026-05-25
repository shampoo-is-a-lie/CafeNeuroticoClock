'use strict';

let settings   = { theme: 'minimalist', kenBurns: false, imageSource: 'all', alwaysOnTop: true, colorTheme: 'CREMA', showGameName: false };
let kbImages   = [];
let kbIndex    = 0;
let kbActive   = 'a';
let kbTimer    = null;

const KB_INTERVAL = 12000;
const BASE_W = { minimalist: 400, crema: 700, kenburns: 900 };

// ── Boot ───────────────────────────────────────────────────────────────────────
async function init() {
    settings = await window.api.loadSettings();
    applyColorTheme(settings.colorTheme || 'CREMA');
    applyTheme(settings.theme);
    startClock();

    const kbOn = settings.kenBurns || settings.theme === 'kenburns';
    if (kbOn) {
        const imgs = await window.api.scanImages(settings.imageSource);
        kbImages = shuffle(imgs.map(x => ({ path: x.path, name: x.name || '' })));
        startKB();
    }

    wireControls();
    setupResizeObserver();
    setupSettingListener();
}

// ── Clock ──────────────────────────────────────────────────────────────────────
function startClock() {
    tick();
    setInterval(tick, 1000);
}

function tick() {
    const now    = new Date();
    const pad    = n => String(n).padStart(2, '0');
    const DAYS   = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
    const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

    document.getElementById('time-main').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    document.getElementById('time-secs').textContent = `:${pad(now.getSeconds())}`;
    document.getElementById('date-line').textContent  =
        `${pad(now.getDate())} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
    const dayEl = document.getElementById('day-line');
    if (dayEl) dayEl.textContent = DAYS[now.getDay()];
}

// ── Dynamic font scale ─────────────────────────────────────────────────────────
function updateClockScale() {
    const w    = document.getElementById('app').offsetWidth || (BASE_W[settings.theme] || 400);
    const base = BASE_W[settings.theme] || 400;
    document.documentElement.style.setProperty('--clock-scale', (w / base).toFixed(4));
}

function setupResizeObserver() {
    const ro = new ResizeObserver(updateClockScale);
    ro.observe(document.getElementById('app'));
}

// ── Color theme ────────────────────────────────────────────────────────────────
function applyColorTheme(name) {
    const t = CN_THEMES[name];
    if (!t) return;
    const root = document.documentElement;
    Object.entries(t).forEach(([k, v]) => root.style.setProperty(`--${k}`, v));
    settings.colorTheme = name;
}

// ── Visual theme ───────────────────────────────────────────────────────────────
function applyTheme(theme) {
    const app = document.getElementById('app');
    app.classList.remove('theme-minimalist', 'theme-crema', 'theme-kenburns');
    app.classList.add(`theme-${theme}`);
    settings.theme = theme;
    updateClockScale();

    const kbOn = theme === 'kenburns' || settings.kenBurns;
    if (kbOn && kbImages.length === 0) {
        window.api.scanImages(settings.imageSource).then(imgs => {
            kbImages = shuffle(imgs.map(x => ({ path: x.path, name: x.name || '' })));
            setKBVisible(true);
        });
    } else {
        setKBVisible(kbOn);
    }
}

// ── Game name label ────────────────────────────────────────────────────────────
function showGameLabel(name) {
    if (!settings.showGameName || !name || /^\d+$/.test(name.trim())) return;
    const el     = document.getElementById('kb-game-label');
    const nameEl = document.getElementById('kb-game-name');
    if (!el || !nameEl) return;
    nameEl.textContent = name;
    el.style.display   = 'block';
    el.style.animation = 'none';
    void el.offsetWidth; // force reflow to restart animation
    el.style.animation = 'gameLabelShow 4.5s ease forwards';
}

// ── Ken Burns ──────────────────────────────────────────────────────────────────
function shuffle(arr) { return arr.sort(() => Math.random() - 0.5); }
function randomV()    { return `v${1 + Math.floor(Math.random() * 4)}`; }

function setKBVisible(on) {
    document.getElementById('app').classList.toggle('kb-on', on);
    if (on) { if (!kbTimer) startKB(); }
    else    { stopKB(); }
}

// Load the next image into `el`, skipping any that fail.
// Only calls `onReady(el)` once a valid image has actually loaded.
function loadNextInto(el, onReady, attempt = 0) {
    if (attempt >= kbImages.length) return; // no valid image found in full list
    const img = kbImages[kbIndex];
    kbIndex = (kbIndex + 1) % kbImages.length;

    // Hard-reset: kill transition so removing 'visible' doesn't animate
    el.style.transition = 'none';
    el.style.opacity    = '0';
    el.className        = 'kb-img';

    el.onload = () => {
        el.onload = el.onerror = null;
        el.style.transition = '';
        el.style.opacity    = '';
        el.classList.add(randomV()); // animation starts now, independent of visible
        el.dataset.name = img.name || '';
        onReady(el);
    };
    el.onerror = () => {
        el.onload = el.onerror = null;
        loadNextInto(el, onReady, attempt + 1);
    };

    el.src = img.path;
}

function startKB() {
    if (!kbImages.length) return;
    kbActive = 'a';
    loadNextInto(document.getElementById('kb-img-a'), el => {
        requestAnimationFrame(() => {
            el.classList.add('visible');
            showGameLabel(el.dataset.name);
        });
        kbTimer = setInterval(crossfadeKB, KB_INTERVAL);
    });
}

function stopKB() {
    clearInterval(kbTimer);
    kbTimer = null;
    ['kb-img-a', 'kb-img-b'].forEach(id => {
        const el = document.getElementById(id);
        el.onload = el.onerror = null;
        el.style.transition = 'none';
        el.style.opacity    = '0';
        el.className        = 'kb-img';
        el.src              = '';
    });
}

function crossfadeKB() {
    if (!kbImages.length) return;

    const nextActive = kbActive === 'a' ? 'b' : 'a';
    const inEl  = document.getElementById(nextActive === 'a' ? 'kb-img-a' : 'kb-img-b');
    if (inEl.onload) return; // already loading from a previous tick, skip

    const outEl = document.getElementById(kbActive === 'a' ? 'kb-img-a' : 'kb-img-b');
    kbActive = nextActive;

    loadNextInto(inEl, el => {
        requestAnimationFrame(() => {
            el.classList.add('visible');
            showGameLabel(el.dataset.name);
            setTimeout(() => {
                outEl.classList.remove('visible');
                outEl.addEventListener('transitionend', () => {
                    outEl.style.transition = 'none';
                    outEl.style.opacity    = '0';
                    outEl.className        = 'kb-img';
                }, { once: true });
            }, 1500);
        });
    });
}

// ── Live settings from settings window ────────────────────────────────────────
function setupSettingListener() {
    window.api.onSettingChanged((key, val) => {
        if (key === 'theme') {
            applyTheme(val);
        }
        if (key === 'kenBurns') {
            settings.kenBurns = val;
            const kbOn = val || settings.theme === 'kenburns';
            if (kbOn && !kbImages.length) {
                window.api.scanImages(settings.imageSource).then(imgs => {
                    kbImages = shuffle(imgs.map(x => ({ path: x.path, name: x.name || '' })));
                    setKBVisible(true);
                });
            } else {
                setKBVisible(kbOn);
            }
        }
        if (key === 'imageSource') {
            settings.imageSource = val;
            const kbRunning = settings.theme === 'kenburns' || settings.kenBurns;
            if (kbRunning) {
                const wasRunning = !!kbTimer;
                stopKB();
                window.api.scanImages(val).then(imgs => {
                    kbImages = shuffle(imgs.map(x => ({ path: x.path, name: x.name || '' })));
                    kbIndex  = 0;
                    if (wasRunning || settings.theme === 'kenburns') startKB();
                });
            }
        }
        if (key === 'colorTheme') {
            applyColorTheme(val);
        }
        if (key === 'showGameName') {
            settings.showGameName = val;
            if (!val) {
                const el = document.getElementById('kb-game-label');
                if (el) el.style.display = 'none';
            }
        }
    });
}

// ── Wire Controls ──────────────────────────────────────────────────────────────
function wireControls() {
    document.getElementById('btn-minimize').addEventListener('click', () => window.api.minimize());
    document.getElementById('btn-close').addEventListener('click',    () => window.api.close());
    document.getElementById('btn-settings').addEventListener('click', () => window.api.openSettingsWindow());
}

init();
