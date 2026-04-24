'use strict';

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  activeTab: 'overview',
  charts: {},
  cpuHistory:     new Array(60).fill(0),
  netSendHistory: new Array(60).fill(0),
  netRecvHistory: new Array(60).fill(0),
  processData: [],
  processSort: { key: 'cpu_percent', asc: false },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + '\u00a0' + sizes[i];
}

function formatUptime(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${Math.floor(sec % 60)}s`;
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Charts ────────────────────────────────────────────────────────────────────
function initCharts() {
  Chart.defaults.color = '#757575';

  const labels = new Array(60).fill('');

  const baseOpts = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
  };

  // CPU chart
  state.charts.cpu = new Chart(document.getElementById('cpu-chart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: [...state.cpuHistory],
        borderColor: '#4f8ef7',
        backgroundColor: 'rgba(79,142,247,0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      }],
    },
    options: {
      ...baseOpts,
      scales: {
        x: { display: false },
        y: {
          min: 0, max: 100,
          grid: { color: '#242424' },
          ticks: { color: '#505050', stepSize: 25, font: { size: 10 } },
          border: { color: '#2d2d2d' },
        },
      },
    },
  });

  // Network chart
  state.charts.net = new Chart(document.getElementById('net-chart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Upload',
          data: [...state.netSendHistory],
          borderColor: '#4caf50',
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
        {
          label: 'Download',
          data: [...state.netRecvHistory],
          borderColor: '#ff9800',
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    },
    options: {
      ...baseOpts,
      plugins: {
        legend: {
          display: true,
          labels: { color: '#606060', boxWidth: 10, font: { size: 11 } },
        },
        tooltip: { enabled: false },
      },
      scales: {
        x: { display: false },
        y: {
          min: 0,
          grid: { color: '#242424' },
          ticks: {
            color: '#505050',
            font: { size: 10 },
            callback: v => formatBytes(v) + '/s',
            maxTicksLimit: 4,
          },
          border: { color: '#2d2d2d' },
        },
      },
    },
  });
}

// ── Overview ──────────────────────────────────────────────────────────────────
async function refreshOverview() {
  let data;
  try {
    data = await fetch('/api/system').then(r => r.json());
  } catch {
    return;
  }

  // Header
  document.getElementById('hostname').textContent = data.hostname;
  document.getElementById('uptime').textContent = 'Up: ' + formatUptime(data.uptime_seconds);

  // CPU
  const cpu = data.cpu.percent;
  state.cpuHistory.push(cpu);
  state.cpuHistory.shift();
  document.getElementById('cpu-percent').textContent = cpu.toFixed(1) + '%';
  document.getElementById('cpu-cores').textContent =
    `${data.cpu.cores_physical ?? '?'} cores (${data.cpu.cores_logical} logical)`;
  document.getElementById('cpu-freq').textContent =
    data.cpu.frequency_mhz ? (data.cpu.frequency_mhz / 1000).toFixed(2) + ' GHz' : '';
  state.charts.cpu.data.datasets[0].data = [...state.cpuHistory];
  state.charts.cpu.update();

  // Memory
  const mem = data.memory;
  document.getElementById('mem-percent').textContent = mem.percent.toFixed(1) + '%';
  document.getElementById('mem-used').textContent  = formatBytes(mem.used);
  document.getElementById('mem-total').textContent = formatBytes(mem.total);
  const memBar = document.getElementById('mem-bar');
  memBar.style.width      = mem.percent + '%';
  memBar.style.background = mem.percent > 90 ? '#f44336' : mem.percent > 70 ? '#ff9800' : '#4f8ef7';

  // Swap
  if (data.swap?.total > 0) {
    document.getElementById('swap-row').style.display    = '';
    document.getElementById('swap-percent').textContent  = data.swap.percent.toFixed(0) + '%';
    document.getElementById('swap-used').textContent     = formatBytes(data.swap.used);
    document.getElementById('swap-total').textContent    = formatBytes(data.swap.total);
    document.getElementById('swap-bar').style.width      = data.swap.percent + '%';
  } else {
    document.getElementById('swap-row').style.display = 'none';
  }

  // Disk
  document.getElementById('disk-list').innerHTML = data.disk.map(d => `
    <div class="disk-item">
      <div class="disk-header">
        <span class="disk-mount">${esc(d.mountpoint)}</span>
        <span class="disk-device">${esc(d.device)}</span>
        <span class="disk-pct ${d.percent > 90 ? 'text-warn' : d.percent > 70 ? 'text-caution' : ''}">${d.percent.toFixed(0)}%</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar" style="width:${d.percent}%;background:${d.percent > 90 ? '#f44336' : d.percent > 70 ? '#ff9800' : '#4f8ef7'}"></div>
      </div>
      <div class="disk-footer">
        <span>${formatBytes(d.used)} used</span>
        <span>${formatBytes(d.free)} free</span>
        <span>${formatBytes(d.total)} total</span>
      </div>
    </div>
  `).join('') || '<p class="muted" style="padding:8px 0">No disk info available</p>';

  // Network
  const send = data.network.speed_send;
  const recv = data.network.speed_recv;
  state.netSendHistory.push(send);
  state.netSendHistory.shift();
  state.netRecvHistory.push(recv);
  state.netRecvHistory.shift();

  document.getElementById('net-send-speed').textContent  = formatBytes(send) + '/s';
  document.getElementById('net-recv-speed').textContent  = formatBytes(recv) + '/s';
  document.getElementById('net-total-sent').textContent  = formatBytes(data.network.bytes_sent);
  document.getElementById('net-total-recv').textContent  = formatBytes(data.network.bytes_recv);

  const maxNet = Math.max(...state.netSendHistory, ...state.netRecvHistory, 1024);
  state.charts.net.options.scales.y.max = maxNet * 1.5;
  state.charts.net.data.datasets[0].data = [...state.netSendHistory];
  state.charts.net.data.datasets[1].data = [...state.netRecvHistory];
  state.charts.net.update();
}

// ── Processes ─────────────────────────────────────────────────────────────────
async function refreshProcesses() {
  let data;
  try {
    data = await fetch('/api/processes').then(r => r.json());
  } catch {
    return;
  }
  state.processData = data;
  renderProcesses();
}

function renderProcesses() {
  const search = document.getElementById('proc-search').value.toLowerCase();
  let filtered = state.processData.filter(p =>
    p.name.toLowerCase().includes(search) ||
    p.username.toLowerCase().includes(search) ||
    String(p.pid).includes(search)
  );

  const { key, asc } = state.processSort;
  filtered.sort((a, b) => {
    const va = a[key] ?? '', vb = b[key] ?? '';
    if (va < vb) return asc ? -1 : 1;
    if (va > vb) return asc ? 1 : -1;
    return 0;
  });

  document.getElementById('proc-count').textContent = `${filtered.length} processes`;
  document.getElementById('proc-tbody').innerHTML = filtered.slice(0, 250).map(p => `
    <tr>
      <td class="mono muted">${p.pid}</td>
      <td>${esc(p.name)}</td>
      <td class="muted">${esc(p.username)}</td>
      <td class="${p.cpu_percent > 50 ? 'text-warn' : p.cpu_percent > 10 ? 'text-caution' : ''}">${p.cpu_percent.toFixed(1)}</td>
      <td>${p.memory_percent.toFixed(1)}</td>
      <td><span class="badge badge-${esc(p.status)}">${esc(p.status)}</span></td>
    </tr>
  `).join('') || '<tr><td colspan="6" class="empty">No processes found</td></tr>';
}

// ── Services (Docker) ─────────────────────────────────────────────────────────
async function refreshServices() {
  let data;
  try {
    data = await fetch('/api/containers').then(r => r.json());
  } catch {
    return;
  }

  const errEl = document.getElementById('services-error');
  if (data.error) {
    errEl.textContent  = 'Docker: ' + data.error;
    errEl.style.display = 'block';
  } else {
    errEl.style.display = 'none';
  }

  document.getElementById('containers-tbody').innerHTML = data.containers.length
    ? data.containers.map(c => `
      <tr>
        <td class="mono muted small">${esc(c.id)}</td>
        <td><strong>${esc(c.name)}</strong></td>
        <td><span class="badge badge-${esc(c.status)}">${esc(c.status)}</span></td>
        <td class="muted small">${esc(c.image)}</td>
        <td class="muted small">${esc(c.ports)}</td>
        <td class="muted">${esc(c.created)}</td>
        <td>
          <div class="actions">
            <button class="btn btn-sm btn-success" onclick="containerAction('${esc(c.id)}','start')" ${c.status === 'running' ? 'disabled' : ''}>Start</button>
            <button class="btn btn-sm btn-danger"  onclick="containerAction('${esc(c.id)}','stop')"  ${c.status !== 'running' ? 'disabled' : ''}>Stop</button>
            <button class="btn btn-sm btn-warning" onclick="containerAction('${esc(c.id)}','restart')">Restart</button>
          </div>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="7" class="empty">No containers found</td></tr>';
}

