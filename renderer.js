const { ipcRenderer } = require('electron');

// 1. DYNAMIC THEME SWITCHER & WALLPAPER BINDING
const themes = ['theme-nord', 'theme-cyber', 'theme-forest', 'theme-sakura'];
// Map themes to mock weather codes to trigger matching wallpapers:
// theme-nord -> 0 (morning.png), theme-cyber -> 61 (rainy.png)
// theme-forest -> 45 (cloudy.png), theme-sakura -> 99 (night.png via night check)
const themeWallpaperCodes = [0, 61, 45, 99];
let currentThemeIndex = 0;

// Load preferred theme on startup
const savedTheme = localStorage.getItem('aura-theme');
if (savedTheme && themes.includes(savedTheme)) {
  currentThemeIndex = themes.indexOf(savedTheme);
  document.body.className = savedTheme;
} else {
  document.body.className = themes[0];
}

const themeBtn = document.getElementById('theme-btn');
themeBtn.addEventListener('click', () => {
  currentThemeIndex = (currentThemeIndex + 1) % themes.length;
  const newTheme = themes[currentThemeIndex];
  document.body.className = newTheme;
  localStorage.setItem('aura-theme', newTheme);

  // Send trigger to main process to change desktop wallpaper to match the theme!
  const mockCode = themeWallpaperCodes[currentThemeIndex];
  ipcRenderer.send('trigger-wallpaper-change', mockCode);
});

// 2. CLOCK & DATE UPDATE
function updateTime() {
  const now = new Date();
  
  // Format Time (HH:MM)
  let hours = now.getHours().toString().padStart(2, '0');
  let minutes = now.getMinutes().toString().padStart(2, '0');
  document.getElementById('time').textContent = `${hours}:${minutes}`;

  // Format Date (Day, DD Month)
  const options = { weekday: 'long', day: 'numeric', month: 'short' };
  document.getElementById('date').textContent = now.toLocaleDateString('en-US', options);
}
updateTime();
setInterval(updateTime, 1000);

// 3. SYSTEM METRICS LISTENER (CPU, RAM, Disk, Wifi)
ipcRenderer.on('sys-metrics', (event, data) => {
  const { cpu, ram, disk, wifi } = data;

  // Update CPU Ring
  document.getElementById('cpu-val').textContent = `${cpu}%`;
  document.getElementById('cpu-ring').setAttribute('stroke-dasharray', `${cpu}, 100`);

  // Update RAM Ring
  document.getElementById('ram-val').textContent = `${ram}%`;
  document.getElementById('ram-ring').setAttribute('stroke-dasharray', `${ram}, 100`);

  // Update Disk Ring
  if (disk !== undefined) {
    document.getElementById('disk-val').textContent = `${disk}%`;
    document.getElementById('disk-ring').setAttribute('stroke-dasharray', `${disk}, 100`);
  }

  // Update Wifi info line
  if (wifi !== undefined) {
    const wifiLine = document.getElementById('wifi-line');
    if (wifi.ssid === 'Disconnected' || wifi.ssid === 'Offline') {
      wifiLine.textContent = `WiFi: ${wifi.ssid}`;
    } else {
      wifiLine.textContent = `WiFi: ${wifi.ssid} (${wifi.signal}%)`;
    }
  }
});

// 4. LIVE WEATHER LISTENER & INTERPRETER
function getWeatherEmoji(code) {
  if (code === 0) return '☀️'; // Clear Sky
  if ([1, 2, 3].includes(code)) return '🌤️'; // Partly Cloudy
  if ([45, 48].includes(code)) return '🌫️'; // Fog
  if ([51, 53, 55].includes(code)) return '🌧️'; // Drizzle
  if ([61, 63, 65, 80, 81, 82].includes(code)) return '🌧️'; // Rain
  if ([71, 73, 75, 85, 86].includes(code)) return '❄️'; // Snow
  if ([95, 96, 99].includes(code)) return '🌩️'; // Thunderstorm
  return '☁️'; // Default cloudy
}

ipcRenderer.on('weather-update', (event, data) => {
  const { city, temp, code } = data;
  
  document.getElementById('weather-city').textContent = city;
  
  if (temp === '--') {
    document.getElementById('weather-temp').textContent = '--°C';
    document.getElementById('weather-icon').textContent = '☁️';
  } else {
    document.getElementById('weather-temp').textContent = `${temp}°C`;
    document.getElementById('weather-icon').textContent = getWeatherEmoji(code);
  }
});

