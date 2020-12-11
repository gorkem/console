import { app, BrowserWindow } from 'electron';

import {Bridge} from './bridge';
import {Cluster, ClusterConnectionStatus} from './cluster';


const bridge = new Bridge();


async function createWindow () {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true
    }
  })
  const cluster = new Cluster();
  const clusterStatus = await cluster.getConnectionStatus();

  if(clusterStatus === ClusterConnectionStatus.AccessGranted){
    bridge.start().then( ()=>  win.loadURL('http://localhost:9000')).catch ((error) => console.log(error));
  }
  else{
    win.loadFile('./www/no-connection.html');
  }
}

app.setName("Encaludus");
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
