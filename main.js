const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs   = require('fs');

let baseDir = process.env.APPIMAGE ? path.dirname(process.env.APPIMAGE) : __dirname;

const settingsDir  = path.join(baseDir, 'GameManagerConfig', 'CafeNeuroticoClock');
const settingsFile = path.join(settingsDir, 'settings.json');

const DEFAULTS = {
    theme:        'minimalist',
    kenBurns:     false,
    imageSource:  'all',
    alwaysOnTop:  true,
    colorTheme:   'CREMA',
    showGameName: false,
};

const THEME_SIZES = {
    minimalist: { w: 400,  h: 160 },
    crema:      { w: 700,  h: 700 },
    kenburns:   { w: 900,  h: 560 },
};

function readSettings() {
    try {
        if (fs.existsSync(settingsFile))
            return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(settingsFile, 'utf8')) };
    } catch {}
    return { ...DEFAULTS };
}

function writeSettings(s) {
    fs.mkdirSync(settingsDir, { recursive: true });
    fs.writeFileSync(settingsFile, JSON.stringify(s, null, 2));
}

let win;
let settingsWin;

function createWindow() {
    const s = readSettings();
    const sz = THEME_SIZES[s.theme] || THEME_SIZES.minimalist;

    win = new BrowserWindow({
        width:       sz.w,
        height:      sz.h,
        minWidth:    260,
        minHeight:   100,
        frame:       false,
        transparent: true,
        alwaysOnTop: s.alwaysOnTop,
        resizable:   true,
        skipTaskbar: false,
        webPreferences: {
            preload:          path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration:  false,
        },
    });

    win.loadFile('index.html');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

// ── IPC ───────────────────────────────────────────────────────────────────────

ipcMain.handle('load-settings', () => readSettings());

ipcMain.handle('save-settings', (_, s) => { writeSettings(s); });

ipcMain.handle('set-theme-size', (_, theme) => {
    const sz = THEME_SIZES[theme] || THEME_SIZES.minimalist;
    if (win) win.setSize(sz.w, sz.h, true);
});

ipcMain.handle('set-always-on-top', (_, v) => {
    if (win) win.setAlwaysOnTop(v);
});

ipcMain.handle('apply-setting-live', (_, key, val) => {
    const s = readSettings();
    s[key] = val;
    writeSettings(s);

    if (key === 'theme') {
        const sz = THEME_SIZES[val] || THEME_SIZES.minimalist;
        if (win) win.setSize(sz.w, sz.h, true);
    }
    if (key === 'alwaysOnTop') {
        if (win) win.setAlwaysOnTop(val);
    }

    if (win) win.webContents.send('setting-applied', key, val);
});

ipcMain.on('open-settings-window', () => {
    if (settingsWin) { settingsWin.focus(); return; }

    settingsWin = new BrowserWindow({
        width:       560,
        height:      720,
        frame:       false,
        transparent: true,
        resizable:   false,
        alwaysOnTop: true,
        skipTaskbar: true,
        webPreferences: {
            preload:          path.join(__dirname, 'settings-preload.js'),
            contextIsolation: true,
            nodeIntegration:  false,
        },
    });
    settingsWin.loadFile('settings.html');
    settingsWin.on('closed', () => { settingsWin = null; });
});

ipcMain.on('settings-win-close', () => {
    settingsWin?.close();
    settingsWin = null;
});

ipcMain.on('win-minimize', () => win?.minimize());
ipcMain.on('win-close',    () => win?.close());

ipcMain.handle('scan-images', (_, source) => {
    const EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
    const imgs = [];

    const walk = (dir) => {
        if (!fs.existsSync(dir)) return;
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) {
                walk(full);
            } else if (EXTS.has(path.extname(e.name).toLowerCase())) {
                const parent = path.basename(dir).toLowerCase();
                const name   = e.name.toLowerCase();
                if (name.includes('_p8_')) continue;
                const typeFromDir  = parent.includes('cover')     ? 'covers'
                                   : parent.includes('hero')      ? 'heroes'
                                   : parent.includes('screen')    ? 'screenshots'
                                   : parent.includes('logo')      ? 'logos'
                                   : parent.includes('wallpaper') ? 'wallpapers'
                                   : null;
                const typeFromFile = name.includes('cover')    ? 'covers'
                                   : name.includes('hero')     ? 'heroes'
                                   : name.includes('screen')   ? 'screenshots'
                                   : name.includes('logo')     ? 'logos'
                                   : 'other';
                const type = typeFromDir || typeFromFile;

                // Extract a display-friendly game name from the filename
                const stem      = path.basename(e.name, path.extname(e.name));
                const nameMatch = stem.match(/^(.*?)[\s_-]*(cover|hero|screen(?:shot)?|logo)[\s_\d-]*$/i);
                const gameName  = nameMatch
                    ? nameMatch[1].replace(/[_-]+/g, ' ').trim()
                    : stem.replace(/[_-]+/g, ' ').trim();

                imgs.push({ path: full, type, name: type === 'wallpapers' ? '' : gameName });
            }
        }
    };

    // CNGM: flat images dir, all types mixed
    walk(path.join(baseDir, 'GameManagerConfig', 'images'));
    // EmuLatte: structured subdirs
    walk(path.join(baseDir, 'GameManagerConfig', 'EmuLatte', 'images'));
    // Bundled wallpapers (inside AppImage)
    walk(path.join(__dirname, 'assets', 'wallpapers'));
    // User-provided wallpapers alongside the AppImage (optional extras)
    walk(path.join(baseDir, 'GameManagerConfig', 'wallpapers'));

    if (source && source !== 'all')
        return imgs.filter(x => x.type === source);

    // "all" = game art only; logos and wallpapers are opt-in via their own buttons
    return imgs.filter(x => x.type !== 'logos' && x.type !== 'wallpapers');
});
