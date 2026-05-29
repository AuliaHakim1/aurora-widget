const { ipcRenderer } = require('electron');

// 1. DYNAMIC THEME SWITCHER
const themes = ['theme-nord', 'theme-cyber', 'theme-forest', 'theme-sakura'];
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