// 5. INTERACTIVE TODO LIST
const todoInput = document.getElementById('todo-input');
const todoList = document.getElementById('todo-list');
let todoItems = [];

// Load saved Todo Items
const savedTodos = localStorage.getItem('aura-todo-items');
if (savedTodos) {
  try {
    todoItems = JSON.parse(savedTodos);
  } catch (e) {
    todoItems = [];
  }
}

function saveTodos() {
  localStorage.setItem('aura-todo-items', JSON.stringify(todoItems));
}

function renderTodos() {
  todoList.innerHTML = '';
  todoItems.forEach((todo, index) => {
    const li = document.createElement('li');
    li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
    
    li.addEventListener('click', (e) => {
      if (e.target.classList.contains('todo-delete')) return;
      todo.completed = !todo.completed;
      saveTodos();
      renderTodos();
    });

    const span = document.createElement('span');
    span.className = 'todo-text';
    span.textContent = todo.text;
    span.title = todo.text;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'todo-delete';
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', () => {
      todoItems.splice(index, 1);
      saveTodos();
      renderTodos();
    });

    li.appendChild(span);
    li.appendChild(deleteBtn);
    todoList.appendChild(li);
  });
}

todoInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const text = todoInput.value.trim();
    if (text) {
      todoItems.push({ text, completed: false });
      todoInput.value = '';
      saveTodos();
      renderTodos();
    }
  }
});

renderTodos();

// 6. PIN / ALWAYS ON TOP CONTROLLER
const pinDot = document.querySelector('.dot.pin');
let isAlwaysOnTop = false;

pinDot.addEventListener('click', () => {
  isAlwaysOnTop = !isAlwaysOnTop;
  ipcRenderer.send('set-always-on-top', isAlwaysOnTop);
  
  if (isAlwaysOnTop) {
    pinDot.style.boxShadow = '0 0 8px var(--accent-cyan)';
    pinDot.title = 'Unpin from top';
  } else {
    pinDot.style.boxShadow = 'none';
    pinDot.title = 'Pin to top';
  }
});

// 7. HIGHLY OPTIMIZED AUDIO VISUALIZER
const canvas = document.getElementById('visualizer');
const canvasCtx = canvas.getContext('2d');

let audioCtx;
let analyser;
let source;
let dataArray;
let bufferLength;

async function initVisualizer() {
  try {
    // Capture audio input stream (typically default mic or stereo mix if configured)
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
    
    analyser.fftSize = 64; // Low sample size for 32 clean bars and ultra low CPU usage
    bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    
    drawVisualizer();
  } catch (err) {
    console.warn('Microphone/Audio visualizer unavailable:', err.message);
    drawStaticVisualizer();
  }
}

function drawVisualizer() {
  requestAnimationFrame(drawVisualizer);
  
  if (!analyser) return;
  analyser.getByteFrequencyData(dataArray);
  
  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  
  const barWidth = (canvas.width / bufferLength) * 1.6;
  let barHeight;
  let x = 0;
  
  const computedStyle = getComputedStyle(document.body);
  const accent = computedStyle.getPropertyValue('--accent-cyan').trim() || '#88c0d0';
  canvasCtx.fillStyle = accent;
  
  // Calculate average to check if silent (throttles redraw loops and saves system resource)
  let sum = 0;
  for (let i = 0; i < bufferLength; i++) {
    sum += dataArray[i];
  }
  const avg = sum / bufferLength;
  
  if (avg < 2) {
    // In silent mode, draw a simple thin indicator line to minimize rendering cycles
    canvasCtx.fillRect(0, canvas.height / 2 - 1, canvas.width, 2);
    return;
  }
  
  for (let i = 0; i < bufferLength; i++) {
    barHeight = (dataArray[i] / 255) * canvas.height;
    
    // Draw centered vertical audio bars
    const y = (canvas.height - barHeight) / 2;
    canvasCtx.fillRect(x, y, barWidth - 2, barHeight);
    
    x += barWidth;
  }
}

function drawStaticVisualizer() {
  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  canvasCtx.fillRect(0, canvas.height / 2 - 1, canvas.width, 2);
}

initVisualizer();
