import { BrowserWindow } from "electron";
import windowStateKeeper = require("electron-window-state");

export class WindowManager {
  private mainWindow: BrowserWindow | null = null ;
  private windowState: windowStateKeeper.State | null =  null;

  public initMainWindow(){
    if (!this.windowState) {
      this.windowState = windowStateKeeper({
        defaultHeight: 900,
        defaultWidth: 1440,
      });
    }
    const { width, height, x, y } = this.windowState;
    this.mainWindow = new BrowserWindow({
      x, y, width, height,
      show: false,
      minWidth: 700,
      minHeight: 500,
      webPreferences: {
        nodeIntegration: true
      }
    });
    this.windowState.manage(this.mainWindow);

  }

  public setMainURL(url:string){
    if(!this.mainWindow){
      throw Error('main window is not initialized');
    }

    if(url.startsWith("http")){
      this.mainWindow.loadURL(url);
    }
    else{
      this.mainWindow.loadFile(url);
    }
    this.mainWindow.show();

  }


}
