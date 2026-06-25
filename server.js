const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('public'));

let processes = [
  { id: "P1", status: "running", cpu: 20, memory: 30, action: "Normal" },
  { id: "P2", status: "running", cpu: 40, memory: 50, action: "Normal" },
  { id: "P3", status: "running", cpu: 30, memory: 20, action: "Normal" },
  { id: "P4", status: "running", cpu: 25, memory: 35, action: "Normal" }
];

// 🔁 Auto simulation + self-healing
function simulateSystem() {
  processes.forEach(p => {
    if (p.status !== "killed") {

      p.cpu = Math.floor(Math.random() * 100);
      p.memory = Math.floor(Math.random() * 100);

      if (p.cpu > 85) {
        p.status = "overload";
        p.action = "Reducing CPU Load";
        p.cpu = 50;
      }
      else if (Math.random() < 0.2) {
        p.status = "stuck";
        p.action = "Auto Restarted";
        p.cpu = 30;
        p.memory = 30;
      }
      else {
        p.status = "running";
        p.action = "Normal";
      }
    }
  });
}

// 📡 Get processes
app.get('/processes', (req, res) => {
  simulateSystem();
  res.json(processes);
});

// ❌ Kill process
app.post('/kill/:id', (req, res) => {
  const id = req.params.id;
  processes = processes.map(p =>
    p.id === id ? { ...p, status: "killed", action: "Killed by User" } : p
  );
  res.json({ message: "Process killed" });
});

// 🔄 Restart process
app.post('/restart/:id', (req, res) => {
  const id = req.params.id;
  processes = processes.map(p =>
    p.id === id
      ? { ...p, status: "running", cpu: 30, memory: 30, action: "Restarted by User" }
      : p
  );
  res.json({ message: "Process restarted" });
});

// ➕ Add process
app.post('/add', (req, res) => {
  const newId = "P" + (processes.length + 1);
  processes.push({
    id: newId,
    status: "running",
    cpu: 20,
    memory: 20,
    action: "New Process Added"
  });
  res.json({ message: "Process added" });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});