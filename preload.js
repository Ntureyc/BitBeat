const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    openDirectory: () => ipcRenderer.invoke('open-directory'),
    readDirectory: (path) => ipcRenderer.invoke('read-directory', path),
    readFile: (path) => ipcRenderer.invoke('read-file', path),
    joinPath: (...args) => ipcRenderer.invoke('join-path', ...args),
    checkPathExists: (path) => ipcRenderer.invoke('check-path-exists', path),
    convertFileSrc: (path) => `local-file://${path}`,
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
});
