async function loadProcesses() {
  const res = await fetch('/processes');
  const data = await res.json();

  const table = document.getElementById('processTable');
  table.innerHTML = '';

  let issues = 0;

  data.forEach(p => {
    if (p.status !== "running") issues++;

    const row = `
      <tr>
        <td>${p.id}</td>
        <td class="${p.status}">${p.status}</td>
        <td>${p.cpu}</td>
        <td>${p.memory}</td>
        <td>${p.action}</td>
        <td>
          <button class="kill" onclick="killProcess('${p.id}')">Kill</button>
          <button class="restart" onclick="restartProcess('${p.id}')">Restart</button>
        </td>
      </tr>
    `;
    table.innerHTML += row;
  });

  document.getElementById('total').innerText = data.length;
  document.getElementById('issues').innerText = issues;
}

async function killProcess(id) {
  await fetch(`/kill/${id}`, { method: 'POST' });
  loadProcesses();
}

async function restartProcess(id) {
  await fetch(`/restart/${id}`, { method: 'POST' });
  loadProcesses();
}

async function addProcess() {
  await fetch('/add', { method: 'POST' });
  loadProcesses();
}

setInterval(loadProcesses, 2000);