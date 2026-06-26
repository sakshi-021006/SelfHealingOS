const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ─── Process Pool ───────────────────────────────────────────────────────────
let processes = [
  { id: 1,  name: 'nginx-master',    command: 'nginx: master process',      user: 'root',     status: 'running',  cpu: 5,  mem: 128, startedAt: ago(14,'days'),  healPolicy: { autoHeal: true,  cpuThreshold: 80, reviveDelay: 5  } },
  { id: 2,  name: 'postgres-db',     command: 'postgres: main process',      user: 'postgres', status: 'running',  cpu: 22, mem: 512, startedAt: ago(7,'days'),   healPolicy: { autoHeal: true,  cpuThreshold: 80, reviveDelay: 4  } },
  { id: 3,  name: 'redis-cache',     command: 'redis-server *:6379',         user: 'redis',    status: 'overload', cpu: 91, mem: 320, startedAt: ago(3,'days'),   healPolicy: { autoHeal: true,  cpuThreshold: 80, reviveDelay: 3  } },
  { id: 4,  name: 'worker-queue',    command: 'node worker.js --queue',      user: 'app',      status: 'stuck',    cpu: 0,  mem: 64,  startedAt: ago(1,'hours'),  healPolicy: { autoHeal: true,  cpuThreshold: 80, reviveDelay: 6  } },
  { id: 5,  name: 'log-aggregator',  command: 'node aggregator.js',          user: 'app',      status: 'running',  cpu: 8,  mem: 96,  startedAt: ago(2,'days'),   healPolicy: { autoHeal: true,  cpuThreshold: 80, reviveDelay: 4  } },
  { id: 6,  name: 'cron-scheduler',  command: 'cron -f',                     user: 'root',     status: 'killed',   cpu: 0,  mem: 0,   startedAt: ago(5,'hours'),  healPolicy: { autoHeal: true,  cpuThreshold: 80, reviveDelay: 8  } },
  { id: 7,  name: 'email-service',   command: 'node email-service.js',       user: 'app',      status: 'running',  cpu: 12, mem: 200, startedAt: ago(5,'days'),   healPolicy: { autoHeal: true,  cpuThreshold: 80, reviveDelay: 5  } },
  { id: 8,  name: 'media-encoder',   command: 'ffmpeg -i input.mp4 ...',     user: 'app',      status: 'overload', cpu: 87, mem: 768, startedAt: ago(0.5,'hours'),healPolicy: { autoHeal: true,  cpuThreshold: 80, reviveDelay: 7  } },
  { id: 9,  name: 'auth-service',    command: 'node auth.js --port 4001',    user: 'app',      status: 'running',  cpu: 6,  mem: 150, startedAt: ago(10,'days'),  healPolicy: { autoHeal: true,  cpuThreshold: 80, reviveDelay: 4  } },
  { id: 10, name: 'api-gateway',     command: 'node gateway.js --port 8080', user: 'app',      status: 'running',  cpu: 18, mem: 256, startedAt: ago(4,'days'),   healPolicy: { autoHeal: false, cpuThreshold: 80, reviveDelay: 5  } },
  { id: 11, name: 'file-watcher',    command: 'node watcher.js /var/data',   user: 'app',      status: 'stuck',    cpu: 0,  mem: 48,  startedAt: ago(2,'hours'),  healPolicy: { autoHeal: true,  cpuThreshold: 80, reviveDelay: 5  } },
  { id: 12, name: 'backup-service',  command: 'bash backup.sh --daily',      user: 'root',     status: 'killed',   cpu: 0,  mem: 0,   startedAt: ago(3,'hours'),  healPolicy: { autoHeal: false, cpuThreshold: 80, reviveDelay: 10 } },
];

let nextId = 13;
let nextPid = 9000;

// ─── Heal Log ───────────────────────────────────────────────────────────────
let healLog = [];
const MAX_LOG = 100;

function addLog(type, process, message) {
  healLog.unshift({
    id: Date.now() + Math.random(),
    time: new Date().toISOString(),
    type,        // 'warning' | 'healed' | 'manual' | 'info'
    processName: process.name,
    processId: process.id,
    message,
  });
  if (healLog.length > MAX_LOG) healLog.pop();
}

