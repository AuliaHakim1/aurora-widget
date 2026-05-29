const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const https = require('https');
const { exec } = require('child_process');

let widgetsWindow;
let dockWindow;
let menubarWindow;

let metricsInterval;
let weatherInterval;

// Helper to make native HTTPS GET JSON requests
function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Fetch Geo-IP location and weather details from Open-Meteo
async function getLiveWeather() {
  try {
    const geo = await httpGetJson('http://ip-api.com/json');
    const lat = geo.lat;
    const lon = geo.lon;
    const city = geo.city || 'Local';
    
    const weather = await httpGetJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
    const temp = Math.round(weather.current_weather.temperature);
    const code = weather.current_weather.weathercode;
    
    return { city, temp, code };
  } catch (err) {
    try {
      const weather = await httpGetJson(`https://api.open-meteo.com/v1/forecast?latitude=-6.2088&longitude=106.8456&current_weather=true`);
      const temp = Math.round(weather.current_weather.temperature);
      const code = weather.current_weather.weathercode;
      return { city: 'Jakarta', temp, code };
    } catch (e) {
      return { city: 'Offline', temp: '--', code: -1 };
    }
  }
}

// Helper to calculate CPU usage
function getCPUUsage() {
  return new Promise((resolve) => {
    const startMeasure = cpuAverage();
    setTimeout(() => {
      const endMeasure = cpuAverage();
      const idleDifference = endMeasure.idle - startMeasure.idle;
      const totalDifference = endMeasure.total - startMeasure.total;
      const percentageCPU = 100 - Math.round((100 * idleDifference) / totalDifference);
      resolve(percentageCPU);
    }, 150);
  });
}

function cpuAverage() {
  let totalIdle = 0;
  let totalTick = 0;
  const cpus = os.cpus();
  for (let i = 0, len = cpus.length; i < len; i++) {
    const cpu = cpus[i];
    for (type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  }
  return { idle: totalIdle / cpus.length, total: totalTick / cpus.length };
}

// Read C: Disk Space usage percentage
function getDiskUsage() {
  try {
    const stats = fs.statfsSync('C:');
    const total = stats.blocks * stats.bsize;
    const free = stats.bfree * stats.bsize;
    const used = total - free;
    return Math.round((used / total) * 100);
  } catch (err) {
    console.error('Failed to read disk space:', err);
    return 0;
  }
}

// Read Wifi SSID & Signal Quality
function getWifiStatus() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      return resolve({ ssid: 'Offline', signal: 0 });
    }
    exec('netsh wlan show interfaces', (err, stdout, stderr) => {
      if (err || !stdout) {
        return resolve({ ssid: 'Offline', signal: 0 });
      }
      
      const stateMatch = stdout.match(/State\s*:\s*(.*)/i);
      const isConnected = stateMatch && stateMatch[1].trim().toLowerCase() === 'connected';

      if (!isConnected) {
        return resolve({ ssid: 'Disconnected', signal: 0 });
      }

      const ssidMatch = stdout.match(/SSID\s*:\s*([^\r\n]*)/i);
      const signalMatch = stdout.match(/Signal\s*:\s*(\d+)%/i);

      const ssid = ssidMatch ? ssidMatch[1].trim() : 'Connected';
      const signal = signalMatch ? parseInt(signalMatch[1].trim(), 10) : 100;

      resolve({ ssid, signal });
    });
  });
}

// Set macOS custom wallpaper via registry commands (fast and reliable on Windows)
function setMacWallpaper() {
  try {
    const wpPath = path.join(app.getAppPath(), 'wallpapers', 'mac_wallpaper.png');
    // Ensure file exists before calling reg command
    if (fs.existsSync(wpPath)) {
      const regCommand = `reg add "HKCU\\Control Panel\\Desktop" /v Wallpaper /t REG_SZ /d "${wpPath}" /f && RUNDLL32.EXE user32.dll,UpdatePerUserSystemParameters`;
      exec(regCommand);
    }
  } catch (err) {
    console.error('Failed to set wallpaper:', err);
  }
}

