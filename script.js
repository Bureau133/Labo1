const fileInput = document.getElementById('fileInput');
const player = document.getElementById('player');
const btnGood = document.getElementById('btnGood');
const btnBad  = document.getElementById('btnBad');
const qCount = document.getElementById('qCount');
const qProgress = document.getElementById('qProgress');
const currentName = document.getElementById('currentName');
const playedBar = document.getElementById('playedBar');
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const btnReset = document.getElementById('btnReset');
const timerEl = document.getElementById('timer');
const urlDialog = document.getElementById('urlDialog');
const urlText = document.getElementById('urlText');
const btnAddUrls = document.getElementById('btnAddUrls');
const btnClear = document.getElementById('btnClear');
const btnSaveCsv = document.getElementById('btnSaveCsv');

let queue = [];        // {name, url, blobURL?}
let index = -1;
let results = [];      // {name, decision, timeSpent, criteria:[...]}
let timer = 0;         // seconds
let intId = null;
let lastTick = null;
let startedAtVideo = null;

function fmt(sec){
  const m = Math.floor(sec/60).toString().padStart(2,'0');
  const s = Math.floor(sec%60).toString().padStart(2,'0');
  return `${m}:${s}`;
}
function renderTimer(){ timerEl.textContent = fmt(timer); }
function startTimer(){
  if(intId) return;
  lastTick = performance.now();
  intId = requestAnimationFrame(tick);
}
function stopTimer(){
  if(!intId) return;
  cancelAnimationFrame(intId); intId = null;
}
function resetTimer(){ timer = 0; renderTimer(); }

function tick(now){
  const dt = (now - lastTick)/1000;
  lastTick = now;
  timer += dt;
  renderTimer();
  intId = requestAnimationFrame(tick);
}

btnStart.addEventListener('click', startTimer);
btnStop.addEventListener('click', stopTimer);
btnReset.addEventListener('click', resetTimer);

fetch('videos.json')
  .then(r=>r.ok?r.json():[])
  .then(list=>{
    (list||[]).forEach(link=>queue.push({name: (link.split('/').pop()||'video'), url: link, blob:false}));
    if(queue.length){ index = 0; loadCurrent(); updateQueueUI(); }
  })
  .catch(()=>{});

fileInput.addEventListener('change', (e)=>{
  for(const f of e.target.files){
    const url = URL.createObjectURL(f);
    queue.push({name:f.name, url, blob:true});
  }
  e.target.value = '';
  updateQueueUI();
  if(index < 0 && queue.length){ index = 0; loadCurrent(); }
});

btnAddUrls.addEventListener('click', ()=> urlDialog.showModal());
document.getElementById('urlOk').addEventListener('click', (e)=>{
  e.preventDefault();
  const lines = urlText.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  for(const link of lines){
    const name = link.split('/').pop() || 'video';
    queue.push({name, url: link, blob:false});
  }
  urlText.value='';
  urlDialog.close();
  updateQueueUI();
  if(index < 0 && queue.length){ index = 0; loadCurrent(); }
});

btnClear.addEventListener('click', ()=>{
  queue.forEach(v=>{ if(v.blob) URL.revokeObjectURL(v.url); });
  queue = []; index = -1; results = [];
  player.removeAttribute('src'); player.load();
  updateQueueUI(); currentName.textContent = '';
  playedBar.style.width = '0%';
});

player.addEventListener('timeupdate', ()=>{
  if(player.duration){
    const p = (player.currentTime/player.duration)*100;
    playedBar.style.width = p + '%';
  }
});

function updateQueueUI(){
  qCount.textContent = queue.length;
  const progress = (queue.length ? ((index+1)/queue.length)*100 : 0);
  qProgress.value = progress;
}

function loadCurrent(){
  if(index < 0 || index >= queue.length){ return; }
  const item = queue[index];
  player.src = item.url;
  player.play().catch(()=>{});
  currentName.textContent = `#${index+1} — ${item.name}`;
  updateQueueUI();
  startedAtVideo = timer;
  for(const tr of document.querySelectorAll('#reviewTable tbody tr')){
    tr.querySelector('select').value = '';
    tr.querySelector('td[contenteditable]').textContent = '';
  }
}

function collectCriteria(){
  const rows = [];
  for(const tr of document.querySelectorAll('#reviewTable tbody tr')){
    const crit = tr.children[0].textContent.trim();
    const val = tr.querySelector('select').value;
    const note = tr.querySelector('td[contenteditable]').textContent.trim();
    rows.push({crit, val, note});
  }
  return rows;
}

function decide(decision){
  if(index < 0 || index >= queue.length) return;
  const spent = timer - (startedAtVideo ?? timer);
  const item = queue[index];
  results.push({
    name: item.name,
    decision,
    timeSpent: Math.max(0, spent).toFixed(1),
    criteria: collectCriteria()
  });
  index++;
  if(index < queue.length){
    loadCurrent();
  }else{
    player.pause();
    currentName.textContent = 'Очередь закончилась';
    playedBar.style.width = '0%';
    updateQueueUI();
  }
}

btnGood.addEventListener('click', ()=>decide('good'));
btnBad.addEventListener('click', ()=>decide('bad'));

document.addEventListener('keydown',(e)=>{
  if(e.key==='ArrowRight') decide('good');
  if(e.key==='ArrowLeft') decide('bad');
  if(e.key===' ') {
    e.preventDefault();
    if(player.paused) player.play(); else player.pause();
  }
});

btnSaveCsv.addEventListener('click', ()=>{
  if(!results.length){ alert('Пока нет данных.'); return; }
  const rows = [];
  rows.push(['№','Файл','Решение','Время (с)','Критерий','Оценка','Комментарий']);
  results.forEach((r,i)=>{
    r.criteria.forEach((c,j)=>{
      rows.push([i+1, r.name, r.decision, r.timeSpent, c.crit, c.val, c.note]);
    });
  });
  const csv = rows.map(r=>r.map(x=>`"${(x??'').toString().replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ad-review.csv';
  a.click();
  URL.revokeObjectURL(a.href);
});