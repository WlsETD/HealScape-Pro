(function patientApp() {
  const state = {
    patientId: sessionStorage.getItem('userId') || 'patient01',
    taskStep: 'idle', // idle/action/result
    taskMode: 'arm',  
    targetReps: 3,
    arm: { angle: 0, reps: 0, status: 'down', max: 0 },
    grip: { score: 0, reps: 0, status: 'open', max: 0 },
    reaction: { targets: [], score: 0, startTime: 0, totalTime: 0 },
    lastSession: { xp: 0, rom: 0, reps: 0 },
    ai: { loading: false, camera: false },
    currentView: 'home',
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
      streak: parseInt(sessionStorage.getItem('mathStreak')) || 0 
    }
  };

  let detector = null, stream = null, rafId = null;

  async function init() {
    healscapeAuth.checkAuth('patient');
    try {
      const data = await healscapeApi.getPatientData(state.patientId);
      state.history = data.history || [];
    } catch(e) { console.error("Data load failed", e); }
    state.stats.nextLevelXp = state.stats.level * 500;
    generateMathQuiz();
    render();
  }

  function generateMathQuiz() {
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    const op = Math.random() > 0.5 ? '+' : '-';
    const answer = op === '+' ? a + b : a - b;
    const question = `${a} ${op} ${b} = ?`;
    let options = [answer];
    while (options.length < 3) {
      const wrong = answer + (Math.floor(Math.random() * 5) - 2);
      if (!options.includes(wrong)) options.push(wrong);
    }
    state.mathQuiz = { ...state.mathQuiz, question, answer, options: options.sort(() => Math.random() - 0.5) };
  }

  function gainXp(amount) {
    state.stats.xp += amount;
    while (state.stats.xp >= state.stats.nextLevelXp) {
      state.stats.xp -= state.stats.nextLevelXp;
      state.stats.level++;
      state.stats.nextLevelXp = state.stats.level * 500;
      toast(`恭喜升級！目前等級：LVL ${state.stats.level}`);
    }
    sessionStorage.setItem('patientXP', state.stats.xp);
    sessionStorage.setItem('patientLevel', state.stats.level);
    render();
  }

  function render() {
    const app = document.getElementById('patient-app');
    if (!app) return;
    const isHome = state.currentView === 'home';
    const xpPct = Math.min((state.stats.xp / state.stats.nextLevelXp) * 100, 100);

    app.style.height = "100%";

    app.innerHTML = `
      <section class="h-full flex flex-col bg-slate-50 overflow-hidden">
        <!-- Header Section -->
        <header class="bg-white p-7 pb-5 shrink-0">
          <div class="flex justify-between items-start mb-4">
            <div>
              <h2 class="text-3xl font-black text-slate-800 leading-none">復健空間</h2>
              <p class="text-[11px] text-teal-600 font-black uppercase tracking-[0.1em] mt-2">CLINICAL MONITOR ACTIVE</p>
            </div>
            <div class="flex items-center gap-3">
              <div class="text-right">
                <div class="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">RECOVERY STAGE</div>
                <div class="text-xl font-black text-slate-800 leading-none">LVL ${state.stats.level}</div>
              </div>
              <button onclick="healscapeAuth.logout()" class="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            </div>
          </div>
          <div class="space-y-1.5">
            <div class="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              <span>XP PROGRESS</span>
              <span>${state.stats.xp} / ${state.stats.nextLevelXp}</span>
            </div>
            <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div class="h-full bg-teal-500 transition-all duration-700 ease-out" style="width: ${xpPct}%"></div>
            </div>
          </div>
        </header>

        <!-- Main Content (Scrollable) -->
        <main class="flex-1 overflow-y-auto no-scrollbar p-5 pt-2">
          ${isHome ? (
            state.taskStep === 'idle' ? renderHome() : 
            state.taskStep === 'action' ? renderTaskInterface() : renderResultView()
          ) : renderDataView()}
        </main>

        <!-- Bottom Navigation -->
        <nav class="bg-white border-t p-4 pb-10 flex justify-around shrink-0 shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
          <button data-act="nav-home" class="${isHome ? 'text-teal-600' : 'text-slate-300'} flex flex-col items-center gap-1.5 transition-colors">
            <svg class="w-7 h-7" fill="${isHome ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            <span class="text-[10px] font-bold">主頁</span>
          </button>
          <button data-act="nav-data" class="${!isHome ? 'text-teal-600' : 'text-slate-300'} flex flex-col items-center gap-1.5 transition-colors">
            <svg class="w-7 h-7" fill="${!isHome ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            <span class="text-[10px] font-bold">數據</span>
          </button>
        </nav>
      </section>
    `;

    if (state.taskStep === 'action' && stream) {
      const video = document.getElementById('cam');
      if (video) video.srcObject = stream;
    }
  }

  function renderHome() {
    return `
      <!-- Math Quiz Card -->
      <div class="bg-gradient-to-br from-teal-500 to-teal-600 p-6 rounded-[40px] text-white shadow-xl mb-6 relative overflow-hidden">
        <div class="absolute inset-0 opacity-10 pointer-events-none">
          <svg class="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0,50 Q25,30 50,50 T100,50" fill="none" stroke="white" stroke-width="0.5" />
          </svg>
        </div>
        
        <div class="relative z-10">
          <div class="flex justify-between items-start mb-6">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
              </div>
              <div>
                <h4 class="text-[9px] font-black uppercase tracking-widest text-teal-100">認知激發訓練</h4>
                <p class="text-3xl font-black">${state.mathQuiz.question}</p>
              </div>
            </div>
            <div class="bg-black/20 backdrop-blur-md rounded-2xl px-4 py-3 text-right">
              <div class="text-[9px] font-bold text-teal-100 uppercase leading-none mb-1">REWARDS</div>
              <div class="text-sm font-black text-yellow-300 leading-none">+100 XP</div>
            </div>
          </div>
          
          <div class="grid grid-cols-3 gap-3 mb-6">
            ${state.mathQuiz.options.map(o => `
              <button data-act="math-ans" data-val="${o}" class="bg-white/20 hover:bg-white/40 h-20 rounded-3xl font-black text-2xl backdrop-blur-md transition-all active:scale-90 flex items-center justify-center">
                ${o}
              </button>
            `).join('')}
          </div>
          
          <div class="flex justify-between items-center px-2">
            <div class="flex gap-2">
              ${[1, 2, 3, 4, 5].map(i => `<div class="w-2 h-2 rounded-full ${i <= (state.mathQuiz.streak % 5 || (state.mathQuiz.streak > 0 ? 5 : 0)) ? 'bg-teal-200' : 'bg-white/20'}"></div>`).join('')}
            </div>
            <div class="text-[10px] font-black uppercase tracking-tighter">STREAK: ${state.mathQuiz.streak}</div>
          </div>
        </div>
      </div>

      <!-- ROM Chart Placeholder -->
      <div class="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 mb-6">
        <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">生理指標趨勢 (ROM)</h3>
        <div class="h-32 flex items-end justify-between gap-3 px-2">
          ${[20, 22, 24, 26].map(day => `
            <div class="flex-1 flex flex-col items-center gap-3">
              <div class="w-full bg-slate-50 rounded-t-xl h-4"></div>
              <div class="text-[10px] font-bold text-slate-300">${day}日</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Task List -->
      <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 px-1">今日處方任務</h3>
      <div class="space-y-4 mb-6">
        <button data-act="start-arm" class="w-full bg-white p-6 rounded-[32px] border border-slate-100 flex justify-between items-center group active:scale-95 transition-all shadow-sm">
          <div class="text-left">
            <div class="font-black text-slate-800 text-lg">肩關節屈曲訓練</div>
            <div class="text-xs text-slate-400 mt-0.5">目標：3 次 · 達 90°</div>
          </div>
          <div class="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-teal-600 border border-slate-100">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
          </div>
        </button>
        
        <button data-act="start-grip" class="w-full bg-white p-6 rounded-[32px] border border-slate-100 flex justify-between items-center group active:scale-95 transition-all shadow-sm">
          <div class="text-left">
            <div class="font-black text-slate-800 text-lg">手指抓握訓練</div>
            <div class="text-xs text-slate-400 mt-0.5">目標：3 次 · 完整握拳</div>
          </div>
          <div class="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-purple-600 border border-slate-100">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
          </div>
        </button>

        <button data-act="start-reaction" class="w-full bg-white p-6 rounded-[32px] border border-slate-100 flex justify-between items-center group active:scale-95 transition-all shadow-sm">
          <div class="text-left">
            <div class="font-black text-slate-800 text-lg">眼手協調反應</div>
            <div class="text-xs text-slate-400 mt-0.5">目標：捕捉 10 個移動目標</div>
          </div>
          <div class="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-amber-500 border border-slate-100">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          </div>
        </button>
      </div>

      <!-- Last Session Performance Card -->
      <div class="bg-slate-800 p-8 rounded-[40px] text-white mb-8 relative overflow-hidden">
        <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">上回訓練表現</h3>
        <div class="flex items-baseline gap-2 mb-2">
          <span class="text-5xl font-black text-teal-400">85%</span>
          <span class="text-sm font-bold text-slate-300">依從率</span>
        </div>
        <p class="text-[11px] text-slate-400 italic">"動作穩定度優於 70% 同年齡患者"</p>
        <div class="absolute -right-4 -bottom-4 w-32 h-32 bg-teal-500/10 rounded-full blur-3xl"></div>
      </div>
    `;
  }

  function renderTaskInterface() {
    const isReaction = state.taskMode === 'reaction';
    return `
      <div class="rounded-[40px] aspect-[3/4] relative overflow-hidden shadow-2xl ${isReaction ? 'bg-slate-900' : 'bg-black'} border-4 border-slate-200" id="game-container">
        ${isReaction ? `
          <div id="reaction-area" class="absolute inset-0">
            ${state.reaction.targets.map(t => `
              <div data-act="hit-target" data-id="${t.id}" class="absolute w-20 h-20 bg-amber-500 rounded-full border-4 border-white shadow-[0_0_20px_rgba(245,158,11,0.6)] animate-pulse active:scale-75 transition-transform" 
                   style="left: ${t.x * 80 + 10}%; top: ${t.y * 80 + 10}%;"></div>
            `).join('')}
          </div>
        ` : `
          <video id="cam" autoplay playsinline muted style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transform:scaleX(-1); z-index:1;"></video>
          <canvas id="overlay" style="position:absolute; inset:0; width:100%; height:100%; transform:scaleX(-1); z-index:2; pointer-events:none;"></canvas>
        `}
        <div class="absolute top-6 left-6 right-6 flex justify-between z-10 pointer-events-none">
          <div class="bg-white/90 backdrop-blur-md p-4 rounded-3xl shadow-xl min-w-[110px]">
            <div class="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Live Monitor</div>
            <div id="stat-val" class="text-2xl font-black text-slate-800">0</div>
          </div>
          <div class="bg-white/90 backdrop-blur-md p-4 rounded-3xl shadow-xl text-right min-w-[110px]">
            <div class="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Completed</div>
            <div id="stat-reps" class="text-2xl font-black text-slate-800">0/${state.targetReps}</div>
          </div>
        </div>
        <div class="absolute bottom-8 left-6 right-6 flex gap-3 z-10">
          <button data-act="cancel-task" class="flex-1 bg-white/20 backdrop-blur-md text-white font-bold py-4 rounded-2xl border border-white/30">取消</button>
          <button data-act="complete-task" class="flex-1 bg-teal-500 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all">完成</button>
        </div>
        ${state.ai.loading ? `<div class="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center z-50 text-white"><div class="w-10 h-10 border-4 border-teal-400 border-t-transparent rounded-full animate-spin mb-4"></div><div class="text-xs font-bold tracking-widest uppercase">Initializing AI...</div></div>` : ''}
      </div>
    `;
  }

  function renderResultView() {
    const s = state.lastSession;
    return `
      <div class="h-full flex flex-col items-center justify-center text-center p-4">
        <div class="w-24 h-24 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg shadow-yellow-200 mb-6 ring-8 ring-yellow-400/20">
          <svg class="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
        </div>
        <h3 class="text-3xl font-black text-slate-800 mb-2">任務完成！</h3>
        <p class="text-slate-400 font-bold mb-8 uppercase tracking-widest">訓練表現優異</p>
        <div class="bg-white w-full rounded-[40px] p-8 shadow-sm border border-slate-100 mb-8 space-y-6">
          <div>
            <div class="text-[10px] font-black text-teal-600 uppercase tracking-widest mb-1">獲得經驗值</div>
            <div class="text-5xl font-black text-slate-800">+${s.xp} <span class="text-sm text-teal-500 font-bold">XP</span></div>
          </div>
          <div class="h-px bg-slate-50"></div>
          <div class="grid grid-cols-2 gap-4 text-center">
            <div>
              <div class="text-[10px] font-bold text-slate-400 uppercase">${state.taskMode === 'reaction' ? '反應時間' : '最佳表現'}</div>
              <div class="text-xl font-black text-slate-800">${s.rom}${state.taskMode === 'arm' ? '°' : (state.taskMode === 'grip' ? '%' : ' 秒')}</div>
            </div>
            <div>
              <div class="text-[10px] font-bold text-slate-400 uppercase">完成次數</div>
              <div class="text-xl font-black text-slate-800">${s.reps} 次</div>
            </div>
          </div>
        </div>
        <button data-act="finish-result" class="w-full bg-slate-900 text-white font-black py-5 rounded-3xl shadow-xl active:scale-95 transition-all">返回首頁</button>
      </div>
    `;
  }

  function renderDataView() {
    const avgROM = state.history.length ? Math.round(state.history.reduce((a, b) => a + b.rom, 0) / state.history.length) : 0;
    return `
      <div class="space-y-6">
        <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6">復健進度概覽</h3>
          <div class="grid grid-cols-2 gap-4 text-center">
            <div class="p-4 bg-slate-50 rounded-2xl">
              <div class="text-[10px] font-bold text-slate-400 uppercase mb-1">平均角度 (ROM)</div>
              <div class="text-2xl font-black text-teal-600">${avgROM}°</div>
            </div>
            <div class="p-4 bg-slate-50 rounded-2xl">
              <div class="text-[10px] font-bold text-slate-400 uppercase mb-1">總訓練次數</div>
              <div class="text-2xl font-black text-purple-600">${state.history.length}</div>
            </div>
          </div>
        </div>
        <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">訓練歷史紀錄</h3>
          <div class="space-y-3">
            ${state.history.slice().reverse().map(h => `
              <div class="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors">
                <div>
                  <div class="text-sm font-bold text-slate-800">${h.date}</div>
                  <div class="text-[10px] text-slate-400 uppercase">${h.task}</div>
                </div>
                <div class="text-right">
                  <div class="text-sm font-black text-teal-600">${h.rom}°</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function updateStats() {
    const valEl = document.getElementById('stat-val');
    const repsEl = document.getElementById('stat-reps');
    if (state.taskMode === 'arm') {
      if (valEl) valEl.innerText = state.arm.angle + '°';
      if (repsEl) repsEl.innerText = `${state.arm.reps}/${state.targetReps}`;
    } else if (state.taskMode === 'grip') {
      if (valEl) valEl.innerText = state.grip.score + '%';
      if (repsEl) repsEl.innerText = `${state.grip.reps}/${state.targetReps}`;
    } else if (state.taskMode === 'reaction') {
      if (valEl) valEl.innerText = '計時中...';
      if (repsEl) repsEl.innerText = `${state.reaction.score}/10`;
    }
  }

  async function startEngine() {
    try {
      state.ai.loading = true; render();
      if (state.taskMode === 'arm') {
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs');
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection');
        detector = await window.poseDetection.createDetector(window.poseDetection.SupportedModels.MoveNet);
      } else {
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');
        detector = new window.Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
        detector.setOptions({ maxNumHands: 1, modelComplexity: 1 });
        detector.onResults(onHandResults);
      }
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      const video = document.getElementById('cam');
      if (video) { video.srcObject = stream; await new Promise(r => video.onloadedmetadata = r); await video.play(); }
      state.ai.loading = false; state.ai.camera = true; render(); runDetectionLoop();
    } catch (e) { console.error(e); toast("相機開啟失敗"); state.taskStep = 'idle'; render(); }
  }

  function runDetectionLoop() {
    const video = document.getElementById('cam');
    const canvas = document.getElementById('overlay');
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');
    const loop = async () => {
      if (!state.ai.camera) return;
      if (video.readyState >= 2) {
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        if (state.taskMode === 'arm') {
          const poses = await detector.estimatePoses(video);
          if (poses[0]) { drawPose(ctx, poses[0].keypoints); processArmLogic(poses[0].keypoints); }
        } else { await detector.send({ image: video }); }
      }
      rafId = requestAnimationFrame(loop);
    };
    loop();
  }

  function onHandResults(res) {
    const canvas = document.getElementById('overlay');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (res.multiHandLandmarks && res.multiHandLandmarks[0]) {
      const lm = res.multiHandLandmarks[0];
      ctx.fillStyle = '#A855F7';
      lm.forEach(p => { ctx.beginPath(); ctx.arc(p.x * canvas.width, p.y * canvas.height, 4, 0, 7); ctx.fill(); });
      processGripLogic(lm);
    }
  }

  function spawnTarget() {
    state.reaction.targets = [{ x: Math.random() * 0.8, y: Math.random() * 0.8, id: Date.now() }];
  }

  function drawPose(ctx, pts) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = '#2DD4BF';
    pts.forEach(p => { if (p.score > 0.45) { ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, 7); ctx.fill(); } });
  }

  function processArmLogic(pts) {
    const kp = pts.reduce((a, c) => ({ ...a, [c.name]: c }), {});
    if (kp.right_shoulder && kp.right_elbow && kp.right_shoulder.score > 0.4) {
      const angle = Math.round(Math.acos((kp.right_elbow.y - kp.right_shoulder.y) / Math.hypot(kp.right_elbow.x - kp.right_shoulder.x, kp.right_elbow.y - kp.right_shoulder.y)) * 57.3);
      state.arm.angle = angle; state.arm.max = Math.max(state.arm.max, angle);
      if (angle > 90 && state.arm.status === 'down') state.arm.status = 'up';
      if (angle < 40 && state.arm.status === 'up') { state.arm.status = 'down'; state.arm.reps++; toast("完成一次舉臂！"); }
      updateStats();
    }
  }

  function processGripLogic(lm) {
    const score = Math.round((1 - Math.hypot(lm[8].x - lm[0].x, lm[8].y - lm[0].y) / 0.45) * 100);
    state.grip.score = score; state.grip.max = Math.max(state.grip.max, score);
    if (score > 75 && state.grip.status === 'open') state.grip.status = 'closed';
    if (score < 30 && state.grip.status === 'closed') { state.grip.status = 'open'; state.grip.reps++; toast("完成一次抓握！"); }
    updateStats();
  }

  function attachEvents() {
    document.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-act]');
      if (!t) return;
      const act = t.dataset.act;

      if (act.startsWith('start-')) {
        state.taskMode = act.replace('start-', '');
        state.taskStep = 'action';
        state.arm = { angle: 0, reps: 0, status: 'down', max: 0 };
        state.grip = { score: 0, reps: 0, status: 'open', max: 0 };
        state.reaction = { targets: [], score: 0, startTime: Date.now(), totalTime: 0 };
        
        if (state.taskMode === 'reaction') {
          spawnTarget();
          render();
        } else {
          render(); await startEngine();
        }
      } else if (act === 'hit-target') {
        state.reaction.score++;
        state.reaction.targets = [];
        if (state.reaction.score >= 10) {
          state.reaction.totalTime = ((Date.now() - state.reaction.startTime) / 1000).toFixed(2);
          const completeBtn = document.querySelector('[data-act="complete-task"]');
          if (completeBtn) completeBtn.click();
        } else {
          spawnTarget();
          render();
        }
      } else if (act === 'complete-task') {
        let reps, maxVal;
        if (state.taskMode === 'arm') { reps = state.arm.reps; maxVal = state.arm.max; }
        else if (state.taskMode === 'grip') { reps = state.grip.reps; maxVal = state.grip.max; }
        else { reps = state.reaction.score; maxVal = state.reaction.totalTime; }

        const earnedXp = reps * 100;
        await healscapeApi.uploadSession({ patientId: state.patientId, task: state.taskMode, rom: maxVal, reps: reps, date: new Date().toISOString().split('T')[0] });
        stopEngine(); state.lastSession = { xp: earnedXp, rom: maxVal, reps: reps }; state.taskStep = 'result'; render();
      } else if (act === 'finish-result') { 
        gainXp(state.lastSession.xp); 
        state.taskStep = 'idle'; 
        // Just refresh instead of init
        state.stats.nextLevelXp = state.stats.level * 500;
        generateMathQuiz();
        render();
      }

      else if (act === 'cancel-task') { stopEngine(); state.taskStep = 'idle'; render(); }
      else if (act.startsWith('nav-')) { state.currentView = act.replace('nav-', ''); render(); }
      else if (act === 'math-ans') {
        const isCorrect = parseInt(t.dataset.val) === state.mathQuiz.answer;
        // Disable math buttons to prevent rapid multiple clicks
        const btns = document.querySelectorAll('[data-act="math-ans"]');
        btns.forEach(b => b.removeAttribute('data-act'));
        
        if (isCorrect) {
          state.mathQuiz.streak++;
          sessionStorage.setItem('mathStreak', state.mathQuiz.streak);
          gainXp(100); toast("答對了！+100 XP");
        } else {
          state.mathQuiz.streak = 0;
          sessionStorage.setItem('mathStreak', 0);
          toast("答錯了，連擊中斷");
        }
        setTimeout(() => { generateMathQuiz(); render(); }, 300);
      }
    });
  }

  function stopEngine() {
    state.ai.camera = false; if (rafId) cancelAnimationFrame(rafId);
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null;
  }

  function loadScript(src) {
    return new Promise(r => { if (document.querySelector(`script[src="${src}"]`)) return r(); const s = document.createElement('script'); s.src = src; s.onload = r; document.head.appendChild(s); });
  }

  function toast(msg) {
    const w = document.getElementById('toastWrap'); if (!w) return;
    const t = document.createElement('div'); t.className = 'toast'; t.innerText = msg;
    w.appendChild(t); setTimeout(() => t.remove(), 2000);
  }

  init();
  attachEvents();
})();
