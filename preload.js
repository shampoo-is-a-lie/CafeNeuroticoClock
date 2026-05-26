const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    loadSettings:       ()        => ipcRenderer.invoke('load-settings'),
    scanImages:         (source)  => ipcRenderer.invoke('scan-images', source),
    minimize:           ()        => ipcRenderer.send('win-minimize'),
    close:              ()        => ipcRenderer.send('win-close'),
    openSettingsWindow: ()        => ipcRenderer.send('open-settings-window'),
    onSettingChanged:   (cb)      => ipcRenderer.on('setting-applied', (_, key, val) => cb(key, val)),
});
