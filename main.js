const { app, BrowserWindow } = require('electron')
const { dialog, ipcMain } = require('electron')
const url = require('url')
const path = require('path')
const fs = require('fs')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win

function createWindow() {
  win = new BrowserWindow({
    width: 500,
    height: 530,
    webPreferences: {
      nodeIntegration: true
    },
    show: false,
  })

  win.loadFile('src/index.html')
  win.once('ready-to-show', () => {
    win.show();
    // win.openDevTools();
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  app.quit()
})
