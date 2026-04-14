import { inject } from '@vercel/analytics';

// Initialize Vercel Analytics
inject();

const STORAGE_KEY = 'rwp7';

const ACTIVITIES = [
  { value: '', label: '—', color: 'transparent', hasKm: false },
  { value: 'easy', label: 'Easy Run', color: '#1D9E75', hasKm: true },
  { value: 'long', label: 'Long Run', color: '#185FA5', hasKm: true },
  { value: 'tempo', label: 'Tempo', color: '#D85A30', hasKm: true },
  { value: 'short_int', label: 'Short Int.', color: '#9F5CC0', hasKm: true },
  { value: 'long_int', label: 'Long Int.', color: '#BA7517', hasKm: true },
  { value: 'work', label: 'Work', color: '#888780', hasKm: false },
];
const ACT_MAP = Object.fromEntries(ACTIVITIES.map(a => [a.value, a]));
const KM_OPTIONS = ['—', ...Array.from({length: 50}, (_, i) => i + 1)];
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

let state = {};
let currentYear, currentMonth;
let saveTimer = null;
let darkMode = false;

// ── STATE ──
function k(y, m, d, f) { return `${y}_${m}_${d}_${f}`; }

function loadState() {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    state = r ? JSON.parse(r) : {};
  } catch(e) { state = {}; }
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); flashSaved(); } catch(e) {}
}

function flashSaved() {
  clearTimeout(saveTimer);
  const el = document.getElementById('savedIndicator');
  el.classList.add('show');
  saveTimer = setTimeout(() => el.classList.remove('show'), 1500);
}

function eraseAll() {
  try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
  state = {};
  renderCalendar(); renderHistory();
}

function getAct(y, m, d) { return state[k(y,m,d,'act')] || ''; }
function getKm(y, m, d) { return state[k(y,m,d,'km')] || 0; }
function setAct(y, m, d, v) { state[k(y,m,d,'act')] = v; saveState(); }
function setKm(y, m, d, v) { state[k(y,m,d,'km')] = v; saveState(); }

// ── DARK MODE ──
function applyTheme() {
  document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  document.getElementById('togglePill').classList.toggle('on', darkMode);
  try { localStorage.setItem('rwp_theme', darkMode ? 'dark' : 'light'); } catch(e) {}
}

function loadTheme() {
  try {
    const t = localStorage.getItem('rwp_theme');
    if (t === 'dark') darkMode = true;
    else if (t === 'light') darkMode = false;
    else darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch(e) { darkMode = false; }
  applyTheme();
}

// ── MENU ──
function toggleMenu() {
  document.getElementById('dropdown').classList.toggle('open');
}

function closeMenu() {
  document.getElementById('dropdown').classList.remove('open');
}

// Close menu on outside click
document.addEventListener('click', (e) => {
  const btn = document.getElementById('menuBtn');
  const dd = document.getElementById('dropdown');
  if (!btn.contains(e.target) && !dd.contains(e.target)) {
    closeMenu();
  }
});

// ── CALENDAR HELPERS ──
function getDays(y, m) { return new Date(y, m+1, 0).getDate(); }
function getOffset(y, m) { let d = new Date(y,m,1).getDay(); return d===0?6:d-1; }
function getWeeks(y, m) { return Math.ceil((getDays(y,m) + getOffset(y,m)) / 7); }

function getMondayOf(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0) ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function calcWeekKmFromMonday(mondayDate) {
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(mondayDate);
    d.setDate(d.getDate() + i);
    total += getKm(d.getFullYear(), d.getMonth(), d.getDate());
  }
  return total;
}

function calcWeekKm(y, m, w) {
  const days = getDays(y,m), off = getOffset(y,m);
  let t = 0;
  for (let d=1; d<=days; d++) {
    if (Math.floor((d-1+off)/7) === w) t += getKm(y,m,d);
  }
  return t;
}

function getCurrentWeekIndex(y, m) {
  const today = new Date();
  if (today.getFullYear() !== y || today.getMonth() !== m) return -1;
  return Math.floor((today.getDate() - 1 + getOffset(y, m)) / 7);
}

function getPrev6Weeks(y, m) {
  const today = new Date();
  const thisMonday = getMondayOf(today);
  let collected = [];
  let weekMonday = new Date(thisMonday);
  weekMonday.setDate(weekMonday.getDate() - 7);
  while (collected.length < 6) {
    const km = calcWeekKmFromMonday(weekMonday);
    const label = weekMonday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    collected.unshift({ km, label });
    weekMonday.setDate(weekMonday.getDate() - 7);
  }
  return collected;
}

function calcAvg6Top3(y, m) {
  const weeks = getPrev6Weeks(y, m);
  if (!weeks.length) return { avg: 0, top3indices: new Set() };
  const sorted = [...weeks].map((w, i) => ({ km: w.km, i })).sort((a, b) => b.km - a.km);
  const top3 = sorted.slice(0, 3);
  const top3indices = new Set(top3.map(t => t.i));
  const avg = top3.length > 0 ? Math.round(top3.reduce((s, t) => s + t.km, 0) / top3.length) : 0;
  return { avg, top3indices };
}

