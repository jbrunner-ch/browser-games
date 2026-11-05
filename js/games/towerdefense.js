/**
 * Cyber Siege - Tower Defense
 * - Einheitliches Glassmorphism-UI (HUD, Overlays, Toasts) per JS ins DOM injiziert
 * - Prozedurale, validierte Level (seeded RNG, orthogonale Pfade ohne Selbstüberschneidung)
 * - Mathematisch nachvollziehbare Skalierung (siehe TowerDefenseGame.difficulty)
 * - Autoplay-Bot + Sanity-Checks + Performance-Log (Taste 'T' oder window.RUN_TESTS = true)
 */
window.TowerDefenseGame = class {
    constructor() {
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        this.animId = null;
        this.isPaused = false;
        this.headless = false;
        this.W = 800;
        this.H = 600;

        this.CELL = 40;
        this.TOP = 64;
        this.BOTTOM = 84;
        this.PATH_CLEAR = 32;
        this.BASE_SPEED = 75;
        this.MAX_TOWER_LEVEL = 5;

        this.state = 'menu'; // menu | playing | paused | levelcomplete | gameover
        this.score = 0;
        this.levelStartScore = 0;
        this.highScore = this.loadHighScore();
        this.credits = 0;
        this.lives = 20;
        this.maxLives = 20;
        this.wave = 1;
        this.maxWaves = 8;
        this.currentLevel = 1;
        this.difficultyName = 'Einfach';

        this.layout = null;
        this.waypoints = [];
        this.flyPath = [];
        this.rocks = [];
        this.pathLength = 0;
        this.spotCache = null;
        this.turrets = [];
        this.enemies = [];
        this.projectiles = [];
        this.particles = [];
        this.beams = [];
        this.selectedTowerType = 'blaster';
        this.waveInProgress = false;
        this.waveSpawnTimer = 0;
        this.enemiesToSpawn = [];
        this.mouse = null;

        this.combo = 0;
        this.comboTimer = 0;
        this.shake = 0;
        this.time = 0;
        this.stats = this.newStats();

        this.bot = false;
        this.botTimer = 0;
        this.botDelay = 0;
        this.perf = { frames: [], render: [], update: [] };
        this.ui = null;

        this.towerTypes = {
            blaster: { name: 'Gatling', cost: 100, range: 110, rate: 0.18, damage: 20, color: '#3b82f6' },
            plasma: { name: 'Plasma', cost: 180, range: 130, rate: 0.65, damage: 50, splash: 50, color: '#f59e0b' },
            cryo: { name: 'Cryo', cost: 140, range: 100, rate: 0.45, damage: 14, slow: 0.5, color: '#06b6d4' },
            tesla: { name: 'Tesla', cost: 240, range: 125, rate: 0.75, damage: 70, chain: 3, color: '#a855f7' }
        };

        // minLevel = ab diesem Level taucht der Gegnertyp auf
        this.enemyTypes = {
            grunt: { name: 'Grunt', minLevel: 1, hp: 1, speed: 1.0, radius: 10, color: '#ef4444', reward: 1, points: 10 },
            runner: { name: 'Runner', minLevel: 3, hp: 0.6, speed: 1.6, radius: 8, color: '#f97316', reward: 1.1, points: 15 },
            tank: { name: 'Tank', minLevel: 5, hp: 2.6, speed: 0.7, radius: 14, color: '#84cc16', reward: 1.8, points: 30 },
            flyer: { name: 'Flyer', minLevel: 8, hp: 0.8, speed: 1.2, radius: 9, color: '#e879f9', reward: 1.4, points: 20, flying: true },
            boss: { name: 'Boss', minLevel: 1, hp: 1, speed: 0.65, radius: 18, color: '#ec4899', reward: 100, points: 150 }
        };

        this._onKey = (e) => this.handleKey(e);
        this._onResize = () => this.resize();
    }

    newStats() {
        return { kills: {}, waveBonus: 0, levelBonus: 0, leaks: 0, shots: 0, placed: 0 };
    }

    /* ------------------------------------------------------------------ */
    /* Schwierigkeit: alle Werte sind einfache, nachvollziehbare Formeln    */
    /* ------------------------------------------------------------------ */
    difficulty(level) {
        const n = Math.max(0, level - 1);
        return {
            speedMul: Math.min(2.5, 1 + 0.10 * n),          // +10% Tempo pro Level (max. 2.5x)
            hpMul: 1 + 0.12 * n,                            // +12% Lebenspunkte pro Level
            countMul: Math.min(2.5, 1 + 0.05 * n),          // +5% Gegner pro Level
            rewardMul: 1 + 0.05 * n,                        // Belohnung wächst langsamer als HP
            rockDensity: Math.min(0.12, 0.02 + 0.004 * n),  // Hindernisdichte
            segments: Math.min(7, 3 + Math.floor(n / 4)),   // Pfadkomplexität
            maxWaves: 6 + Math.min(10, Math.floor(n / 3)),
            startCredits: 350 + 25 * level
        };
    }

    loadHighScore() {
        try {
            return parseInt(window.localStorage && window.localStorage.getItem('cybersiege_highscore'), 10) || 0;
        } catch (e) {
            return 0;
        }
    }

    saveHighScore() {
        try {
            if (window.localStorage) window.localStorage.setItem('cybersiege_highscore', String(this.highScore));
        } catch (e) { /* Speicher nicht verfügbar */ }
    }

    /* ------------------------------------------------------------------ */
    /* Initialisierung & UI                                                */
    /* ------------------------------------------------------------------ */
    init(container, options = {}) {
        this.container = container;
        this.container.innerHTML = '';
        if (this.container.style) this.container.style.position = 'relative';

        this.canvas = document.createElement('canvas');
        this.canvas.className = 'game-canvas';
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);

        this.buildUI();
        this.bindEvents();
        this.resize();

        this.difficultyName = options.difficulty || 'Einfach';
        this.loadLevel(options.levelIndex || 1);
        this.setState('menu');

        requestAnimationFrame(() => this.resize());

        this.lastTime = performance.now();
        this.loop = this.loop.bind(this);
        this.animId = requestAnimationFrame(this.loop);

        if (window.RUN_TESTS === true) {
            setTimeout(() => this.runSelfTest({ live: true }), 0);
        }
    }

    initHeadless(width = 800, height = 600, level = 1) {
        this.headless = true;
        this.W = width;
        this.H = height;
        this.loadLevel(level);
        this.state = 'playing';
    }

    injectStyles() {
        if (typeof document === 'undefined' || !document.head || !document.head.appendChild) return;
        if (document.getElementById && document.getElementById('gx-ui-style')) return;
        const style = document.createElement('style');
        style.id = 'gx-ui-style';
        style.textContent = `
.gx-root{position:absolute;inset:0;pointer-events:none;font-family:'Segoe UI',system-ui,-apple-system,Roboto,Arial,sans-serif;color:#e2e8f0;overflow:hidden;user-select:none}
.gx-glass{background:rgba(15,23,42,.75);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.1);border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.35)}
.gx-header{position:absolute;top:8px;left:8px;right:8px;height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;pointer-events:auto;box-sizing:border-box}
.gx-left,.gx-right{display:flex;align-items:center;gap:12px;flex:1}
.gx-right{justify-content:flex-end}
.gx-center{flex:1;text-align:center;font-variant-numeric:tabular-nums}
.gx-title{font-weight:700;letter-spacing:.5px}
.gx-level{padding:2px 10px;border-radius:999px;background:rgba(99,102,241,.25);color:#a5b4fc;font-size:13px;font-weight:600}
.gx-score{font-size:20px;font-weight:700;color:#fff}
.gx-hi{font-size:12px;color:#94a3b8}
.gx-stat{font-size:13px;color:#cbd5e1;white-space:nowrap}
.gx-stat b{color:#fbbf24}
.gx-hp{display:flex;align-items:center;gap:6px;font-size:13px}
.gx-hpbar{width:90px;height:8px;border-radius:999px;background:rgba(255,255,255,.12);overflow:hidden}
.gx-hpfill{height:100%;width:100%;background:linear-gradient(90deg,#ef4444,#f97316);transition:width .25s ease}
.gx-icon{width:32px;height:32px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#e2e8f0;cursor:pointer;font-size:15px;transition:transform .12s,background .15s}
.gx-icon:hover{background:rgba(99,102,241,.35)}
.gx-icon:active{transform:scale(.9)}
.gx-shop{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);display:flex;gap:8px;padding:8px;pointer-events:auto}
.gx-card{padding:6px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);cursor:pointer;text-align:center;min-width:70px;transition:transform .12s,border-color .15s,background .15s}
.gx-card:hover{transform:translateY(-2px);background:rgba(99,102,241,.2)}
.gx-card.selected{border-color:#818cf8;background:rgba(99,102,241,.3)}
.gx-card.poor{opacity:.5}
.gx-card-name{font-size:13px;font-weight:600}
.gx-card-cost{font-size:12px;color:#fbbf24}
.gx-btn{border:0;border-radius:10px;padding:10px 22px;font-size:15px;font-weight:700;color:#fff;cursor:pointer;background:linear-gradient(135deg,#6366f1,#06b6d4);box-shadow:0 4px 18px rgba(99,102,241,.45);transition:transform .12s,box-shadow .2s,filter .2s;pointer-events:auto}
.gx-btn:hover{filter:brightness(1.15);box-shadow:0 6px 24px rgba(6,182,212,.5);transform:translateY(-1px)}
.gx-btn:active{transform:scale(.95)}
.gx-btn:disabled{opacity:.45;cursor:default;transform:none}
.gx-btn.ghost{background:rgba(255,255,255,.08);box-shadow:none}
.gx-overlay{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(2,6,23,.55);pointer-events:auto}
.gx-overlay.active{display:flex;animation:gxFade .3s ease}
.gx-modal{padding:28px 36px;text-align:center;min-width:300px;max-width:90%;animation:gxPop .35s cubic-bezier(.2,1.3,.4,1)}
.gx-modal h2{margin:0 0 6px;font-size:26px;letter-spacing:.5px}
.gx-modal p{margin:6px 0;color:#cbd5e1;font-size:14px}
.gx-actions{display:flex;gap:10px;justify-content:center;margin-top:18px;flex-wrap:wrap}
.gx-toasts{position:absolute;top:70px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px}
.gx-toast{padding:8px 20px;border-radius:999px;font-weight:700;font-size:15px;animation:gxToast 1.9s ease forwards}
.gx-toast.good{color:#6ee7b7}.gx-toast.warn{color:#fca5a5}.gx-toast.info{color:#a5b4fc}
@keyframes gxFade{from{opacity:0}to{opacity:1}}
@keyframes gxPop{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes gxToast{0%{opacity:0;transform:translateY(-10px) scale(.9)}12%{opacity:1;transform:none}80%{opacity:1}100%{opacity:0;transform:translateY(-8px)}}
`;
        document.head.appendChild(style);
    }

    buildUI() {
        this.injectStyles();
        const root = document.createElement('div');
        root.className = 'gx-root';
        root.innerHTML = `
            <div class="gx-header gx-glass">
                <div class="gx-left"><span class="gx-title">Cyber Siege</span><span class="gx-level" id="gx-level">Level 01</span></div>
                <div class="gx-center"><div class="gx-score" id="gx-score">0</div><div class="gx-hi" id="gx-hi">Highscore 0</div></div>
                <div class="gx-right">
                    <span class="gx-stat">Credits <b id="gx-credits">$0</b></span>
                    <span class="gx-stat">Welle <b id="gx-wave" style="color:#a5b4fc">1/8</b></span>
                    <span class="gx-hp">&#9829;<span class="gx-hpbar"><span class="gx-hpfill" id="gx-hpfill"></span></span><span id="gx-lives">20</span></span>
                    <button class="gx-icon" data-act="pause" title="Pause (P)">&#10074;&#10074;</button>
                    <button class="gx-icon" data-act="mute" id="gx-mute" title="Mute (M)">&#128266;</button>
                </div>
            </div>
            <div class="gx-shop gx-glass">
                ${Object.keys(this.towerTypes).map((k, i) => `<div class="gx-card${i === 0 ? ' selected' : ''}" data-type="${k}"><div class="gx-card-name">${this.towerTypes[k].name}</div><div class="gx-card-cost">$${this.towerTypes[k].cost}</div></div>`).join('')}
                <button class="gx-btn" data-act="wave" id="gx-wavebtn">Welle starten</button>
            </div>
            <div class="gx-toasts" id="gx-toasts"></div>
            <div class="gx-overlay" id="gx-ov-menu"><div class="gx-modal gx-glass"><h2>Cyber Siege</h2><p id="gx-menu-level">Level 01</p><p>Platziere Türme, überlebe alle Wellen.<br>Klick auf Turm = Upgrade, Rechtsklick = Verkaufen.</p><div class="gx-actions"><button class="gx-btn" data-act="start">Start</button></div></div></div>
            <div class="gx-overlay" id="gx-ov-paused"><div class="gx-modal gx-glass"><h2>Pause</h2><p>Das Spiel ist angehalten.</p><div class="gx-actions"><button class="gx-btn" data-act="resume">Fortsetzen</button><button class="gx-btn ghost" data-act="restart">Neustart</button></div></div></div>
            <div class="gx-overlay" id="gx-ov-gameover"><div class="gx-modal gx-glass"><h2 style="color:#fca5a5">Game Over</h2><p id="gx-go-text">Basis überrannt.</p><div class="gx-actions"><button class="gx-btn" data-act="restart">Erneut versuchen</button></div></div></div>
            <div class="gx-overlay" id="gx-ov-levelcomplete"><div class="gx-modal gx-glass"><h2 style="color:#6ee7b7">Level Complete</h2><p id="gx-lc-text">Sektor bereinigt.</p><div class="gx-actions"><button class="gx-btn ghost" data-act="restart">Wiederholen</button><button class="gx-btn" data-act="next">Nächstes Level &#10140;</button></div></div></div>
        `;
        this.container.appendChild(root);
        this.root = root;

        const q = (s) => root.querySelector(s);
        this.ui = {
            level: q('#gx-level'), score: q('#gx-score'), hi: q('#gx-hi'), credits: q('#gx-credits'),
            wave: q('#gx-wave'), hp: q('#gx-hpfill'), lives: q('#gx-lives'), mute: q('#gx-mute'),
            waveBtn: q('#gx-wavebtn'), toasts: q('#gx-toasts'), menuLevel: q('#gx-menu-level'),
            goText: q('#gx-go-text'), lcText: q('#gx-lc-text'),
            overlays: {
                menu: q('#gx-ov-menu'), paused: q('#gx-ov-paused'),
                gameover: q('#gx-ov-gameover'), levelcomplete: q('#gx-ov-levelcomplete')
            }
        };
    }

    bindEvents() {
        window.addEventListener('resize', this._onResize);
        window.addEventListener('keydown', this._onKey);

        this.root.addEventListener('click', (e) => {
            const t = e.target;
            if (!t || !t.closest) return;
            const card = t.closest('[data-type]');
            if (card) {
                this.selectTower(card.dataset.type);
                return;
            }
            const btn = t.closest('[data-act]');
            if (btn) this.handleAction(btn.dataset.act);
        });

        this.canvas.addEventListener('click', (e) => {
            if (this.state !== 'playing') return;
            const p = this.canvasPoint(e);
            this.handleCanvasClick(p.x, p.y);
        });
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (this.state !== 'playing') return;
            const p = this.canvasPoint(e);
            this.sellTurretAt(p.x, p.y);
        });
        this.canvas.addEventListener('mousemove', (e) => { this.mouse = this.canvasPoint(e); });
        this.canvas.addEventListener('mouseleave', () => { this.mouse = null; });
    }

    canvasPoint(e) {
        const rect = this.canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    handleAction(act) {
        if (window.AudioManager) window.AudioManager.playClick();
        switch (act) {
            case 'start': this.setState('playing'); break;
            case 'pause': this.togglePause(); break;
            case 'resume': this.setState('playing'); break;
            case 'restart': this.restartLevel(); break;
            case 'next': this.nextLevel(); break;
            case 'wave': this.startNextWave(); break;
            case 'mute':
                if (window.AudioManager) {
                    const muted = window.AudioManager.toggleMute();
                    if (this.ui.mute) this.ui.mute.innerHTML = muted ? '&#128263;' : '&#128266;';
                }
                break;
        }
    }

    handleKey(e) {
        const k = (e.key || '').toLowerCase();
        if (k === 'p' || k === 'escape') this.togglePause();
        else if (k === 'm') this.handleAction('mute');
        else if (k === ' ' && this.state === 'playing') { if (e.preventDefault) e.preventDefault(); this.startNextWave(); }
        else if (k === 't') this.toggleBot();
        else if (k >= '1' && k <= '4') this.selectTower(Object.keys(this.towerTypes)[Number(k) - 1]);
    }

    selectTower(type) {
        if (!this.towerTypes[type]) return;
        this.selectedTowerType = type;
        if (this.root) {
            this.root.querySelectorAll('.gx-card').forEach(c => c.classList.toggle('selected', c.dataset.type === type));
        }
    }

    togglePause() {
        if (this.state === 'playing') this.setState('paused');
        else if (this.state === 'paused') this.setState('playing');
    }

    setState(state) {
        this.state = state;
        if (!this.ui) return;
        const map = { menu: 'menu', paused: 'paused', gameover: 'gameover', levelcomplete: 'levelcomplete' };
        for (const key of Object.keys(this.ui.overlays)) {
            this.ui.overlays[key].classList.toggle('active', map[state] === key);
        }
        if (state === 'menu' && this.ui.menuLevel) this.ui.menuLevel.textContent = `Level ${this.pad(this.currentLevel)}`;
        this.lastTime = performance.now();
    }

    pad(n) { return String(n).padStart(2, '0'); }

    toast(msg, type = 'info') {
        if (!this.ui || !this.ui.toasts || !document.createElement) return;
        const el = document.createElement('div');
        el.className = `gx-toast gx-glass ${type}`;
        el.textContent = msg;
        this.ui.toasts.appendChild(el);
        setTimeout(() => { if (el.remove) el.remove(); }, 1950);
    }

    sfx(name) {
        if (this.headless || !window.AudioManager || !window.AudioManager[name]) return;
        try { window.AudioManager[name](); } catch (e) { /* Audio optional */ }
    }

    resize() {
        if (!this.container || !this.canvas) return;
        const rect = this.container.getBoundingClientRect();
        const w = Math.floor(rect.width > 50 ? rect.width : (window.innerWidth || 800));
        const h = Math.floor(rect.height > 50 ? rect.height : ((window.innerHeight || 648) - 48));
        if (w === this.W && h === this.H && this.canvas.width === w) return;

        const sx = w / this.W, sy = h / this.H;
        this.canvas.width = w;
        this.canvas.height = h;
        this.W = w;
        this.H = h;
        if (this.layout) {
            this.applyLayout();
            for (const t of this.turrets) { t.x *= sx; t.y *= sy; }
            for (const en of this.enemies) { en.x *= sx; en.y *= sy; }
            this.spotCache = null;
        }
    }

    /* ------------------------------------------------------------------ */
    /* Prozeduraler Level-Generator                                        */
    /* ------------------------------------------------------------------ */
    rng(seed) {
        let a = seed >>> 0;
        return () => {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // Normalisierte Koordinaten (0..1), damit Resize das Layout verlustfrei neu berechnet.
    generateLayout(level, attempt = 0) {
        const d = this.difficulty(level);
        const rand = this.rng(level * 7919 + attempt * 104729 + 17);
        const top = this.TOP / this.H + 0.04;
        const bottom = 1 - this.BOTTOM / this.H - 0.02;
        const span = Math.max(0.2, bottom - top);
        const minDy = Math.min(0.25, span * 0.3);

        const pts = [];
        const segs = d.segments;
        let y = top + rand() * span;
        pts.push({ u: -0.02, v: y });
        for (let i = 1; i <= segs; i++) {
            const x = 0.1 + (0.8 * i) / segs + (rand() - 0.5) * (0.4 / segs);
            pts.push({ u: Math.min(0.92, Math.max(0.08 * i, x)), v: y });
            let ny = y;
            for (let tries = 0; tries < 12 && Math.abs(ny - y) < minDy; tries++) ny = top + rand() * span;
            if (Math.abs(ny - y) < minDy) ny = y > top + span / 2 ? top : bottom;
            y = ny;
            pts.push({ u: pts[pts.length - 1].u, v: y });
        }
        pts.push({ u: 1.03, v: y });

        const rocks = [];
        if (attempt < 6) {
            const cols = Math.floor(this.W / this.CELL), rows = Math.floor(this.H / this.CELL);
            for (let cy = 0; cy < rows; cy++) {
                for (let cx = 0; cx < cols; cx++) {
                    if (rand() < d.rockDensity) rocks.push({ u: (cx + 0.5) / cols, v: (cy + 0.5) / rows });
                }
            }
        }
        return { pts, rocks, attempt };
    }

    applyLayout() {
        const L = this.layout;
        this.waypoints = L.pts.map(p => ({ x: p.u * this.W, y: p.v * this.H }));
        this.flyPath = [this.waypoints[0], this.waypoints[this.waypoints.length - 1]];
        this.pathLength = 0;
        for (let i = 0; i < this.waypoints.length - 1; i++) {
            const a = this.waypoints[i], b = this.waypoints[i + 1];
            this.pathLength += Math.hypot(b.x - a.x, b.y - a.y);
        }
        const cols = Math.floor(this.W / this.CELL), rows = Math.floor(this.H / this.CELL);
        this.rocks = L.rocks.map(r => {
            const cx = Math.min(cols - 1, Math.floor(r.u * cols)), cy = Math.min(rows - 1, Math.floor(r.v * rows));
            return { x: (cx + 0.5) * this.CELL, y: (cy + 0.5) * this.CELL, cx, cy };
        }).filter(r => !this.isNearPath(r.x, r.y, this.PATH_CLEAR + 4));
        this.spotCache = null;
    }

    segmentsIntersect(a, b, c, d) {
        const o = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
        const d1 = o(a, b, c), d2 = o(a, b, d), d3 = o(c, d, a), d4 = o(c, d, b);
        return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0)) && d1 !== 0 && d2 !== 0 && d3 !== 0 && d4 !== 0;
    }

    // Liefert Liste der Probleme; leer = Level ist strukturell lösbar.
    validateLayout(level) {
        const issues = [];
        const wp = this.waypoints;
        if (wp.length < 2) issues.push('Pfad hat weniger als 2 Wegpunkte');
        for (const p of wp) {
            if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) issues.push('Wegpunkt nicht endlich');
            else if (p.y < this.TOP - 1 || p.y > this.H - this.BOTTOM + 1) issues.push('Wegpunkt außerhalb Spielfeld');
        }
        for (let i = 0; i < wp.length - 1; i++) {
            if (Math.hypot(wp[i + 1].x - wp[i].x, wp[i + 1].y - wp[i].y) < 1) issues.push('Segment mit Länge 0');
            for (let j = i + 2; j < wp.length - 1; j++) {
                if (this.segmentsIntersect(wp[i], wp[i + 1], wp[j], wp[j + 1])) issues.push('Pfad überschneidet sich');
            }
        }
        const spots = this.buildSpots();
        if (spots.length < 14) issues.push(`Zu wenige Bauplätze (${spots.length})`);
        const best = spots.length ? spots[0].score : 0;
        if (best < 8) issues.push('Kein Bauplatz deckt den Pfad ab');
        const d = this.difficulty(level);
        if (d.startCredits < this.towerTypes.blaster.cost * 2) issues.push('Startkapital zu niedrig');
        return issues;
    }

    loadLevel(level) {
        const lvl = Math.max(1, Math.floor(level) || 1);
        this.currentLevel = lvl;
        const d = this.difficulty(lvl);

        this.lives = this.maxLives;
        this.credits = d.startCredits;
        this.wave = 1;
        this.maxWaves = d.maxWaves;
        this.turrets = [];
        this.enemies = [];
        this.projectiles = [];
        this.particles = [];
        this.beams = [];
        this.enemiesToSpawn = [];
        this.waveInProgress = false;
        this.combo = 0;
        this.stats = this.newStats();
        this.levelStartScore = this.score;

        // Generiere, bis Validierung besteht; letzter Versuch ist hindernisfrei.
        for (let attempt = 0; attempt < 8; attempt++) {
            this.layout = this.generateLayout(lvl, attempt);
            this.applyLayout();
            this.layoutIssues = this.validateLayout(lvl);
            if (this.layoutIssues.length === 0) break;
        }
        this.updateHUD();
    }

    startLevel(levelIndex = 1, difficulty = 'Einfach') {
        this.difficultyName = difficulty;
        this.loadLevel(levelIndex);
        if (this.state !== 'menu') this.setState('playing');
        else this.setState('menu');
    }

    restartLevel() {
        this.score = this.levelStartScore;
        this.loadLevel(this.currentLevel);
        this.setState('playing');
    }

    nextLevel() {
        const next = this.currentLevel + 1;
        this.loadLevel(next);
        this.setState('playing');
        this.toast(`Level ${this.pad(next)}`, 'info');
        const d = this.difficulty(next);
        const unlocked = Object.keys(this.enemyTypes).filter(k => this.enemyTypes[k].minLevel === next && k !== 'boss');
        unlocked.forEach(k => this.toast(`Neuer Gegner: ${this.enemyTypes[k].name}`, 'warn'));
        if (next > 1 && d.speedMul < 2.5) this.toast(`Tempo x${d.speedMul.toFixed(1)}`, 'warn');
    }

    /* ------------------------------------------------------------------ */
    /* Bauplätze & Kollision                                               */
    /* ------------------------------------------------------------------ */
    isNearPath(x, y, threshold) {
        for (let i = 0; i < this.waypoints.length - 1; i++) {
            if (this.distToSegment({ x, y }, this.waypoints[i], this.waypoints[i + 1]) < threshold) return true;
        }
        return false;
    }

    distToSegment(p, v, w) {
        const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
        if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
    }

    snap(x, y) {
        return { x: (Math.floor(x / this.CELL) + 0.5) * this.CELL, y: (Math.floor(y / this.CELL) + 0.5) * this.CELL };
    }

    isBuildable(x, y) {
        if (x < 14 || x > this.W - 14 || y < this.TOP + 8 || y > this.H - this.BOTTOM + 20) return false;
        if (this.isNearPath(x, y, this.PATH_CLEAR)) return false;
        for (const r of this.rocks) if (Math.abs(r.x - x) < 1 && Math.abs(r.y - y) < 1) return false;
        for (const t of this.turrets) if (Math.abs(t.x - x) < 1 && Math.abs(t.y - y) < 1) return false;
        return true;
    }

    // Alle freien Bauplätze, sortiert nach Pfadabdeckung (Bot & Validierung).
    buildSpots() {
        if (this.spotCache && this.spotCache.turrets === this.turrets.length) return this.spotCache.spots;
        const samples = [];
        for (let i = 0; i < this.waypoints.length - 1; i++) {
            const a = this.waypoints[i], b = this.waypoints[i + 1];
            const len = Math.hypot(b.x - a.x, b.y - a.y);
            for (let s = 0; s < len; s += 12) samples.push({ x: a.x + (b.x - a.x) * s / len, y: a.y + (b.y - a.y) * s / len });
        }
        const spots = [];
        const cols = Math.floor(this.W / this.CELL), rows = Math.floor(this.H / this.CELL);
        for (let cy = 0; cy < rows; cy++) {
            for (let cx = 0; cx < cols; cx++) {
                const x = (cx + 0.5) * this.CELL, y = (cy + 0.5) * this.CELL;
                if (!this.isBuildable(x, y)) continue;
                let score = 0;
                for (const p of samples) if (Math.hypot(p.x - x, p.y - y) <= 110) score++;
                spots.push({ x, y, score });
            }
        }
        spots.sort((a, b) => b.score - a.score);
        this.spotCache = { turrets: this.turrets.length, spots };
        return spots;
    }

    turretAt(x, y, radius = 22) {
        return this.turrets.find(t => Math.hypot(t.x - x, t.y - y) < radius) || null;
    }

    upgradeCost(t) { return Math.floor(t.cost * 0.6 * t.level); }

    handleCanvasClick(x, y) {
        const existing = this.turretAt(x, y);
        if (existing) {
            this.upgradeTurret(existing);
            return;
        }
        const s = this.snap(x, y);
        this.placeTurret(this.selectedTowerType, s.x, s.y);
    }

    placeTurret(type, x, y) {
        const info = this.towerTypes[type];
        if (!info || !this.isBuildable(x, y)) return false;
        if (this.credits < info.cost) {
            this.toast('Nicht genug Credits', 'warn');
            return false;
        }
        this.credits -= info.cost;
        this.turrets.push({
            x, y, type, cost: info.cost, range: info.range, rate: info.rate, damage: info.damage,
            splash: info.splash || 0, slow: info.slow || 0, chain: info.chain || 0,
            color: info.color, cooldown: 0, level: 1, angle: 0
        });
        this.stats.placed++;
        this.spotCache = null;
        this.burst(x, y, info.color, 10, 90);
        this.updateHUD();
        this.sfx('playPlaceBlock');
        return true;
    }

    upgradeTurret(t) {
        const cost = this.upgradeCost(t);
        if (t.level >= this.MAX_TOWER_LEVEL) { this.toast('Max. Level', 'info'); return false; }
        if (this.credits < cost) { this.toast('Nicht genug Credits', 'warn'); return false; }
        this.credits -= cost;
        t.level++;
        t.damage = Math.floor(t.damage * 1.4);
        t.range += 12;
        this.burst(t.x, t.y, '#fbbf24', 14, 120);
        this.updateHUD();
        this.sfx('playPowerup');
        return true;
    }

    sellTurretAt(x, y) {
        const t = this.turretAt(x, y);
        if (!t) return;
        this.credits += Math.floor(t.cost * 0.7 * (1 + (t.level - 1) * 0.5));
        this.turrets.splice(this.turrets.indexOf(t), 1);
        this.spotCache = null;
        this.burst(t.x, t.y, '#94a3b8', 10, 80);
        this.updateHUD();
    }

    /* ------------------------------------------------------------------ */
    /* Wellen                                                              */
    /* ------------------------------------------------------------------ */
    makeEnemy(typeKey, hpBase, rand) {
        const d = this.difficulty(this.currentLevel);
        const t = this.enemyTypes[typeKey];
        const hp = Math.max(1, Math.floor(hpBase * t.hp * d.hpMul));
        const path = t.flying ? this.flyPath : this.waypoints;
        return {
            type: typeKey, hp, maxHp: hp, radius: t.radius, color: t.color, flying: !!t.flying,
            speed: t.speed * d.speedMul * (0.95 + rand() * 0.1),
            reward: Math.round((typeKey === 'boss' ? t.reward : (8 + this.wave * 1.5) * t.reward) * d.rewardMul),
            points: t.points, path, seg: 0, travelled: 0, slowTimer: 0, flash: 0, dead: false,
            x: path[0].x, y: path[0].y
        };
    }

    startNextWave() {
        if (this.state !== 'playing' || this.waveInProgress) return false;
        const d = this.difficulty(this.currentLevel);
        const rand = this.rng(this.currentLevel * 31337 + this.wave * 101);
        this.waveInProgress = true;
        this.enemiesToSpawn = [];

        const count = Math.round((6 + this.wave * 2.5) * d.countMul);
        const hpBase = 30 + this.wave * 16;
        const pool = Object.keys(this.enemyTypes).filter(k => k !== 'boss' && this.enemyTypes[k].minLevel <= this.currentLevel);
        for (let i = 0; i < count; i++) {
            // Spezialtypen ab Welle 2; ungefähr jeder dritte Gegner.
            const special = this.wave >= 2 && pool.length > 1 && rand() < 0.35;
            const key = special ? pool[1 + Math.floor(rand() * (pool.length - 1))] : 'grunt';
            this.enemiesToSpawn.push(this.makeEnemy(key, hpBase, rand));
        }
        if (this.wave % 4 === 0) {
            this.enemiesToSpawn.push(this.makeEnemy('boss', 350 + this.wave * 100, rand));
            this.toast('Boss naht!', 'warn');
        }
        this.waveSpawnTimer = 0;
        this.updateHUD();
        this.sfx('playClick');
        return true;
    }

    /* ------------------------------------------------------------------ */
    /* Punkte, HUD                                                         */
    /* ------------------------------------------------------------------ */
    addScore(n) {
        this.score += n;
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.highScoreDirty = true;
        }
    }

    updateHUD() {
        if (!this.ui) return;
        const u = this.ui;
        u.level.textContent = `Level ${this.pad(this.currentLevel)}`;
        u.score.textContent = String(this.score);
        u.hi.textContent = `Highscore ${this.highScore}`;
        u.credits.textContent = `$${this.credits}`;
        u.wave.textContent = `${Math.min(this.wave, this.maxWaves)}/${this.maxWaves}`;
        u.lives.textContent = String(this.lives);
        if (u.hp.style) u.hp.style.width = `${Math.max(0, (this.lives / this.maxLives) * 100)}%`;
        if (u.waveBtn) u.waveBtn.disabled = this.waveInProgress;
        if (this.root) {
            this.root.querySelectorAll('.gx-card').forEach(c => {
                const info = this.towerTypes[c.dataset.type];
                if (info) c.classList.toggle('poor', this.credits < info.cost);
            });
        }
    }

    /* ------------------------------------------------------------------ */
    /* Effekte                                                             */
    /* ------------------------------------------------------------------ */
    burst(x, y, color, n, speed) {
        if (this.headless) return;
        for (let i = 0; i < n && this.particles.length < 400; i++) {
            const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
            this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.3, max: 0.8, color, size: 1.5 + Math.random() * 2.5 });
        }
    }

    addShake(v) { if (!this.headless) this.shake = Math.min(14, Math.max(this.shake, v)); }

    /* ------------------------------------------------------------------ */
    /* Simulation                                                          */
    /* ------------------------------------------------------------------ */
    loop(time) {
        this.animId = requestAnimationFrame(this.loop);
        if (this.isPaused || !this.ctx) return;

        const frameMs = time - this.lastTime;
        const delta = Math.min(frameMs / 1000, 0.1);
        this.lastTime = time;

        const t0 = performance.now();
        this.step(delta);
        const t1 = performance.now();
        this.render();
        const t2 = performance.now();

        const p = this.perf;
        p.frames.push(frameMs); p.update.push(t1 - t0); p.render.push(t2 - t1);
        if (p.frames.length > 300) { p.frames.shift(); p.update.shift(); p.render.shift(); }
    }

    // Fester Substep (max 1/60 s): verhindert Tunneling bei schnellen Gegnern/Projektilen.
    step(delta) {
        this.time += delta;
        if (this.state === 'playing') {
            let remaining = delta;
            while (remaining > 1e-9) {
                const dt = Math.min(remaining, 1 / 60);
                this.update(dt);
                remaining -= dt;
                if (this.state !== 'playing') break;
            }
            if (this.bot) this.botTick(delta);
        } else if (this.bot) {
            this.botTick(delta);
        }
        this.updateEffects(delta);
    }

    updateEffects(dt) {
        if (this.headless) return;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;
            if (p.life <= 0) { this.particles.splice(i, 1); continue; }
            p.x += p.vx * dt; p.y += p.vy * dt;
            p.vx *= 0.94; p.vy *= 0.94;
        }
        for (let i = this.beams.length - 1; i >= 0; i--) {
            this.beams[i].life -= dt;
            if (this.beams[i].life <= 0) this.beams.splice(i, 1);
        }
        this.shake *= 0.88;
        if (this.shake < 0.1) this.shake = 0;
        if (this.canvas && this.canvas.style) {
            this.canvas.style.transform = this.shake > 0
                ? `translate(${((Math.random() - 0.5) * this.shake).toFixed(1)}px,${((Math.random() - 0.5) * this.shake).toFixed(1)}px)`
                : '';
        }
    }

    update(dt) {
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) this.combo = 0;
        }

        if (this.enemiesToSpawn.length > 0) {
            this.waveSpawnTimer -= dt;
            if (this.waveSpawnTimer <= 0) {
                this.enemies.push(this.enemiesToSpawn.shift());
                const d = this.difficulty(this.currentLevel);
                this.waveSpawnTimer = Math.max(0.25, 0.6 / Math.sqrt(d.speedMul));
            }
        }

        for (const en of this.enemies) {
            if (en.dead) continue;
            if (en.flash > 0) en.flash -= dt;
            let mult = 1;
            if (en.slowTimer > 0) { mult = 0.5; en.slowTimer -= dt; }
            if (this.moveEnemy(en, en.speed * mult * this.BASE_SPEED * dt)) this.leak(en);
        }

        this.updateTurrets(dt);
        this.updateProjectiles(dt);
        this.reapDead();

        if (this.state === 'playing' && this.waveInProgress && this.enemiesToSpawn.length === 0 && this.enemies.length === 0) {
            this.finishWave();
        }
    }

    // Bewegt entlang des Pfads inkl. Restweg über Eckpunkte; true = Ziel erreicht.
    moveEnemy(en, dist) {
        const path = en.path;
        while (dist > 0) {
            const tgt = path[en.seg + 1];
            if (!tgt) return true;
            const dx = tgt.x - en.x, dy = tgt.y - en.y;
            const d = Math.hypot(dx, dy);
            if (d <= dist) {
                en.x = tgt.x; en.y = tgt.y; en.seg++;
                en.travelled += d; dist -= d;
            } else {
                en.x += (dx / d) * dist; en.y += (dy / d) * dist;
                en.travelled += dist; dist = 0;
            }
        }
        return en.seg >= path.length - 1;
    }

    leak(en) {
        en.dead = true;
        en.leaked = true;
        this.lives = Math.max(0, this.lives - (en.type === 'boss' ? 5 : 1));
        this.stats.leaks++;
        this.combo = 0;
        this.addShake(9);
        this.burst(en.x, en.y, '#ef4444', 18, 160);
        this.sfx('playHit');
        this.updateHUD();
        if (this.lives <= 0) this.gameOver();
    }

    updateTurrets(dt) {
        for (const t of this.turrets) {
            t.cooldown -= dt;
            if (t.cooldown > 0) continue;
            let target = null;
            for (const en of this.enemies) {
                if (en.dead || Math.hypot(en.x - t.x, en.y - t.y) > t.range + en.radius) continue;
                if (!target || en.travelled > target.travelled) target = en;
            }
            if (!target) continue;
            t.cooldown = t.rate;
            t.angle = Math.atan2(target.y - t.y, target.x - t.x);
            this.stats.shots++;
            this.projectiles.push({
                x: t.x + Math.cos(t.angle) * 14, y: t.y + Math.sin(t.angle) * 14, target,
                damage: t.damage, splash: t.splash, slow: t.slow, chain: t.chain, color: t.color, speed: 420, life: 3
            });
            this.sfx('playLaser');
        }
    }

    updateProjectiles(dt) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.life -= dt;
            if (p.target.dead) {
                let best = null, bd = 160;
                for (const en of this.enemies) {
                    if (en.dead) continue;
                    const dd = Math.hypot(en.x - p.x, en.y - p.y);
                    if (dd < bd) { bd = dd; best = en; }
                }
                p.target = best;
            }
            if (!p.target || p.life <= 0) { this.projectiles.splice(i, 1); continue; }

            // Treffer = Distanz <= Zielradius, Schrittweite wird auf Distanz begrenzt (kein Durchfliegen).
            const dx = p.target.x - p.x, dy = p.target.y - p.y;
            const dist = Math.hypot(dx, dy);
            const step = p.speed * dt;
            if (dist <= p.target.radius + step) {
                this.impact(p);
                this.projectiles.splice(i, 1);
            } else {
                p.x += (dx / dist) * step;
                p.y += (dy / dist) * step;
            }
        }
    }

    impact(p) {
        const tgt = p.target;
        this.damage(tgt, p.damage);
        if (p.splash > 0) {
            for (const en of this.enemies) {
                if (en !== tgt && !en.dead && Math.hypot(en.x - tgt.x, en.y - tgt.y) < p.splash) this.damage(en, p.damage * 0.7);
            }
            this.burst(tgt.x, tgt.y, p.color, 12, 140);
            this.addShake(2);
        }
        if (p.slow > 0) tgt.slowTimer = 2.0;
        if (p.chain > 0) {
            const pts = [{ x: p.x, y: p.y }, { x: tgt.x, y: tgt.y }];
            const hit = new Set([tgt]);
            let from = tgt;
            for (let c = 0; c < p.chain; c++) {
                let best = null, bd = 90;
                for (const en of this.enemies) {
                    if (en.dead || hit.has(en)) continue;
                    const dd = Math.hypot(en.x - from.x, en.y - from.y);
                    if (dd < bd) { bd = dd; best = en; }
                }
                if (!best) break;
                hit.add(best);
                this.damage(best, p.damage * 0.6);
                pts.push({ x: best.x, y: best.y });
                from = best;
            }
            if (!this.headless) this.beams.push({ pts, life: 0.15, color: p.color });
        }
        this.burst(tgt.x, tgt.y, p.color, 4, 80);
    }

    damage(en, amount) {
        if (en.dead) return;
        en.hp -= amount;
        en.flash = 0.08;
        if (en.hp <= 0) this.kill(en);
    }

    kill(en) {
        en.dead = true;
        this.credits += en.reward;
        this.stats.kills[en.type] = (this.stats.kills[en.type] || 0) + 1;
        this.addScore(en.points);
        this.combo++;
        this.comboTimer = 1.5;
        if (this.combo >= 3 && this.combo % 3 === 0) this.toast(`Combo x${this.combo}`, 'good');
        this.burst(en.x, en.y, en.color, en.type === 'boss' ? 40 : 14, 170);
        this.addShake(en.type === 'boss' ? 10 : 2.5);
        this.sfx('playExplosion');
        this.updateHUD();
    }

    reapDead() {
        for (let i = this.enemies.length - 1; i >= 0; i--) if (this.enemies[i].dead) this.enemies.splice(i, 1);
    }

    finishWave() {
        this.waveInProgress = false;
        const credit = 45 + this.wave * 8;
        const bonus = 50 * this.wave;
        this.credits += credit;
        this.stats.waveBonus += bonus;
        this.addScore(bonus);
        this.toast(`Welle ${this.wave} geschafft +$${credit}`, 'good');
        if (this.wave >= this.maxWaves) {
            this.levelComplete();
        } else {
            this.wave++;
        }
        this.updateHUD();
    }

    levelComplete() {
        const bonus = 500 + 25 * this.lives;
        this.stats.levelBonus = bonus;
        this.addScore(bonus);
        this.persistHighScore();
        this.setState('levelcomplete');
        if (this.ui) {
            this.ui.lcText.textContent = `Level ${this.pad(this.currentLevel)} bereinigt – Score ${this.score} (Bonus +${bonus})`;
        }
        this.toast('Level Up!', 'good');
        this.sfx('playWin');
        this.updateHUD();
    }

    gameOver() {
        this.persistHighScore();
        this.setState('gameover');
        if (this.ui) this.ui.goText.textContent = `Basis überrannt in Level ${this.pad(this.currentLevel)} – Score ${this.score}, Highscore ${this.highScore}`;
    }

    persistHighScore() {
        if (this.highScoreDirty) {
            this.highScoreDirty = false;
            this.saveHighScore();
        }
    }

    /* ------------------------------------------------------------------ */
    /* Rendering                                                           */
    /* ------------------------------------------------------------------ */
    render() {
        const ctx = this.ctx;
        const W = this.canvas.width, H = this.canvas.height;
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#0b1020';
        ctx.fillRect(0, 0, W, H);

        // Raster
        ctx.fillStyle = 'rgba(148,163,184,0.06)';
        for (let x = 0; x < W; x += this.CELL) ctx.fillRect(x, 0, 1, H);
        for (let y = 0; y < H; y += this.CELL) ctx.fillRect(0, y, W, 1);

        // Pfad
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const trace = () => {
            ctx.beginPath();
            this.waypoints.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
        };
        ctx.shadowColor = '#6366f1';
        ctx.shadowBlur = 18;
        ctx.strokeStyle = '#312e81';
        ctx.lineWidth = 40;
        trace(); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 32;
        trace(); ctx.stroke();
        ctx.restore();

        // Hindernisse
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        for (const r of this.rocks) {
            ctx.fillRect(r.x - 13, r.y - 13, 26, 26);
            ctx.strokeRect(r.x - 13, r.y - 13, 26, 26);
        }

        // Bauvorschau
        if (this.mouse && this.state === 'playing') {
            const s = this.snap(this.mouse.x, this.mouse.y);
            const existing = this.turretAt(s.x, s.y);
            const ok = existing || this.isBuildable(s.x, s.y);
            const info = this.towerTypes[this.selectedTowerType];
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.strokeStyle = ok ? info.color : '#ef4444';
            ctx.fillStyle = ok ? 'rgba(99,102,241,0.12)' : 'rgba(239,68,68,0.15)';
            ctx.beginPath();
            ctx.arc(s.x, s.y, existing ? existing.range : info.range, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
            ctx.restore();
        }

        // Türme
        for (const t of this.turrets) {
            ctx.save();
            ctx.shadowColor = t.color;
            ctx.shadowBlur = 12;
            ctx.fillStyle = '#0f172a';
            ctx.beginPath(); ctx.arc(t.x, t.y, 15, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = t.color;
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(t.x, t.y);
            ctx.lineTo(t.x + Math.cos(t.angle) * 16, t.y + Math.sin(t.angle) * 16);
            ctx.stroke();
            ctx.fillStyle = t.color;
            ctx.beginPath(); ctx.arc(t.x, t.y, 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fbbf24';
            for (let i = 1; i < t.level; i++) ctx.fillRect(t.x - 12 + (i - 1) * 6, t.y + 18, 4, 3);
            ctx.restore();
        }

        // Gegner
        for (const en of this.enemies) {
            ctx.save();
            const col = en.flash > 0 ? '#ffffff' : (en.slowTimer > 0 ? '#38bdf8' : en.color);
            ctx.shadowColor = col;
            ctx.shadowBlur = en.type === 'boss' ? 20 : 8;
            ctx.fillStyle = col;
            const r = en.radius;
            ctx.beginPath();
            if (en.type === 'runner') {
                ctx.moveTo(en.x, en.y - r); ctx.lineTo(en.x + r, en.y); ctx.lineTo(en.x, en.y + r); ctx.lineTo(en.x - r, en.y);
            } else if (en.type === 'tank') {
                ctx.moveTo(en.x - r, en.y - r); ctx.lineTo(en.x + r, en.y - r); ctx.lineTo(en.x + r, en.y + r); ctx.lineTo(en.x - r, en.y + r);
            } else if (en.type === 'flyer') {
                ctx.moveTo(en.x, en.y - r); ctx.lineTo(en.x + r, en.y + r * 0.8); ctx.lineTo(en.x - r, en.y + r * 0.8);
            } else {
                ctx.arc(en.x, en.y, r, 0, Math.PI * 2);
            }
            ctx.fill();
            ctx.shadowBlur = 0;
            if (en.type === 'boss') {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(en.x, en.y, r - 5, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(en.x - r, en.y - r - 8, r * 2, 3);
            ctx.fillStyle = '#10b981';
            ctx.fillRect(en.x - r, en.y - r - 8, r * 2 * Math.max(0, en.hp / en.maxHp), 3);
            ctx.restore();
        }

        // Projektile
        for (const p of this.projectiles) {
            ctx.save();
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 10;
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }

        // Tesla-Blitze
        for (const b of this.beams) {
            ctx.save();
            ctx.strokeStyle = b.color;
            ctx.shadowColor = b.color;
            ctx.shadowBlur = 12;
            ctx.lineWidth = 2;
            ctx.globalAlpha = Math.max(0, b.life / 0.15);
            ctx.beginPath();
            b.pts.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
            ctx.stroke();
            ctx.restore();
        }

        // Partikel
        for (const p of this.particles) {
            ctx.globalAlpha = Math.max(0, p.life / p.max);
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
        ctx.globalAlpha = 1;
    }

    /* ------------------------------------------------------------------ */
    /* Bot / Autoplay                                                      */
    /* ------------------------------------------------------------------ */
    toggleBot() {
        this.bot = !this.bot;
        this.botDelay = 0;
        this.toast(this.bot ? 'Autoplay-Bot AN' : 'Autoplay-Bot AUS', 'info');
        if (this.bot) {
            console.group('[TD-Test] Autoplay gestartet');
            this.logSanity(this.sanityCheck());
            console.groupEnd();
        }
    }

    botTick(dt) {
        this.botTimer -= dt;
        if (this.botTimer > 0) return;
        this.botTimer = 0.25;

        if (this.state === 'menu') { this.setState('playing'); return; }
        if (this.state === 'levelcomplete') {
            this.botDelay += 0.25;
            if (this.botDelay >= 1.0) { this.botDelay = 0; this.nextLevel(); }
            return;
        }
        if (this.state !== 'playing') return;

        this.botBuild();
        if (!this.waveInProgress) this.startNextWave();
    }

    botBuild() {
        const order = ['blaster', 'plasma', 'cryo', 'blaster', 'tesla'];
        const maxTowers = 8 + this.currentLevel;
        for (let guard = 0; guard < 6; guard++) {
            if (this.turrets.length < maxTowers) {
                const type = order[this.turrets.length % order.length];
                const cost = this.towerTypes[type].cost;
                const spots = this.buildSpots();
                if (this.credits >= cost && spots.length) {
                    if (this.placeTurret(type, spots[0].x, spots[0].y)) continue;
                }
                if (this.credits < cost) return;
            }
            const cand = this.turrets.filter(t => t.level < this.MAX_TOWER_LEVEL).sort((a, b) => a.level - b.level)[0];
            if (!cand || this.credits < this.upgradeCost(cand) || !this.upgradeTurret(cand)) return;
        }
    }

    /* ------------------------------------------------------------------ */
    /* Tests                                                               */
    /* ------------------------------------------------------------------ */
    sanityCheck() {
        const r = [];
        const add = (name, ok, detail = '') => r.push({ Test: name, Ergebnis: ok ? 'OK' : 'FEHLER', Details: detail });
        const finite = (o) => Number.isFinite(o.x) && Number.isFinite(o.y);

        add('Initialisierung (State/Layout)', !!this.layout && this.waypoints.length >= 2 && !!this.towerTypes, `State=${this.state}`);
        add('Level-Validierung', this.layoutIssues.length === 0, this.layoutIssues.join('; ') || `${this.waypoints.length} Wegpunkte, ${this.rocks.length} Hindernisse`);
        add('Bauplätze vorhanden', this.buildSpots().length >= 14, `${this.buildSpots().length}`);
        add('Keine NaN-Werte in Entities',
            [...this.enemies, ...this.turrets, ...this.projectiles].every(finite) && Number.isFinite(this.credits) && Number.isFinite(this.score));
        add('Gültige Nutzerwerte', this.lives >= 0 && this.lives <= this.maxLives && this.credits >= 0, `Leben=${this.lives}, Credits=${this.credits}`);
        add('Keine Türme auf dem Pfad', this.turrets.every(t => !this.isNearPath(t.x, t.y, this.PATH_CLEAR - 1)));
        add('Keine Türme auf Hindernissen/doppelt', this.turrets.every((t, i) =>
            !this.rocks.some(k => k.x === t.x && k.y === t.y) && this.turrets.findIndex(o => o.x === t.x && o.y === t.y) === i));
        add('Punkteberechnung konsistent', this.score - this.levelStartScore === this.expectedLevelScore(), `Score=${this.score - this.levelStartScore}, erwartet=${this.expectedLevelScore()}`);
        const dA = this.difficulty(this.currentLevel), dB = this.difficulty(this.currentLevel + 1);
        add('Schwierigkeit monoton steigend', dB.speedMul >= dA.speedMul && dB.hpMul > dA.hpMul && dB.countMul >= dA.countMul && dB.rockDensity >= dA.rockDensity);
        return r;
    }

    expectedLevelScore() {
        let s = this.stats.waveBonus + this.stats.levelBonus;
        for (const k of Object.keys(this.stats.kills)) s += this.stats.kills[k] * this.enemyTypes[k].points;
        return s;
    }

    logSanity(results) {
        console.table(results);
        const failed = results.filter(x => x.Ergebnis !== 'OK');
        if (failed.length) console.error(`[TD-Test] ${failed.length} Sanity-Check(s) fehlgeschlagen`);
        else console.log('[TD-Test] Alle Sanity-Checks bestanden');
    }

    perfSummary() {
        const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
        const frame = avg(this.perf.frames);
        return {
            'FPS (Ø)': frame > 0 ? +(1000 / frame).toFixed(1) : 0,
            'Update ms (Ø)': +avg(this.perf.update).toFixed(3),
            'Render ms (Ø)': +avg(this.perf.render).toFixed(3),
            Frames: this.perf.frames.length
        };
    }

    // Headless-Simulation auf eigener Instanz: Bot spielt N Level mit festem Zeitschritt.
    runHeadlessBotTest(levels = 3, startLevel = 1) {
        const sim = new window.TowerDefenseGame();
        sim.initHeadless(this.W, this.H, startLevel);
        sim.bot = true;
        sim.highScore = 0;
        const rows = [];
        const dt = 1 / 30;
        for (let i = 0; i < levels; i++) {
            const lvl = sim.currentLevel;
            const wall0 = performance.now();
            let simTime = 0;
            const limit = 60 * 60;
            while (sim.state === 'playing' && simTime < limit) {
                sim.step(dt);
                simTime += dt;
            }
            const checks = sim.sanityCheck();
            const bad = checks.filter(c => c.Ergebnis !== 'OK').map(c => c.Test);
            const won = sim.state === 'levelcomplete';
            rows.push({
                Level: lvl, Ergebnis: won ? 'GEWONNEN' : 'FEHLGESCHLAGEN', Wellen: `${Math.min(sim.wave, sim.maxWaves)}/${sim.maxWaves}`,
                Kills: Object.values(sim.stats.kills).reduce((a, b) => a + b, 0), Leaks: sim.stats.leaks, Leben: sim.lives,
                Score: sim.score, 'Sim-Sek': +simTime.toFixed(0), 'Wall ms': +(performance.now() - wall0).toFixed(1),
                Sanity: bad.length ? bad.join(', ') : 'OK'
            });
            if (!won) break;
            sim.nextLevel();
        }
        return rows;
    }

    runSelfTest(opts = {}) {
        console.group('%c[TD-Test] Cyber Siege Self-Test', 'color:#6366f1;font-weight:bold');
        let ok = true;
        try {
            const sanity = this.sanityCheck();
            this.logSanity(sanity);
            ok = sanity.every(x => x.Ergebnis === 'OK');

            const rows = this.runHeadlessBotTest(3, 1);
            console.table(rows);
            ok = ok && rows.length === 3 && rows.every(r => r.Ergebnis === 'GEWONNEN' && r.Sanity === 'OK');

            if (opts.live && !this.bot) this.toggleBot();
            if (this.perf.frames.length) console.table([this.perfSummary()]);
        } catch (e) {
            ok = false;
            console.error('[TD-Test] Unerwarteter Fehler', e);
        }
        console.log(ok ? '[TD-Test] BESTANDEN' : '[TD-Test] FEHLGESCHLAGEN');
        console.groupEnd();
        return ok;
    }

    pause() { this.isPaused = true; }
    resume() { this.isPaused = false; this.lastTime = performance.now(); }
    destroy() {
        if (this.animId) cancelAnimationFrame(this.animId);
        window.removeEventListener('resize', this._onResize);
        window.removeEventListener('keydown', this._onKey);
        this.bot = false;
        if (this.container) this.container.innerHTML = '';
    }
};