// ─── CPU Fluctuation Engine (every 3s) ──────────────────────────────────────
setInterval(() => {
  processes.forEach(p => {
    if (p.status === 'killed' || p.status === 'stuck') return;
    const delta = (Math.random() - 0.45) * 12;
    p.cpu = Math.max(1, Math.min(99, parseFloat((p.cpu + delta).toFixed(1))));

    const wasRunning = p.status === 'running';
    if (p.cpu > p.healPolicy.cpuThreshold && wasRunning) {
      p.status = 'overload';
      addLog('warning', p, `CPU spiked to ${p.cpu}% — marked as OVERLOAD`);
    } else if (p.cpu <= p.healPolicy.cpuThreshold && p.status === 'overload') {
      p.status = 'running';
      addLog('info', p, `CPU dropped to ${p.cpu}% — back to RUNNING`);
    }
  });
}, 3000);

// ─── Self-Healing Engine (every 5s) ─────────────────────────────────────────
setInterval(() => {
  processes.forEach(p => {
    if (!p.healPolicy.autoHeal) return;

    // Auto-heal STUCK processes
    if (p.status === 'stuck') {
      addLog('warning', p, `Detected STUCK — initiating auto-heal...`);
      setTimeout(() => {
        if (p.status !== 'stuck') return; // already changed
        p.status = 'running';
        p.cpu = Math.floor(Math.random() * 15) + 3;
        p.mem = p.mem || 128;
        p.startedAt = new Date();
        addLog('healed', p, `Auto-healed successfully — process restarted`);
      }, p.healPolicy.reviveDelay * 1000);
    }

    // Auto-heal KILLED processes
    if (p.status === 'killed') {
      addLog('warning', p, `Detected KILLED — scheduling auto-revive in ${p.healPolicy.reviveDelay}s...`);
      setTimeout(() => {
        if (p.status !== 'killed') return;
        p.status = 'running';
        p.cpu = Math.floor(Math.random() * 15) + 3;
        p.mem = p._lastMem || 128;
        p.startedAt = new Date();
        addLog('healed', p, `Auto-revived successfully — process is running again`);
      }, p.healPolicy.reviveDelay * 1000);
    }

    // Auto-heal persistent OVERLOAD (if overloaded for too long, restart)
    if (p.status === 'overload') {
      if (!p._overloadSince) {
        p._overloadSince = Date.now();
      } else if (Date.now() - p._overloadSince > 15000) {
        // Overloaded for 15s — force restart
        addLog('warning', p, `OVERLOAD for 15s — force restarting...`);
        p._overloadSince = null;
        setTimeout(() => {
          p.status = 'running';
          p.cpu = Math.floor(Math.random() * 20) + 5;
          p.startedAt = new Date();
          addLog('healed', p, `Force-restarted after sustained overload — CPU now ${p.cpu}%`);
        }, 3000);
      }
    } else {
      p._overloadSince = null;
    }
  });
}, 5000);

// ─── Simulate random faults (every 20s) — keeps demo interesting ────────────
setInterval(() => {
  const healthy = processes.filter(p => p.status === 'running');
  if (healthy.length < 3) return; // don't fault too many at once
  const target = healthy[Math.floor(Math.random() * healthy.length)];
  const fault = Math.random() > 0.5 ? 'stuck' : 'overload';
  target.status = fault;
  if (fault === 'stuck') target.cpu = 0;
  if (fault === 'overload') target.cpu = Math.floor(Math.random() * 15) + 85;
  addLog('warning', target, `Random fault injected — process went ${fault.toUpperCase()}`);
}, 20000);

// ─── API Routes ──────────────────────────────────────────────────────────────

// GET /api/processes
app.get('/api/processes', (req, res) => {
  res.json({ processes: processes.map(fmt), system: systemStats() });
});

// GET /api/heal-log
app.get('/api/heal-log', (req, res) => {
  res.json({ log: healLog });
});

// POST /api/processes/:id/kill — manual kill
app.post('/api/processes/:id/kill', (req, res) => {
  const p = processes.find(x => x.id === parseInt(req.params.id));
  if (!p) return res.status(404).json({ error: 'Not found' });
  if (p.status === 'killed') return res.status(400).json({ error: 'Already killed' });
  p._lastMem = p.mem;
  p.status = 'killed';
  p.cpu = 0;
  p.mem = 0;
  addLog('manual', p, `Manually killed by operator`);
  res.json({ success: true });
});

