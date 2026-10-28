const { app, BrowserWindow } = require('electron');
const path = require('path');

app.setName('Пятый Этаж');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 720, minWidth: 800, minHeight: 450,
    fullscreen: false, autoHideMenuBar: true, backgroundColor: '#000000',
    title: 'ПЯТЫЙ ЭТАЖ — хоррор',
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  win.setMenu(null);
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
