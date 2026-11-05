/**
 * Traffic Escape / Rush Hour - 2D Parking Lot Puzzle Game
 *
 * - Procedural, solver-verified levels (BFS guarantees solvability, gives the optimal "Par")
 * - Difficulty scaling: target Par, car count, trucks (Lv 4+), immovable rocks (Lv 8+)
 * - Unified glassmorphism UI (HUD, overlays, toasts) injected via JS
 * - Juice: particles, screen shake, smooth inertia, level transitions
 * - Self-test / autoplay bot: press [T] or set window.RUN_TESTS = true before init
 */
(function () {
    'use strict';

    const GRID = 6;
    const EXIT_ROW = 2;
    const TITLE = 'Rush Hour';
    const STORAGE_KEY = 'browsergames_rushhour_highscore';

    /* ------------------------------------------------------------------ *
     * Helpers
     * ------------------------------------------------------------------ */
    const now = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const pad = (n, w) => String(Math.max(0, Math.floor(n))).padStart(w, '0');
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

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

    function shade(hex, amt) {
        const n = parseInt(hex.slice(1), 16);
        const r = clamp(((n >> 16) & 255) + amt, 0, 255);
        const g = clamp(((n >> 8) & 255) + amt, 0, 255);
        const b = clamp((n & 255) + amt, 0, 255);
        return `rgb(${r},${g},${b})`;
    }

    /* ------------------------------------------------------------------ *
     * Solver (BFS over slide-moves; one move = sliding one car any distance)
     * ------------------------------------------------------------------ */
    function solve(vehicles, maxStates = 8000) {
        const n = vehicles.length;
        const redIdx = vehicles.findIndex(v => v.isRed);
        if (redIdx < 0) return { solvable: false, moves: 0, path: [], exhausted: true };

        const horiz = vehicles.map(v => v.dir === 'H');
        const lens = vehicles.map(v => v.len);
        const fixedCoord = vehicles.map(v => (v.dir === 'H' ? v.y : v.x));
        const movable = vehicles.map(v => !v.fixed);
        const start = vehicles.map(v => (v.dir === 'H' ? v.x : v.y));

        if (start[redIdx] >= GRID - 2) return { solvable: true, moves: 0, path: [], exhausted: false };

        const cell = (i, pos) => (horiz[i] ? fixedCoord[i] * GRID + pos : pos * GRID + fixedCoord[i]);
        const startKey = start.join('');
        const parent = new Map();
        parent.set(startKey, null);
        const queue = [start];
        let head = 0;
        const occ = new Uint8Array(GRID * GRID);

        while (head < queue.length) {
            const p = queue[head++];
            const pKey = p.join('');
            occ.fill(0);
            for (let i = 0; i < n; i++) {
                for (let k = 0; k < lens[i]; k++) occ[cell(i, p[i] + k)] = 1;
            }
            for (let i = 0; i < n; i++) {
                if (!movable[i]) continue;
                for (let dir = -1; dir <= 1; dir += 2) {
                    let q = p[i];
                    for (;;) {
                        const nq = q + dir;
                        if (nq < 0 || nq + lens[i] > GRID) break;
                        const lead = dir > 0 ? nq + lens[i] - 1 : nq;
                        if (occ[cell(i, lead)]) break;
                        q = nq;
                        const np = p.slice();
                        np[i] = q;
                        const key = np.join('');
                        if (parent.has(key)) continue;
                        parent.set(key, { prev: pKey, i, to: q });
                        if (i === redIdx && q >= GRID - 2) {
                            return finish(key);
                        }
                        if (parent.size > maxStates) {
                            return { solvable: false, moves: 0, path: [], exhausted: false };
                        }
                        queue.push(np);
                    }
                }
            }
        }
        return { solvable: false, moves: 0, path: [], exhausted: true };

        function finish(goalKey) {
            const path = [];
            let key = goalKey;
            while (parent.get(key)) {
                const e = parent.get(key);
                path.push({ id: vehicles[e.i].id, to: e.to });
                key = e.prev;
            }
            path.reverse();
            return { solvable: true, moves: path.length, path, exhausted: false };
        }
    }

    function validateLayout(vehicles) {
        const errors = [];
        const occ = new Map();
        let reds = 0;
        for (const v of vehicles) {
            if (v.isRed) reds++;
            if (!Number.isInteger(v.x) || !Number.isInteger(v.y) || !(v.len >= 1)) {
                errors.push(`${v.id}: invalid coordinates`);
                continue;
            }
            for (let k = 0; k < v.len; k++) {
                const cx = v.dir === 'H' ? v.x + k : v.x;
                const cy = v.dir === 'V' ? v.y + k : v.y;
                if (cx < 0 || cy < 0 || cx >= GRID || cy >= GRID) errors.push(`${v.id}: out of bounds`);
                const key = cx + ',' + cy;
                if (occ.has(key)) errors.push(`${v.id} overlaps ${occ.get(key)} at ${key}`);
                occ.set(key, v.id);
            }
        }
        if (reds !== 1) errors.push(`expected exactly one red car, found ${reds}`);
        return errors;
    }

    /* ------------------------------------------------------------------ *
     * Procedural level generator
     * ------------------------------------------------------------------ */
    function levelParams(level) {
        return {
            level,
            targetPar: Math.min(16, 2 + Math.round(level * 0.8)),
            cars: Math.min(11, 4 + Math.floor(level / 3)),
            laneBlockers: Math.min(3, 1 + Math.floor(level / 6)),
            trucks: level >= 4,
            truckChance: Math.min(0.45, 0.1 + level * 0.02),
            rocks: level >= 8 ? Math.min(3, 1 + Math.floor((level - 8) / 6)) : 0
        };
    }

    function fallbackLayout() {
        return [
            { id: 'red', isRed: true, x: 0, y: EXIT_ROW, len: 2, dir: 'H' },
            { id: 'c0', x: 3, y: 1, len: 2, dir: 'V' },
            { id: 'c1', x: 0, y: 4, len: 2, dir: 'H' }
        ];
    }

    function tryGenerate(params, rnd) {
        const grid = new Uint8Array(GRID * GRID);
        const vehicles = [];
        const free = (v) => {
            for (let k = 0; k < v.len; k++) {
                const cx = v.dir === 'H' ? v.x + k : v.x;
                const cy = v.dir === 'V' ? v.y + k : v.y;
                if (cx < 0 || cy < 0 || cx >= GRID || cy >= GRID || grid[cy * GRID + cx]) return false;
            }
            return true;
        };
        const place = (v) => {
            for (let k = 0; k < v.len; k++) {
                const cx = v.dir === 'H' ? v.x + k : v.x;
                const cy = v.dir === 'V' ? v.y + k : v.y;
                grid[cy * GRID + cx] = 1;
            }
            vehicles.push(v);
        };
        const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));

        const red = { id: 'red', isRed: true, x: ri(0, 1), y: EXIT_ROW, len: 2, dir: 'H' };
        place(red);

        let idx = 0;
        // Cars that cross the exit lane make the puzzle non-trivial
        const cols = [];
        for (let c = red.x + 2; c < GRID; c++) cols.push(c);
        for (let i = cols.length - 1; i > 0; i--) {
            const j = ri(0, i);
            [cols[i], cols[j]] = [cols[j], cols[i]];
        }
        for (let b = 0; b < params.laneBlockers && b < cols.length; b++) {
            const len = params.trucks && rnd() < params.truckChance ? 3 : 2;
            const minY = Math.max(0, EXIT_ROW - len + 1);
            const maxY = Math.min(EXIT_ROW, GRID - len);
            const car = { id: 'c' + idx, x: cols[b], y: ri(minY, maxY), len, dir: 'V' };
            if (free(car)) { place(car); idx++; }
        }

        let guard = 0;
        while (vehicles.length - 1 < params.cars && guard++ < 120) {
            const dir = rnd() > 0.5 ? 'V' : 'H';
            const len = params.trucks && rnd() < params.truckChance ? 3 : 2;
            const car = {
                id: 'c' + idx,
                x: ri(0, dir === 'H' ? GRID - len : GRID - 1),
                y: ri(0, dir === 'V' ? GRID - len : GRID - 1),
                len, dir
            };
            if (dir === 'H' && car.y === EXIT_ROW) continue; // exit row stays reserved for the red car
            if (free(car)) { place(car); idx++; }
        }

        for (let r = 0, g2 = 0; r < params.rocks && g2 < 60; g2++) {
            const rock = { id: 'r' + r, x: ri(0, GRID - 1), y: ri(0, GRID - 1), len: 1, dir: 'H', fixed: true, kind: 'rock' };
            if (rock.y === EXIT_ROW) continue;
            if (free(rock)) { place(rock); r++; }
        }
        return vehicles;
    }

    // Grows a solvable layout by adding / relocating cars. Every accepted step is re-verified by
    // the solver, so the result stays solvable while its optimal move count (Par) grows to the target.
    function hillClimb(best, params, rnd) {
        const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
        for (let i = 0; i < 150 && best.sol.moves < params.targetPar; i++) {
            const cand = best.vehicles.map(v => ({ ...v }));
            const cars = cand.filter(v => !v.fixed && !v.isRed);
            const rocks = cand.filter(v => v.fixed);
            const r = rnd();
            if (rocks.length < params.rocks && r < 0.15) {
                cand.push({ id: 'r' + rocks.length, x: ri(0, GRID - 1), y: ri(0, GRID - 1), len: 1, dir: 'H', fixed: true, kind: 'rock' });
            } else if (cars.length < params.cars && r < 0.65) {
                const dir = rnd() > 0.5 ? 'V' : 'H';
                const len = params.trucks && rnd() < params.truckChance ? 3 : 2;
                cand.push({
                    id: 'c' + i,
                    x: ri(0, dir === 'H' ? GRID - len : GRID - 1),
                    y: ri(0, dir === 'V' ? GRID - len : GRID - 1),
                    len, dir
                });
            } else if (cars.length) {
                const v = cars[ri(0, cars.length - 1)];
                if (v.dir === 'H') v.x = ri(0, GRID - v.len); else v.y = ri(0, GRID - v.len);
            }
            if (validateLayout(cand).length) continue;
            const sol = solve(cand, 6000);
            if (sol.solvable && sol.moves >= best.sol.moves) best = { vehicles: cand, sol };
        }
        return best;
    }
    const levelCache = new Map();

    function generateLevel(level) {
        level = Math.max(1, Math.floor(level) || 1);
        if (levelCache.has(level)) return levelCache.get(level);

        const params = levelParams(level);
        let best = null;
        for (let attempt = 0, climbed = 0; attempt < 24 && climbed < 4 && !(best && best.sol.moves >= params.targetPar); attempt++) {
            const rnd = mulberry32(level * 7919 + attempt * 104729 + 13);
            const vehicles = tryGenerate({ ...params, cars: 0, rocks: 0 }, rnd);
            if (validateLayout(vehicles).length) continue;
            const sol = solve(vehicles, 8000);
            if (!sol.solvable || sol.moves < 1) continue;
            const grown = hillClimb({ vehicles, sol }, params, rnd);
            climbed++;
            if (!best || grown.sol.moves > best.sol.moves) best = grown;
        }
        if (!best) {
            const vehicles = fallbackLayout();
            best = { vehicles, sol: solve(vehicles, 8000), diff: 0 };
        }
        const result = { level, params, vehicles: best.vehicles, par: best.sol.moves, solution: best.sol.path };
        levelCache.set(level, result);
        return result;
    }

    /* ------------------------------------------------------------------ *
     * UI styles (shared design system, injected once)
     * ------------------------------------------------------------------ */
    const UI_CSS = `
.gs-root{position:absolute;inset:0;pointer-events:none;font-family:'Inter','Segoe UI',system-ui,-apple-system,sans-serif;color:#f1f5f9;user-select:none;-webkit-user-select:none}
.gs-glass{background:rgba(15,23,42,0.75);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.1);border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,0.35)}
.gs-hud{position:absolute;top:8px;left:8px;right:8px;height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;gap:12px;pointer-events:auto;z-index:5}
.gs-hud-left{display:flex;flex-direction:column;line-height:1.15;min-width:110px}
.gs-title{font-weight:700;font-size:14px;letter-spacing:.04em}
.gs-level{font-size:12px;color:#22d3ee;font-weight:600;letter-spacing:.08em}
.gs-hud-mid{display:flex;flex-direction:column;align-items:center;line-height:1.15;text-align:center}
.gs-score{font-size:18px;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:.05em}
.gs-sub{font-size:11px;color:#94a3b8;font-variant-numeric:tabular-nums}
.gs-hud-right{display:flex;align-items:center;gap:8px;min-width:110px;justify-content:flex-end}
.gs-hearts{display:flex;gap:2px;font-size:16px;color:#f43f5e;margin-right:4px}
.gs-hearts .off{color:rgba(255,255,255,0.18)}
.gs-icon-btn{width:30px;height:30px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#f1f5f9;cursor:pointer;font-size:14px;transition:background .15s,transform .1s}
.gs-icon-btn:hover{background:rgba(99,102,241,0.35)}
.gs-icon-btn:active{transform:scale(.92)}
.gs-overlay{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(2,6,23,0.55);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);pointer-events:auto;z-index:10}
.gs-overlay.active{display:flex;animation:gs-fade .25s ease-out}
.gs-modal{padding:28px 34px;min-width:260px;max-width:min(420px,88%);text-align:center;animation:gs-pop .3s cubic-bezier(.2,1.2,.4,1)}
.gs-modal h2{margin:0 0 8px;font-size:26px;letter-spacing:.06em;background:linear-gradient(90deg,#818cf8,#22d3ee);-webkit-background-clip:text;background-clip:text;color:transparent}
.gs-modal.bad h2{background:linear-gradient(90deg,#fb7185,#f59e0b);-webkit-background-clip:text;background-clip:text}
.gs-modal p{margin:4px 0;color:#cbd5e1;font-size:14px;line-height:1.5}
.gs-actions{display:flex;gap:10px;justify-content:center;margin-top:20px;flex-wrap:wrap}
.gs-btn{padding:10px 20px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.08);color:#f1f5f9;font-weight:600;font-size:14px;cursor:pointer;transition:transform .12s,box-shadow .15s,background .15s}
.gs-btn:hover{background:rgba(255,255,255,0.16);transform:translateY(-1px)}
.gs-btn:active{transform:scale(.95)}
.gs-btn.primary{background:linear-gradient(135deg,#6366f1,#06b6d4);border-color:transparent;box-shadow:0 4px 18px rgba(99,102,241,0.45)}
.gs-btn.primary:hover{box-shadow:0 6px 24px rgba(34,211,238,0.5);background:linear-gradient(135deg,#7c83ff,#22d3ee)}
.gs-toasts{position:absolute;top:70px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:8px;z-index:8}
.gs-toast{padding:8px 18px;font-weight:700;font-size:15px;letter-spacing:.05em;animation:gs-toast 1.6s ease-out forwards}
.gs-toast.good{color:#22d3ee}.gs-toast.warn{color:#fbbf24}.gs-toast.bad{color:#fb7185}
@keyframes gs-fade{from{opacity:0}to{opacity:1}}
@keyframes gs-pop{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes gs-toast{0%{opacity:0;transform:translateY(-12px) scale(.9)}12%{opacity:1;transform:translateY(0) scale(1)}80%{opacity:1}100%{opacity:0;transform:translateY(-8px)}}
@media (max-width:560px){.gs-hud{padding:0 8px}.gs-title{font-size:12px}.gs-score{font-size:15px}.gs-hud-left,.gs-hud-right{min-width:0}}
`;

    function injectStyles() {
        if (typeof document === 'undefined' || !document.head || typeof document.getElementById !== 'function') return;
        if (document.getElementById('gs-ui-style')) return;
        const st = document.createElement('style');
        st.id = 'gs-ui-style';
        st.textContent = UI_CSS;
        document.head.appendChild(st);
    }

    /* ------------------------------------------------------------------ *
     * Game
     * ------------------------------------------------------------------ */
    class RushHourGame {
        constructor() {
            this.container = null;
            this.canvas = null;
            this.ctx = null;
            this.animId = null;
            this.isPaused = false;
            this.destroyed = false;

            this.gridSize = GRID;
            this.cellSize = 70;
            this.boardOffset = { x: 50, y: 50 };

            this.vehicles = [];
            this.selectedVehicle = null;
            this.dragOffset = 0;
            this.startPos = 0;
            this.bumped = false;

            this.moves = 0;
            this.par = 0;
            this.moveLimit = 0;
            this.history = [];
            this.currentLevel = 1;
            this.difficulty = 'Einfach';
            this.hasWon = false;
            this.state = 'ready'; // ready | playing | complete | over

            this.score = 0;
            this.levelStartScore = 0;
            this.comboPoints = 0;
            this.combo = 0;
            this.best = this.loadBest();

            this.particles = [];
            this.shake = 0;
            this.fade = 1;
            this.time = 0;
            this.lastTs = 0;
            this.timers = [];
            this.listeners = [];
            this.renderErrorLogged = false;

            this.testMode = false;
            this.botActive = false;
            this.perf = { frames: 0, renderMs: 0, maxRenderMs: 0, t0: 0 };

            this.vehicleColors = [
                '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
                '#06b6d4', '#64748b', '#ec4899', '#84cc16'
            ];
            this.render = this.render.bind(this);
        }

        /* ------------------------------ setup ------------------------------ */
        init(container, options = {}) {
            this.container = container;
            this.container.innerHTML = '';
            this.destroyed = false;
            injectStyles();
            if (this.container.style && !this.container.style.position) this.container.style.position = 'relative';

            this.canvas = document.createElement('canvas');
            this.canvas.className = 'game-canvas';
            if (this.canvas.style) this.canvas.style.touchAction = 'none';
            this.ctx = this.canvas.getContext('2d');
            this.container.appendChild(this.canvas);

            const root = document.createElement('div');
            root.className = 'gs-root';
            root.innerHTML = `
                <div class="gs-hud gs-glass">
                    <div class="gs-hud-left">
                        <span class="gs-title">${TITLE}</span>
                        <span class="gs-level" data-ui="level">Level 01</span>
                    </div>
                    <div class="gs-hud-mid">
                        <span class="gs-score" data-ui="score">000000</span>
                        <span class="gs-sub" data-ui="sub">Best 000000</span>
                    </div>
                    <div class="gs-hud-right">
                        <span class="gs-hearts" data-ui="hearts"></span>
                        <button class="gs-icon-btn" data-act="undo" title="Undo (Z)">↶</button>
                        <button class="gs-icon-btn" data-act="reset" title="Reset (R)">↺</button>
                        <button class="gs-icon-btn" data-act="mute" title="Mute (M)" data-ui="mute">🔊</button>
                        <button class="gs-icon-btn" data-act="pause" title="Pause (P)">⏸</button>
                    </div>
                </div>
                <div class="gs-toasts" data-ui="toasts"></div>
                <div class="gs-overlay" data-ui="overlay"></div>
            `;
            this.container.appendChild(root);
            const q = (s) => root.querySelector(`[data-ui="${s}"]`);
            this.ui = {
                root,
                level: q('level'), score: q('score'), sub: q('sub'), hearts: q('hearts'),
                mute: q('mute'), toasts: q('toasts'), overlay: q('overlay')
            };

            this.bindEvents(root);
            this.resize();

            this.state = 'ready';
            this.score = 0;
            this.startLevel(options.levelIndex || 1, options.difficulty || 'Einfach');
            this.showOverlay('start');

            if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => this.resize());
            this.lastTs = now();
            this.animId = requestAnimationFrame(this.render);

            if (typeof window !== 'undefined' && window.RUN_TESTS === true) {
                this.timers.push(setTimeout(() => this.runSelfTest(), 50));
            }
        }

        resize() {
            if (!this.container || !this.canvas) return;
            const rect = this.container.getBoundingClientRect();
            const w = rect.width > 50 ? rect.width : ((typeof window !== 'undefined' && window.innerWidth) || 800);
            const h = rect.height > 50 ? rect.height : (((typeof window !== 'undefined' && window.innerHeight) || 648) - 48);

            this.canvas.width = w;
            this.canvas.height = h;

            const hudH = 64;
            const maxBoard = Math.min(w - 32, h - hudH - 32, 520);
            this.cellSize = Math.max(30, Math.floor(maxBoard / GRID));
            const boardSize = this.cellSize * GRID;
            this.boardOffset.x = Math.floor((w - boardSize) / 2);
            this.boardOffset.y = hudH + Math.max(8, Math.floor((h - hudH - boardSize) / 2));
        }

        /* ------------------------------ levels ------------------------------ */
        startLevel(levelIndex = 1, difficulty = this.difficulty) {
            this.currentLevel = Math.max(1, Math.floor(levelIndex) || 1);
            this.difficulty = difficulty;
            this.moves = 0;
            this.history = [];
            this.hasWon = false;
            this.selectedVehicle = null;
            this.combo = 0;
            this.comboPoints = 0;
            this.levelStartScore = this.score;
            this.fade = 1;

            if (this.state !== 'ready') this.state = 'playing';
            if (this.state === 'playing') this.hideOverlay();

            this.buildLevel(this.currentLevel);
            this.updateHUD();
        }

        buildLevel(level) {
            const gen = generateLevel(level);
            this.levelData = gen;
            this.vehicles = JSON.parse(JSON.stringify(gen.vehicles));
            this.par = gen.par;
            this.moveLimit = Math.ceil(gen.par * 2.2) + 6;

            let cIdx = 0;
            this.vehicles.forEach(v => {
                if (v.isRed) v.color = '#ef4444';
                else if (v.fixed) v.color = '#475569';
                else { v.color = this.vehicleColors[cIdx % this.vehicleColors.length]; cIdx++; }
                v.rx = v.x;
                v.ry = v.y;
            });
        }

        nextLevel() {
            this.state = 'playing';
            this.startLevel(this.currentLevel + 1);
            this.toast(`Level ${pad(this.currentLevel, 2)}`, 'good');
        }

        startGame() {
            if (this.state === 'ready') {
                this.state = 'playing';
                this.hideOverlay();
                this.fade = 1;
            }
        }

        retryLevel() {
            this.score = this.levelStartScore;
            this.state = 'playing';
            this.startLevel(this.currentLevel);
        }

        static levelScore({ level, moves, par, limit }) {
            return 500 + 50 * level + Math.max(0, limit - moves) * 10 + (moves <= par ? 300 : 0);
        }

        /* ------------------------------ input ------------------------------ */
        canInput() {
            return this.state === 'playing' && !this.isPaused && !this.botActive && !this.hasWon;
        }

        bindEvents(root) {
            const on = (target, type, fn, opts) => {
                if (!target || !target.addEventListener) return;
                target.addEventListener(type, fn, opts);
                this.listeners.push({ target, type, fn, opts });
            };

            const getPos = (e) => {
                const rect = this.canvas.getBoundingClientRect();
                const t = e.touches && e.touches.length ? e.touches[0] : (e.changedTouches && e.changedTouches[0]) || e;
                return { x: t.clientX - rect.left, y: t.clientY - rect.top };
            };

            const onDown = (e) => {
                if (!this.canInput()) return;
                const pos = getPos(e);
                const gx = (pos.x - this.boardOffset.x) / this.cellSize;
                const gy = (pos.y - this.boardOffset.y) / this.cellSize;
                for (const v of this.vehicles) {
                    if (v.fixed) continue;
                    const w = v.dir === 'H' ? v.len : 1;
                    const h = v.dir === 'V' ? v.len : 1;
                    if (gx >= v.x && gx < v.x + w && gy >= v.y && gy < v.y + h) {
                        this.grab(v, v.dir === 'H' ? gx - v.x : gy - v.y);
                        break;
                    }
                }
            };

            const onMove = (e) => {
                const v = this.selectedVehicle;
                if (!v || !this.canInput()) return;
                const pos = getPos(e);
                const raw = v.dir === 'H'
                    ? (pos.x - this.boardOffset.x) / this.cellSize
                    : (pos.y - this.boardOffset.y) / this.cellSize;
                this.dragTo(raw - this.dragOffset);
            };

            const onUp = () => { if (this.selectedVehicle) this.release(); };

            on(this.canvas, 'mousedown', onDown);
            on(window, 'mousemove', onMove);
            on(window, 'mouseup', onUp);
            on(this.canvas, 'touchstart', onDown, { passive: true });
            on(window, 'touchmove', onMove, { passive: true });
            on(window, 'touchend', onUp);
            on(window, 'resize', () => this.resize());

            const act = (name) => {
                if (window.AudioManager && window.AudioManager.playClick && name !== 'mute') window.AudioManager.playClick();
                switch (name) {
                    case 'undo': this.undo(); break;
                    case 'reset': if (this.state === 'playing' || this.state === 'over') { this.state = 'playing'; this.score = this.levelStartScore; this.startLevel(this.currentLevel); } break;
                    case 'mute': this.toggleMute(); break;
                    case 'pause': this.userPause(); break;
                    case 'start': this.startGame(); break;
                    case 'resume': this.resume(); break;
                    case 'restart': this.score = this.levelStartScore; this.state = 'playing'; this.startLevel(this.currentLevel); break;
                    case 'next': this.nextLevel(); break;
                    case 'retry': this.retryLevel(); break;
                    case 'test': this.runSelfTest(); break;
                }
            };
            on(root, 'click', (e) => {
                const el = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
                if (el) act(el.getAttribute('data-act'));
            });

            on(window, 'keydown', (e) => {
                const tag = e.target && e.target.tagName ? e.target.tagName.toUpperCase() : '';
                if (tag === 'INPUT' || tag === 'TEXTAREA') return;
                const k = (e.key || '').toLowerCase();
                if (k === 't') this.runSelfTest();
                else if (k === 'p' || k === 'escape') this.userPause();
                else if (k === 'm') this.toggleMute();
                else if (k === 'z') this.undo();
                else if (k === 'r') act('reset');
                else if ((k === 'enter' || k === ' ') && this.state === 'ready') this.startGame();
            });
        }

        buildOccupancy(skip) {
            const occ = new Array(GRID * GRID).fill(null);
            for (const o of this.vehicles) {
                if (o === skip) continue;
                const ox = Math.round(o.x), oy = Math.round(o.y);
                for (let k = 0; k < o.len; k++) {
                    const cx = o.dir === 'H' ? ox + k : ox;
                    const cy = o.dir === 'V' ? oy + k : oy;
                    if (cx >= 0 && cy >= 0 && cx < GRID && cy < GRID) occ[cy * GRID + cx] = o;
                }
            }
            return occ;
        }

        // Continuous free range for a vehicle (cell-based sweep => no tunneling)
        getLimits(target) {
            const occ = this.buildOccupancy(target);
            const horiz = target.dir === 'H';
            const fixedC = horiz ? Math.round(target.y) : Math.round(target.x);
            const pos = Math.round(horiz ? target.x : target.y);
            const cellAt = (p) => (horiz ? occ[fixedC * GRID + p] : occ[p * GRID + fixedC]);
            let min = pos;
            while (min - 1 >= 0 && !cellAt(min - 1)) min--;
            let max = pos;
            while (max + target.len < GRID && !cellAt(max + target.len)) max++;
            return { min, max };
        }

        grab(v, offset) {
            this.selectedVehicle = v;
            this.dragOffset = offset;
            this.startPos = Math.round(v.dir === 'H' ? v.x : v.y);
            this.bumped = false;
            this._reachBefore = this.reach();
            if (window.AudioManager && window.AudioManager.playSelect) window.AudioManager.playSelect();
        }

        dragTo(pos) {
            const v = this.selectedVehicle;
            if (!v) return;
            const lim = this.getLimits(v);
            const c = clamp(pos, lim.min, lim.max);
            if (v.dir === 'H') v.x = c; else v.y = c;
            const hitWall = Math.abs(pos - c) > 0.15;
            if (hitWall && !this.bumped) {
                this.bumped = true;
                this.bump(v, pos > c ? 1 : -1);
            } else if (!hitWall) {
                this.bumped = false;
            }
        }

        release() {
            const v = this.selectedVehicle;
            if (!v) return;
            const lim = this.getLimits(v);
            const raw = v.dir === 'H' ? v.x : v.y;
            const target = clamp(Math.round(raw), lim.min, lim.max);
            if (v.dir === 'H') v.x = target; else v.y = target;
            this.selectedVehicle = null;

            if (target !== this.startPos) this.commitMove(v, this.startPos, target);
        }

        reach() {
            const red = this.vehicles.find(v => v.isRed);
            if (!red) return 0;
            const occ = this.buildOccupancy(red);
            let end = Math.round(red.x) + red.len;
            while (end < GRID && !occ[EXIT_ROW * GRID + end]) end++;
            return end;
        }

        commitMove(v, from, to, reachBefore) {
            const before = reachBefore !== undefined ? reachBefore : this._reachBefore;
            const after = this.reach();
            const prevCombo = this.combo;
            let pts = 0;
            if (before !== undefined && after > before) {
                this.combo++;
                if (this.combo >= 2) {
                    pts = 50 * this.combo;
                    this.toast(`Combo x${this.combo}  +${pts}`, 'good');
                }
            } else if (before !== undefined && after < before) {
                this.combo = 0;
            }
            this.score += pts;
            this.comboPoints += pts;

            this.moves++;
            this.history.push({ id: v.id, from, to, dir: v.dir, pts, prevCombo });
            this.emitDust(v, from, to);
            if (window.AudioManager && window.AudioManager.playCarSlide) window.AudioManager.playCarSlide();

            if (v.isRed && to >= GRID - 2) {
                this.triggerWin();
            } else if (this.moves >= this.moveLimit) {
                this.triggerGameOver();
            }
            this.updateHUD();
            this._reachBefore = this.reach();
        }

        undo() {
            if (this.history.length === 0 || this.hasWon || this.state !== 'playing') return;
            const last = this.history.pop();
            const v = this.vehicles.find(item => item.id === last.id);
            if (!v) return;
            if (last.dir === 'H') v.x = last.from; else v.y = last.from;
            this.moves--;
            this.score -= last.pts;
            this.comboPoints -= last.pts;
            this.combo = last.prevCombo;
            this._reachBefore = this.reach();
            this.updateHUD();
            if (window.AudioManager && window.AudioManager.playClick) window.AudioManager.playClick();
        }

        /* ------------------------------ game flow ------------------------------ */
        triggerWin() {
            this.hasWon = true;
            this.state = 'complete';
            const bonus = RushHourGame.levelScore({ level: this.currentLevel, moves: this.moves, par: this.par, limit: this.moveLimit });
            this.lastBonus = bonus;
            this.score += bonus;
            const red = this.vehicles.find(v => v.isRed);
            if (red) red.x = GRID + 1;
            this.saveBest();
            this.confetti();
            this.shake = Math.max(this.shake, 6);
            if (window.AudioManager && window.AudioManager.playWin) window.AudioManager.playWin();
            this.toast(this.moves <= this.par ? 'Perfekt! Par erreicht' : 'Level Up!', 'good');
            this.updateHUD();
            this.timers.push(setTimeout(() => {
                if (this.state === 'complete' && !this.botActive) this.showOverlay('complete');
            }, 450));
        }

        triggerGameOver() {
            this.state = 'over';
            this.shake = Math.max(this.shake, 10);
            if (window.AudioManager && window.AudioManager.playHit) window.AudioManager.playHit();
            this.saveBest();
            this.timers.push(setTimeout(() => {
                if (this.state === 'over') this.showOverlay('over');
            }, 300));
        }

        userPause() {
            if (this.state !== 'playing' && !this.isPaused) return;
            if (this.isPaused) { this.resume(); return; }
            this.isPaused = true;
            this.showOverlay('pause');
        }

        pause() { this.isPaused = true; }

        resume() {
            this.isPaused = false;
            if (this.overlayKind === 'pause') this.hideOverlay();
            this.lastTs = now();
        }

        toggleMute() {
            if (!window.AudioManager || !window.AudioManager.toggleMute) return;
            const muted = window.AudioManager.toggleMute();
            if (this.ui && this.ui.mute) this.ui.mute.textContent = muted ? '🔇' : '🔊';
        }

        loadBest() {
            try { return parseInt(window.localStorage.getItem(STORAGE_KEY), 10) || 0; } catch (e) { return 0; }
        }

        saveBest() {
            if (this.testMode) return;
            if (this.score > this.best) {
                this.best = this.score;
                try { window.localStorage.setItem(STORAGE_KEY, String(this.best)); } catch (e) { /* storage unavailable */ }
            }
        }

        /* ------------------------------ UI ------------------------------ */
        updateHUD() {
            if (!this.ui) return;
            const ratio = this.moveLimit ? this.moves / this.moveLimit : 0;
            const hearts = ratio < 0.5 ? 3 : (ratio < 0.8 ? 2 : 1);
            this.ui.level.textContent = `Level ${pad(this.currentLevel, 2)}`;
            this.ui.score.textContent = pad(this.score, 6);
            this.ui.sub.textContent = `Züge ${this.moves}/${this.moveLimit} · Par ${this.par} · Best ${pad(Math.max(this.best, this.testMode ? 0 : this.score), 6)}`;
            let h = '';
            for (let i = 0; i < 3; i++) h += `<span class="${i < hearts && this.state !== 'over' ? '' : 'off'}">♥</span>`;
            this.ui.hearts.innerHTML = h;
        }

        showOverlay(kind) {
            if (!this.ui) return;
            this.overlayKind = kind;
            let html = '';
            const btn = (act, label, primary) => `<button class="gs-btn${primary ? ' primary' : ''}" data-act="${act}">${label}</button>`;
            const lv = pad(this.currentLevel, 2);
            if (kind === 'start') {
                html = `<div class="gs-modal gs-glass"><h2>${TITLE.toUpperCase()}</h2>
                    <p>Schiebe die Autos beiseite und führe das rote Auto zur Ausfahrt.</p>
                    <p>Level ${lv} · Par ${this.par} Züge</p>
                    <div class="gs-actions">${btn('start', 'Start ▶', true)}${btn('test', 'Self-Test (T)')}</div></div>`;
            } else if (kind === 'pause') {
                html = `<div class="gs-modal gs-glass"><h2>PAUSE</h2><p>Level ${lv} · ${this.moves} Züge</p>
                    <div class="gs-actions">${btn('resume', 'Weiter ▶', true)}${btn('restart', 'Neustart')}</div></div>`;
            } else if (kind === 'over') {
                html = `<div class="gs-modal gs-glass bad"><h2>GAME OVER</h2>
                    <p>Zug-Limit (${this.moveLimit}) erreicht.</p><p>Score ${pad(this.score, 6)}</p>
                    <div class="gs-actions">${btn('retry', 'Nochmal ↻', true)}</div></div>`;
            } else if (kind === 'complete') {
                html = `<div class="gs-modal gs-glass"><h2>LEVEL ${lv} GESCHAFFT</h2>
                    <p>${this.moves} Züge (Par ${this.par}) · Bonus +${this.lastBonus || 0}</p><p>Score ${pad(this.score, 6)}</p>
                    <div class="gs-actions">${btn('restart', 'Wiederholen')}${btn('next', 'Nächstes Level ➔', true)}</div></div>`;
            }
            this.ui.overlay.innerHTML = html;
            this.ui.overlay.classList.add('active');
        }

        hideOverlay() {
            this.overlayKind = null;
            if (this.ui && this.ui.overlay) this.ui.overlay.classList.remove('active');
        }

        toast(msg, kind = 'good') {
            if (!this.ui || !this.ui.toasts) return;
            const el = document.createElement('div');
            el.className = `gs-toast gs-glass ${kind}`;
            el.textContent = msg;
            this.ui.toasts.appendChild(el);
            this.timers.push(setTimeout(() => { if (el.remove) el.remove(); }, 1650));
        }

        /* ------------------------------ juice ------------------------------ */
        cellToScreen(cx, cy) {
            return { x: this.boardOffset.x + cx * this.cellSize, y: this.boardOffset.y + cy * this.cellSize };
        }

        spawn(x, y, n, color, speed, life, size) {
            for (let i = 0; i < n && this.particles.length < 500; i++) {
                const a = Math.random() * Math.PI * 2;
                const s = speed * (0.3 + Math.random() * 0.7);
                this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color, size: size * (0.6 + Math.random() * 0.8) });
            }
        }

        emitDust(v, from, to) {
            const horiz = v.dir === 'H';
            const tail = to > from ? from : to + v.len;
            const p = horiz ? this.cellToScreen(tail, v.y + 0.5) : this.cellToScreen(v.x + 0.5, tail);
            this.spawn(p.x, p.y, 8, 'rgba(203,213,225,0.8)', 60, 0.45, 3);
        }

        bump(v, side) {
            this.shake = Math.max(this.shake, 3);
            const horiz = v.dir === 'H';
            const edge = side > 0 ? (horiz ? v.x + v.len : v.y + v.len) : (horiz ? v.x : v.y);
            const p = horiz ? this.cellToScreen(edge, v.y + 0.5) : this.cellToScreen(v.x + 0.5, edge);
            this.spawn(p.x, p.y, 6, '#fbbf24', 110, 0.3, 2.5);
            if (window.AudioManager && window.AudioManager.playHit) window.AudioManager.playHit();
        }

        confetti() {
            const colors = ['#6366f1', '#22d3ee', '#f59e0b', '#ef4444', '#10b981', '#ec4899'];
            const cx = this.boardOffset.x + this.cellSize * GRID;
            const cy = this.boardOffset.y + this.cellSize * (EXIT_ROW + 0.5);
            for (let i = 0; i < 4; i++) this.spawn(cx, cy, 18, colors[(i * 2) % colors.length], 260, 1.1, 4);
        }

        /* ------------------------------ render ------------------------------ */
        update(dt) {
            this.time += dt;
            this.fade = Math.max(0, this.fade - dt * 3);
            this.shake = Math.max(0, this.shake - dt * 30);
            const k = 1 - Math.exp(-dt * 24);
            for (const v of this.vehicles) {
                v.rx += (v.x - v.rx) * k;
                v.ry += (v.y - v.ry) * k;
            }
            for (let i = this.particles.length - 1; i >= 0; i--) {
                const p = this.particles[i];
                p.life -= dt;
                if (p.life <= 0) { this.particles.splice(i, 1); continue; }
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.vy += 240 * dt;
                p.vx *= 0.98;
            }
        }

        render() {
            if (this.destroyed) return;
            this.animId = requestAnimationFrame(this.render);
            const t = now();
            const dt = Math.min(0.05, Math.max(0, (t - this.lastTs) / 1000));
            this.lastTs = t;
            if (!this.ctx) return;

            if (!this.isPaused) {
                try { this.update(dt); } catch (e) { this.logRenderError(e); }
            }
            try {
                this.draw(this.ctx);
            } catch (e) {
                this.logRenderError(e);
            }
            const ms = now() - t;
            this.perf.frames++;
            this.perf.renderMs += ms;
            if (ms > this.perf.maxRenderMs) this.perf.maxRenderMs = ms;
        }

        logRenderError(e) {
            if (this.renderErrorLogged) return;
            this.renderErrorLogged = true;
            console.warn('[RushHour] render error:', e && e.message ? e.message : e);
        }

        draw(ctx) {
            const W = this.canvas.width, H = this.canvas.height;
            const cs = this.cellSize;
            const ox = this.boardOffset.x, oy = this.boardOffset.y;
            const bs = cs * GRID;

            ctx.clearRect(0, 0, W, H);
            const bg = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, Math.max(W, H) * 0.7);
            bg.addColorStop(0, '#16213a');
            bg.addColorStop(1, '#070b14');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, W, H);

            ctx.save();
            if (this.shake > 0.1) ctx.translate((Math.random() - 0.5) * this.shake * 2, (Math.random() - 0.5) * this.shake * 2);
            const sc = 0.95 + 0.05 * (1 - this.fade);
            ctx.translate(W / 2, oy + bs / 2);
            ctx.scale(sc, sc);
            ctx.translate(-W / 2, -(oy + bs / 2));

            // Board
            ctx.fillStyle = '#0f172a';
            ctx.strokeStyle = 'rgba(129,140,248,0.35)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(ox - 8, oy - 8, bs + 16, bs + 16, 14);
            ctx.fill();
            ctx.stroke();

            for (let r = 0; r < GRID; r++) {
                for (let c = 0; c < GRID; c++) {
                    ctx.fillStyle = (r + c) % 2 ? '#162036' : '#1a2540';
                    ctx.fillRect(ox + c * cs, oy + r * cs, cs, cs);
                }
            }
            ctx.fillStyle = 'rgba(239,68,68,0.07)';
            ctx.fillRect(ox, oy + EXIT_ROW * cs, bs, cs);

            // Exit marker
            const pulse = 0.6 + 0.4 * Math.sin(this.time * 4);
            ctx.fillStyle = `rgba(16,185,129,${0.5 + 0.5 * pulse})`;
            ctx.beginPath();
            ctx.roundRect(ox + bs + 3, oy + EXIT_ROW * cs + 8, 8, cs - 16, 3);
            ctx.fill();
            ctx.fillStyle = `rgba(16,185,129,${pulse})`;
            ctx.font = `${Math.floor(cs * 0.4)}px sans-serif`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText('➜', ox + bs + 14, oy + EXIT_ROW * cs + cs / 2);

            // Vehicles
            for (const v of this.vehicles) this.drawVehicle(ctx, v, v === this.selectedVehicle);

            // Particles
            for (const p of this.particles) {
                ctx.globalAlpha = Math.max(0, p.life / p.max);
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            }
            ctx.globalAlpha = 1;
            ctx.restore();

            if (this.fade > 0.01) {
                ctx.fillStyle = `rgba(7,11,20,${this.fade})`;
                ctx.fillRect(0, 0, W, H);
            }
        }

        drawVehicle(ctx, v, selected) {
            const cs = this.cellSize;
            const pad2 = Math.max(3, cs * 0.06);
            const vx = this.boardOffset.x + v.rx * cs + pad2;
            const vy = this.boardOffset.y + v.ry * cs + pad2;
            const horiz = v.dir === 'H';
            const vw = (horiz ? v.len * cs : cs) - pad2 * 2;
            const vh = (!horiz ? v.len * cs : cs) - pad2 * 2;

            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = selected ? 18 : 8;
            ctx.shadowOffsetY = selected ? 6 : 3;
            const g = horiz ? ctx.createLinearGradient(vx, vy, vx, vy + vh) : ctx.createLinearGradient(vx, vy, vx + vw, vy);
            g.addColorStop(0, shade(v.color, 35));
            g.addColorStop(1, shade(v.color, -35));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.roundRect(vx, vy, vw, vh, v.fixed ? 8 : 9);
            ctx.fill();
            ctx.restore();

            if (v.fixed) {
                ctx.fillStyle = 'rgba(255,255,255,0.12)';
                ctx.beginPath();
                ctx.arc(vx + vw * 0.35, vy + vh * 0.35, vw * 0.14, 0, Math.PI * 2);
                ctx.fill();
                return;
            }

            ctx.strokeStyle = selected ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)';
            ctx.lineWidth = selected ? 2 : 1;
            ctx.beginPath();
            ctx.roundRect(vx, vy, vw, vh, 9);
            ctx.stroke();

            // Windshield / roof
            ctx.fillStyle = 'rgba(15,23,42,0.55)';
            const cw = horiz ? vw * (v.len === 3 ? 0.38 : 0.42) : vw * 0.62;
            const ch = !horiz ? vh * (v.len === 3 ? 0.38 : 0.42) : vh * 0.62;
            const cx0 = horiz ? vx + vw * 0.3 : vx + (vw - cw) / 2;
            const cy0 = !horiz ? vy + vh * 0.3 : vy + (vh - ch) / 2;
            ctx.beginPath();
            ctx.roundRect(cx0, cy0, cw, ch, 5);
            ctx.fill();

            // Headlights at the front (right / bottom)
            ctx.fillStyle = '#fde68a';
            const lr = Math.max(2, cs * 0.045);
            if (horiz) {
                ctx.fillRect(vx + vw - lr * 2, vy + vh * 0.18, lr * 1.5, lr * 2);
                ctx.fillRect(vx + vw - lr * 2, vy + vh * 0.82 - lr * 2, lr * 1.5, lr * 2);
            } else {
                ctx.fillRect(vx + vw * 0.18, vy + vh - lr * 2, lr * 2, lr * 1.5);
                ctx.fillRect(vx + vw * 0.82 - lr * 2, vy + vh - lr * 2, lr * 2, lr * 1.5);
            }
        }

        /* ------------------------------ self-test & bot ------------------------------ */
        wait(ms) {
            return new Promise(res => { this.timers.push(setTimeout(res, Math.max(0, ms))); });
        }

        sanityChecks() {
            const rows = [];
            const check = (name, fn) => {
                try {
                    const detail = fn();
                    rows.push({ test: name, result: 'PASS', detail: detail === undefined ? '' : String(detail) });
                } catch (e) {
                    rows.push({ test: name, result: 'FAIL', detail: e && e.message ? e.message : String(e) });
                }
            };
            const assert = (c, msg) => { if (!c) throw new Error(msg); };

            check('Init: canvas, ctx, container', () => {
                assert(this.canvas && this.ctx && this.container, 'missing canvas/ctx/container');
                assert(this.ui && this.ui.score && this.ui.overlay, 'missing UI refs');
            });
            check('Init: valid vehicle layout', () => {
                const errs = validateLayout(this.vehicles);
                assert(errs.length === 0, errs.join('; '));
                return `${this.vehicles.length} vehicles`;
            });
            check('Init: no null/NaN positions', () => {
                for (const v of this.vehicles) {
                    assert(v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.rx) && Number.isFinite(v.ry), `bad vehicle ${v && v.id}`);
                }
            });
            check('Collision: limits never overlap', () => {
                for (const v of this.vehicles) {
                    if (v.fixed) continue;
                    const lim = this.getLimits(v);
                    const cur = v.dir === 'H' ? v.x : v.y;
                    assert(lim.min <= cur && cur <= lim.max, `${v.id} outside own limits`);
                    for (const edge of [lim.min, lim.max]) {
                        const probe = this.vehicles.map(o => (o === v ? { ...o, [v.dir === 'H' ? 'x' : 'y']: edge } : o));
                        const errs = validateLayout(probe);
                        assert(errs.length === 0, `${v.id}@${edge}: ${errs[0]}`);
                    }
                }
            });
            check('Generator: solvable & valid (levels 1-34 samples)', () => {
                const pars = [];
                for (const lvl of [1, 2, 3, 5, 8, 13, 21, 34]) {
                    const g = generateLevel(lvl);
                    const errs = validateLayout(g.vehicles);
                    assert(errs.length === 0, `L${lvl}: ${errs[0]}`);
                    const s = solve(g.vehicles, 60000);
                    assert(s.solvable && s.moves === g.par, `L${lvl} not solvable / par mismatch`);
                    pars.push(g.par);
                }
                return `pars ${pars.join(',')}`;
            });
            check('Generator: deterministic', () => {
                const a = JSON.stringify(generateLevel(7).vehicles);
                levelCache.delete(7);
                const b = JSON.stringify(generateLevel(7).vehicles);
                assert(a === b, 'level 7 differs between runs');
            });
            check('Scoring: formula', () => {
                const s = RushHourGame.levelScore({ level: 2, moves: 5, par: 5, limit: 17 });
                assert(s === 500 + 100 + 120 + 300, `unexpected ${s}`);
                const s2 = RushHourGame.levelScore({ level: 2, moves: 9, par: 5, limit: 17 });
                assert(s2 === 500 + 100 + 80, `unexpected ${s2}`);
            });
            return rows;
        }

        async runBot(levels, delay) {
            const rows = [];
            const errors = [];
            for (let n = 0; n < levels; n++) {
                if (this.destroyed || !this.botActive) break;
                const level = this.currentLevel;
                const scoreBefore = this.score;
                const t0 = now();
                const sol = solve(this.vehicles, 60000);
                if (!sol.solvable) { errors.push(`L${level}: solver found no solution`); break; }
                let illegal = 0;
                for (const step of sol.path) {
                    await this.wait(delay);
                    while (this.isPaused && !this.destroyed) await this.wait(100);
                    if (this.destroyed || !this.botActive) break;
                    const v = this.vehicles.find(x => x.id === step.id);
                    if (!v) { errors.push(`L${level}: vehicle ${step.id} missing`); illegal++; break; }
                    this.grab(v, 0);
                    this.dragTo(step.to);
                    const actual = v.dir === 'H' ? v.x : v.y;
                    if (actual !== step.to) { illegal++; errors.push(`L${level}: move ${step.id}->${step.to} blocked (got ${actual})`); }
                    this.release();
                    if (this.state !== 'playing') break;
                }
                const complete = this.state === 'complete';
                const expected = scoreBefore + this.comboPoints + (this.lastBonus || 0);
                const scoreOk = complete && this.score === expected;
                if (complete && !scoreOk) errors.push(`L${level}: score ${this.score} != expected ${expected}`);
                if (!complete) errors.push(`L${level}: level not completed (state ${this.state})`);
                rows.push({
                    level,
                    par: this.par,
                    moves: this.moves,
                    cars: this.vehicles.length - 1,
                    illegalMoves: illegal,
                    scoreGain: this.score - scoreBefore,
                    scoreOk,
                    ms: Math.round(now() - t0)
                });
                if (!complete) break;
                await this.wait(delay * 2);
                if (n < levels - 1) this.nextLevel();
            }
            return { rows, errors };
        }

        async runSelfTest(options = {}) {
            if (this.botActive || this.destroyed) return null;
            const levels = options.levels || 3;
            const delay = options.delay !== undefined ? options.delay : 140;
            const saved = { level: this.currentLevel, score: this.score, difficulty: this.difficulty };

            this.testMode = true;
            this.botActive = true;
            this.perf = { frames: 0, renderMs: 0, maxRenderMs: 0, t0: now() };
            this.score = 0;
            this.state = 'playing';
            this.hideOverlay();
            this.startLevel(1, saved.difficulty);
            this.toast('Self-Test läuft…', 'warn');
            console.group('%c[RushHour] Self-Test', 'color:#22d3ee;font-weight:bold');

            const sanity = this.sanityChecks();
            console.log('Sanity checks');
            console.table(sanity);

            const bot = await this.runBot(levels, delay);
            const elapsed = (now() - this.perf.t0) / 1000;
            const perf = {
                frames: this.perf.frames,
                fps: elapsed > 0 ? Math.round(this.perf.frames / elapsed) : 0,
                avgRenderMs: this.perf.frames ? +(this.perf.renderMs / this.perf.frames).toFixed(3) : 0,
                maxRenderMs: +this.perf.maxRenderMs.toFixed(3),
                seconds: +elapsed.toFixed(2)
            };
            console.log('Bot autoplay');
            console.table(bot.rows);
            console.log('Performance');
            console.table([perf]);
            bot.errors.forEach(e => console.error('✗', e));

            const failed = sanity.filter(r => r.result === 'FAIL').length + bot.errors.length;
            const passed = failed === 0 && bot.rows.length >= Math.min(levels, 3);
            console.log(passed ? '%c✓ ALL TESTS PASSED' : '%c✗ TESTS FAILED', passed ? 'color:#10b981;font-weight:bold' : 'color:#ef4444;font-weight:bold');
            console.groupEnd();

            const report = { passed, sanity, bot, perf };
            if (typeof window !== 'undefined') window.RUSH_TEST_REPORT = report;

            if (!this.destroyed) {
                this.botActive = false;
                this.testMode = false;
                this.score = saved.score;
                this.state = 'ready';
                this.startLevel(saved.level, saved.difficulty);
                this.updateHUD();
                this.toast(passed ? 'Self-Test bestanden ✓' : 'Self-Test fehlgeschlagen ✗', passed ? 'good' : 'bad');
                this.showOverlay('start');
            }
            return report;
        }

        /* ------------------------------ lifecycle ------------------------------ */
        destroy() {
            this.destroyed = true;
            this.botActive = false;
            if (this.animId) cancelAnimationFrame(this.animId);
            this.animId = null;
            this.timers.forEach(t => clearTimeout(t));
            this.timers = [];
            this.listeners.forEach(l => l.target.removeEventListener && l.target.removeEventListener(l.type, l.fn, l.opts));
            this.listeners = [];
            if (this.container) this.container.innerHTML = '';
        }
    }

    RushHourGame.solve = solve;
    RushHourGame.generateLevel = generateLevel;
    RushHourGame.levelParams = levelParams;
    RushHourGame.validateLayout = validateLayout;

    window.RushHourGame = RushHourGame;
})();
