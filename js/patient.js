(function patientApp() {
  const state = {
    patientId: sessionStorage.getItem('userId') || 'patient01',
    taskStep: 'idle', // idle/scanning/action/result
    taskMode: 'arm',  // arm/grip
    targetReps: 3,
    arm: { angle: 0, reps: 0, status: 'down', max: 0 },
    grip: { score: 0, reps: 0, status: 'open', max: 0 },
    ai: { loading: false, camera: false, engineReady: false, side: '-' },
    history: [],
    stats: {
      xp: parseInt(sessionStorage.getItem('patientXP')) || 0,
      level: parseInt(sessionStorage.getItem('patientLevel')) || 1,
      nextLevelXp: 500
    },
    mathQuiz: {
      question: '',
      answer: null,
      options: [],
      solved: false,
      streak: 0
    },
    reactionTask: {
      active: false,
      startTime: 0,
      targetPos: { x: 50, y: 50 },
      hits: 0,
      targetHits: 5,
      times: []
    },
    currentView: 'home' // home / data
  };

  const buffers = { angle: [], grip: [], closeFrames: 0 };
  let detector = null;
  let stream = null;
  let rafId = null;

  async function init() {
    healscapeAuth.checkAuth('patient');
    state.history = (await healscapeApi.getPatientData(state.patientId)).history;
    state.stats.nextLevelXp = state.stats.level * 500;
    generateMathQuiz();
    render();
    attachEvents();
  }

  function generateMathQuiz() {
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    const operators = ['+', '-'];
    const op = operators[Math.floor(Math.random() * operators.length)];
    const question = `${a} ${op} ${b} = ?`;
    const answer = op === '+' ? a + b : a - b;
    
    let options = [answer];
    while (options.length < 3) {
      const wrong = answer + (Math.floor(Math.random() * 5) - 2);
      if (!options.includes(wrong)) options.push(wrong);
    }
    options.sort(() => Math.random() - 0.5);

    // Keep streak, only update question related data
    state.mathQuiz.question = question;
    state.mathQuiz.answer = answer;
    state.mathQuiz.options = options;
    state.mathQuiz.solved = false;
  }

  function generateReactionTarget() {
    state.reactionTask.targetPos = {
      x: 20 + Math.random() * 60,
      y: 20 + Math.random() * 60
    };
    state.reactionTask.startTime = Date.now();
  }

  function renderMathQuiz() {
    const streak = state.mathQuiz.streak || 0;
    const bonusXp = 100 + (streak * 20);

    if (state.mathQuiz.solved) {
      return `
        <div class="bg-teal-50 border-2 border-teal-100 p-6 rounded-[32px] text-center animate-pop">
          <div class="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg class="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
          </div>
          <h3 class="text-lg font-black text-teal-800 mb-1">大腦活性充能成功</h3>
          <p class="text-teal-600 text-[10px] font-bold uppercase tracking-widest mb-4">連續答對次數：${streak}</p>
          <button data-act="new-math" class="w-full bg-teal-600 text-white font-bold py-3 rounded-2xl shadow-lg shadow-teal-200 active:scale-95 transition-all">
            接受下一項挑戰
          </button>
        </div>
      `;
    }

    return `
      <div class="bg-gradient-to-br from-teal-500 to-teal-600 p-6 rounded-[32px] shadow-xl text-white relative overflow-hidden">
        <!-- Medical Pattern Background -->
        <div class="absolute inset-0 opacity-10 pointer-events-none">
          <svg class="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0,50 Q25,30 50,50 T100,50" fill="none" stroke="white" stroke-width="0.5" />
            <path d="M0,60 Q25,40 50,60 T100,60" fill="none" stroke="white" stroke-width="0.5" />
          </svg>
        </div>

        <div class="relative z-10">
          <div class="flex justify-between items-start mb-5">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
              </div>
              <div>
                <h3 class="text-[10px] font-black uppercase tracking-widest text-teal-100">認知激發訓練</h3>
                <p class="text-2xl font-black tabular-nums">${state.mathQuiz.question}</p>
              </div>
            </div>
            <div class="bg-white/20 backdrop-blur-md rounded-xl px-3 py-2 text-right">
              <div class="text-[9px] font-bold text-teal-50 uppercase leading-none mb-1">Rewards</div>
              <div class="text-sm font-black text-yellow-300 leading-none">+${bonusXp} XP</div>
            </div>
          </div>
          
          <div class="grid grid-cols-3 gap-3">
            ${state.mathQuiz.options.map(opt => `
              <button data-act="math-ans" data-val="${opt}" class="bg-white/20 hover:bg-white/30 border border-white/20 py-4 rounded-2xl font-black text-xl backdrop-blur-md transition-all active:scale-90">
                ${opt}
              </button>
            `).join('')}
          </div>
          
          <div class="mt-5 flex justify-between items-center px-1">
            <div class="flex gap-1.5">
              ${Array.from({length: 5}).map((_, i) => `
                <div class="w-2 h-2 rounded-full ${i < streak ? 'bg-yellow-300 shadow-[0_0_8px_rgba(253,224,71,0.6)]' : 'bg-white/20'} transition-all duration-300"></div>
              `).join('')}
            </div>
            <div class="text-[10px] font-bold text-teal-50 uppercase tracking-tighter">Streak: ${streak}</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderReactionTask() {
    const r = state.reactionTask;
    return `
      <div class="space-y-4">
        <div class="bg-slate-900 rounded-[32px] aspect-[3/4] relative overflow-hidden shadow-2xl">
          <!-- Background Grid -->
          <div class="absolute inset-0 opacity-10" style="background-image: radial-gradient(circle, white 1px, transparent 1px); background-size: 30px 30px;"></div>
          
          <div class="absolute top-10 left-6 right-6 flex justify-between items-start z-10">
            <div class="glass-panel p-3 px-4 text-slate-800 border-l-4 border-amber-500">
              <div class="text-[10px] font-bold text-amber-600 uppercase tracking-tighter">Reaction Task</div>
              <div class="text-xl font-black tabular-nums">${r.hits} <span class="text-xs text-slate-400">Hits</span></div>
            </div>
            <div class="glass-panel p-3 px-4 text-slate-800 text-right">
              <div class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Target</div>
              <div class="text-xl font-black tabular-nums">${r.targetHits}</div>
            </div>
          </div>

          <!-- The Target -->
          ${r.active ? `
            <button data-act="hit-target" class="absolute w-16 h-16 bg-amber-500 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.6)] flex items-center justify-center transition-all duration-300 active:scale-90" style="left: ${r.targetPos.x}%; top: ${r.targetPos.y}%; transform: translate(-50%, -50%);">
              <div class="w-12 h-12 border-4 border-white/40 rounded-full animate-ping"></div>
            </button>
          ` : `
            <div class="absolute inset-0 flex items-center justify-center">
              <button data-act="start-reaction-go" class="bg-amber-500 text-white font-black px-8 py-4 rounded-2xl shadow-xl active:scale-95 transition-all">準備好了</button>
            </div>
          `}

          <div class="absolute bottom-8 left-6 right-6">
            <button data-act="cancel-task" class="w-full bg-slate-800/80 text-white font-bold py-4 rounded-2xl backdrop-blur-md">取消任務</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderHomeView() {
    return `
      <div class="flex-1 overflow-y-auto no-scrollbar p-5 space-y-6">
        <!-- Math Quiz -->
        ${renderMathQuiz()}

        <!-- Physiological Trend -->
        <div class="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
          <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">生理指標趨勢 (ROM)</h3>
          <div class="h-32 flex items-end justify-between gap-2 px-2">
            ${state.history.map(h => `
              <div class="flex-1 flex flex-col items-center group">
                <div class="w-full bg-teal-50 rounded-t-lg transition-all duration-500 relative" style="height: ${h.rom}%">
                  <div class="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-teal-600 opacity-0 group-hover:opacity-100">${h.rom}°</div>
                </div>
                <div class="text-[9px] text-slate-400 mt-2">${h.date.split('-')[2]}日</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Tasks -->
        ${state.taskStep === 'idle' ? renderTaskSelection() : (state.taskMode === 'reaction' ? renderReactionTask() : renderDetectionInterface())}
        
        <!-- History Card -->
        <div class="bg-slate-800 text-white p-5 rounded-3xl shadow-lg relative overflow-hidden">
          <div class="relative z-10">
            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">上回訓練表現</h3>
            <div class="text-3xl font-black text-teal-400">85% <span class="text-xs text-slate-400 font-normal ml-1">依從率</span></div>
            <p class="text-[10px] text-slate-400 mt-2 italic">"動作穩定度優於 70% 同年齡患者"</p>
          </div>
          <div class="absolute -right-4 -bottom-4 w-24 h-24 bg-teal-500/10 rounded-full blur-2xl"></div>
        </div>
      </div>
    `;
  }

  function renderDataView() {
    const totalXP = state.stats.xp + (state.stats.level - 1) * 500;
    const avgROM = Math.round(state.history.reduce((a, b) => a + b.rom, 0) / state.history.length);
    const avgAdherence = Math.round(state.history.reduce((a, b) => a + b.adherence, 0) / state.history.length);

    return `
      <div class="flex-1 overflow-y-auto no-scrollbar p-5 space-y-6">
        <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6">復健進度報告</h3>
          
          <div class="grid grid-cols-2 gap-4 mb-8">
            <div class="p-4 bg-slate-50 rounded-2xl text-center">
              <div class="text-[10px] font-bold text-slate-400 uppercase mb-1">平均角度 (ROM)</div>
              <div class="text-2xl font-black text-teal-600">${avgROM}°</div>
            </div>
            <div class="p-4 bg-slate-50 rounded-2xl text-center">
              <div class="text-[10px] font-bold text-slate-400 uppercase mb-1">總累積經驗</div>
              <div class="text-2xl font-black text-purple-600">${totalXP}</div>
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <div class="flex justify-between text-[11px] font-bold mb-2">
                <span class="text-slate-500">平均依從率</span>
                <span class="text-teal-600">${avgAdherence}%</span>
              </div>
              <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div class="h-full bg-teal-500" style="width: ${avgAdherence}%"></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between text-[11px] font-bold mb-2">
                <span class="text-slate-500">動作穩定度評分</span>
                <span class="text-teal-600">82%</span>
              </div>
              <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div class="h-full bg-teal-500" style="width: 82%"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">訓練紀錄明細</h3>
          <div class="space-y-3">
            ${state.history.slice().reverse().map(h => `
              <div class="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors">
                <div>
                  <div class="text-sm font-bold text-slate-800">${h.date}</div>
                  <div class="text-[10px] text-slate-400">居家復健訓練</div>
                </div>
                <div class="text-right">
                  <div class="text-sm font-black text-teal-600">${h.rom}°</div>
                  <div class="text-[9px] text-slate-400">Max ROM</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function render() {
    const app = document.getElementById('patient-app');
    if (!app) return;

    const xpPct = Math.min((state.stats.xp / state.stats.nextLevelXp) * 100, 100);
    const isHome = state.currentView === 'home';

    let html = `
      <section class="h-full flex flex-col bg-slate-50">
        <header class="bg-white p-6 shadow-sm border-b border-slate-200">
          <div class="flex justify-between items-center mb-3">
            <div>
              <h2 class="text-xl font-black text-slate-800">${isHome ? '復健空間' : '數據中心'}</h2>
              <p class="text-xs text-teal-600 font-bold uppercase tracking-widest mt-0.5">Clinical Monitor Active</p>
            </div>
            <div class="flex items-center gap-3">
              <div class="text-right">
                <div class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Recovery Stage</div>
                <div class="text-sm font-black text-slate-800">LVL ${state.stats.level}</div>
              </div>
              <button onclick="healscapeAuth.logout()" class="text-slate-400 hover:text-red-500">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            </div>
          </div>
          <div class="space-y-1">
            <div class="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              <span>XP Progress</span>
              <span>${state.stats.xp} / ${state.stats.nextLevelXp}</span>
            </div>
            <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div class="h-full bg-teal-500 transition-all duration-500" style="width: ${xpPct}%"></div>
            </div>
          </div>
        </header>

        ${isHome ? renderHomeView() : renderDataView()}

        <!-- Navigation Bar (Fixed at bottom) -->
        <div class="bg-white border-t border-slate-200 p-4 flex justify-around">
          <button data-act="nav-home" class="${isHome ? 'text-teal-600' : 'text-slate-400'} flex flex-col items-center">
            <svg class="w-6 h-6" fill="${isHome ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>
            <span class="text-[10px] font-bold mt-1">主頁</span>
          </button>
          <button data-act="nav-data" class="${!isHome ? 'text-teal-600' : 'text-slate-400'} flex flex-col items-center">
            <svg class="w-6 h-6" fill="${!isHome ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            <span class="text-[10px] font-bold mt-1">數據</span>
          </button>
        </div>
      </section>
    `;
    app.innerHTML = html;
  }

  function renderTaskSelection() {
    return `
      <div class="space-y-3">
        <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">今日處方任務</h3>
        <div class="grid grid-cols-1 gap-3">
          <button data-act="start-arm" class="bg-white border border-slate-200 rounded-3xl p-5 text-left flex justify-between items-center group active:scale-95 transition-all">
            <div>
              <div class="font-black text-slate-800 text-lg group-hover:text-teal-600 transition-colors">肩關節屈曲訓練</div>
              <div class="text-xs text-slate-400 mt-1">目標：3 次 · 達 90°</div>
            </div>
            <div class="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-teal-600">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
            </div>
          </button>
          <button data-act="start-grip" class="bg-white border border-slate-200 rounded-3xl p-5 text-left flex justify-between items-center group active:scale-95 transition-all">
            <div>
              <div class="font-black text-slate-800 text-lg group-hover:text-purple-600 transition-colors">手指抓握訓練</div>
              <div class="text-xs text-slate-400 mt-1">目標：3 次 · 完整握拳</div>
            </div>
            <div class="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-purple-600">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
            </div>
          </button>
          <button data-act="start-reaction" class="bg-white border border-slate-200 rounded-3xl p-5 text-left flex justify-between items-center group active:scale-95 transition-all">
            <div>
              <div class="font-black text-slate-800 text-lg group-hover:text-amber-500 transition-colors">眼手協調反應</div>
              <div class="text-xs text-slate-400 mt-1">捕捉 5 個移動目標</div>
            </div>
            <div class="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-amber-500">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            </div>
          </button>
        </div>
      </div>
    `;
  }

  function renderDetectionInterface() {
    const isAction = state.taskStep === 'action';
    const reps = state.taskMode === 'arm' ? state.arm.reps : state.grip.reps;
    const repPct = Math.min((reps / state.targetReps) * 100, 100);

    return `
      <div class="space-y-4">
        <div class="bg-slate-900 rounded-[32px] aspect-[3/4] relative overflow-hidden shadow-2xl">
          <video id="cam" autoplay playsinline muted class="absolute inset-0 w-full h-full object-cover scale-x-[-1] ${state.ai.camera ? '' : 'hidden'}"></video>
          <canvas id="overlay" class="absolute inset-0 w-full h-full scale-x-[-1]"></canvas>
          
          <!-- Clinical Guidance Frame -->
          <div class="absolute inset-6 border border-white/20 rounded-2xl pointer-events-none">
            <div class="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-teal-400 rounded-tl-lg"></div>
            <div class="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-teal-400 rounded-tr-lg"></div>
            <div class="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-teal-400 rounded-bl-lg"></div>
            <div class="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-teal-400 rounded-br-lg"></div>
          </div>

          <!-- Medical Monitor Overlay -->
          <div class="absolute top-10 left-6 right-6 flex justify-between items-start z-10">
            <div class="glass-panel p-3 px-4 text-slate-800 border-l-4 border-teal-500">
              <div class="text-[10px] font-bold text-teal-600 uppercase tracking-tighter">AI Vital Status</div>
              <div class="text-xl font-black tabular-nums">${state.taskMode === 'arm' ? state.arm.angle + '°' : state.grip.score + '%'}</div>
              <div class="text-[9px] text-slate-500 font-bold">${state.taskMode === 'arm' ? 'Shoulder Angle' : 'Grip Pressure'}</div>
            </div>
            <div class="glass-panel p-3 px-4 text-slate-800 text-right">
              <div class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Completed</div>
              <div class="text-xl font-black tabular-nums">${reps}<span class="text-xs text-slate-400 ml-1">/${state.targetReps}</span></div>
            </div>
          </div>

          <!-- Progress Bar -->
          <div class="absolute bottom-24 left-10 right-10">
            <div class="h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div class="h-full bg-teal-400 transition-all duration-300" style="width: ${repPct}%"></div>
            </div>
          </div>

          <!-- Controls -->
          <div class="absolute bottom-8 left-6 right-6 flex gap-3">
            ${state.taskStep === 'scanning' ? `
              <button data-act="go-action" class="flex-1 bg-teal-500 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all">開始偵測</button>
            ` : `
              <button data-act="complete-task" class="flex-1 bg-teal-500 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all">完成</button>
            `}
            <button data-act="cancel-task" class="px-6 bg-slate-800/80 text-white font-bold py-4 rounded-2xl backdrop-blur-md">取消</button>
          </div>

          ${state.ai.loading ? `
            <div class="absolute inset-0 bg-slate-900/80 backdrop-blur-sm grid place-items-center text-white z-50">
              <div class="text-center">
                <div class="inline-block w-8 h-8 border-4 border-teal-400 border-t-transparent rounded-full animate-spin mb-4"></div>
                <div class="text-lg font-black">AI ENGINE BOOTING...</div>
                <div class="text-[10px] text-teal-400 tracking-widest mt-1">INITIALIZING MODELS</div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  function attachEvents() {
    document.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-act]');
      if (!t) return;
      const act = t.dataset.act;

      if (act === 'start-arm' || act === 'start-grip' || act === 'start-reaction') {
        state.taskMode = act.replace('start-', '');
        state.taskStep = state.taskMode === 'reaction' ? 'action' : 'scanning';
        
        if (state.taskMode === 'reaction') {
          state.reactionTask = { active: false, startTime: 0, targetPos: { x: 50, y: 50 }, hits: 0, targetHits: 5, times: [] };
        } else {
          state.arm = { angle: 0, reps: 0, status: 'down', max: 0 };
          state.grip = { score: 0, reps: 0, status: 'open', max: 0 };
        }
        render();
      }

      if (act === 'start-reaction-go') {
        state.reactionTask.active = true;
        generateReactionTarget();
        render();
      }

      if (act === 'hit-target') {
        const r = state.reactionTask;
        const reactionTime = Date.now() - r.startTime;
        r.times.push(reactionTime);
        r.hits++;
        
        if (r.hits >= r.targetHits) {
          const avgTime = Math.round(r.times.reduce((a,b)=>a+b, 0) / r.hits);
          const xp = Math.max(100, 500 - Math.floor(avgTime / 2));
          gainXp(xp);
          toast(`反應訓練完成！平均速度：${avgTime}ms`, 'success');
          state.taskStep = 'idle';
        } else {
          generateReactionTarget();
        }
        render();
      }

      if (act === 'go-action') {
        state.taskStep = 'action';
        render();
        await initAiEngine();
        startDetection();
      }

      if (act === 'cancel-task') {
        stopDetection();
        state.taskStep = 'idle';
        render();
      }

      if (act === 'complete-task') {
        // Calculate XP gain
        const reps = state.taskMode === 'arm' ? state.arm.reps : state.grip.reps;
        const baseXP = reps * 50;
        const bonusXP = (state.arm.max || state.grip.max) > 80 ? 100 : 0;
        const totalXP = baseXP + bonusXP;

        await healscapeApi.uploadSession({
          patientId: state.patientId,
          task: state.taskMode,
          angle: state.arm.max || state.grip.max,
          reps: reps,
          adherence: 100
        });

        stopDetection();
        state.taskStep = 'idle';
        
        gainXp(totalXP);
        toast(`任務完成！獲得 ${totalXP} 經驗值`);
      }

      if (act === 'math-ans') {
        const val = parseInt(t.dataset.val);
        if (val === state.mathQuiz.answer) {
          state.mathQuiz.solved = true;
          state.mathQuiz.streak++;
          const bonus = state.mathQuiz.streak * 20;
          gainXp(100 + bonus);
          toast(`答對了！連續 ${state.mathQuiz.streak} 題成功`, 'success');
        } else {
          state.mathQuiz.streak = 0;
          toast('答錯了，連擊中斷', 'error');
          generateMathQuiz();
          render();
        }
      }

      if (act === 'new-math') {
        generateMathQuiz();
        render();
      }

      if (act === 'nav-home') {
        state.currentView = 'home';
        render();
      }

      if (act === 'nav-data') {
        state.currentView = 'data';
        render();
      }
    });
  }

  function gainXp(amount) {
    state.stats.xp += amount;
    
    // Level up logic
    while (state.stats.xp >= state.stats.nextLevelXp) {
      state.stats.xp -= state.stats.nextLevelXp;
      state.stats.level++;
      state.stats.nextLevelXp = state.stats.level * 500;
      toast(`恭喜升級！目前等級：LVL ${state.stats.level}`, 'success');
    }
    
    // Persist
    sessionStorage.setItem('patientXP', state.stats.xp);
    sessionStorage.setItem('patientLevel', state.stats.level);
    
    render();
  }

  async function initAiEngine() {
    state.ai.loading = true;
    render();
    try {
      if (state.taskMode === 'arm') {
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs');
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection');
        detector = await window.poseDetection.createDetector(
          window.poseDetection.SupportedModels.MoveNet,
          { modelType: window.poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
        );
      } else {
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js');
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');
        detector = new window.Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
        detector.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.55, minTrackingConfidence: 0.55 });
      }
      state.ai.engineReady = true;
    } catch (e) {
      console.error(e);
      toast('AI 引擎載入失敗', 'error');
    } finally {
      state.ai.loading = false;
      render();
    }
  }

  async function startDetection() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      const video = document.getElementById('cam');
      video.srcObject = stream;
      await video.play();
      state.ai.camera = true;
      render();

      const canvas = document.getElementById('overlay');
      const ctx = canvas.getContext('2d');

      const loop = async () => {
        if (!state.ai.camera) return;
        if (video.videoWidth > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        if (state.taskMode === 'arm') {
          const poses = await detector.estimatePoses(video);
          if (poses && poses[0]) {
            drawPose(ctx, poses[0]);
            updateArmLogic(poses[0]);
          }
        } else {
          await detector.send({ image: video });
          // MediaPipe hands uses callback (onResults)
        }
        rafId = requestAnimationFrame(loop);
      };

      if (state.taskMode === 'grip') {
        detector.onResults((results) => {
          if (results.multiHandLandmarks && results.multiHandLandmarks[0]) {
            drawHand(ctx, results.multiHandLandmarks[0]);
            updateGripLogic(results.multiHandLandmarks[0]);
          }
        });
      }

      loop();
    } catch (e) {
      console.error(e);
      toast('無法存取相機', 'error');
    }
  }

  function stopDetection() {
    if (rafId) cancelAnimationFrame(rafId);
    if (stream) stream.getTracks().forEach(t => t.stop());
    state.ai.camera = false;
    state.ai.engineReady = false;
  }

  function drawPose(ctx, pose) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.strokeStyle = '#2DD4BF';
    ctx.lineWidth = 4;
    // Simple drawing
    pose.keypoints.forEach(kp => {
      if (kp.score > 0.3) {
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.stroke();
      }
    });
  }

  function drawHand(ctx, lm) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (window.drawConnectors && window.HAND_CONNECTIONS) {
      window.drawConnectors(ctx, lm, window.HAND_CONNECTIONS, { color: '#2DD4BF', lineWidth: 4 });
      window.drawLandmarks(ctx, lm, { color: 'white', radius: 2 });
    }
  }

  function updateArmLogic(pose) {
    const kp = pose.keypoints.reduce((acc, curr) => ({ ...acc, [curr.name]: curr }), {});
    const s = kp.right_shoulder, e = kp.right_elbow;
    if (s && e && s.score > 0.3 && e.score > 0.3) {
      const dx = e.x - s.x, dy = e.y - s.y;
      const angle = Math.round(Math.acos(dy / Math.hypot(dx, dy)) * 180 / Math.PI);
      state.arm.angle = angle;
      state.arm.max = Math.max(state.arm.max, angle);
      if (angle >= 90 && state.arm.status === 'down') state.arm.status = 'up';
      if (angle <= 40 && state.arm.status === 'up') {
        state.arm.status = 'down';
        state.arm.reps++;
        render();
      }
    }
  }

  function updateGripLogic(lm) {
    // Simplified grip logic
    const wrist = lm[0], tip = lm[8];
    const dist = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
    const score = Math.round(Math.max(0, Math.min(100, (1 - dist / 0.5) * 100)));
    state.grip.score = score;
    state.grip.max = Math.max(state.grip.max, score);
    if (score > 70 && state.grip.status === 'open') state.grip.status = 'closed';
    if (score < 30 && state.grip.status === 'closed') {
      state.grip.status = 'open';
      state.grip.reps++;
      render();
    }
  }

  function loadScript(src) {
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      document.head.appendChild(s);
    });
  }

  function toast(msg, type = 'success') {
    const wrap = document.getElementById('toastWrap');
    const t = document.createElement('div');
    t.className = `toast ${type === 'error' ? 'error' : ''}`;
    t.innerHTML = `<span class="font-bold">${msg}</span>`;
    wrap.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  init();
})();