function createMacWindows() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  // 1. TOP MENU BAR WINDOW
  menubarWindow = new BrowserWindow({
    width: width,
    height: 24,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    type: 'desktop', // anchors behind main apps, floats on wallpaper level
    alwaysOnTop: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  menubarWindow.loadFile('menubar.html');

  // 2. BOTTOM DOCK WINDOW
  const dockWidth = 520;
  const dockHeight = 68;
  dockWindow = new BrowserWindow({
    width: dockWidth,
    height: dockHeight,
    x: Math.floor((width - dockWidth) / 2),
    y: height - dockHeight - 10, // 10px spacing from screen bottom
    transparent: true,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    type: 'desktop',
    alwaysOnTop: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  dockWindow.loadFile('dock.html');

  // 3. RIGHT WIDGETS WINDOW
  const widgetWidth = 320;
  const widgetHeight = 530;
  widgetsWindow = new BrowserWindow({
    width: widgetWidth,
    height: widgetHeight,
    x: width - widgetWidth - 20, // 20px padding from screen right
    y: Math.floor((height - widgetHeight) / 2),
    transparent: true,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    type: 'desktop',
    alwaysOnTop: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  widgetsWindow.loadFile('index.html');

  // Clean up
  widgetsWindow.on('closed', () => { widgetsWindow = null; });
  dockWindow.on('closed', () => { dockWindow = null; });
  menubarWindow.on('closed', () => { menubarWindow = null; });
}

const additionalData = { myKey: 'aura-widgets' };
const gotTheLock = app.requestSingleInstanceLock(additionalData);

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (widgetsWindow) {
      if (widgetsWindow.isMinimized()) widgetsWindow.restore();
      widgetsWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Configure to auto-launch on system startup
    try {
      app.setLoginItemSettings({
        openAtLogin: true,
        path: process.execPath,
        args: [path.resolve(app.getAppPath())]
      });
    } catch (e) {
      console.error('Failed to configure auto-startup:', e);
    }

    // Set macOS style wallpaper
    setMacWallpaper();

    // Create Menubar, Dock, and Widgets Windows
    createMacWindows();

    // IPC app launch dispatcher from the Dock
    ipcMain.on('launch-app', (event, appName) => {
      if (appName === 'finder') {
        exec('explorer.exe');
      } else if (appName === 'safari') {
        exec('start https://google.com');
      } else if (appName === 'terminal') {
        exec('start cmd.exe');
      } else if (appName === 'settings') {
        exec('control.exe');
      }
    });

    // IPC channel to toggle always-on-top for Widgets
    ipcMain.on('set-always-on-top', (event, isAlwaysOnTop) => {
      if (widgetsWindow && !widgetsWindow.isDestroyed()) {
        widgetsWindow.setAlwaysOnTop(isAlwaysOnTop);
      }
    });

    // IPC channel to minimize widgets window
    ipcMain.on('minimize-widgets', () => {
      if (widgetsWindow && !widgetsWindow.isDestroyed()) {
        widgetsWindow.minimize();
      }
    });

    // Send weather update on widgets window load and every 30 minutes
    widgetsWindow.webContents.once('did-finish-load', async () => {
      const weatherData = await getLiveWeather();
      if (widgetsWindow && !widgetsWindow.isDestroyed()) {
        widgetsWindow.webContents.send('weather-update', weatherData);
      }
    });

    weatherInterval = setInterval(async () => {
      const weatherData = await getLiveWeather();
      if (widgetsWindow && !widgetsWindow.isDestroyed()) {
        widgetsWindow.webContents.send('weather-update', weatherData);
      }
    }, 1800000); // 30 minutes

    // Start sending system metrics to the widgets process (CPU, RAM, Disk, Wifi)
    let tickCount = 0;
    let lastDisk = 0;
    let lastWifi = { ssid: 'Disconnected', signal: 0 };

    metricsInterval = setInterval(async () => {
      if (widgetsWindow && !widgetsWindow.isDestroyed()) {
        try {
          const cpu = await getCPUUsage();
          const totalMem = os.totalmem();
          const freeMem = os.freemem();
          const ram = Math.round(((totalMem - freeMem) / totalMem) * 100);

          if (tickCount % 10 === 0 || lastDisk === 0) {
            lastDisk = getDiskUsage();
          }

          if (tickCount % 3 === 0 || tickCount === 0) {
            lastWifi = await getWifiStatus();
          }

          widgetsWindow.webContents.send('sys-metrics', { 
            cpu, 
            ram, 
            disk: lastDisk,
            wifi: lastWifi
          });

          tickCount++;
        } catch (err) {
          console.error('Error measuring metrics:', err);
        }
      }
    }, 3000);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMacWindows();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (metricsInterval) clearInterval(metricsInterval);
  if (weatherInterval) clearInterval(weatherInterval);
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
