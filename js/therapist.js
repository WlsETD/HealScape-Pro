(function therapistApp() {
  const PATIENTS = [
    { id: 'p01', name: '王大明', birthday: '1958-05-12', age: 68, risk: 'high', alert: 'ROM 下降 15%', rom: 75, historyRom: 88, adherence: 62, level: 12, height: 172, weight: 75, bp: '145/92' },
    { id: 'p02', name: '林淑芬', birthday: '1954-11-20', age: 72, risk: 'low', alert: '進度穩定', rom: 88, historyRom: 85, adherence: 91, level: 25, height: 158, weight: 58, bp: '128/80' },
    { id: 'p03', name: '張志豪', birthday: '1981-03-05', age: 45, risk: 'medium', alert: '依從率波動', rom: 74, historyRom: 72, adherence: 70, level: 18, height: 180, weight: 82, bp: '135/85' },
    { id: 'p04', name: '陳文琪', birthday: '1967-08-15', age: 59, risk: 'high', alert: '連續 3 日未登入', rom: 63, historyRom: 70, adherence: 58, level: 8, height: 162, weight: 64, bp: '152/98' },
    { id: 'p05', name: '劉家豪', birthday: '1975-01-22', age: 51, risk: 'low', alert: '可提升訓練難度', rom: 92, historyRom: 90, adherence: 95, level: 30, height: 175, weight: 70, bp: '120/78' },
    { id: 'p06', name: '黃小玲', birthday: '1992-12-10', age: 34, risk: 'medium', alert: '抓握力不穩定', rom: 65, historyRom: 68, adherence: 72, level: 15, height: 165, weight: 52, bp: '118/75' },
    { id: 'p07', name: '郭振興 (伯伯)', birthday: '1944-06-30', age: 82, risk: 'high', alert: '平衡能力欠佳 / 疲勞感增加', rom: 55, historyRom: 60, adherence: 45, level: 5, height: 168, weight: 68, bp: '158/95' },
    { id: 'p08', name: '李美雲 (阿姨)', birthday: '1966-04-18', age: 60, risk: 'low', alert: '居家練習表現優異', rom: 80, historyRom: 78, adherence: 98, level: 22, height: 155, weight: 55, bp: '122/76' },
    { id: 'p09', name: '趙子龍', birthday: '1997-09-09', age: 29, risk: 'low', alert: '術後恢復進度超前', rom: 95, historyRom: 92, adherence: 100, level: 42, height: 182, weight: 78, bp: '115/72' },
    { id: 'p10', name: '孫大華', birthday: '1951-02-14', age: 75, risk: 'medium', alert: '動作代償頻繁 (Trunk)', rom: 68, historyRom: 70, adherence: 78, level: 14, height: 170, weight: 72, bp: '140/88' },
  ];

  const STAFF = {
    doctor: '陳志明 醫師',
    therapist: '林雅婷 物理治療師',
    department: '復健醫學科 - 神經復健組'
  };

  const state = {
    selectedId: null,
    filterRisk: 'all',
    searchQuery: '',
    showPrescribeModal: false
  };

  function maskName(str) {
    if (!str) return '';
    const parts = str.split(' ');
    let name = parts[0];
    let masked = '';
    if (name.length === 2) {
      masked = name[0] + 'O';
    } else if (name.length >= 3) {
      masked = name[0] + 'O' + name.substring(2);
    } else {
      masked = name;
    }
    return masked + (parts.length > 1 ? ' ' + parts.slice(1).join(' ') : '');
  }

  function init() {
    healscapeAuth.checkAuth('therapist');
    render();
    attachEvents();
  }

  function render() {
    const app = document.getElementById('therapist-app');
    if (!app) return;

    const filtered = PATIENTS.filter(p => {
      const matchRisk = state.filterRisk === 'all' || p.risk === state.filterRisk;
      const matchSearch = p.name.includes(state.searchQuery);
      return matchRisk && matchSearch;
    });

    let html = `
      <section class="h-full flex flex-col bg-slate-50">
        <header class="bg-slate-900 text-white p-6 shadow-xl">
          <div class="flex justify-between items-center mb-4">
            <div>
              <h2 class="text-xl font-black">臨床駕駛艙</h2>
              <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Clinical Cockpit v2.0</p>
            </div>
            <button onclick="healscapeAuth.logout()" class="text-slate-400 hover:text-white">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <div class="bg-slate-800 p-2 rounded-xl text-center">
              <div class="text-xs text-slate-500 font-bold uppercase">Total</div>
              <div class="text-lg font-black">${PATIENTS.length}</div>
            </div>
            <div class="bg-slate-800 p-2 rounded-xl text-center">
              <div class="text-xs text-slate-500 font-bold uppercase">High Risk</div>
              <div class="text-lg font-black text-red-400">${PATIENTS.filter(p=>p.risk==='high').length}</div>
            </div>
            <div class="bg-slate-800 p-2 rounded-xl text-center">
              <div class="text-xs text-slate-500 font-bold uppercase">Avg Adh.</div>
              <div class="text-lg font-black text-teal-400">${Math.round(PATIENTS.reduce((a, b) => a + b.adherence, 0) / PATIENTS.length)}%</div>
            </div>
          </div>
        </header>

        <div class="flex-1 overflow-y-auto no-scrollbar p-5 space-y-4">
          <div class="flex gap-2 mb-2">
            <input id="search-input" type="text" placeholder="搜尋姓名..." value="${state.searchQuery}" class="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20">
            <select id="risk-filter" class="bg-white border border-slate-200 rounded-xl px-2 py-2 text-sm focus:outline-none">
              <option value="all" ${state.filterRisk==='all'?'selected':''}>全部</option>
              <option value="high" ${state.filterRisk==='high'?'selected':''}>高風險</option>
              <option value="medium" ${state.filterRisk==='medium'?'selected':''}>中風險</option>
              <option value="low" ${state.filterRisk==='low'?'selected':''}>低風險</option>
            </select>
          </div>

          <div class="space-y-3">
            ${filtered.map(p => renderPatientCard(p)).join('')}
          </div>
        </div>

        ${state.selectedId ? renderPatientDetails(PATIENTS.find(p=>p.id===state.selectedId)) : ''}
        ${state.showPrescribeModal ? renderPrescribeModal() : ''}
      </section>
    `;
    app.innerHTML = html;
    
    // Re-attach input listeners
    document.getElementById('search-input')?.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      render();
    });
    document.getElementById('risk-filter')?.addEventListener('change', (e) => {
      state.filterRisk = e.target.value;
      render();
    });
  }

  function renderPatientCard(p) {
    const isSelected = state.selectedId === p.id;
    return `
      <div data-act="select-patient" data-id="${p.id}" class="bg-white p-4 rounded-2xl border ${isSelected ? 'border-teal-500 ring-2 ring-teal-500/10' : 'border-slate-100'} shadow-sm transition-all active:scale-[0.98] cursor-pointer">
        <div class="flex justify-between items-start">
          <div class="flex gap-3">
            <div class="w-1 h-10 rounded-full ${p.risk === 'high' ? 'bg-red-500' : p.risk === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}"></div>
            <div>
              <div class="flex items-center gap-2">
                <h4 class="font-black text-slate-800">${maskName(p.name)}</h4>
                <span class="bg-slate-100 text-[9px] font-black text-slate-500 px-1.5 py-0.5 rounded-md border border-slate-200">LVL ${p.level}</span>
              </div>
              <p class="text-[10px] ${p.risk==='high'?'text-red-500 font-bold':'text-slate-400'} mt-0.5">${p.alert}</p>
            </div>
          </div>
          <div class="text-right">
            <div class="text-xs font-bold text-slate-300 uppercase tracking-tighter">Current ROM</div>
            <div class="text-lg font-black ${p.rom < p.historyRom ? 'text-red-500' : 'text-teal-600'}">${p.rom}°</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderPatientDetails(p) {
    if (!p) return '';
    return `
      <div class="fixed inset-x-0 bottom-0 bg-white rounded-t-[40px] shadow-2xl z-20 border-t border-slate-100 animate-slide-up h-[85%] flex flex-col">
        <div class="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-4 mb-6"></div>
        <div class="px-8 flex-1 overflow-y-auto no-scrollbar">
          <div class="flex justify-between items-center mb-6">
            <div>
              <h3 class="text-2xl font-black text-slate-800">${maskName(p.name)} 生理參數報告</h3>
              <div class="flex gap-2 mt-2">
                <span class="status-pill ${p.risk}">${p.risk.toUpperCase()} RISK</span>
                <span class="bg-teal-100 text-teal-700 text-[10px] font-black px-3 py-1 rounded-full border border-teal-200">LVL ${p.level}</span>
                <span class="text-[10px] text-slate-400 font-bold uppercase py-1 px-3 bg-slate-100 rounded-full">ID: ${p.id}</span>
              </div>
            </div>
            <button data-act="close-details" class="p-2 bg-slate-100 rounded-full text-slate-500">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <!-- Basic Information -->
          <div class="bg-slate-50 p-5 rounded-3xl mb-6 border border-slate-100">
            <h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">病患基本資料</h4>
            <div class="grid grid-cols-2 gap-y-3">
              <div>
                <div class="text-[10px] text-slate-400">出生日期</div>
                <div class="text-sm font-bold text-slate-700">${p.birthday}</div>
              </div>
              <div>
                <div class="text-[10px] text-slate-400">性別 / 年齡</div>
                <div class="text-sm font-bold text-slate-700">${p.age >= 60 ? '男' : '女'} / ${p.age} 歲</div>
              </div>
              <div>
                <div class="text-[10px] text-slate-400">主責醫師</div>
                <div class="text-sm font-bold text-teal-600">${STAFF.doctor}</div>
              </div>
              <div>
                <div class="text-[10px] text-slate-400">物理治療師</div>
                <div class="text-sm font-bold text-teal-600">${STAFF.therapist}</div>
              </div>
            </div>
          </div>

          <!-- Measurement Data -->
          <div class="grid grid-cols-3 gap-3 mb-6">
            <div class="bg-white border border-slate-100 p-4 rounded-2xl text-center shadow-sm">
              <div class="text-[9px] font-bold text-slate-400 uppercase mb-1">身高 (cm)</div>
              <div class="text-lg font-black text-slate-800">${p.height}</div>
            </div>
            <div class="bg-white border border-slate-100 p-4 rounded-2xl text-center shadow-sm">
              <div class="text-[9px] font-bold text-slate-400 uppercase mb-1">體重 (kg)</div>
              <div class="text-lg font-black text-slate-800">${p.weight}</div>
            </div>
            <div class="bg-white border border-slate-100 p-4 rounded-2xl text-center shadow-sm">
              <div class="text-[9px] font-bold text-slate-400 uppercase mb-1">血壓 (mmHg)</div>
              <div class="text-lg font-black ${parseInt(p.bp.split('/')[0]) > 140 ? 'text-red-500' : 'text-slate-800'}">${p.bp}</div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4 mb-8">
            <div class="bg-slate-50 p-4 rounded-3xl">
              <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">今日 ROM</div>
              <div class="text-3xl font-black text-slate-800">${p.rom}°</div>
              <div class="text-[10px] mt-1 ${p.rom < p.historyRom ? 'text-red-500' : 'text-teal-500'} font-bold">
                ${p.rom < p.historyRom ? '↓' : '↑'} ${Math.abs(p.rom - p.historyRom)}° vs 歷史平均
              </div>
            </div>
            <div class="bg-slate-50 p-4 rounded-3xl">
              <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">依從率</div>
              <div class="text-3xl font-black text-slate-800">${p.adherence}%</div>
              <div class="w-full h-1 bg-slate-200 rounded-full mt-2 overflow-hidden">
                <div class="h-full bg-teal-500" style="width: ${p.adherence}%"></div>
              </div>
            </div>
          </div>

          <div class="space-y-4 mb-8">
            <div class="flex items-center gap-2">
              <div class="w-5 h-5 bg-teal-500 rounded-md flex items-center justify-center">
                <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <h4 class="text-xs font-bold text-slate-800 uppercase tracking-widest">AI 臨床摘要與建議</h4>
            </div>
            
            <div class="bg-gradient-to-br from-teal-50 to-white border border-teal-100 rounded-3xl p-5 shadow-sm">
              <div class="flex items-start gap-4 mb-4">
                <div class="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-teal-50 shrink-0">
                  <span class="text-xl">🤖</span>
                </div>
                <div>
                  <div class="text-[10px] font-bold text-teal-600 uppercase mb-1">Clinical Insight</div>
                  <p class="text-sm text-slate-700 leading-relaxed font-medium">
                    ${p.rom < p.historyRom 
                      ? `偵測到近三日 ROM 呈現 <span class="text-red-500 font-bold">下降趨勢 (-${Math.abs(p.rom - p.historyRom)}°)</span>。結合動作特徵分析，患者在屈曲 60° 後出現明顯的肩胛骨代償（Scapular Shrugging）。`
                      : `患者恢復進度良好，ROM 穩定提升中。動作流暢度評分優於 85% 同期患者，建議可開始介入抗阻力訓練以加強肌力。`}
                  </p>
                </div>
              </div>

              <div class="space-y-3 pt-3 border-t border-teal-50">
                <div class="flex items-start gap-2">
                  <div class="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5"></div>
                  <p class="text-[11px] text-slate-500"><span class="font-bold text-slate-700">復健處方調整：</span>${p.risk === 'high' ? '建議降低目標角度至 70°，重點轉向動作正確性而非範圍。' : '可維持目前計畫，並增加手指精細動作訓練比重。'}</p>
                </div>
                <div class="flex items-start gap-2">
                  <div class="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5"></div>
                  <p class="text-[11px] text-slate-500"><span class="font-bold text-slate-700">居家監測重點：</span>提醒患者在執行動作時保持背部挺直，避免利用軀幹後仰代償。</p>
                </div>
              </div>
            </div>
          </div>

          <div class="pb-10">
            <button data-act="open-prescribe" class="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl shadow-xl active:scale-95 transition-all">
              下達復健處方
            </button>
          </div>
        </div>
      </div>
      <div class="fixed inset-0 bg-black/20 backdrop-blur-sm z-10" data-act="close-details"></div>
    `;
  }

  function renderPrescribeModal() {
    return `
      <div class="fixed inset-0 flex items-center justify-center z-50 p-6">
        <div class="bg-white rounded-[32px] w-full max-w-sm shadow-2xl overflow-hidden animate-pop">
          <div class="bg-slate-900 p-6 text-white">
            <h3 class="text-xl font-black">處方派送</h3>
            <p class="text-xs text-slate-400 mt-1">設定目標生理參數</p>
          </div>
          <div class="p-8 space-y-6">
            <div>
              <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">訓練項目</label>
              <select class="w-full border-b-2 border-slate-100 py-2 focus:border-teal-500 outline-none font-bold">
                <option>肩關節屈曲 (Shoulder Flexion)</option>
                <option>手指抓握 (Grip Strength)</option>
              </select>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">目標角度</label>
                <input type="number" value="90" class="w-full border-b-2 border-slate-100 py-2 focus:border-teal-500 outline-none font-black text-xl">
              </div>
              <div>
                <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">重複次數</label>
                <input type="number" value="3" class="w-full border-b-2 border-slate-100 py-2 focus:border-teal-500 outline-none font-black text-xl">
              </div>
            </div>
            <div class="pt-4 flex gap-3">
              <button data-act="send-prescription" class="flex-1 bg-teal-500 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all">確認派送</button>
              <button data-act="close-prescribe" class="flex-1 bg-slate-100 text-slate-500 font-bold py-4 rounded-2xl">取消</button>
            </div>
          </div>
        </div>
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-40" data-act="close-prescribe"></div>
      </div>
    `;
  }

  function attachEvents() {
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act]');
      if (!t) return;
      const act = t.dataset.act;

      if (act === 'select-patient') {
        state.selectedId = t.dataset.id;
        render();
      }

      if (act === 'close-details') {
        state.selectedId = null;
        render();
      }

      if (act === 'open-prescribe') {
        state.showPrescribeModal = true;
        render();
      }

      if (act === 'close-prescribe') {
        state.showPrescribeModal = false;
        render();
      }

      if (act === 'send-prescription') {
        toast('處方已成功上傳至雲端試算表');
        state.showPrescribeModal = false;
        render();
      }
    });
  }

  function toast(msg) {
    const wrap = document.getElementById('toastWrap');
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<span class="font-bold">${msg}</span>`;
    wrap.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  init();
})();