function makeKmSelect(y, m, d, disabled, currentKm, rowRef, weekIdx, avg6) {
  const sel = document.createElement('select');
  sel.className = 'sel';
  sel.disabled = disabled;
  KM_OPTIONS.forEach((v, i) => {
    const opt = document.createElement('option');
    opt.value = i === 0 ? 0 : v;
    opt.textContent = i === 0 ? '—' : String(v);
    if ((i === 0 && currentKm === 0) || (i > 0 && v === currentKm)) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', function() {
    setKm(y, m, d, parseInt(this.value) || 0);
    updateWeekKm(weekIdx, rowRef, avg6);
    renderHistory();
  });
  return sel;
}

function renderLegend() {
  document.getElementById('legend').innerHTML = ACTIVITIES.filter(a=>a.value).map(a=>
    `<span class="legend-item"><span class="dot" style="background:${a.color}"></span>${a.label}</span>`
  ).join('');
}

function renderDayHeaders() {
  document.getElementById('dayHeaders').innerHTML =
    DAYS.map(d=>`<div class="day-hdr">${d}</div>`).join('') +
    '<div class="day-hdr dist-hdr"></div>';
}

function renderCalendar() {
  const y = currentYear, m = currentMonth;
  const now = new Date();
  document.getElementById('monthTitle').textContent =
    new Date(y,m,1).toLocaleDateString('en-GB',{month:'long',year:'numeric'});

  const isCurrentMonth = now.getFullYear() === y && now.getMonth() === m;

  const days = getDays(y,m), off = getOffset(y,m), numWeeks = getWeeks(y,m);
  const today = new Date();
  const curWeekIdx = getCurrentWeekIndex(y, m);
  const { avg: avg6 } = calcAvg6Top3(y, m);
  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  for (let w=0; w<numWeeks; w++) {
    const row = document.createElement('div');
    row.className = 'week-row';
    const isCurrent = (w === curWeekIdx);
    const wkm = calcWeekKm(y,m,w);
    const isOver = isCurrent && avg6 > 0 && wkm > avg6 * 1.1;

    for (let dow=0; dow<7; dow++) {
      const pos = w*7 + dow;
      const dayNum = pos - off + 1;
      const cell = document.createElement('div');

      if (dayNum < 1 || dayNum > days) {
        cell.className = 'day-cell empty-cell';
      } else {
        cell.className = 'day-cell';
        const act = getAct(y,m,dayNum);
        const km = getKm(y,m,dayNum);
        const actInfo = ACT_MAP[act] || ACT_MAP[''];
        if (act) {
          cell.classList.add('has-activity');
          cell.style.borderColor = actInfo.color;
        }

        const isTodayCell = today.getFullYear()===y && today.getMonth()===m && today.getDate()===dayNum;
        const numEl = document.createElement('div');
        numEl.className = 'day-num' + (isTodayCell?' today':'');
        numEl.textContent = dayNum;
        cell.appendChild(numEl);

        const actSel = document.createElement('select');
        actSel.className = 'sel';
        ACTIVITIES.forEach(a => {
          const opt = document.createElement('option');
          opt.value = a.value; opt.textContent = a.label;
          if (a.value === act) opt.selected = true;
          actSel.appendChild(opt);
        });

        const kmSel = makeKmSelect(y, m, dayNum, !actInfo.hasKm, km, row, w, avg6);

        actSel.addEventListener('change', function() {
          const newAct = this.value;
          setAct(y, m, dayNum, newAct);
          const info = ACT_MAP[newAct] || ACT_MAP[''];
          if (newAct) {
            cell.classList.add('has-activity');
            cell.style.borderColor = info.color;
          } else {
            cell.classList.remove('has-activity');
            cell.style.borderColor = 'transparent';
          }
          kmSel.disabled = !info.hasKm;
          if (!info.hasKm) { setKm(y,m,dayNum,0); kmSel.value = 0; }
          updateWeekKm(w, row, avg6);
          renderHistory();
        });

        cell.appendChild(actSel);
        cell.appendChild(kmSel);
      }
      row.appendChild(cell);
    }

    const kmCell = document.createElement('div');
    kmCell.className = 'week-km' + (isCurrent ? (isOver ? ' is-over' : ' is-current') : '');
    kmCell.dataset.week = w;
    kmCell.dataset.isCurrent = isCurrent ? '1' : '0';

    const totalEl = document.createElement('span');
    totalEl.className = 'wk-total' + (isOver ? ' over' : '');
    totalEl.textContent = wkm;
    const lblEl = document.createElement('span');
    lblEl.className = 'wk-lbl';
    lblEl.textContent = '';
    kmCell.appendChild(totalEl);
    kmCell.appendChild(lblEl);

    if (isCurrent) {
      const avgEl = document.createElement('div');
      avgEl.className = 'wk-avg ' + (isOver ? 'over' : 'normal');
      avgEl.textContent = avg6;
      const avgLbl = document.createElement('div');
      avgLbl.className = 'wk-avg-lbl';
      avgLbl.textContent = 'avg 6w';
      kmCell.appendChild(avgEl);
      kmCell.appendChild(avgLbl);
    }

    row.appendChild(kmCell);
    grid.appendChild(row);
  }
}

