const { app, BrowserWindow } = require('electron')

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#ffffff',
    title: 'PlayPulse',
  })

  win.loadURL('http://localhost:5173')
}

app.whenReady().then(createWindow)