const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const https = require('https');
const { exec } = require('child_process');

let mainWindow;
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

// PowerShell wallpaper changer
function changeWallpaper(wallpaperName) {
  try {
    // Resolve absolute path to wallpaper asset
    const wallpaperPath = path.join(app.getAppPath(), 'wallpapers', wallpaperName);
    
    // Standard Windows User32 API call via PowerShell to change desktop wallpaper immediately
    const psCommand = `powershell -Command "Add-Type -TypeDefinition '[DllImport(\\"user32.dll\\")] public class Win { [DllImport(\\"user32.dll\\", CharSet = CharSet.Auto)] public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni); }'; [Win]::SystemParametersInfo(20, 0, \\"${wallpaperPath}\\", 3)"`;
    
    exec(psCommand, (err) => {
      if (err) {
        console.error('Wallpaper execution error:', err);
      }
    });
  } catch (err) {
    console.error('Failed to change wallpaper:', err);
  }
}

// Select wallpaper based on weather code and time of day
function selectWallpaperForWeather(code) {
  const hour = new Date().getHours();
  
  // 1. Rainy/Thunderstorm conditions
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code)) {
    return 'rainy.png';
  }
  
  // 2. Night time (6 PM to 6 AM)
  if (hour >= 18 || hour < 6) {
    return 'night.png';
  }
  
  // 3. Cloudy/Foggy conditions during day
  if ([1, 2, 3, 45, 48].includes(code)) {
    return 'cloudy.png';
  }
  
  // 4. Default: clear morning/day
  return 'morning.png';
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 320,
    height: 600, // Height increased to 600 to fit audio visualizer
    transparent: true,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    type: 'desktop',
    alwaysOnTop: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: false
    }
  });

  mainWindow.loadFile('index.html');

  // Position on the right side of the screen
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  
  const x = width - 340;
  const y = Math.floor((height - 600) / 2);
  mainWindow.setPosition(x, y);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const additionalData = { myKey: 'aura-widgets' };
const gotTheLock = app.requestSingleInstanceLock(additionalData);

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
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

    createWindow();

    // IPC channel to toggle always-on-top
    ipcMain.on('set-always-on-top', (event, isAlwaysOnTop) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setAlwaysOnTop(isAlwaysOnTop);
      }
    });

    // Handle wallpaper change request from renderer or IPC
    ipcMain.on('trigger-wallpaper-change', (event, code) => {
      const wp = selectWallpaperForWeather(code);
      changeWallpaper(wp);
    });

    // Send weather update on window load and every 30 minutes
    mainWindow.webContents.once('did-finish-load', async () => {
      const weatherData = await getLiveWeather();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('weather-update', weatherData);
        // Trigger wallpaper change immediately based on weather code
        const wp = selectWallpaperForWeather(weatherData.code);
        changeWallpaper(wp);
      }
    });

    weatherInterval = setInterval(async () => {
      const weatherData = await getLiveWeather();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('weather-update', weatherData);
        const wp = selectWallpaperForWeather(weatherData.code);
        changeWallpaper(wp);
      }
    }, 1800000); // 30 minutes

    // Start sending system metrics to the renderer process (CPU, RAM, Disk, Wifi)
    let tickCount = 0;
    let lastDisk = 0;
    let lastWifi = { ssid: 'Disconnected', signal: 0 };

    metricsInterval = setInterval(async () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          const cpu = await getCPUUsage();
          
          // RAM calculation
          const totalMem = os.totalmem();
          const freeMem = os.freemem();
          const ram = Math.round(((totalMem - freeMem) / totalMem) * 100);

          // Throttled Disk check (every 30s)
          if (tickCount % 10 === 0 || lastDisk === 0) {
            lastDisk = getDiskUsage();
          }

          // Throttled Wifi check (every 9s)
          if (tickCount % 3 === 0 || tickCount === 0) {
            lastWifi = await getWifiStatus();
          }

          mainWindow.webContents.send('sys-metrics', { 
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
        createWindow();
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
