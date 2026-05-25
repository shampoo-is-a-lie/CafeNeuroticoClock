'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    loadSettings:     ()         => ipcRenderer.invoke('load-settings'),
    applySettingLive: (key, val) => ipcRenderer.invoke('apply-setting-live', key, val),
    scanImages:       (src)      => ipcRenderer.invoke('scan-images', src),
    closeSettings:    ()         => ipcRenderer.send('settings-win-close'),
});