function updateWeekKm(w, row, avg6) {
  const cell = row.querySelector('.week-km');
  if (!cell) return;
  const isCurrent = cell.dataset.isCurrent === '1';
  const wkm = calcWeekKm(currentYear, currentMonth, w);
  const isOver = isCurrent && avg6 > 0 && wkm > avg6 * 1.1;
  const totalEl = cell.querySelector('.wk-total');
  if (totalEl) { totalEl.textContent = wkm; totalEl.className = 'wk-total' + (isOver ? ' over' : ''); }
  if (isCurrent) {
    cell.className = 'week-km ' + (isOver ? 'is-over' : 'is-current');
    const avgEl = cell.querySelector('.wk-avg');
    if (avgEl) avgEl.className = 'wk-avg ' + (isOver ? 'over' : 'normal');
  }
}

function renderHistory() {
  const weeks = getPrev6Weeks(currentYear, currentMonth);
  const { top3indices } = calcAvg6Top3(currentYear, currentMonth);
  const maxKm = Math.max(...weeks.map(w=>w.km), 1);
  document.getElementById('historyBars').innerHTML = weeks.map((w, i)=>`
    <div class="bar-row">
      <span class="bar-label">${w.label}</span>
      <div class="bar-track">
        <div class="bar-fill ${top3indices.has(i) ? 'top3' : ''}" style="width:${Math.round((w.km/maxKm)*100)}%"></div>
      </div>
      <span class="bar-km">${w.km}</span>
    </div>
  `).join('');
}

// ── EMAIL via mailto (obfuscated) ──
function getRecipient() {
  const p = ['t','o','m','a','s','e','k','e','n','g','r','e','n','\x40','y','a','h','o','o','\x2e','s','e'];
  return p.join('');
}

function sendMessage(name, email, message) {
  const to = getRecipient();
  const subject = encodeURIComponent('Run Week – Message from ' + name);
  const body = encodeURIComponent(
    'Name: ' + name + '\n' +
    'Email: ' + email + '\n\n' +
    message
  );
  window.location.href = 'mailto:' + to + '?subject=' + subject + '&body=' + body;
}

// ── INIT ──
function init() {
  loadState();
  loadTheme();
  const now = new Date();
  currentYear = now.getFullYear(); currentMonth = now.getMonth();

  document.getElementById('prevBtn').addEventListener('click', () => {
    currentMonth--; if(currentMonth<0){currentMonth=11;currentYear--;}
    renderCalendar(); renderHistory();
  });

  document.getElementById('nextBtn').addEventListener('click', () => {
    currentMonth++; if(currentMonth>11){currentMonth=0;currentYear++;}
    renderCalendar(); renderHistory();
  });

  // Menu button
  document.getElementById('menuBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  // Dark/light mode
  document.getElementById('menuThemeBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    darkMode = !darkMode;
    applyTheme();
  });

  // Erase all from menu
  document.getElementById('menuEraseBtn').addEventListener('click', () => {
    closeMenu();
    document.getElementById('confirmBox').classList.add('visible');
  });

  document.getElementById('confirmNo').addEventListener('click', () => {
    document.getElementById('confirmBox').classList.remove('visible');
  });

  document.getElementById('confirmYes').addEventListener('click', () => {
    document.getElementById('confirmBox').classList.remove('visible');
    eraseAll();
  });

  // Contact / message Thomas
  document.getElementById('menuContactBtn').addEventListener('click', () => {
    closeMenu();
    document.getElementById('senderName').value = '';
    document.getElementById('senderEmail').value = '';
    document.getElementById('senderMessage').value = '';
    document.getElementById('msgStatus').textContent = '';
    document.getElementById('msgStatus').className = 'msg-status';
    document.getElementById('sendBtn').disabled = false;
    document.getElementById('contactOverlay').classList.add('open');
  });

  document.getElementById('contactClose').addEventListener('click', () => {
    document.getElementById('contactOverlay').classList.remove('open');
  });

  document.getElementById('contactOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('contactOverlay')) {
      document.getElementById('contactOverlay').classList.remove('open');
    }
  });

  document.getElementById('sendBtn').addEventListener('click', () => {
    const name = document.getElementById('senderName').value.trim();
    const email = document.getElementById('senderEmail').value.trim();
    const message = document.getElementById('senderMessage').value.trim();
    const status = document.getElementById('msgStatus');

    if (!name) { status.textContent = 'Please enter your name.'; status.className = 'msg-status error'; return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { status.textContent = 'Please enter a valid email address.'; status.className = 'msg-status error'; return; }
    if (!message) { status.textContent = 'Please write a message.'; status.className = 'msg-status error'; return; }

    sendMessage(name, email, message);

    status.textContent = 'Opening your email app...';
    status.className = 'msg-status success';
    setTimeout(() => {
      document.getElementById('contactOverlay').classList.remove('open');
    }, 1500);
  });

  renderLegend(); renderDayHeaders(); renderCalendar(); renderHistory();
}

init();
