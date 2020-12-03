import { app, BrowserWindow } from 'electron';

import {Bridge} from './bridge';


const bridge = new Bridge();


function createWindow () {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true
    }
  })

  bridge.start().then( ()=>  win.loadURL('http://localhost:9000')).catch ((error) => console.log(error));

  win.webContents.openDevTools()
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('window-all-closed', () => {
  bridge.stop();
  app.quit()
})
