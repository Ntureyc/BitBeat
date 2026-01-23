const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        backgroundColor: '#191022',
        frame: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            spellcheck: false,
        },
    });

    win.setMenuBarVisibility(false);

    win.loadFile(path.join(__dirname, 'index.html'));
}

// Register custom protocol for local files
app.whenReady().then(() => {
    protocol.handle('local-file', async (request) => {
        const filePath = decodeURIComponent(request.url.replace('local-file://', ''));
        try {
            const stats = await fs.promises.stat(filePath);
            const stream = fs.createReadStream(filePath);
            return new Response(stream, {
                headers: {
                    'content-length': stats.size.toString(),
                }
            });
        } catch (error) {
            console.error('Failed to read file:', error);
            return new Response(null, { status: 404 });
        }
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC Handlers
ipcMain.handle('open-directory', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
    });
    if (result.canceled) {
        return null;
    }
    return result.filePaths[0];
});

ipcMain.handle('read-directory', async (event, dirPath) => {
    try {
        const files = fs.readdirSync(dirPath, { withFileTypes: true });
        return files
            .filter(file => file.isFile())
            .map(file => ({
                name: file.name,
                path: path.join(dirPath, file.name),
                isFile: true
            }));
    } catch (error) {
        console.error('Error reading directory:', error);
        return [];
    }
});

ipcMain.handle('read-file', async (event, filePath) => {
    try {
        return fs.readFileSync(filePath);
    } catch (error) {
        console.error('Error reading file:', error);
        return null;
    }
});

ipcMain.handle('join-path', async (event, ...args) => {
    return path.join(...args);
});

ipcMain.handle('check-path-exists', async (event, dirPath) => {
    try {
        return fs.existsSync(dirPath) && fs.lstatSync(dirPath).isDirectory();
    } catch (error) {
        return false;
    }
});

ipcMain.on('window-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        if (win.isMaximized()) {
            win.unmaximize();
        } else {
            win.maximize();
        }
    }
});

ipcMain.on('window-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
});