async function containerAction(id, action) {
  try {
    const r = await fetch(`/api/containers/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
    if (!r.ok) throw new Error((await r.json()).detail ?? r.statusText);
    await refreshServices();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

// ── Startup ───────────────────────────────────────────────────────────────────
async function refreshStartup() {
  let data;
  try {
    data = await fetch('/api/startup').then(r => r.json());
  } catch {
    return;
  }

  document.getElementById('startup-list').innerHTML = data.length
    ? data.map(item => `
      <tr class="${item.enabled ? '' : 'disabled-row'}">
        <td><strong>${esc(item.name)}</strong></td>
        <td class="mono small">${esc(item.command)}</td>
        <td class="muted">${esc(item.description)}</td>
        <td>
          <label class="toggle">
            <input type="checkbox" ${item.enabled ? 'checked' : ''} onchange="toggleStartup('${esc(item.id)}')">
            <span class="toggle-slider"></span>
          </label>
        </td>
        <td>
          <button class="btn btn-sm btn-danger" onclick="deleteStartup('${esc(item.id)}')">Delete</button>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" class="empty">No startup items configured yet.</td></tr>';
}

async function toggleStartup(id) {
  await fetch(`/api/startup/${encodeURIComponent(id)}/toggle`, { method: 'PUT' });
  refreshStartup();
}

async function deleteStartup(id) {
  if (!confirm('Delete this startup item?')) return;
  await fetch(`/api/startup/${encodeURIComponent(id)}`, { method: 'DELETE' });
  refreshStartup();
}

async function addStartupItem(e) {
  e.preventDefault();
  const name        = document.getElementById('startup-name').value.trim();
  const command     = document.getElementById('startup-command').value.trim();
  const description = document.getElementById('startup-desc').value.trim();
  if (!name || !command) return;

  await fetch('/api/startup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, command, description, enabled: true }),
  });
  document.getElementById('startup-form').reset();
  refreshStartup();
}

// ── Tab switching ─────────────────────────────────────────────────────────────
function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );
  document.querySelectorAll('.tab-pane').forEach(p =>
    p.classList.toggle('active', p.id === tab)
  );
  if (tab === 'processes') refreshProcesses();
  if (tab === 'services')  refreshServices();
  if (tab === 'startup')   refreshStartup();
}

// ── Clock ─────────────────────────────────────────────────────────────────────
function updateClock() {
  document.getElementById('clock').textContent = new Date().toLocaleTimeString();
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Sortable process table headers
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (state.processSort.key === key) {
        state.processSort.asc = !state.processSort.asc;
      } else {
        state.processSort.key = key;
        state.processSort.asc = false;
      }
      document.querySelectorAll('th.sortable').forEach(t =>
        t.classList.remove('sort-asc', 'sort-desc')
      );
      th.classList.add(state.processSort.asc ? 'sort-asc' : 'sort-desc');
      renderProcesses();
    });
  });

  // Live search
  document.getElementById('proc-search').addEventListener('input', renderProcesses);

  // Startup form
  document.getElementById('startup-form').addEventListener('submit', addStartupItem);

  // Init charts and first data fetch
  initCharts();
  await refreshOverview();

  // Polling intervals
  setInterval(refreshOverview, 2000);
  setInterval(() => { if (state.activeTab === 'processes') refreshProcesses(); }, 3000);
  setInterval(() => { if (state.activeTab === 'services')  refreshServices();  }, 5000);
  setInterval(updateClock, 1000);
  updateClock();
});
