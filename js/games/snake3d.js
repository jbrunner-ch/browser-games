/**
 * Neon Snake 3D - Cyber Arena
 * Three.js, procedural & provably solvable levels, progressive difficulty,
 * unified glassmorphism UI, juice (particles / shake / transitions),
 * bot-driven self-test (key 'T' or window.RUN_TESTS = true).
 *
 * Game logic (grid, ticks, collisions, generator, bot) is independent of
 * Three.js / DOM and can run headless: Snake3DGame.runHeadlessSimulation(3).
 */
(function () {
    'use strict';

    const HALF = 10;                 // playable cells: -HALF..HALF
    const N = HALF * 2 + 1;          // cells per axis
    const CELL = 1.5;                // world units per cell
    const MAX_LIVES = 3;
    const COMBO_WINDOW = 30;         // ticks between apples that keep a combo alive
    const INVULN_TICKS = 12;
    const INTRO_DURATION = 0.9;
    const DIRS = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
    const HS_KEY = 'snake3d_highscore';

    const key = (x, z) => (x + HALF) * N + (z + HALF);
    const inBounds = (x, z) => x >= -HALF && x <= HALF && z >= -HALF && z <= HALF;
    const inSafeZone = (x, z) => x >= -4 && x <= 6 && z >= -2 && z <= 2;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
    const pad2 = (n) => String(n).padStart(2, '0');

    function mulberry32(seed) {
        let a = seed >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    /* ------------------------------------------------------------------ *
     * Shared design system (injected once, reusable by other games)
     * ------------------------------------------------------------------ */
    const GUI_CSS = `
.gui-root{position:absolute;inset:0;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;overflow:hidden;user-select:none}
.gui-root *{box-sizing:border-box}
.gui-header{position:absolute;top:10px;left:10px;right:10px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;padding:8px 16px;background:rgba(15,23,42,.75);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.1);border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.35);pointer-events:auto}
.gui-left{display:flex;flex-direction:column;line-height:1.15}
.gui-title{font-weight:700;font-size:14px;letter-spacing:.04em}
.gui-level{font-size:12px;color:#22d3ee;font-weight:600;letter-spacing:.08em}
.gui-center{text-align:center;line-height:1.15}
.gui-score{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums}
.gui-best{font-size:11px;color:#94a3b8;letter-spacing:.06em}
.gui-right{display:flex;align-items:center;justify-content:flex-end;gap:12px}
.gui-hearts{display:flex;gap:3px;font-size:18px}
.gui-heart{color:#334155;transition:color .2s,transform .2s}
.gui-heart.on{color:#f43f5e;text-shadow:0 0 8px rgba(244,63,94,.6)}
.gui-heart.pop{transform:scale(1.4)}
.gui-bar{width:70px;height:8px;border-radius:99px;background:rgba(255,255,255,.12);overflow:hidden}
.gui-bar>i{display:block;height:100%;width:0;background:linear-gradient(90deg,#6366f1,#22d3ee);transition:width .25s}
.gui-icon-btn{width:32px;height:32px;border-radius:9px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);color:#e2e8f0;cursor:pointer;font-size:14px;transition:background .15s,transform .1s}
.gui-icon-btn:hover{background:rgba(99,102,241,.35)}
.gui-icon-btn:active{transform:scale(.92)}
.gui-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,.45);opacity:0;visibility:hidden;transition:opacity .25s,visibility .25s;pointer-events:none}
.gui-overlay.active{opacity:1;visibility:visible;pointer-events:auto}
.gui-modal{min-width:300px;max-width:90%;padding:28px 34px;text-align:center;background:rgba(15,23,42,.75);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.1);border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.5);transform:translateY(12px) scale(.97);transition:transform .25s}
.gui-overlay.active .gui-modal{transform:none}
.gui-modal h2{margin:0 0 6px;font-size:26px;letter-spacing:.05em}
.gui-modal p{margin:4px 0;color:#94a3b8;font-size:14px;line-height:1.5}
.gui-stats{display:flex;justify-content:center;gap:22px;margin:14px 0 18px}
.gui-stat b{display:block;font-size:20px;color:#e2e8f0;font-variant-numeric:tabular-nums}
.gui-stat span{font-size:11px;color:#94a3b8;letter-spacing:.08em;text-transform:uppercase}
.gui-actions{display:flex;gap:10px;justify-content:center;margin-top:16px;flex-wrap:wrap}
.gui-btn{padding:10px 22px;border:0;border-radius:10px;font-weight:600;font-size:14px;font-family:inherit;color:#fff;cursor:pointer;background:linear-gradient(135deg,#6366f1,#06b6d4);box-shadow:0 6px 18px rgba(99,102,241,.4);transition:transform .12s,filter .15s,box-shadow .15s}
.gui-btn:hover{filter:brightness(1.15);box-shadow:0 8px 24px rgba(34,211,238,.4)}
.gui-btn:active{transform:scale(.95)}
.gui-btn.secondary{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);box-shadow:none}
.gui-toasts{position:absolute;top:84px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none}
.gui-toast{padding:8px 18px;border-radius:99px;font-weight:700;font-size:15px;background:rgba(15,23,42,.75);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.1);animation:gui-toast-in .25s ease-out;transition:opacity .35s,transform .35s}
.gui-toast.good{color:#22d3ee}.gui-toast.bad{color:#f43f5e}.gui-toast.info{color:#a5b4fc}
.gui-toast.out{opacity:0;transform:translateY(-10px)}
.gui-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;transition:opacity .5s}
.gui-flash.on{opacity:.55;transition:none}
@keyframes gui-toast-in{from{opacity:0;transform:translateY(-12px) scale(.9)}to{opacity:1;transform:none}}
`;

    function injectStyle() {
        if (document.getElementById('gui-ds-style')) return;
        const st = document.createElement('style');
        st.id = 'gui-ds-style';
        st.textContent = GUI_CSS;
        document.head.appendChild(st);
    }

    /* ------------------------------------------------------------------ *
     * Game class
     * ------------------------------------------------------------------ */
    class Snake3DGame {
        constructor() {
            this.container = null;
            this.scene = null;
            this.camera = null;
            this.renderer = null;
            this.animId = null;
            this.clock = null;
            this.isPaused = false;      // external pause (portal modals)
            this.headless = false;

            this.state = 'start';       // start | intro | playing | paused | gameover | complete
            this.level = 1;
            this.params = Snake3DGame.levelParams(1);
            this.score = 0;
            this.lives = MAX_LIVES;
            this.highScore = 0;
            this.applesEaten = 0;
            this.combo = 0;
            this.ticksSinceApple = 9999;
            this.tickCount = 0;
            this.invuln = 0;
            this.levelStartScore = 0;
            this.levelBonus = 0;
            this.stats = { ticks: 0, apples: 0, livesLost: 0 };

            this.snake = [];
            this.prevSnake = [];
            this.dir = { x: 1, z: 0 };
            this.inputQueue = [];
            this.apple = { x: 5, z: 0 };
            this.obstacles = [];
            this.obstacleSet = new Set();
            this.enemies = [];
            this.rng = mulberry32(1);

            this.interval = this.params.interval;
            this.moveTimer = 0;
            this.timeScale = 1;
            this.bot = false;
            this.testRun = null;

            this.introT = 0;
            this.trauma = 0;
            this.headPulse = 0;
            this.camBase = { x: 0, y: 25, z: 19 };

            this.snakeMeshes = [];
            this.enemyMeshes = [];
            this.obsGroup = null;
            this.appleMesh = null;
            this.headLight = null;
            this.particles = null;
            this.disposables = [];
            this.timers = new Set();

            this.perf = { frames: [], render: [], last: 0 };
            this.ui = {};
            this._listeners = [];

            try { this.highScore = parseInt(localStorage.getItem(HS_KEY), 10) || 0; } catch (e) { this.highScore = 0; }
        }

        /* ============================ Generator ============================ */

        static levelParams(level) {
            const L = Math.max(1, Math.floor(level));
            return {
                level: L,
                // +10% speed per level (linear), floor at 55ms per step
                speedFactor: 1 + 0.1 * (L - 1),
                interval: Math.max(0.055, 0.14 / (1 + 0.1 * (L - 1))),
                targetApples: Math.min(20, 4 + L),
                obstacleCount: Math.min(70, 3 + Math.floor(L * 2.2)),
                patrols: L >= 4 ? Math.min(5, 1 + Math.floor((L - 4) / 3)) : 0,
                hunters: L >= 8 ? Math.min(4, 1 + Math.floor((L - 8) / 4)) : 0,
                patrolPeriod: 2,
                hunterPeriod: L >= 16 ? 2 : 3
            };
        }

        /**
         * Free cells must form one connected region and every free cell needs
         * >= 2 free neighbours (no dead ends the snake could get stuck in).
         */
        static layoutIsSolvable(blocked) {
            let free = 0, start = -1;
            for (let x = -HALF; x <= HALF; x++) {
                for (let z = -HALF; z <= HALF; z++) {
                    if (blocked.has(key(x, z))) continue;
                    free++;
                    if (start < 0) start = key(x, z);
                    let deg = 0;
                    for (const d of DIRS) {
                        const nx = x + d.x, nz = z + d.z;
                        if (inBounds(nx, nz) && !blocked.has(key(nx, nz))) deg++;
                    }
                    if (deg < 2) return false;
                }
            }
            if (free === 0) return false;
            const seen = new Set([start]);
            const stack = [start];
            while (stack.length) {
                const c = stack.pop();
                const x = Math.floor(c / N) - HALF, z = (c % N) - HALF;
                for (const d of DIRS) {
                    const nx = x + d.x, nz = z + d.z;
                    if (!inBounds(nx, nz)) continue;
                    const nk = key(nx, nz);
                    if (blocked.has(nk) || seen.has(nk)) continue;
                    seen.add(nk);
                    stack.push(nk);
                }
            }
            return seen.size === free;
        }

        static generateLevel(level) {
            const p = Snake3DGame.levelParams(level);
            const rng = mulberry32(p.level * 7919 + 1337);
            const blocked = new Set();
            const obstacles = [];
            const maxLen = Math.min(4, 1 + Math.floor(p.level / 4));

            let attempts = 0;
            while (obstacles.length < p.obstacleCount && attempts < 800) {
                attempts++;
                const len = 1 + Math.floor(rng() * maxLen);
                const horizontal = rng() < 0.5;
                const sx = Math.floor(rng() * N) - HALF;
                const sz = Math.floor(rng() * N) - HALF;
                const cells = [];
                let ok = true;
                for (let i = 0; i < len; i++) {
                    const x = sx + (horizontal ? i : 0);
                    const z = sz + (horizontal ? 0 : i);
                    if (!inBounds(x, z) || inSafeZone(x, z) || blocked.has(key(x, z))) { ok = false; break; }
                    cells.push({ x, z });
                }
                if (!ok) continue;
                cells.forEach(c => blocked.add(key(c.x, c.z)));
                if (!Snake3DGame.layoutIsSolvable(blocked)) {
                    cells.forEach(c => blocked.delete(key(c.x, c.z)));
                    continue;
                }
                cells.forEach(c => obstacles.push(c));
            }

            const enemies = [];
            const taken = new Set();
            const isFree = (x, z) => inBounds(x, z) && !blocked.has(key(x, z));
            const pickCell = (pred) => {
                for (let i = 0; i < 400; i++) {
                    const x = Math.floor(rng() * N) - HALF;
                    const z = Math.floor(rng() * N) - HALF;
                    const k = key(x, z);
                    if (blocked.has(k) || taken.has(k) || inSafeZone(x, z)) continue;
                    if (Math.abs(x) + Math.abs(z) < 7) continue;
                    if (pred && !pred(x, z)) continue;
                    taken.add(k);
                    return { x, z };
                }
                return null;
            };

            for (let i = 0; i < p.patrols; i++) {
                const horizontal = rng() < 0.5;
                const c = pickCell((x, z) => horizontal
                    ? isFree(x - 1, z) && isFree(x + 1, z)
                    : isFree(x, z - 1) && isFree(x, z + 1));
                if (c) enemies.push({ type: 'patrol', x: c.x, z: c.z, dx: horizontal ? 1 : 0, dz: horizontal ? 0 : 1, period: p.patrolPeriod });
            }
            for (let i = 0; i < p.hunters; i++) {
                const c = pickCell((x, z) => Math.abs(x) + Math.abs(z) >= 8);
                if (c) enemies.push({ type: 'hunter', x: c.x, z: c.z, dx: 0, dz: 0, period: p.hunterPeriod });
            }

            return { params: p, obstacles, enemies };
        }

        /** Verifies a generated level; returns list of problems (empty = ok). */
        static validateLevel(level) {
            const problems = [];
            const gen = Snake3DGame.generateLevel(level);
            const blocked = new Set();
            gen.obstacles.forEach(o => {
                if (!inBounds(o.x, o.z)) problems.push(`Obstacle out of bounds ${o.x},${o.z}`);
                if (inSafeZone(o.x, o.z)) problems.push(`Obstacle in safe zone ${o.x},${o.z}`);
                if (blocked.has(key(o.x, o.z))) problems.push(`Duplicate obstacle ${o.x},${o.z}`);
                blocked.add(key(o.x, o.z));
            });
            if (!Snake3DGame.layoutIsSolvable(blocked)) problems.push('Layout not connected / has dead ends');
            gen.enemies.forEach(e => {
                if (blocked.has(key(e.x, e.z))) problems.push(`Enemy inside obstacle ${e.x},${e.z}`);
            });
            if (gen.params.targetApples > N * N - blocked.size - 3) problems.push('Too many apples required');
            return problems;
        }

        /* ============================ Lifecycle ============================ */

        init(container, options = {}) {
            this.container = container;
            this.container.innerHTML = '';

            if (typeof THREE === 'undefined') {
                this.container.innerHTML = `
                    <div style="color:var(--text-secondary); text-align:center; padding:40px; font-family:sans-serif;">
                        <h3>Three.js 3D Engine konnte nicht geladen werden</h3>
                        <p style="margin-top:8px; font-size:13px;">Bitte stelle sicher, dass eine Internetverbindung für das CDN besteht.</p>
                    </div>`;
                return;
            }

            if (getComputedStyle(this.container).position === 'static') this.container.style.position = 'relative';

            const canvas = document.createElement('canvas');
            canvas.className = 'game-canvas';
            this.container.appendChild(canvas);

            injectStyle();
            this.buildUI();
            this.buildScene(canvas);
            this.bindEvents(canvas);

            this.loadLevel(Math.max(1, parseInt(options.levelIndex, 10) || 1));
            this.setState('start');

            requestAnimationFrame(() => this.resize());
            this.animate = this.animate.bind(this);
            this.perf.last = performance.now();
            this.animId = requestAnimationFrame(this.animate);

            // Startup sanity checks (compact; only logs when something fails)
            Snake3DGame.runSanityChecks({ quick: true, silent: true, live: this });
            if (window.RUN_TESTS === true) {
                this.after(300, () => this.startSelfTest());
            }
        }

        after(ms, fn) {
            const id = setTimeout(() => { this.timers.delete(id); fn(); }, ms);
            this.timers.add(id);
        }

        resize() {
            if (!this.renderer || !this.container) return;
            const w = Math.max(300, this.container.clientWidth || window.innerWidth);
            const h = Math.max(300, this.container.clientHeight || (window.innerHeight - 48));
            this.camera.aspect = w / h;
            this.updateCameraBase();
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(w, h);
        }

        updateCameraBase() {
            const aspect = this.camera ? this.camera.aspect : 1.6;
            const k = Math.max(1, 1.15 / aspect);
            this.camBase = { x: 0, y: 25 * k, z: 19 * k };
        }

        pause() { this.isPaused = true; }
        resume() {
            this.isPaused = false;
            if (this.clock) this.clock.getDelta();
        }

        destroy() {
            if (this.animId) cancelAnimationFrame(this.animId);
            this.animId = null;
            this.timers.forEach(clearTimeout);
            this.timers.clear();
            this._listeners.forEach(([t, ev, fn, opt]) => t.removeEventListener(ev, fn, opt));
            this._listeners = [];
            this.disposables.forEach(d => { try { d.dispose(); } catch (e) { /* ignore */ } });
            this.disposables = [];
            if (this.renderer) {
                this.renderer.dispose();
                this.renderer = null;
            }
            this.scene = null;
            if (this.container) this.container.innerHTML = '';
        }

        listen(target, ev, fn, opt) {
            target.addEventListener(ev, fn, opt);
            this._listeners.push([target, ev, fn, opt]);
        }

        /* ============================== State ============================== */

        setState(s) {
            this.state = s;
            if (this.headless) return;
            this.showOverlay(s === 'start' || s === 'paused' || s === 'gameover' || s === 'complete' ? s : null);
            this.updateHUD();
        }

        startPlay() {
            if (window.AudioManager && AudioManager.init) AudioManager.init();
            this.beginIntro();
        }

        beginIntro() {
            this.introT = 0;
            this.moveTimer = 0;
            this.inputQueue = [];
            this.setState('intro');
            this.toast(`Level ${pad2(this.level)}`, 'info');
            this.syncPortalLevel();
        }

        togglePause() {
            if (this.state === 'playing') { this.setState('paused'); }
            else if (this.state === 'paused') { if (this.clock) this.clock.getDelta(); this.setState('playing'); }
        }

        toggleMute() {
            if (!window.AudioManager) return;
            AudioManager.toggleMute();
            this.updateHUD();
        }

        syncPortalLevel() {
            const pill = document.getElementById('active-level-indicator');
            if (pill && window.portal && typeof window.portal.getDifficultyName === 'function') {
                pill.innerText = `Level ${this.level} (${window.portal.getDifficultyName(this.level)}) ▾`;
            }
            if (window.portal) window.portal.currentLevel = this.level;
        }

        /** Public: restart cleanly at a given level (fresh score & lives). */
        startLevel(levelIndex = 1) {
            this.score = 0;
            this.lives = MAX_LIVES;
            this.loadLevel(levelIndex);
            if (this.headless) this.state = 'playing';
            else this.beginIntro();
        }

        nextLevel() {
            this.lives = Math.min(MAX_LIVES, this.lives + 1);
            this.loadLevel(this.level + 1);
            if (this.headless) { this.state = 'playing'; return; }
            this.flash();
            this.beginIntro();
        }

        retry() {
            this.score = this.levelStartScore;
            this.lives = MAX_LIVES;
            this.loadLevel(this.level);
            this.beginIntro();
        }

        loadLevel(level) {
            this.level = level;
            this.params = Snake3DGame.levelParams(level);
            this.interval = this.params.interval;
            const gen = Snake3DGame.generateLevel(level);
            this.obstacles = gen.obstacles;
            this.obstacleSet = new Set(gen.obstacles.map(o => key(o.x, o.z)));
            this.enemies = gen.enemies.map(e => ({ ...e, px: e.x, pz: e.z }));
            this.rng = mulberry32(level * 104729 + 7);
            this.applesEaten = 0;
            this.combo = 0;
            this.ticksSinceApple = 9999;
            this.tickCount = 0;
            this.invuln = 0;
            this.moveTimer = 0;
            this.levelStartScore = this.score;
            this.stats = { ticks: 0, apples: 0, livesLost: 0 };
            this.resetSnake();
            this.spawnApple();
            this.rebuildEntityMeshes();
            this.updateHUD();
        }

        resetSnake() {
            this.snake = [{ x: 0, z: 0 }, { x: -1, z: 0 }, { x: -2, z: 0 }];
            this.prevSnake = this.snake.map(s => ({ ...s }));
            this.dir = { x: 1, z: 0 };
            this.inputQueue = [];
        }

        spawnApple() {
            const occupied = new Set(this.snake.map(s => key(s.x, s.z)));
            this.enemies.forEach(e => occupied.add(key(e.x, e.z)));
            const free = [];
            for (let x = -HALF; x <= HALF; x++) {
                for (let z = -HALF; z <= HALF; z++) {
                    const k = key(x, z);
                    if (!this.obstacleSet.has(k) && !occupied.has(k)) free.push({ x, z });
                }
            }
            if (!free.length) { this.apple = null; return; }
            // keep apples a few cells away from the head so the player has to steer
            const head = this.snake[0];
            const far = free.filter(c => Math.abs(c.x - head.x) + Math.abs(c.z - head.z) >= 4);
            const pool = far.length ? far : free;
            this.apple = pool[Math.floor(this.rng() * pool.length)];
        }

        /* ============================= Game tick ============================ */

        isBlocked(x, z) {
            return !inBounds(x, z) || this.obstacleSet.has(key(x, z));
        }

        tick() {
            this.tickCount++;
            this.stats.ticks++;
            this.ticksSinceApple++;
            if (this.invuln > 0) this.invuln--;

            if (this.bot) this.dir = this.botDecide();
            else if (this.inputQueue.length) this.dir = this.inputQueue.shift();

            this.prevSnake = this.snake.map(s => ({ x: s.x, z: s.z }));
            this.enemies.forEach(e => { e.px = e.x; e.pz = e.z; });

            const head = this.snake[0];
            const nh = { x: head.x + this.dir.x, z: head.z + this.dir.z };

            if (!inBounds(nh.x, nh.z)) return this.damage('wall', head);
            if (this.obstacleSet.has(key(nh.x, nh.z))) return this.damage('obstacle', nh);

            const ate = !!this.apple && nh.x === this.apple.x && nh.z === this.apple.z;
            const body = ate ? this.snake : this.snake.slice(0, -1);
            if (this.invuln === 0 && body.some(s => s.x === nh.x && s.z === nh.z)) return this.damage('self', nh);

            this.snake.unshift(nh);
            if (!ate) this.snake.pop();
            else this.onApple(nh);

            this.moveEnemies();
            this.checkEnemyHits(head, nh);
            if (this.state !== 'playing') return;

            if (this.applesEaten >= this.params.targetApples) this.completeLevel();
        }

        onApple(pos) {
            this.combo = this.ticksSinceApple <= COMBO_WINDOW ? Math.min(5, this.combo + 1) : 1;
            this.ticksSinceApple = 0;
            this.score += 10 * this.combo;
            this.applesEaten++;
            this.stats.apples++;
            if (this.score > this.highScore) this.highScore = this.score;

            if (!this.headless) {
                this.burst(pos.x, pos.z, 0x34d399, 26, 6);
                this.headPulse = 1;
                this.addTrauma(0.15);
                if (window.AudioManager) AudioManager.playPowerup();
                if (this.combo >= 2) this.toast(`Combo x${this.combo}`, 'good');
            }
            this.spawnApple();
            this.updateHUD();
        }

        moveEnemies() {
            const head = this.snake[0];
            const occupied = (x, z, self) => this.enemies.some(o => o !== self && o.x === x && o.z === z);
            for (const e of this.enemies) {
                if (this.tickCount % e.period !== 0) continue;
                if (e.type === 'patrol') {
                    let nx = e.x + e.dx, nz = e.z + e.dz;
                    if (this.isBlocked(nx, nz) || occupied(nx, nz, e)) {
                        e.dx = -e.dx; e.dz = -e.dz;
                        nx = e.x + e.dx; nz = e.z + e.dz;
                        if (this.isBlocked(nx, nz) || occupied(nx, nz, e)) continue;
                    }
                    e.x = nx; e.z = nz;
                } else {
                    const dx = head.x - e.x, dz = head.z - e.z;
                    const sx = Math.sign(dx), sz = Math.sign(dz);
                    const cand = Math.abs(dx) >= Math.abs(dz) ? [[sx, 0], [0, sz]] : [[0, sz], [sx, 0]];
                    let moved = false;
                    for (const [cx, cz] of cand) {
                        if (cx === 0 && cz === 0) continue;
                        const nx = e.x + cx, nz = e.z + cz;
                        if (!this.isBlocked(nx, nz) && !occupied(nx, nz, e)) { e.x = nx; e.z = nz; moved = true; break; }
                    }
                    if (!moved) {
                        const opts = DIRS.filter(d => !this.isBlocked(e.x + d.x, e.z + d.z) && !occupied(e.x + d.x, e.z + d.z, e));
                        if (opts.length) {
                            const d = opts[Math.floor(this.rng() * opts.length)];
                            e.x += d.x; e.z += d.z;
                        }
                    }
                }
            }
        }

        /** Cell-based + swap detection => no tunnelling through enemies. */
        checkEnemyHits(prevHead, newHead) {
            if (this.invuln > 0) return;
            for (const e of this.enemies) {
                const onBody = this.snake.some(s => s.x === e.x && s.z === e.z);
                const swapped = e.x === prevHead.x && e.z === prevHead.z && e.px === newHead.x && e.pz === newHead.z;
                if (onBody || swapped) {
                    this.enemies = this.enemies.filter(o => o !== e);
                    this.damage('enemy', { x: e.x, z: e.z });
                    return;
                }
            }
        }

        damage(kind, pos) {
            this.lives--;
            this.stats.livesLost++;
            this.combo = 0;
            this.ticksSinceApple = 9999;
            this.invuln = INVULN_TICKS;

            if (!this.headless) {
                this.burst(pos.x, pos.z, 0xf43f5e, 40, 8);
                this.addTrauma(0.7);
                if (window.AudioManager) AudioManager.playExplosion();
                this.toast(this.lives > 0 ? 'Treffer!' : 'Game Over', 'bad');
                this.pulseHeart();
            }
            if (this.lives <= 0) { this.gameOver(); return; }
            if (kind !== 'enemy') this.resetSnake();
            this.rebuildEnemyMeshes();
            this.updateHUD();
        }

        gameOver() {
            this.saveHighScore();
            this.setState('gameover');
            if (this.testRun) this.finishSelfTest('Game Over im Autoplay');
        }

        completeLevel() {
            this.levelBonus = 100 + 50 * this.lives;
            this.score += this.levelBonus;
            if (this.score > this.highScore) this.highScore = this.score;
            this.saveHighScore();
            this.state = 'complete';
            if (this.headless) return;

            if (window.AudioManager) AudioManager.playWin();
            const h = this.snake[0];
            this.burst(h.x, h.z, 0x22d3ee, 60, 9);
            this.burst(h.x, h.z, 0x6366f1, 60, 7);
            this.toast('Level Up!', 'good');
            this.updateHUD();

            if (this.testRun) {
                this.testRun.levels.push({
                    level: this.level, ticks: this.stats.ticks, apples: this.stats.apples,
                    livesLost: this.stats.livesLost, score: this.score, interval: +this.interval.toFixed(4)
                });
                if (this.testRun.levels.length >= this.testRun.target) { this.finishSelfTest(); return; }
                this.after(250, () => { if (this.testRun) this.nextLevel(); });
                return;
            }
            this.setState('complete');
        }

        saveHighScore() {
            if (this.headless || this.testRun) return;
            try { localStorage.setItem(HS_KEY, String(this.highScore)); } catch (e) { /* storage unavailable */ }
        }

        /* =============================== Bot AI ============================= */

        botDecide() {
            const head = this.snake[0];
            const len = this.snake.length;
            const rev = { x: -this.dir.x, z: -this.dir.z };
            const danger = new Set();
            this.enemies.forEach(e => {
                danger.add(key(e.x, e.z));
                DIRS.forEach(d => { if (inBounds(e.x + d.x, e.z + d.z)) danger.add(key(e.x + d.x, e.z + d.z)); });
            });

            const bodyIdx = new Map();
            this.snake.forEach((s, i) => bodyIdx.set(key(s.x, s.z), i));

            const options = [];
            for (const d of DIRS) {
                if (d.x === rev.x && d.z === rev.z) continue;
                const x = head.x + d.x, z = head.z + d.z;
                if (this.isBlocked(x, z)) continue;
                const bi = bodyIdx.get(key(x, z));
                if (bi !== undefined && bi < len - 1 && this.invuln === 0) continue;
                options.push({
                    d,
                    danger: danger.has(key(x, z)) ? 1 : 0,
                    area: this.floodArea(x, z, bodyIdx, len),
                    dist: this.pathDist(x, z, bodyIdx, len)
                });
            }
            if (!options.length) return this.dir;
            options.sort((a, b) =>
                (a.danger - b.danger) ||
                ((a.area >= len ? 0 : 1) - (b.area >= len ? 0 : 1)) ||
                (a.dist - b.dist) ||
                (b.area - a.area));
            return options[0].d;
        }

        floodArea(sx, sz, bodyIdx, len) {
            const cap = len + 6;
            const seen = new Set([key(sx, sz)]);
            const queue = [[sx, sz]];
            let count = 0;
            for (let qi = 0; qi < queue.length && count < cap; qi++) {
                const [x, z] = queue[qi];
                count++;
                for (const d of DIRS) {
                    const nx = x + d.x, nz = z + d.z;
                    if (this.isBlocked(nx, nz)) continue;
                    const k = key(nx, nz);
                    if (seen.has(k)) continue;
                    const bi = bodyIdx.get(k);
                    if (bi !== undefined && bi < len - 1) continue;
                    seen.add(k);
                    queue.push([nx, nz]);
                }
            }
            return count;
        }

        /** Time-aware BFS: body segments free up as the tail advances. */
        pathDist(sx, sz, bodyIdx, len) {
            if (!this.apple) return 9999;
            const target = key(this.apple.x, this.apple.z);
            if (key(sx, sz) === target) return 0;
            const seen = new Set([key(sx, sz)]);
            let frontier = [[sx, sz]];
            let step = 1;
            while (frontier.length && step < N * N) {
                const next = [];
                step++;
                for (const [x, z] of frontier) {
                    for (const d of DIRS) {
                        const nx = x + d.x, nz = z + d.z;
                        if (this.isBlocked(nx, nz)) continue;
                        const k = key(nx, nz);
                        if (seen.has(k)) continue;
                        const bi = bodyIdx.get(k);
                        if (bi !== undefined && step < len - bi) continue;
                        if (k === target) return step - 1;
                        seen.add(k);
                        next.push([nx, nz]);
                    }
                }
                frontier = next;
            }
            return 9999;
        }

        /* ============================ Invariants ============================ */

        checkInvariants() {
            const errs = [];
            if (!Array.isArray(this.snake) || this.snake.length < 3) errs.push('snake invalid');
            else {
                const seen = new Set();
                for (const s of this.snake) {
                    if (!Number.isFinite(s.x) || !Number.isFinite(s.z)) { errs.push('NaN in snake'); break; }
                    if (!inBounds(s.x, s.z)) errs.push(`snake out of bounds ${s.x},${s.z}`);
                    if (this.obstacleSet.has(key(s.x, s.z))) errs.push(`snake on obstacle ${s.x},${s.z}`);
                    const k = key(s.x, s.z);
                    if (seen.has(k) && this.invuln === 0) errs.push('snake overlaps itself');
                    seen.add(k);
                }
            }
            if (this.apple && (!inBounds(this.apple.x, this.apple.z) || this.obstacleSet.has(key(this.apple.x, this.apple.z)))) errs.push('apple invalid');
            if (!Number.isFinite(this.score) || this.score < 0) errs.push('score invalid');
            if (this.lives < 0 || this.lives > MAX_LIVES) errs.push('lives invalid');
            return errs;
        }

        /* ============================ Self test ============================= */

        static runHeadlessSimulation(levels = 3, maxTicksPerLevel = 8000) {
            const g = new Snake3DGame();
            g.headless = true;
            g.highScore = 0;
            g.bot = true;
            g.startLevel(1);
            const results = [];
            const violations = [];
            let ticks = 0;
            let ok = true;
            while (results.length < levels) {
                if (g.state === 'complete') {
                    results.push({
                        level: g.level, ticks: g.stats.ticks, apples: g.stats.apples,
                        livesLost: g.stats.livesLost, score: g.score, interval: +g.interval.toFixed(4)
                    });
                    ticks = 0;
                    if (results.length < levels) g.nextLevel();
                    continue;
                }
                if (g.state === 'gameover') { violations.push(`L${g.level}: game over`); ok = false; break; }
                g.tick();
                ticks++;
                const errs = g.checkInvariants();
                if (errs.length) { violations.push(`L${g.level}@${g.tickCount}: ${errs.join('; ')}`); ok = false; break; }
                if (ticks > maxTicksPerLevel) { violations.push(`L${g.level}: timeout`); ok = false; break; }
            }
            return { ok: ok && results.length === levels, results, violations };
        }

        static runSanityChecks(opts = {}) {
            const tests = [];
            const add = (name, fn) => {
                const t0 = performance.now();
                let ok = false, detail = '';
                try {
                    const r = fn();
                    ok = r === true || (!!r && r.ok === true);
                    detail = (r && r.detail) || (ok ? 'ok' : 'failed');
                } catch (e) {
                    detail = `Exception: ${e && e.message ? e.message : e}`;
                }
                tests.push({ Test: name, Ergebnis: ok ? 'PASS' : 'FAIL', Detail: detail, ms: +(performance.now() - t0).toFixed(2) });
            };
            const fresh = (setup) => {
                const g = new Snake3DGame();
                g.headless = true;
                g.highScore = 0;
                g.startLevel(1);
                g.obstacles = []; g.obstacleSet = new Set(); g.enemies = [];
                g.apple = { x: 8, z: 8 };
                if (setup) setup(g);
                return g;
            };
            const maxLevel = opts.quick ? 10 : 40;

            if (opts.live) {
                add('Init: Container/Renderer/Scene/Kamera', () => {
                    const g = opts.live;
                    return !!(g.container && g.renderer && g.scene && g.camera && g.clock && g.particles && g.ui.root);
                });
            }
            add(`Generator: Level 1-${maxLevel} lösbar`, () => {
                for (let l = 1; l <= maxLevel; l++) {
                    const p = Snake3DGame.validateLevel(l);
                    if (p.length) return { ok: false, detail: `L${l}: ${p[0]}` };
                }
                return true;
            });
            add('Generator: deterministisch', () =>
                JSON.stringify(Snake3DGame.generateLevel(7)) === JSON.stringify(Snake3DGame.generateLevel(7)));
            add('Skalierung: Speed +10%/Level, Dichte & Gegner steigen', () => {
                for (let l = 1; l < 30; l++) {
                    const a = Snake3DGame.levelParams(l), b = Snake3DGame.levelParams(l + 1);
                    if (b.interval > a.interval || b.obstacleCount < a.obstacleCount) return { ok: false, detail: `Level ${l}->${l + 1}` };
                }
                const ratio = Snake3DGame.levelParams(2).speedFactor / Snake3DGame.levelParams(1).speedFactor;
                const enemiesOk = Snake3DGame.levelParams(3).patrols === 0 && Snake3DGame.levelParams(4).patrols === 1 &&
                    Snake3DGame.levelParams(7).hunters === 0 && Snake3DGame.levelParams(8).hunters === 1;
                return Math.abs(ratio - 1.1) < 1e-9 && enemiesOk;
            });
            add('Apfel-Spawn: nie auf Hindernis/Schlange', () => {
                const g = fresh();
                g.loadLevel(15);
                for (let i = 0; i < 300; i++) {
                    g.spawnApple();
                    const a = g.apple;
                    if (!a || g.obstacleSet.has(key(a.x, a.z)) || g.snake.some(s => s.x === a.x && s.z === a.z)) return false;
                }
                return true;
            });
            add('Punkte: Apfel +10, Combo +20, Länge +1', () => {
                const g = fresh(s => { s.apple = { x: 1, z: 0 }; });
                g.tick();
                if (g.score !== 10 || g.snake.length !== 4) return { ok: false, detail: `score=${g.score} len=${g.snake.length}` };
                g.apple = { x: 2, z: 0 };
                g.tick();
                return { ok: g.score === 30 && g.combo === 2, detail: `score=${g.score} combo=${g.combo}` };
            });
            add('Kollision: Wand kostet Leben + Respawn', () => {
                const g = fresh(s => { s.snake = [{ x: HALF, z: 0 }, { x: HALF - 1, z: 0 }, { x: HALF - 2, z: 0 }]; });
                g.tick();
                return { ok: g.lives === MAX_LIVES - 1 && g.snake[0].x === 0, detail: `lives=${g.lives}` };
            });
            add('Kollision: Hindernis', () => {
                const g = fresh(s => { s.obstacles = [{ x: 1, z: 0 }]; s.obstacleSet = new Set([key(1, 0)]); });
                g.tick();
                return g.lives === MAX_LIVES - 1;
            });
            add('Kollision: Selbst-Biss', () => {
                const g = fresh(s => {
                    s.snake = [{ x: 0, z: 0 }, { x: 0, z: 1 }, { x: -1, z: 1 }, { x: -1, z: 0 }, { x: -1, z: -1 }];
                    s.dir = { x: -1, z: 0 };
                });
                g.tick();
                return g.lives === MAX_LIVES - 1;
            });
            add('Kein Tunneling: Gegner-Tausch erkannt', () => {
                const g = fresh(s => { s.enemies = [{ type: 'patrol', x: 1, z: 0, dx: -1, dz: 0, period: 1, px: 1, pz: 0 }]; });
                g.tick();
                return { ok: g.lives === MAX_LIVES - 1 && g.enemies.length === 0, detail: `lives=${g.lives}` };
            });
            add('Null-Safety: Pflichtfelder nach startLevel', () => {
                const g = fresh();
                return !!(g.snake.length && g.apple && g.obstacleSet && g.enemies && g.params && g.rng && g.dir);
            });
            add('Bot-Simulation (headless): 3 Level', () => {
                const r = Snake3DGame.runHeadlessSimulation(3);
                return { ok: r.ok, detail: r.ok ? r.results.map(x => `L${x.level}:${x.ticks}t`).join(' ') : (r.violations[0] || 'bot failed') };
            });

            const failed = tests.filter(t => t.Ergebnis !== 'PASS');
            if (!opts.silent || failed.length) {
                console.groupCollapsed(`[Snake3D] Sanity-Checks: ${tests.length - failed.length}/${tests.length} bestanden`);
                console.table(tests);
                console.groupEnd();
            }
            if (failed.length) console.warn('[Snake3D] Fehlgeschlagene Checks:', failed.map(f => f.Test));
            return { ok: failed.length === 0, tests };
        }

        startSelfTest(levels = 3) {
            if (!this.renderer) return;
            console.log('%c[Snake3D] Self-Test gestartet', 'color:#22d3ee;font-weight:bold');
            const sanity = Snake3DGame.runSanityChecks({ live: this });
            this.testRun = { target: levels, levels: [], sanity, startedAt: performance.now() };
            this.perf.frames = [];
            this.perf.render = [];
            this.bot = true;
            this.timeScale = 6;
            this.score = 0;
            this.lives = MAX_LIVES;
            this.loadLevel(1);
            this.beginIntro();
            this.toast('Self-Test (Bot) läuft', 'info');
        }

        finishSelfTest(failReason) {
            const run = this.testRun;
            if (!run) return;
            this.testRun = null;
            this.bot = false;
            this.timeScale = 1;

            const frames = this.perf.frames.slice().sort((a, b) => a - b);
            const avgMs = frames.length ? frames.reduce((a, b) => a + b, 0) / frames.length : 0;
            const rend = this.perf.render;
            const avgR = rend.length ? rend.reduce((a, b) => a + b, 0) / rend.length : 0;
            const p95 = frames.length ? frames[Math.floor(frames.length * 0.95)] : 0;
            const passed = !failReason && run.levels.length >= run.target && run.sanity.ok;

            console.group(`%c[Snake3D] Self-Test ${passed ? 'BESTANDEN' : 'FEHLGESCHLAGEN'}`, `color:${passed ? '#10b981' : '#f43f5e'};font-weight:bold`);
            if (failReason) console.warn(failReason);
            console.table(run.levels);
            console.table([{
                'Ø FPS': avgMs ? +(1000 / avgMs).toFixed(1) : 0,
                'Min FPS': frames.length ? +(1000 / frames[frames.length - 1]).toFixed(1) : 0,
                'p95 Frame (ms)': +p95.toFixed(2),
                'Ø Render (ms)': +avgR.toFixed(2),
                Frames: frames.length,
                'Dauer (s)': +((performance.now() - run.startedAt) / 1000).toFixed(1)
            }]);
            console.groupEnd();
            window.SNAKE3D_TEST_RESULT = { passed, levels: run.levels, failReason: failReason || null };

            this.toast(passed ? 'Self-Test bestanden ✔' : 'Self-Test fehlgeschlagen ✘', passed ? 'good' : 'bad');
            this.score = 0;
            this.lives = MAX_LIVES;
            this.loadLevel(1);
            this.setState('start');
        }

        /* ============================ UI (DOM) ============================== */

        buildUI() {
            const root = document.createElement('div');
            root.className = 'gui-root';
            root.innerHTML = `
                <div class="gui-header">
                    <div class="gui-left">
                        <span class="gui-title">NEON SNAKE 3D</span>
                        <span class="gui-level" data-ui="level">Level 01</span>
                    </div>
                    <div class="gui-center">
                        <div class="gui-score" data-ui="score">0</div>
                        <div class="gui-best" data-ui="best">BEST 0</div>
                    </div>
                    <div class="gui-right">
                        <div class="gui-bar" title="Äpfel"><i data-ui="bar"></i></div>
                        <div class="gui-hearts" data-ui="hearts"></div>
                        <button class="gui-icon-btn" data-ui="btn-pause" title="Pause (P)">❚❚</button>
                        <button class="gui-icon-btn" data-ui="btn-mute" title="Ton (M)">♪</button>
                    </div>
                </div>
                <div class="gui-toasts" data-ui="toasts"></div>
                <div class="gui-flash" data-ui="flash"></div>
                <div class="gui-overlay" data-ui="overlay"><div class="gui-modal" data-ui="modal"></div></div>`;
            this.container.appendChild(root);
            root.querySelectorAll('[data-ui]').forEach(el => { this.ui[el.dataset.ui] = el; });
            this.ui.root = root;

            this.ui['btn-pause'].onclick = () => this.togglePause();
            this.ui['btn-mute'].onclick = () => this.toggleMute();
        }

        showOverlay(kind) {
            const ov = this.ui.overlay, modal = this.ui.modal;
            if (!ov || !modal) return;
            if (!kind) { ov.classList.remove('active'); return; }

            const stats = `
                <div class="gui-stats">
                    <div class="gui-stat"><b>${this.score}</b><span>Score</span></div>
                    <div class="gui-stat"><b>${this.highScore}</b><span>Best</span></div>
                    <div class="gui-stat"><b>${pad2(this.level)}</b><span>Level</span></div>
                </div>`;
            let html = '';
            if (kind === 'start') {
                html = `<h2>NEON SNAKE 3D</h2>
                    <p>Sammle Energie-Orbs, weiche Blöcken und Drohnen aus.</p>
                    <p>WASD / Pfeiltasten · P Pause · M Ton · T Self-Test</p>
                    <div class="gui-actions">
                        <button class="gui-btn" data-act="play">Spielen</button>
                        <button class="gui-btn secondary" data-act="test">Auto-Test</button>
                    </div>`;
            } else if (kind === 'paused') {
                html = `<h2>PAUSE</h2>${stats}
                    <div class="gui-actions">
                        <button class="gui-btn" data-act="resume">Weiter</button>
                        <button class="gui-btn secondary" data-act="restart">Neustart</button>
                    </div>`;
            } else if (kind === 'gameover') {
                html = `<h2 style="color:#f43f5e">GAME OVER</h2>${stats}
                    <div class="gui-actions">
                        <button class="gui-btn" data-act="retry">Nochmal</button>
                        <button class="gui-btn secondary" data-act="restart">Von vorn</button>
                    </div>`;
            } else if (kind === 'complete') {
                const next = Snake3DGame.levelParams(this.level + 1);
                html = `<h2 style="color:#22d3ee">LEVEL ${pad2(this.level)} GESCHAFFT</h2>${stats}
                    <p>Bonus +${this.levelBonus} · Nächstes Level: +10% Tempo, ${next.obstacleCount} Blöcke${next.patrols ? ', Patrouillen' : ''}${next.hunters ? ', Jäger' : ''}</p>
                    <div class="gui-actions">
                        <button class="gui-btn" data-act="next">Nächstes Level ➔</button>
                    </div>`;
            }
            modal.innerHTML = html;
            modal.querySelectorAll('[data-act]').forEach(b => {
                b.onclick = () => this.handleAction(b.dataset.act);
            });
            ov.classList.add('active');
            const primary = modal.querySelector('.gui-btn');
            if (primary) primary.focus({ preventScroll: true });
        }

        handleAction(act) {
            if (window.AudioManager && AudioManager.playClick) AudioManager.playClick();
            switch (act) {
                case 'play': this.startPlay(); break;
                case 'test': this.startSelfTest(); break;
                case 'resume': this.togglePause(); break;
                case 'restart': this.startLevel(1); break;
                case 'retry': this.retry(); break;
                case 'next': this.nextLevel(); break;
            }
        }

        updateHUD() {
            const u = this.ui;
            if (!u.root) return;
            u.level.textContent = `Level ${pad2(this.level)}`;
            u.score.textContent = String(this.score);
            u.best.textContent = `BEST ${Math.max(this.highScore, this.score)}`;
            u.bar.style.width = `${clamp(this.applesEaten / this.params.targetApples, 0, 1) * 100}%`;
            let hearts = '';
            for (let i = 0; i < MAX_LIVES; i++) hearts += `<span class="gui-heart ${i < this.lives ? 'on' : ''}">♥</span>`;
            u.hearts.innerHTML = hearts;
            const muted = !!(window.AudioManager && AudioManager.muted);
            u['btn-mute'].textContent = muted ? '✕' : '♪';
            u['btn-pause'].textContent = this.state === 'paused' ? '▶' : '❚❚';
        }

        pulseHeart() {
            const hs = this.ui.hearts && this.ui.hearts.querySelectorAll('.gui-heart');
            if (!hs || !hs.length) return;
            const idx = clamp(this.lives, 0, hs.length - 1);
            hs[idx].classList.add('pop');
            this.after(250, () => hs[idx] && hs[idx].classList.remove('pop'));
        }

        toast(text, kind = 'info') {
            if (this.headless || !this.ui.toasts) return;
            const el = document.createElement('div');
            el.className = `gui-toast ${kind}`;
            el.textContent = text;
            this.ui.toasts.appendChild(el);
            while (this.ui.toasts.children.length > 3) this.ui.toasts.removeChild(this.ui.toasts.firstChild);
            this.after(1500, () => el.classList.add('out'));
            this.after(1900, () => el.remove());
        }

        flash() {
            const f = this.ui.flash;
            if (!f) return;
            f.classList.add('on');
            requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on')));
        }

        /* ============================== Input =============================== */

        bindEvents(canvas) {
            this.listen(window, 'resize', () => this.resize());
            this.listen(window, 'blur', () => { if (this.state === 'playing' && !this.testRun) this.togglePause(); });
            this.listen(window, 'keydown', (e) => this.onKey(e));

            let t0 = null;
            this.listen(canvas, 'touchstart', (e) => {
                const t = e.changedTouches[0];
                t0 = { x: t.clientX, y: t.clientY };
            }, { passive: true });
            this.listen(canvas, 'touchend', (e) => {
                if (!t0) return;
                const t = e.changedTouches[0];
                const dx = t.clientX - t0.x, dy = t.clientY - t0.y;
                t0 = null;
                if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
                if (Math.abs(dx) > Math.abs(dy)) this.queueDir(Math.sign(dx), 0);
                else this.queueDir(0, Math.sign(dy));
            }, { passive: true });
        }

        onKey(e) {
            const tag = e.target && e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            const map = {
                KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1],
                KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0]
            };
            if (map[e.code]) {
                if (e.code.startsWith('Arrow')) e.preventDefault();
                this.queueDir(map[e.code][0], map[e.code][1]);
                return;
            }
            switch (e.code) {
                case 'KeyP': case 'Escape': this.togglePause(); break;
                case 'KeyM': this.toggleMute(); break;
                case 'KeyT': if (!this.testRun && this.state !== 'paused') this.startSelfTest(); break;
                case 'Space': case 'Enter': {
                    if (e.code === 'Space') e.preventDefault();
                    const active = this.ui.overlay && this.ui.overlay.classList.contains('active');
                    const btn = active && this.ui.modal.querySelector('.gui-btn');
                    if (btn && document.activeElement !== btn) btn.click();
                    break;
                }
            }
        }

        queueDir(dx, dz) {
            if (this.state !== 'playing' || this.bot) return;
            const last = this.inputQueue.length ? this.inputQueue[this.inputQueue.length - 1] : this.dir;
            if (last.x === dx && last.z === dz) return;
            if (last.x === -dx && last.z === -dz) return;
            if (this.inputQueue.length < 2) this.inputQueue.push({ x: dx, z: dz });
        }

        /* ============================ 3D rendering ========================== */

        buildScene(canvas) {
            const w = Math.max(300, this.container.clientWidth || window.innerWidth);
            const h = Math.max(300, this.container.clientHeight || (window.innerHeight - 48));

            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x050816);
            this.scene.fog = new THREE.FogExp2(0x050816, 0.016);

            this.camera = new THREE.PerspectiveCamera(52, w / h, 0.1, 400);
            this.updateCameraBase();

            this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
            this.renderer.setSize(w, h);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

            this.clock = new THREE.Clock();

            this.scene.add(new THREE.HemisphereLight(0x7dd3fc, 0x1e1b4b, 0.8));
            const sun = new THREE.DirectionalLight(0xffffff, 0.7);
            sun.position.set(8, 22, 6);
            this.scene.add(sun);
            this.headLight = new THREE.PointLight(0x22d3ee, 1.4, 16);
            this.scene.add(this.headLight);

            const size = N * CELL;
            const floorGeo = new THREE.PlaneGeometry(size + 6, size + 6);
            const floorMat = new THREE.MeshStandardMaterial({ color: 0x0b1226, roughness: 0.85, metalness: 0.2 });
            const floor = new THREE.Mesh(floorGeo, floorMat);
            floor.rotation.x = -Math.PI / 2;
            floor.position.y = -0.55;
            this.scene.add(floor);

            const grid = new THREE.GridHelper(size, N, 0x4f46e5, 0x1e293b);
            grid.position.y = -0.53;
            this.scene.add(grid);

            const wallMat = new THREE.MeshStandardMaterial({ color: 0x4f46e5, emissive: 0x4338ca, emissiveIntensity: 0.9, roughness: 0.4 });
            const wallGeoH = new THREE.BoxGeometry(size + 0.6, 0.5, 0.3);
            const wallGeoV = new THREE.BoxGeometry(0.3, 0.5, size + 0.6);
            const off = size / 2 + 0.15;
            [[0, -off, wallGeoH], [0, off, wallGeoH], [-off, 0, wallGeoV], [off, 0, wallGeoV]].forEach(([x, z, g]) => {
                const m = new THREE.Mesh(g, wallMat);
                m.position.set(x, -0.2, z);
                this.scene.add(m);
            });

            this.geo = {
                seg: new THREE.BoxGeometry(1.25, 1.25, 1.25),
                obs: new THREE.BoxGeometry(1.35, 1.35, 1.35),
                apple: new THREE.IcosahedronGeometry(0.6, 1),
                patrol: new THREE.OctahedronGeometry(0.75),
                hunter: new THREE.TetrahedronGeometry(0.85)
            };
            const stdMat = (color, emissive, ei) => new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: ei, roughness: 0.3, metalness: 0.25 });
            this.mat = {
                head: stdMat(0x67e8f9, 0x0891b2, 0.9),
                body: [],
                obs: stdMat(0xf43f5e, 0x9f1239, 0.6),
                apple: stdMat(0x34d399, 0x059669, 1.0),
                patrol: stdMat(0xa78bfa, 0x6d28d9, 0.9),
                hunter: stdMat(0xfb923c, 0xc2410c, 0.9)
            };
            const c1 = new THREE.Color(0x22d3ee), c2 = new THREE.Color(0x6366f1);
            for (let i = 0; i < 12; i++) {
                const c = c1.clone().lerp(c2, i / 11);
                this.mat.body.push(stdMat(c, c.clone().multiplyScalar(0.55), 0.7));
            }
            [floorGeo, floorMat, wallMat, wallGeoH, wallGeoV, ...Object.values(this.geo),
                this.mat.head, this.mat.obs, this.mat.apple, this.mat.patrol, this.mat.hunter, ...this.mat.body]
                .forEach(d => this.disposables.push(d));

            this.obsGroup = new THREE.Group();
            this.scene.add(this.obsGroup);
            this.appleMesh = new THREE.Mesh(this.geo.apple, this.mat.apple);
            this.scene.add(this.appleMesh);

            this.initParticles(500);
        }

        rebuildEntityMeshes() {
            if (!this.scene) return;
            while (this.obsGroup.children.length) this.obsGroup.remove(this.obsGroup.children[0]);
            this.obstacles.forEach(o => {
                const m = new THREE.Mesh(this.geo.obs, this.mat.obs);
                m.position.set(o.x * CELL, 0.1, o.z * CELL);
                this.obsGroup.add(m);
            });
            this.snakeMeshes.forEach(m => this.scene.remove(m));
            this.snakeMeshes = [];
            this.rebuildEnemyMeshes();
        }

        rebuildEnemyMeshes() {
            if (!this.scene) return;
            this.enemyMeshes.forEach(m => this.scene.remove(m.mesh));
            this.enemyMeshes = this.enemies.map(e => {
                const hunter = e.type === 'hunter';
                const mesh = new THREE.Mesh(hunter ? this.geo.hunter : this.geo.patrol, hunter ? this.mat.hunter : this.mat.patrol);
                this.scene.add(mesh);
                return { enemy: e, mesh };
            });
        }

        /* ------------------------------ Particles ------------------------- */

        initParticles(cap) {
            const geo = new THREE.BufferGeometry();
            const pos = new Float32Array(cap * 3);
            const col = new Float32Array(cap * 3);
            for (let i = 0; i < cap; i++) pos[i * 3 + 1] = -1000;
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
            const mat = new THREE.PointsMaterial({
                size: 0.45, vertexColors: true, transparent: true, depthWrite: false,
                blending: THREE.AdditiveBlending
            });
            const points = new THREE.Points(geo, mat);
            points.frustumCulled = false;
            this.scene.add(points);
            this.disposables.push(geo, mat);
            this.particles = {
                cap, geo, pos, col, points, next: 0,
                vel: new Float32Array(cap * 3),
                life: new Float32Array(cap),
                maxLife: new Float32Array(cap),
                base: new Float32Array(cap * 3)
            };
        }

        burst(gx, gz, color, count, speed) {
            const P = this.particles;
            if (!P) return;
            const c = new THREE.Color(color);
            for (let n = 0; n < count; n++) {
                const i = P.next;
                P.next = (P.next + 1) % P.cap;
                const a = Math.random() * Math.PI * 2;
                const s = speed * (0.3 + Math.random() * 0.7);
                P.pos[i * 3] = gx * CELL;
                P.pos[i * 3 + 1] = 0.3;
                P.pos[i * 3 + 2] = gz * CELL;
                P.vel[i * 3] = Math.cos(a) * s;
                P.vel[i * 3 + 1] = Math.random() * s * 0.9;
                P.vel[i * 3 + 2] = Math.sin(a) * s;
                P.life[i] = P.maxLife[i] = 0.5 + Math.random() * 0.6;
                P.base[i * 3] = c.r; P.base[i * 3 + 1] = c.g; P.base[i * 3 + 2] = c.b;
            }
        }

        updateParticles(dt) {
            const P = this.particles;
            if (!P) return;
            for (let i = 0; i < P.cap; i++) {
                if (P.life[i] <= 0) continue;
                P.life[i] -= dt;
                if (P.life[i] <= 0) {
                    P.pos[i * 3 + 1] = -1000;
                    P.col[i * 3] = P.col[i * 3 + 1] = P.col[i * 3 + 2] = 0;
                    continue;
                }
                P.vel[i * 3 + 1] -= 14 * dt;
                P.pos[i * 3] += P.vel[i * 3] * dt;
                P.pos[i * 3 + 1] = Math.max(-0.4, P.pos[i * 3 + 1] + P.vel[i * 3 + 1] * dt);
                P.pos[i * 3 + 2] += P.vel[i * 3 + 2] * dt;
                const f = P.life[i] / P.maxLife[i];
                P.col[i * 3] = P.base[i * 3] * f;
                P.col[i * 3 + 1] = P.base[i * 3 + 1] * f;
                P.col[i * 3 + 2] = P.base[i * 3 + 2] * f;
            }
            P.geo.attributes.position.needsUpdate = true;
            P.geo.attributes.color.needsUpdate = true;
        }

        addTrauma(v) { this.trauma = Math.min(1, this.trauma + v); }

        /* ------------------------------ Frame loop ------------------------ */

        update(dt) {
            if (this.state === 'intro') {
                this.introT += dt * (this.testRun ? 8 : 1);
                if (this.introT >= INTRO_DURATION) {
                    this.introT = INTRO_DURATION;
                    this.setState('playing');
                }
            } else if (this.state === 'playing') {
                this.moveTimer += dt * this.timeScale;
                const cap = Math.max(4, Math.ceil(this.timeScale) + 1);
                let steps = 0;
                while (this.moveTimer >= this.interval && steps < cap && this.state === 'playing') {
                    this.tick();
                    this.moveTimer -= this.interval;
                    steps++;
                }
                if (steps >= cap) this.moveTimer = 0;
            }
            if (this.state !== 'paused') this.updateParticles(dt);
            this.headPulse = Math.max(0, this.headPulse - dt * 4);
            this.trauma = Math.max(0, this.trauma - dt * 1.6);
        }

        renderFrame(dt, now) {
            const alpha = this.state === 'playing' ? clamp(this.moveTimer / this.interval, 0, 1) : 1;
            const lerp = (a, b) => a + (b - a) * alpha;
            const intro = this.state === 'intro' ? easeOut(this.introT / INTRO_DURATION) : 1;

            while (this.snakeMeshes.length < this.snake.length) {
                const m = new THREE.Mesh(this.geo.seg, this.mat.head);
                this.scene.add(m);
                this.snakeMeshes.push(m);
            }
            while (this.snakeMeshes.length > this.snake.length) this.scene.remove(this.snakeMeshes.pop());
            const blink = this.invuln > 0 && Math.floor(now / 90) % 2 === 0;
            const tail = this.prevSnake[this.prevSnake.length - 1];
            this.snake.forEach((s, i) => {
                const p = this.prevSnake[i] || tail || s;
                const m = this.snakeMeshes[i];
                m.position.set(lerp(p.x, s.x) * CELL, 0.1, lerp(p.z, s.z) * CELL);
                m.material = i === 0 ? this.mat.head : this.mat.body[Math.min(i - 1, 11)];
                const sc = (i === 0 ? 1 + this.headPulse * 0.35 : 1 - Math.min(i, 12) * 0.012) * intro;
                m.scale.setScalar(Math.max(0.001, sc));
                m.visible = !blink;
            });
            const h = this.snakeMeshes[0];
            if (h) this.headLight.position.set(h.position.x, 2.5, h.position.z);

            this.enemyMeshes.forEach(({ enemy: e, mesh }) => {
                mesh.position.set(lerp(e.px, e.x) * CELL, 0.2 + Math.sin(now / 250 + e.x) * 0.15, lerp(e.pz, e.z) * CELL);
                mesh.rotation.y += dt * 2.5;
                mesh.rotation.x += dt * 1.2;
                mesh.scale.setScalar(Math.max(0.001, intro));
            });

            this.obsGroup.scale.set(1, Math.max(0.001, intro), 1);
            this.appleMesh.visible = !!this.apple;
            if (this.apple) {
                this.appleMesh.position.set(this.apple.x * CELL, 0.2 + Math.sin(now / 300) * 0.15, this.apple.z * CELL);
                this.appleMesh.rotation.y += dt * 2;
                this.appleMesh.scale.setScalar(Math.max(0.001, intro) * (1 + Math.sin(now / 200) * 0.06));
            }

            // intro dolly + screen shake
            const cb = this.camBase;
            const lift = (1 - intro) * 16;
            const sh = this.trauma * this.trauma;
            this.camera.position.set(
                cb.x + (Math.random() * 2 - 1) * sh * 0.9,
                cb.y + lift + (Math.random() * 2 - 1) * sh * 0.9,
                cb.z + lift * 0.4);
            this.camera.lookAt(0, 0, 0);
        }

        animate() {
            this.animId = requestAnimationFrame(this.animate);
            if (!this.renderer || this.isPaused) return;

            const t0 = performance.now();
            const dt = Math.min(this.clock.getDelta(), 0.1);
            this.update(dt);
            this.renderFrame(dt, t0);

            const r0 = performance.now();
            this.renderer.render(this.scene, this.camera);
            const t1 = performance.now();

            const P = this.perf;
            P.frames.push(t1 - P.last);
            P.render.push(t1 - r0);
            if (!this.testRun && P.frames.length > 300) { P.frames.shift(); P.render.shift(); }
            P.last = t1;
        }
    }

    window.Snake3DGame = Snake3DGame;
})();