// POST /api/processes/:id/restart — manual restart
app.post('/api/processes/:id/restart', (req, res) => {
  const p = processes.find(x => x.id === parseInt(req.params.id));
  if (!p) return res.status(404).json({ error: 'Not found' });
  p.status = 'running';
  p.cpu = Math.floor(Math.random() * 20) + 3;
  p.mem = p.mem || p._lastMem || 128;
  p.startedAt = new Date();
  p._overloadSince = null;
  addLog('manual', p, `Manually restarted by operator`);
  res.json({ success: true });
});

// PATCH /api/processes/:id/heal-policy — toggle autoHeal
app.patch('/api/processes/:id/heal-policy', (req, res) => {
  const p = processes.find(x => x.id === parseInt(req.params.id));
  if (!p) return res.status(404).json({ error: 'Not found' });
  if (typeof req.body.autoHeal === 'boolean') p.healPolicy.autoHeal = req.body.autoHeal;
  if (req.body.cpuThreshold) p.healPolicy.cpuThreshold = req.body.cpuThreshold;
  addLog('info', p, `Heal policy updated — autoHeal: ${p.healPolicy.autoHeal}`);
  res.json({ success: true, healPolicy: p.healPolicy });
});

// POST /api/processes — add new process
app.post('/api/processes', (req, res) => {
  const { name, command, user, status, cpu, mem } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const p = {
    id: nextId++, pid: nextPid++, name,
    command: command || name,
    user: user || 'app',
    status: status || 'running',
    cpu: parseFloat(cpu) || 5,
    mem: parseInt(mem) || 128,
    startedAt: new Date(),
    healPolicy: { autoHeal: true, cpuThreshold: 80, reviveDelay: 5 },
  };
  processes.push(p);
  addLog('info', p, `New process added to monitor`);
  res.status(201).json(fmt(p));
});

// DELETE /api/processes/:id
app.delete('/api/processes/:id', (req, res) => {
  const idx = processes.findIndex(x => x.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  processes.splice(idx, 1);
  res.json({ success: true });
});

// POST /api/inject-fault — manually inject a fault for demo
app.post('/api/inject-fault', (req, res) => {
  const { id, fault } = req.body;
  const p = processes.find(x => x.id === id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  p.status = fault;
  if (fault === 'stuck') p.cpu = 0;
  if (fault === 'overload') p.cpu = Math.floor(Math.random() * 15) + 85;
  if (fault === 'killed') { p._lastMem = p.mem; p.cpu = 0; p.mem = 0; }
  addLog('warning', p, `Fault injected manually — ${fault.toUpperCase()}`);
  res.json({ success: true });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(p) {
  return {
    id: p.id, pid: p.pid || 1000 + p.id,
    name: p.name, command: p.command, user: p.user,
    status: p.status,
    cpu: parseFloat(p.cpu.toFixed(1)),
    mem: p.mem,
    uptime: formatUptime(p.startedAt),
    healPolicy: p.healPolicy,
  };
}

function systemStats() {
  const running  = processes.filter(p => p.status === 'running').length;
  const overload = processes.filter(p => p.status === 'overload').length;
  const stuck    = processes.filter(p => p.status === 'stuck').length;
  const killed   = processes.filter(p => p.status === 'killed').length;
  const healed   = healLog.filter(l => l.type === 'healed').length;
  const avgCpu   = processes.filter(p => p.status !== 'killed')
    .reduce((a, b) => a + b.cpu, 0) / Math.max(processes.filter(p=>p.status!=='killed').length, 1);
  return { total: processes.length, running, overload, stuck, killed, healed, cpuUsage: parseFloat(avgCpu.toFixed(1)) };
}

function ago(amount, unit) {
  const ms = unit === 'days' ? amount * 86400000 : unit === 'hours' ? amount * 3600000 : amount * 60000;
  return new Date(Date.now() - ms);
}

function formatUptime(startedAt) {
  if (!startedAt) return '—';
  const ms = Date.now() - new Date(startedAt).getTime();
  if (ms < 0) return '—';
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m ${s % 60}s`;
}

app.listen(PORT, () => {
  console.log(`✅ Self-Healing OS Simulator running → http://localhost:${PORT}`);
  console.log(`   Auto-heal engine active — faults injected every 20s`);
});
