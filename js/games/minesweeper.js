/**
 * Minesweeper Deluxe (Square & Hex)
 * - Standardised glassmorphism UI (HUD, overlays, toasts) injected via JS
 * - Procedural, logic-solvable boards (no-guess generator with built-in solver)
 * - Mathematical difficulty scaling per level, seamless level transitions
 * - Juice: particles, screen shake, reveal animations, floating text
 * - Self-test: window.RUN_TESTS = true or key "T" (headless checks + autoplay bot)
 */
(function () {
    'use strict';

    const STYLE_ID = 'gx-ui-style-v1';
    const HUD_H = 56;
    const SQRT3 = Math.sqrt(3);
    const GAME_TITLE = 'Minesweeper';
    const NUM_COLORS = ['#60a5fa', '#34d399', '#f87171', '#a78bfa', '#fbbf24', '#22d3ee', '#f472b6', '#e2e8f0'];

    const UI_CSS = `
    .gx-root{position:relative;width:100%;height:100%;overflow:hidden;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;user-select:none;-webkit-user-select:none;touch-action:none}
    .gx-root canvas{display:block;position:absolute;left:0;top:0}
    .gx-glass{background:rgba(15,23,42,0.75);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.1);border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,0.35)}
    .gx-hud{position:absolute;left:8px;right:8px;top:8px;height:40px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;padding:0 14px;z-index:5;pointer-events:none}
    .gx-hud-left{display:flex;align-items:baseline;gap:10px;white-space:nowrap}
    .gx-title{font-weight:700;font-size:15px;letter-spacing:.3px}
    .gx-level{font-size:12px;color:#22d3ee;font-weight:600;font-variant-numeric:tabular-nums}
    .gx-hud-center{text-align:center;font-variant-numeric:tabular-nums;white-space:nowrap}
    .gx-score{font-size:18px;font-weight:700}
    .gx-best{font-size:11px;color:#94a3b8;margin-left:8px}
    .gx-hud-right{display:flex;justify-content:flex-end;align-items:center;gap:12px;pointer-events:auto}
    .gx-chip{font-size:12px;color:#cbd5e1;font-variant-numeric:tabular-nums;white-space:nowrap}
    .gx-hearts{display:flex;gap:2px;font-size:16px}
    .gx-heart{color:#f43f5e;transition:transform .2s,opacity .2s}
    .gx-heart.lost{color:#475569;opacity:.5;transform:scale(.8)}
    .gx-icon-btn{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#e2e8f0;border-radius:8px;width:28px;height:28px;cursor:pointer;font-size:13px;line-height:1;transition:background .15s,transform .1s}
    .gx-icon-btn:hover{background:rgba(99,102,241,0.35)}
    .gx-icon-btn:active{transform:scale(.92)}
    .gx-overlay{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(2,6,23,0.45);z-index:10}
    .gx-overlay.active{display:flex;animation:gx-fade .25s ease-out}
    .gx-modal{min-width:280px;max-width:90%;padding:28px 32px;text-align:center;animation:gx-pop .3s cubic-bezier(.2,1.4,.4,1)}
    .gx-modal h2{margin:0 0 6px;font-size:26px;font-weight:800;letter-spacing:.5px}
    .gx-modal p{margin:0 0 16px;color:#94a3b8;font-size:14px;line-height:1.5}
    .gx-stats{display:grid;grid-template-columns:auto auto;gap:4px 18px;margin:0 auto 18px;font-size:13px;color:#cbd5e1;text-align:left;width:max-content;font-variant-numeric:tabular-nums}
    .gx-stats b{color:#fff;text-align:right}
    .gx-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
    .gx-btn{background:linear-gradient(135deg,#6366f1,#06b6d4);color:#fff;border:0;border-radius:10px;padding:10px 22px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 4px 16px rgba(99,102,241,0.4);transition:transform .12s,filter .15s,box-shadow .15s}
    .gx-btn:hover{filter:brightness(1.15);box-shadow:0 6px 22px rgba(6,182,212,0.45);transform:translateY(-1px)}
    .gx-btn:active{transform:scale(.95)}
    .gx-btn.secondary{background:rgba(255,255,255,0.08);box-shadow:none;border:1px solid rgba(255,255,255,0.15)}
    .gx-toasts{position:absolute;left:0;right:0;top:64px;display:flex;flex-direction:column;align-items:center;gap:6px;z-index:8;pointer-events:none}
    .gx-toast{padding:8px 18px;font-size:14px;font-weight:700;border-radius:999px;animation:gx-toast 1.6s ease-out forwards}
    .gx-toast.good{color:#67e8f9}.gx-toast.bad{color:#fda4af}.gx-toast.info{color:#c7d2fe}
    @keyframes gx-pop{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}
    @keyframes gx-fade{from{opacity:0}to{opacity:1}}
    @keyframes gx-toast{0%{transform:translateY(-12px) scale(.9);opacity:0}12%{transform:translateY(0) scale(1);opacity:1}80%{opacity:1}100%{transform:translateY(-8px);opacity:0}}
    `;

    const NOOP = function () { return { addColorStop() {} }; };
    const SAFE_METHODS = new Set(['closePath', 'translate', 'scale', 'setTransform', 'createRadialGradient',
        'createLinearGradient', 'roundRect', 'save', 'restore', 'fillText', 'arc', 'clip', 'rect', 'quadraticCurveTo',
        'beginPath', 'moveTo', 'lineTo', 'stroke', 'fill', 'fillRect', 'strokeRect', 'clearRect', 'rotate']);

    // Wraps a 2D context so methods missing in mock/limited contexts never throw.
    function safeContext(raw) {
        if (!raw || typeof Proxy === 'undefined') return raw;
        return new Proxy(raw, {
            get(target, prop) {
                const v = target[prop];
                if (v === undefined && SAFE_METHODS.has(prop)) return NOOP;
                return typeof v === 'function' ? v.bind(target) : v;
            },
            set(target, prop, value) { target[prop] = value; return true; }
        });
    }

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

    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    class MinesweeperGame {
        constructor() {
            this.container = null;
            this.canvas = null;
            this.ctx = null;
            this.animId = null;
            this.isPaused = false;
            this.state = 'ready'; // ready | play | pause | over | complete

            this.rows = 9;
            this.cols = 9;
            this.totalMines = 10;
            this.isHex = false;
            this.nb = [];
            this.grid = [];
            this.firstClick = true;
            this.gameOver = false;
            this.hasWon = false;
            this.solvable = true;
            this.genStats = { attempts: 0, ms: 0, mines: 0 };

            this.flagCount = 0;
            this.blownCount = 0;
            this.currentLevel = 1;
            this.params = MinesweeperGame.levelParams(1);
            this.lives = 3;
            this.maxLives = 3;
            this.score = 0;
            this.levelStartScore = 0;
            this.lastBonus = 0;
            this.highScore = this.loadBest();
            this.combo = 0;
            this.playTime = 0;
            this.limitLeft = 0;
            this.moves = 0;

            this.cellSize = 34;
            this.hexSize = 20;
            this.boardOffset = { x: 50, y: 70 };
            this.width = 800;
            this.height = 600;
            this.dpr = 1;
            this.hover = null;

            this.particles = [];
            this.floaters = [];
            this.shake = 0;
            this.lastFrame = 0;

            this.timers = [];
            this.overlayTimer = null;
            this.listeners = [];
            this.hudCache = {};
            this.refs = {};
            this.longPress = null;
            this.touchCell = null;

            this.perf = { frames: 0, time: 0, renderMs: 0, renderMax: 0 };
            this.bot = null;
            this.errors = [];
        }

        // ---------- Pure helpers (shared by game, solver and tests) ----------

        static levelParams(level) {
            const L = Math.max(1, level | 0);
            const base = 8 + Math.min(12, Math.floor(L / 4));
            const rows = base;
            const cols = Math.min(22, base + Math.floor(L / 8));
            const isHex = (L % 3 === 0);
            const density = (0.12 + Math.min(0.08, L * 0.003)) * (isHex ? 0.85 : 1);
            const cells = rows * cols;
            const mines = clamp(Math.floor(cells * density), 6, cells - 12);
            const speed = 1 + 0.1 * (L - 1);
            const par = Math.round(cells * 0.9 / speed);
            const timePressure = L >= 5;
            const timeLimit = timePressure ? Math.max(25, Math.round(cells * 1.2 / (1 + 0.1 * (L - 5)))) : 0;
            return { level: L, rows, cols, isHex, density, mines, speed, par, timePressure, timeLimit, lives: L >= 15 ? 2 : 3 };
        }

        static revealPoints(level, count, combo) {
            if (count <= 0) return 0;
            const levelMult = 1 + 0.1 * (level - 1);
            const comboMult = 1 + 0.1 * (clamp(combo, 1, 10) - 1);
            return Math.round(count * 10 * levelMult * comboMult);
        }

        static levelBonus(level, elapsed, par, lives) {
            return 100 * level + Math.max(0, Math.round((par - elapsed) * 5)) + lives * 100;
        }

        static computeNeighbors(rows, cols, hex) {
            const nb = [];
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const list = [];
                    let deltas;
                    if (!hex) {
                        deltas = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
                    } else if (r % 2 === 1) {
                        deltas = [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]];
                    } else {
                        deltas = [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]];
                    }
                    for (const [dr, dc] of deltas) {
                        const nr = r + dr, nc = c + dc;
                        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) list.push(nr * cols + nc);
                    }
                    nb.push(list);
                }
            }
            return nb;
        }

        /**
         * Pure logic deduction. state: 0 unknown, 1 revealed, 2 known mine.
         * Returns {safe:[], mines:[]} using single-cell, subset and global-count rules.
         */
        static deduce(n, nb, state, counts, totalMines) {
            const safe = new Set();
            const mines = new Set();
            const constraints = [];

            for (let i = 0; i < n; i++) {
                if (state[i] !== 1 || counts[i] <= 0) continue;
                const U = [];
                let m = 0;
                for (const j of nb[i]) {
                    if (state[j] === 0) U.push(j);
                    else if (state[j] === 2) m++;
                }
                if (!U.length) continue;
                const rem = counts[i] - m;
                if (rem < 0 || rem > U.length) continue;
                if (rem === 0) U.forEach(j => safe.add(j));
                else if (rem === U.length) U.forEach(j => mines.add(j));
                else constraints.push({ U, rem, set: new Set(U) });
            }
            if (safe.size || mines.size) return { safe: [...safe], mines: [...mines] };

            for (let a = 0; a < constraints.length; a++) {
                const A = constraints[a];
                for (let b = 0; b < constraints.length; b++) {
                    const B = constraints[b];
                    if (a === b || B.U.length <= A.U.length) continue;
                    if (!A.U.every(x => B.set.has(x))) continue;
                    const diff = B.U.filter(x => !A.set.has(x));
                    const rem = B.rem - A.rem;
                    if (rem === 0) diff.forEach(j => safe.add(j));
                    else if (rem === diff.length) diff.forEach(j => mines.add(j));
                }
            }
            if (safe.size || mines.size) return { safe: [...safe], mines: [...mines] };

            const unknown = [];
            let known = 0;
            for (let i = 0; i < n; i++) {
                if (state[i] === 0) unknown.push(i);
                else if (state[i] === 2) known++;
            }
            const left = totalMines - known;
            if (unknown.length && left === 0) return { safe: unknown, mines: [] };
            if (unknown.length && left === unknown.length) return { safe: [], mines: unknown };
            return { safe: [], mines: [] };
        }

        /** Simulates a logic-only playthrough from `start`; true if every safe cell can be deduced. */
        static isSolvable(rows, cols, nb, isMine, counts, start, totalMines) {
            const n = rows * cols;
            const state = new Int8Array(n);
            let revealed = 0;
            const flood = (s) => {
                const stack = [s];
                while (stack.length) {
                    const i = stack.pop();
                    if (state[i] !== 0) continue;
                    state[i] = 1;
                    revealed++;
                    if (counts[i] === 0) for (const j of nb[i]) if (state[j] === 0) stack.push(j);
                }
            };
            flood(start);
            for (let guard = 0; guard < n * 2; guard++) {
                if (revealed === n - totalMines) return true;
                const res = MinesweeperGame.deduce(n, nb, state, counts, totalMines);
                if (!res.safe.length && !res.mines.length) break;
                for (const j of res.mines) if (state[j] === 0) state[j] = 2;
                for (const j of res.safe) {
                    if (isMine[j]) return false;
                    flood(j);
                }
            }
            return revealed === n - totalMines;
        }

        // ---------- Lifecycle ----------

        init(container, options = {}) {
            this.container = container;
            this.container.innerHTML = '';
            this.injectStyles();
            this.buildUI();

            this.bindEvents();
            this.resize();
            this.startLevel(options.levelIndex || 1);
            this.state = 'ready';
            this.showOverlay('start');
            this.quickSanity();

            this.lastFrame = now();
            this.loop = this.loop.bind(this);
            this.animId = requestAnimationFrame(this.loop);
            requestAnimationFrame(() => this.resize());

            if (typeof window !== 'undefined' && window.RUN_TESTS === true) {
                this.later(() => this.runFullTest(3), 300);
            }
        }

        later(fn, ms) {
            const id = setTimeout(() => {
                this.timers = this.timers.filter(t => t !== id);
                fn();
            }, ms);
            this.timers.push(id);
            return id;
        }

        injectStyles() {
            if (typeof document === 'undefined' || !document.head || !document.head.appendChild) return;
            if (document.getElementById && document.getElementById(STYLE_ID)) return;
            const style = document.createElement('style');
            style.id = STYLE_ID;
            style.textContent = UI_CSS;
            document.head.appendChild(style);
        }

        buildUI() {
            const c = this.container;
            c.classList.add('gx-root');

            this.canvas = document.createElement('canvas');
            this.canvas.className = 'game-canvas';
            this.ctx = safeContext(this.canvas.getContext('2d'));
            c.appendChild(this.canvas);

            const hud = document.createElement('div');
            hud.className = 'gx-hud gx-glass';
            hud.innerHTML = `
                <div class="gx-hud-left"><span class="gx-title">${GAME_TITLE}</span><span class="gx-level" data-ref="level">Level 01</span></div>
                <div class="gx-hud-center"><span class="gx-score" data-ref="score">0</span><span class="gx-best" data-ref="best">Best 0</span></div>
                <div class="gx-hud-right">
                    <span class="gx-chip" data-ref="mines">💣 0</span>
                    <span class="gx-chip" data-ref="time">⏱ 0</span>
                    <span class="gx-hearts" data-ref="hearts"></span>
                    <button class="gx-icon-btn" data-gx="pause" title="Pause (P)">⏸</button>
                    <button class="gx-icon-btn" data-gx="mute" data-ref="mute" title="Mute (M)">🔊</button>
                </div>`;
            c.appendChild(hud);

            const toasts = document.createElement('div');
            toasts.className = 'gx-toasts';
            c.appendChild(toasts);
            this.refs.toasts = toasts;

            const overlay = document.createElement('div');
            overlay.className = 'gx-overlay';
            c.appendChild(overlay);
            this.refs.overlay = overlay;

            if (c.querySelectorAll) {
                for (const el of c.querySelectorAll('[data-ref]')) this.refs[el.getAttribute('data-ref')] = el;
            }
        }

        addListener(target, type, fn) {
            if (!target || !target.addEventListener) return;
            target.addEventListener(type, fn);
            this.listeners.push([target, type, fn]);
        }

        bindEvents() {
            this.addListener(window, 'resize', () => this.resize());
            this.addListener(window, 'keydown', (e) => this.onKey(e));
            this.addListener(this.canvas, 'contextmenu', (e) => { if (e.preventDefault) e.preventDefault(); });
            this.addListener(this.canvas, 'pointerdown', (e) => this.onPointerDown(e));
            this.addListener(this.canvas, 'pointerup', () => this.onPointerUp());
            this.addListener(this.canvas, 'pointerleave', () => { this.hover = null; this.clearLongPress(); });
            this.addListener(this.canvas, 'pointermove', (e) => { this.hover = this.pointerToCell(e); });
            this.addListener(this.container, 'click', (e) => {
                const t = e.target && e.target.closest ? e.target.closest('[data-gx]') : null;
                if (t) this.doAction(t.getAttribute('data-gx'));
            });
        }

        doAction(action) {
            const am = window.AudioManager;
            if (am && am.init) { try { am.init(); } catch (e) { /* audio is optional */ } }
            switch (action) {
                case 'start': this.startLevel(this.currentLevel); this.levelToasts(); break;
                case 'resume': this.resume(); break;
                case 'pause': if (this.state === 'pause') this.resume(); else this.pause(); break;
                case 'retry': this.retryLevel(); break;
                case 'restart': this.score = 0; this.startLevel(1); this.levelToasts(); break;
                case 'next': this.nextLevel(); break;
                case 'mute':
                    if (am && am.toggleMute) {
                        const muted = am.toggleMute();
                        if (this.refs.mute) this.refs.mute.textContent = muted ? '🔇' : '🔊';
                    }
                    break;
                default: break;
            }
        }

        onKey(e) {
            if (!this.container) return;
            const k = (e.key || '').toLowerCase();
            const stop = () => { if (e.preventDefault) e.preventDefault(); };
            if (k === 'p' || k === 'escape') {
                if (this.state === 'play') { this.pause(); stop(); }
                else if (this.state === 'pause') { this.resume(); stop(); }
            } else if (k === 'm') {
                this.doAction('mute');
            } else if (k === 't') {
                if (this.bot && this.bot.active) this.stopBot('manuell gestoppt');
                else this.runFullTest(3);
                stop();
            } else if (k === 'r' && this.state === 'play') {
                this.retryLevel(); stop();
            } else if (k === 'enter' || k === ' ') {
                const map = { ready: 'start', pause: 'resume', over: 'retry', complete: 'next' };
                if (map[this.state]) { this.doAction(map[this.state]); stop(); }
            }
        }

        // ---------- Layout & input ----------

        resize() {
            if (!this.container || !this.canvas) return;
            const rect = this.container.getBoundingClientRect();
            const w = rect.width > 50 ? rect.width : (window.innerWidth || 800);
            const h = rect.height > 50 ? rect.height : ((window.innerHeight || 648) - 48);
            const dpr = Math.min(2, window.devicePixelRatio || 1);

            this.width = w;
            this.height = h;
            this.dpr = dpr;
            this.canvas.width = Math.floor(w * dpr);
            this.canvas.height = Math.floor(h * dpr);
            this.canvas.style.width = w + 'px';
            this.canvas.style.height = h + 'px';

            const availW = w - 24;
            const availH = h - HUD_H - 20;
            let boardW, boardH;
            if (this.isHex) {
                const s = Math.min(availW / (SQRT3 * (this.cols + 0.5)), availH / (1.5 * this.rows + 0.5));
                this.hexSize = clamp(s, 8, 30);
                boardW = SQRT3 * this.hexSize * (this.cols + 0.5);
                boardH = this.hexSize * (1.5 * this.rows + 0.5);
            } else {
                this.cellSize = clamp(Math.floor(Math.min(availW / this.cols, availH / this.rows)), 12, 46);
                boardW = this.cellSize * this.cols;
                boardH = this.cellSize * this.rows;
            }
            this.boardOffset.x = Math.floor((w - boardW) / 2);
            this.boardOffset.y = Math.floor(HUD_H + (availH - boardH) / 2 + 8);
        }

        cellCenter(r, c) {
            const o = this.boardOffset;
            if (!this.isHex) return { x: o.x + (c + 0.5) * this.cellSize, y: o.y + (r + 0.5) * this.cellSize };
            const s = this.hexSize, w = SQRT3 * s;
            return { x: o.x + w * (c + 0.5 + (r % 2 === 1 ? 0.5 : 0)), y: o.y + s * (1 + 1.5 * r) };
        }

        /** Maps a canvas pixel to the cell whose centre is nearest (exact hit test for squares, hexes). */
        pickCell(px, py) {
            const o = this.boardOffset;
            if (!this.isHex) {
                const c = Math.floor((px - o.x) / this.cellSize);
                const r = Math.floor((py - o.y) / this.cellSize);
                return (r >= 0 && r < this.rows && c >= 0 && c < this.cols) ? { r, c } : null;
            }
            const s = this.hexSize, w = SQRT3 * s;
            const r0 = Math.round((py - o.y - s) / (1.5 * s));
            let best = null, bestD = Infinity;
            for (let r = r0 - 1; r <= r0 + 1; r++) {
                if (r < 0 || r >= this.rows) continue;
                const c0 = Math.round((px - o.x) / w - 0.5 - (r % 2 === 1 ? 0.5 : 0));
                for (let c = c0 - 1; c <= c0 + 1; c++) {
                    if (c < 0 || c >= this.cols) continue;
                    const p = this.cellCenter(r, c);
                    const d = Math.hypot(px - p.x, py - p.y);
                    if (d < bestD) { bestD = d; best = { r, c }; }
                }
            }
            return best && bestD <= s ? best : null;
        }

        pointerToCell(e) {
            const rect = this.canvas.getBoundingClientRect();
            return this.pickCell(e.clientX - rect.left, e.clientY - rect.top);
        }

        onPointerDown(e) {
            if (this.state !== 'play' || (this.bot && this.bot.active)) return;
            const cell = this.pointerToCell(e);
            if (!cell) return;
            if (e.pointerType === 'touch') {
                this.clearLongPress();
                this.touchCell = cell;
                this.longPress = setTimeout(() => {
                    this.longPress = null;
                    this.touchCell = null;
                    this.toggleFlag(cell.r, cell.c);
                }, 380);
                return;
            }
            if (e.button === 2) this.toggleFlag(cell.r, cell.c);
            else if (e.button === 0) this.handleClick(cell.r, cell.c);
        }

        onPointerUp() {
            if (this.longPress && this.touchCell) {
                const cell = this.touchCell;
                this.clearLongPress();
                this.handleClick(cell.r, cell.c);
            }
        }

        clearLongPress() {
            if (this.longPress) clearTimeout(this.longPress);
            this.longPress = null;
            this.touchCell = null;
        }

        // ---------- Level setup ----------

        pad(n) { return String(n).padStart(2, '0'); }

        startLevel(levelIndex = 1) {
            const L = Math.max(1, levelIndex | 0);
            this.currentLevel = L;
            const p = MinesweeperGame.levelParams(L);
            this.params = p;
            this.rows = p.rows;
            this.cols = p.cols;
            this.isHex = p.isHex;
            this.totalMines = p.mines;
            this.maxLives = p.lives;
            this.lives = p.lives;

            if (this.overlayTimer) { clearTimeout(this.overlayTimer); this.overlayTimer = null; }
            this.clearLongPress();
            this.firstClick = true;
            this.gameOver = false;
            this.hasWon = false;
            this.flagCount = 0;
            this.blownCount = 0;
            this.combo = 0;
            this.playTime = 0;
            this.moves = 0;
            this.limitLeft = p.timeLimit;
            this.levelStartScore = this.score;
            this.particles = [];
            this.floaters = [];
            this.shake = 0;
            this.state = 'play';

            this.initGrid();
            this.resize();
            this.hideOverlay();
            this.syncPortalLevel();
            this.updateHUD();
        }

        levelToasts() {
            const p = this.params;
            this.toast(`Level ${this.pad(this.currentLevel)}`, 'info');
            if (p.isHex) this.toast('Hex-Gitter', 'info');
            if (p.timePressure && p.level === 5) this.toast('Zeitdruck aktiv!', 'bad');
        }

        syncPortalLevel() {
            if (!this.container || typeof document === 'undefined' || !document.getElementById) return;
            try {
                const pill = document.getElementById('active-level-indicator');
                if (pill && window.portal && window.portal.getDifficultyName) {
                    pill.innerText = `Level ${this.currentLevel} (${window.portal.getDifficultyName(this.currentLevel)}) ▾`;
                }
                if (window.portal) window.portal.currentLevel = this.currentLevel;
            } catch (e) { /* cosmetic only */ }
        }

        nextLevel() {
            this.startLevel(this.currentLevel + 1);
            this.toast('Level Up!', 'good');
            this.levelToasts();
        }

        retryLevel() {
            this.score = this.levelStartScore;
            this.startLevel(this.currentLevel);
        }

        initGrid() {
            this.nb = MinesweeperGame.computeNeighbors(this.rows, this.cols, this.isHex);
            this.grid = [];
            for (let r = 0; r < this.rows; r++) {
                const row = [];
                for (let c = 0; c < this.cols; c++) {
                    row.push({ isMine: false, isRevealed: false, isFlagged: false, isBlown: false, count: 0, appear: 1, pop: 0 });
                }
                this.grid.push(row);
            }
        }

        getNeighbors(r, c) {
            return this.nb[r * this.cols + c].map(i => ({ r: Math.floor(i / this.cols), c: i % this.cols }));
        }

        /** Places mines so the board is logic-solvable from the first click; lowers mine count if the search fails. */
        populateMines(safeR, safeC) {
            const rows = this.rows, cols = this.cols, n = rows * cols;
            const start = safeR * cols + safeC;
            const safe = new Set([start, ...this.nb[start]]);
            const candidates = [];
            for (let i = 0; i < n; i++) if (!safe.has(i)) candidates.push(i);

            let mineCount = Math.min(this.totalMines, candidates.length);
            const minAllowed = Math.max(4, Math.floor(mineCount * 0.7));
            const rng = mulberry32((this.currentLevel * 7919 + Math.floor(Math.random() * 1e9)) >>> 0);
            const t0 = now();
            let isMine = new Uint8Array(n), counts = new Int8Array(n);
            let ok = false, attempts = 0;

            const build = (m) => {
                isMine = new Uint8Array(n);
                const pool = candidates.slice();
                for (let k = 0; k < m; k++) {
                    const j = k + Math.floor(rng() * (pool.length - k));
                    [pool[k], pool[j]] = [pool[j], pool[k]];
                    isMine[pool[k]] = 1;
                }
                counts = new Int8Array(n);
                for (let i = 0; i < n; i++) {
                    if (isMine[i]) continue;
                    let cnt = 0;
                    for (const j of this.nb[i]) cnt += isMine[j];
                    counts[i] = cnt;
                }
            };

            for (;;) {
                attempts++;
                build(mineCount);
                ok = MinesweeperGame.isSolvable(rows, cols, this.nb, isMine, counts, start, mineCount);
                if (ok) break;
                if (attempts % 12 === 0 && mineCount > minAllowed) mineCount--;
                if (attempts >= 600 || (now() - t0 > 400 && mineCount <= minAllowed)) break;
            }

            this.solvable = ok;
            this.totalMines = mineCount;
            this.genStats = { attempts, ms: now() - t0, mines: mineCount };
            for (let i = 0; i < n; i++) {
                const cell = this.grid[Math.floor(i / cols)][i % cols];
                cell.isMine = !!isMine[i];
                cell.count = counts[i];
            }
        }

        // ---------- Gameplay ----------

        handleClick(r, c) {
            if (this.state !== 'play') return false;
            const cell = this.grid[r] && this.grid[r][c];
            if (!cell || cell.isFlagged) return false;

            if (this.firstClick) {
                this.populateMines(r, c);
                this.firstClick = false;
            }

            let revealed = 0, hits = 0;
            const reveal = (rr, cc) => {
                const res = this.revealFlood(rr, cc);
                revealed += res.revealed;
                hits += res.hits;
            };

            if (cell.isRevealed) {
                if (cell.count === 0 || cell.isMine) return false;
                const nbs = this.nb[r * this.cols + c];
                let marked = 0;
                for (const i of nbs) {
                    const nc = this.grid[Math.floor(i / this.cols)][i % this.cols];
                    if (nc.isFlagged || nc.isBlown) marked++;
                }
                if (marked !== cell.count) return false;
                for (const i of nbs) {
                    const rr = Math.floor(i / this.cols), cc = i % this.cols;
                    const nc = this.grid[rr][cc];
                    if (!nc.isRevealed && !nc.isFlagged) reveal(rr, cc);
                }
            } else {
                reveal(r, c);
            }

            this.moves++;
            this.afterReveal(revealed, hits);
            return true;
        }

        revealFlood(r, c) {
            const cols = this.cols;
            let revealed = 0, hits = 0;
            const queue = [[r * cols + c, 0]];
            for (let qi = 0; qi < queue.length; qi++) {
                const [i, depth] = queue[qi];
                const rr = Math.floor(i / cols), cc = i % cols;
                const cell = this.grid[rr][cc];
                if (cell.isRevealed || cell.isFlagged) continue;
                cell.isRevealed = true;
                cell.appear = -depth * 0.025;
                if (cell.isMine) {
                    cell.isBlown = true;
                    this.blownCount++;
                    hits++;
                    this.explodeAt(rr, cc);
                    continue;
                }
                revealed++;
                if (revealed <= 24) this.burstAt(rr, cc, 3, '#38bdf8', 60);
                if (cell.count === 0) {
                    for (const j of this.nb[i]) {
                        const nc = this.grid[Math.floor(j / cols)][j % cols];
                        if (!nc.isRevealed && !nc.isFlagged) queue.push([j, depth + 1]);
                    }
                }
            }
            return { revealed, hits };
        }

        afterReveal(revealed, hits) {
            if (revealed > 0 && hits === 0) {
                this.combo++;
                this.addScore(MinesweeperGame.revealPoints(this.currentLevel, revealed, this.combo));
                this.sfx('playClick');
                if (this.combo === 3 || this.combo === 5 || this.combo === 10 || (this.combo > 10 && this.combo % 10 === 0)) {
                    this.toast(`Combo x${this.combo}`, 'good');
                    this.sfx('playPowerup');
                }
                if (revealed >= 15) this.toast('Großer Durchbruch!', 'info');
            } else if (revealed > 0) {
                this.addScore(MinesweeperGame.revealPoints(this.currentLevel, revealed, 1));
            }

            if (hits > 0) {
                this.lives = Math.max(0, this.lives - hits);
                this.combo = 0;
                this.shake = Math.min(14, 8 + hits * 3);
                this.sfx('playExplosion');
                this.toast(this.lives > 0 ? 'Mine getroffen! −♥' : 'Game Over', 'bad');
                if (this.lives <= 0) { this.triggerGameOver(); this.updateHUD(); return; }
            }
            this.checkWinCondition();
            this.updateHUD();
        }

        addScore(pts) {
            if (!(pts > 0)) return;
            this.score += pts;
            if (this.score > this.highScore) this.highScore = this.score;
        }

        toggleFlag(r, c) {
            if (this.state !== 'play') return false;
            const cell = this.grid[r] && this.grid[r][c];
            if (!cell || cell.isRevealed) return false;
            cell.isFlagged = !cell.isFlagged;
            this.flagCount += cell.isFlagged ? 1 : -1;
            cell.pop = 1;
            this.burstAt(r, c, 5, '#fbbf24', 50);
            this.sfx('playDigBlock');
            this.updateHUD();
            return true;
        }

        checkWinCondition() {
            if (this.gameOver || this.hasWon) return;
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    const cell = this.grid[r][c];
                    if (!cell.isMine && !cell.isRevealed) return;
                }
            }
            this.triggerWin();
        }

        triggerGameOver() {
            this.gameOver = true;
            this.state = 'over';
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    const cell = this.grid[r][c];
                    if (cell.isMine && !cell.isRevealed) {
                        cell.isRevealed = true;
                        cell.appear = -(0.2 + Math.random() * 0.6);
                    }
                }
            }
            this.saveBest();
            if (this.container) this.overlayTimer = setTimeout(() => this.showOverlay('over'), 900);
        }

        triggerWin() {
            this.hasWon = true;
            this.state = 'complete';
            this.lastBonus = MinesweeperGame.levelBonus(this.currentLevel, this.playTime, this.params.par, this.lives);
            this.addScore(this.lastBonus);
            this.saveBest();
            this.sfx('playWin');
            if (this.container) {
                const colors = ['#6366f1', '#22d3ee', '#fbbf24', '#f472b6', '#34d399'];
                for (let i = 0; i < 90; i++) {
                    this.particles.push({
                        x: this.width / 2, y: this.height / 2,
                        vx: (Math.random() - 0.5) * 520, vy: -Math.random() * 480 - 80,
                        life: 1.4 + Math.random() * 0.8, max: 2.2, size: 3 + Math.random() * 3,
                        color: colors[i % colors.length], g: 600
                    });
                }
                this.overlayTimer = setTimeout(() => this.showOverlay('complete'), 700);
            }
        }

        // ---------- Juice ----------

        burstAt(r, c, count, color, speed) {
            if (!this.container) return;
            const p = this.cellCenter(r, c);
            for (let i = 0; i < count && this.particles.length < 500; i++) {
                const a = Math.random() * Math.PI * 2;
                const v = speed * (0.4 + Math.random());
                this.particles.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.4, max: 0.9, size: 1.5 + Math.random() * 2.2, color, g: 120 });
            }
        }

        explodeAt(r, c) {
            if (!this.container) return;
            this.burstAt(r, c, 36, '#f97316', 260);
            this.burstAt(r, c, 16, '#fde047', 160);
            const p = this.cellCenter(r, c);
            this.floaters.push({ x: p.x, y: p.y, text: '−♥', life: 1, color: '#fda4af' });
        }

        sfx(name) {
            const am = typeof window !== 'undefined' ? window.AudioManager : null;
            if (am && typeof am[name] === 'function') {
                try { am[name](); } catch (e) { /* audio must never break gameplay */ }
            }
        }

        toast(msg, kind = 'info') {
            if (!this.container || !this.refs.toasts) return;
            const el = document.createElement('div');
            el.className = `gx-toast gx-glass ${kind}`;
            el.textContent = msg;
            this.refs.toasts.appendChild(el);
            const stack = this.refs.toasts.children;
            if (stack && stack.length > 3 && stack[0] && stack[0].remove) stack[0].remove();
            this.later(() => { if (el.remove) el.remove(); }, 1600);
        }

        // ---------- HUD & Overlays ----------

        setText(key, value) {
            if (this.hudCache[key] === value) return;
            this.hudCache[key] = value;
            const el = this.refs[key];
            if (el) el.textContent = value;
        }

        updateHUD() {
            if (!this.container) return;
            this.setText('level', `Level ${this.pad(this.currentLevel)}`);
            this.setText('score', String(this.score));
            this.setText('best', `Best ${this.highScore}`);
            this.setText('mines', `💣 ${Math.max(0, this.totalMines - this.flagCount - this.blownCount)}`);
            this.setText('time', this.params.timePressure ? `⏱ ${Math.max(0, Math.ceil(this.limitLeft))}s` : `⏱ ${Math.floor(this.playTime)}s`);
            let hearts = '';
            for (let i = 0; i < this.maxLives; i++) hearts += `<span class="gx-heart${i < this.lives ? '' : ' lost'}">♥</span>`;
            if (this.hudCache.heartsHtml !== hearts && this.refs.hearts) {
                this.hudCache.heartsHtml = hearts;
                this.refs.hearts.innerHTML = hearts;
            }
        }

        showOverlay(kind) {
            if (!this.refs.overlay) return;
            const p = this.params;
            const stats = (rows) => `<div class="gx-stats">${rows.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('')}</div>`;
            let html = '';
            if (kind === 'start') {
                html = `<h2>${GAME_TITLE}</h2><p>Level ${this.pad(this.currentLevel)} · ${p.isHex ? 'Hex-Gitter' : 'Quadrat-Gitter'} · ${p.rows}×${p.cols} · ${p.mines} Minen<br>Linksklick: aufdecken · Rechtsklick/Langdruck: Flagge<br>Jedes Level ist per Logik lösbar. <b>T</b> = Selbsttest</p>
                    <div class="gx-actions"><button class="gx-btn" data-gx="start">Start</button></div>`;
            } else if (kind === 'pause') {
                html = `<h2>Pause</h2><p>Durchatmen. Das Feld wartet.</p>
                    <div class="gx-actions"><button class="gx-btn" data-gx="resume">Weiter</button><button class="gx-btn secondary" data-gx="retry">Neustart</button></div>`;
            } else if (kind === 'over') {
                html = `<h2>Game Over</h2><p>Alle Leben verbraucht.</p>
                    ${stats([['Score', this.score], ['Highscore', this.highScore], ['Level', this.pad(this.currentLevel)]])}
                    <div class="gx-actions"><button class="gx-btn" data-gx="retry">Level wiederholen</button><button class="gx-btn secondary" data-gx="restart">Von vorn</button></div>`;
            } else if (kind === 'complete') {
                html = `<h2>Level Complete!</h2><p>Minenfeld geräumt.</p>
                    ${stats([['Zeit', `${Math.floor(this.playTime)}s (Par ${p.par}s)`], ['Bonus', `+${this.lastBonus}`], ['Score', this.score], ['Highscore', this.highScore]])}
                    <div class="gx-actions"><button class="gx-btn" data-gx="next">Level ${this.pad(this.currentLevel + 1)} ➔</button></div>`;
            }
            this.refs.overlay.innerHTML = `<div class="gx-modal gx-glass">${html}</div>`;
            this.refs.overlay.classList.add('active');
        }

        hideOverlay() {
            if (this.refs.overlay) this.refs.overlay.classList.remove('active');
        }

        // ---------- Persistence ----------

        loadBest() {
            try {
                if (typeof localStorage !== 'undefined') return parseInt(localStorage.getItem('gx-minesweeper-best') || '0', 10) || 0;
            } catch (e) { /* storage unavailable */ }
            return 0;
        }

        saveBest() {
            try {
                if (typeof localStorage !== 'undefined') localStorage.setItem('gx-minesweeper-best', String(this.highScore));
            } catch (e) { /* storage unavailable */ }
        }

        // ---------- Update / Render loop ----------

        update(dt) {
            if (this.state === 'play' && !this.firstClick) {
                this.playTime += dt;
                if (this.params.timePressure) {
                    this.limitLeft -= dt;
                    if (this.limitLeft <= 0) {
                        this.limitLeft = this.params.timeLimit;
                        this.lives = Math.max(0, this.lives - 1);
                        this.combo = 0;
                        this.shake = 8;
                        this.sfx('playHit');
                        this.toast('Zeit abgelaufen! −♥', 'bad');
                        if (this.lives <= 0) this.triggerGameOver();
                    }
                }
            }

            if (this.bot && this.bot.active) this.updateBot(dt);
            if (!this.container) return;

            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    const cell = this.grid[r][c];
                    if (cell.appear < 1) cell.appear += dt * 4;
                    if (cell.pop > 0) cell.pop = Math.max(0, cell.pop - dt * 5);
                }
            }
            for (const p of this.particles) {
                p.life -= dt;
                p.vy += (p.g || 0) * dt;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
            }
            this.particles = this.particles.filter(p => p.life > 0);
            for (const f of this.floaters) { f.life -= dt; f.y -= 40 * dt; }
            this.floaters = this.floaters.filter(f => f.life > 0);
            this.shake = Math.max(0, this.shake - dt * 30);
            this.updateHUD();
        }

        loop() {
            this.animId = requestAnimationFrame(this.loop);
            if (this.isPaused || !this.ctx) return;
            const t = now();
            const dt = Math.min(0.05, Math.max(0, (t - this.lastFrame) / 1000));
            this.lastFrame = t;
            try {
                this.update(dt);
                const r0 = now();
                this.render();
                const rm = now() - r0;
                const pf = this.perf;
                pf.frames++;
                pf.time += dt;
                pf.renderMs += rm;
                pf.renderMax = Math.max(pf.renderMax, rm);
            } catch (e) {
                this.errors.push(e);
                if (this.errors.length < 4) console.error('[Minesweeper] frame error', e);
            }
        }

        cellPath(ctx, x, y, size) {
            ctx.beginPath();
            if (this.isHex) {
                for (let k = 0; k < 6; k++) {
                    const a = -Math.PI / 2 + k * Math.PI / 3;
                    const px = x + Math.cos(a) * size, py = y + Math.sin(a) * size;
                    if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.closePath();
                return;
            }
            const h = size / 2;
            if (ctx.roundRect) ctx.roundRect(x - h, y - h, size, size, Math.max(2, size * 0.16));
            else ctx.rect(x - h, y - h, size, size);
        }

        render() {
            const ctx = this.ctx;
            const w = this.width, h = this.height;
            ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

            const bg = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, Math.max(w, h) * 0.7);
            bg.addColorStop(0, '#1e293b');
            bg.addColorStop(1, '#020617');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, w, h);

            ctx.save();
            if (this.shake > 0.1) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // square: edge length; hex: circumradius
            const baseSize = this.isHex ? this.hexSize * 0.94 : this.cellSize - 2;

            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    const cell = this.grid[r][c];
                    const p = this.cellCenter(r, c);
                    const showRevealed = cell.isRevealed && cell.appear > 0;
                    const isHover = this.hover && this.hover.r === r && this.hover.c === c && this.state === 'play';
                    let scale = 1;
                    if (cell.isRevealed && cell.appear < 1) {
                        const t = clamp(cell.appear, 0, 1) / 1;
                        scale = 0.6 + 0.4 * (1 - Math.pow(1 - t, 3));
                    }
                    if (cell.pop > 0) scale += cell.pop * 0.18;
                    const size = baseSize * scale;

                    this.cellPath(ctx, p.x, p.y, size);
                    if (showRevealed) {
                        ctx.fillStyle = cell.isMine ? (cell.isBlown ? '#b91c1c' : '#7f1d1d') : '#0b1220';
                        ctx.fill();
                        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
                        ctx.stroke();
                        if (cell.isMine) this.drawMine(ctx, p.x, p.y, baseSize * 0.3, cell.isBlown);
                        else if (cell.count > 0) {
                            ctx.fillStyle = NUM_COLORS[cell.count - 1];
                            ctx.font = `bold ${Math.floor(baseSize * 0.58)}px system-ui, sans-serif`;
                            ctx.fillText(String(cell.count), p.x, p.y + 1);
                        }
                    } else {
                        const g = ctx.createLinearGradient(p.x, p.y - size / 2, p.x, p.y + size / 2);
                        g.addColorStop(0, isHover ? '#64748b' : '#475569');
                        g.addColorStop(1, isHover ? '#475569' : '#334155');
                        ctx.fillStyle = g;
                        ctx.fill();
                        ctx.strokeStyle = 'rgba(255,255,255,0.14)';
                        ctx.stroke();
                        if (cell.isFlagged) this.drawFlag(ctx, p.x, p.y, baseSize * 0.34);
                    }
                }
            }

            for (const f of this.floaters) {
                ctx.globalAlpha = clamp(f.life, 0, 1);
                ctx.fillStyle = f.color;
                ctx.font = 'bold 16px system-ui, sans-serif';
                ctx.fillText(f.text, f.x, f.y);
            }
            for (const p of this.particles) {
                ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            }
            ctx.globalAlpha = 1;
            ctx.restore();
        }

        drawMine(ctx, x, y, rad, blown) {
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = Math.max(1.5, rad * 0.25);
            ctx.beginPath();
            for (let k = 0; k < 4; k++) {
                const a = k * Math.PI / 4;
                ctx.moveTo(x - Math.cos(a) * rad * 1.45, y - Math.sin(a) * rad * 1.45);
                ctx.lineTo(x + Math.cos(a) * rad * 1.45, y + Math.sin(a) * rad * 1.45);
            }
            ctx.stroke();
            ctx.fillStyle = blown ? '#fecaca' : '#0f172a';
            ctx.beginPath();
            ctx.arc(x, y, rad, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineWidth = 1;
        }

        drawFlag(ctx, x, y, s) {
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = Math.max(1.5, s * 0.18);
            ctx.beginPath();
            ctx.moveTo(x - s * 0.3, y + s);
            ctx.lineTo(x - s * 0.3, y - s);
            ctx.stroke();
            ctx.fillStyle = '#f43f5e';
            ctx.beginPath();
            ctx.moveTo(x - s * 0.3, y - s);
            ctx.lineTo(x + s * 0.9, y - s * 0.4);
            ctx.lineTo(x - s * 0.3, y + s * 0.2);
            ctx.closePath();
            ctx.fill();
            ctx.lineWidth = 1;
        }

        pause() {
            this.isPaused = true;
            if (this.state === 'play') {
                this.state = 'pause';
                this.showOverlay('pause');
            }
        }

        resume() {
            this.isPaused = false;
            this.lastFrame = now();
            if (this.state === 'pause') {
                this.state = 'play';
                this.hideOverlay();
            }
        }

        destroy() {
            if (this.animId) cancelAnimationFrame(this.animId);
            this.animId = null;
            this.timers.forEach(t => clearTimeout(t));
            this.timers = [];
            if (this.overlayTimer) clearTimeout(this.overlayTimer);
            this.overlayTimer = null;
            this.clearLongPress();
            this.bot = null;
            for (const [target, type, fn] of this.listeners) {
                if (target && target.removeEventListener) target.removeEventListener(type, fn);
            }
            this.listeners = [];
            if (this.container) {
                if (this.container.classList) this.container.classList.remove('gx-root');
                this.container.innerHTML = '';
            }
        }

        // ---------- Bot / Autoplay ----------

        botView() {
            const n = this.rows * this.cols;
            const state = new Int8Array(n);
            const counts = new Int8Array(n);
            for (let i = 0; i < n; i++) {
                const cell = this.grid[Math.floor(i / this.cols)][i % this.cols];
                if (cell.isRevealed && !cell.isMine) { state[i] = 1; counts[i] = cell.count; }
                else if (cell.isBlown || cell.isFlagged) state[i] = 2;
            }
            return { n, state, counts };
        }

        /** One bot decision based only on visible state. Returns 'first' | 'click' | 'flag' | 'guess' | 'none'. */
        botStep() {
            if (this.state !== 'play') return 'none';
            if (this.firstClick) {
                this.handleClick(this.rows >> 1, this.cols >> 1);
                return 'first';
            }
            const { n, state, counts } = this.botView();
            const res = MinesweeperGame.deduce(n, this.nb, state, counts, this.totalMines);
            const at = (i) => [Math.floor(i / this.cols), i % this.cols];
            if (res.safe.length) {
                const [r, c] = at(res.safe[0]);
                this.handleClick(r, c);
                return 'click';
            }
            if (res.mines.length) {
                const [r, c] = at(res.mines[0]);
                this.toggleFlag(r, c);
                return 'flag';
            }
            let best = -1, bestP = Infinity;
            for (let i = 0; i < n; i++) {
                if (state[i] !== 0) continue;
                let p = 0;
                for (const j of this.nb[i]) {
                    if (state[j] !== 1 || counts[j] <= 0) continue;
                    let u = 0, m = 0;
                    for (const k of this.nb[j]) { if (state[k] === 0) u++; else if (state[k] === 2) m++; }
                    if (u) p = Math.max(p, (counts[j] - m) / u);
                }
                if (p === 0) p = this.totalMines / n;
                if (p < bestP) { bestP = p; best = i; }
            }
            if (best < 0) return 'none';
            const [r, c] = at(best);
            this.handleClick(r, c);
            return 'guess';
        }

        runFullTest(levels = 3) {
            if (!this.container) return;
            const head = MinesweeperGame.selfTest(levels);
            this.score = 0;
            this.startLevel(1);
            this.bot = { active: true, timer: 0, interval: 0.06, wait: 0, levels, done: 0, rows: [], guesses: 0, head };
            this.perf = { frames: 0, time: 0, renderMs: 0, renderMax: 0 };
            this.toast('Autoplay-Test läuft (T = Stopp)', 'info');
        }

        updateBot(dt) {
            const b = this.bot;
            if (this.state === 'complete') {
                b.wait += dt;
                if (b.wait > 1.0) {
                    b.wait = 0;
                    this.pushBotRow('WIN');
                    b.done++;
                    if (b.done >= b.levels) this.stopBot('abgeschlossen');
                    else this.nextLevel();
                }
                return;
            }
            if (this.state === 'over') {
                this.pushBotRow('GAME OVER');
                this.stopBot('Spiel verloren');
                return;
            }
            if (this.state !== 'play') return;
            b.timer += dt;
            while (b.timer >= b.interval && this.state === 'play') {
                b.timer -= b.interval;
                const a = this.botStep();
                if (a === 'guess') b.guesses++;
                if (a === 'none') break;
            }
        }

        pushBotRow(result) {
            const b = this.bot;
            b.rows.push({
                Level: this.currentLevel, Ergebnis: result, Gitter: `${this.rows}x${this.cols}${this.isHex ? ' hex' : ''}`,
                Minen: this.totalMines, 'Lösbar': this.solvable, Züge: this.moves, 'Rate-Züge': b.guesses,
                'Zeit(s)': +this.playTime.toFixed(1), Leben: this.lives, Score: this.score
            });
            b.guesses = 0;
        }

        stopBot(reason) {
            const b = this.bot;
            if (!b || !b.active) return;
            b.active = false;
            const pf = this.perf;
            const fps = pf.time > 0 ? pf.frames / pf.time : 0;
            const passed = b.rows.filter(r => r.Ergebnis === 'WIN').length;
            console.group(`%c[Minesweeper] Autoplay-Test ${reason}`, 'color:#22d3ee;font-weight:bold');
            if (b.rows.length) console.table(b.rows);
            console.table([{
                Frames: pf.frames, 'FPS': +fps.toFixed(1),
                'Render ø (ms)': +(pf.frames ? pf.renderMs / pf.frames : 0).toFixed(3),
                'Render max (ms)': +pf.renderMax.toFixed(3), 'Frame-Fehler': this.errors.length
            }]);
            console.log(`Autoplay: ${passed}/${b.levels} Level gelöst – ${passed === b.levels ? 'PASS' : 'FAIL'}`);
            console.groupEnd();
            window.RUN_TESTS_RESULT = { head: b.head, autoplay: b.rows, passed: passed === b.levels };
            this.toast(passed === b.levels ? 'Test bestanden ✔' : 'Test beendet', passed === b.levels ? 'good' : 'bad');
        }

        // ---------- Sanity & self test ----------

        quickSanity() {
            const problems = [];
            try {
                if (!this.grid.length || this.grid.length !== this.rows) problems.push('Grid-Zeilen ungültig');
                if (this.grid.some(row => !row || row.length !== this.cols)) problems.push('Grid-Spalten ungültig');
                if (!this.nb || this.nb.length !== this.rows * this.cols) problems.push('Nachbar-Cache ungültig');
                if (this.container && !this.ctx) problems.push('Canvas-Kontext fehlt');
                if (!(this.totalMines > 0)) problems.push('Minenzahl ungültig');
            } catch (e) {
                problems.push('Ausnahme: ' + e.message);
            }
            if (problems.length) console.warn('[Minesweeper] Init-Sanity-Check fehlgeschlagen:', problems);
            return problems;
        }

        /** Headless validation (no DOM needed). Logs a console.table and returns {ok, results}. */
        static selfTest(levels = 3) {
            const results = [];
            const check = (name, fn) => {
                const t0 = now();
                let ok = false, detail = '';
                try {
                    const r = fn();
                    ok = r === true || (!!r && r.ok === true);
                    detail = (r && r.detail) || '';
                } catch (e) {
                    detail = 'Exception: ' + e.message;
                }
                results.push({ Test: name, Ergebnis: ok ? 'PASS' : 'FAIL', ms: +(now() - t0).toFixed(2), Details: detail });
            };
            const make = (level) => {
                const g = new MinesweeperGame();
                g.startLevel(level);
                return g;
            };
            const cellAt = (g, i) => g.grid[Math.floor(i / g.cols)][i % g.cols];

            check('Initialisierung / Null-Checks', () => {
                const g = make(1);
                return g.quickSanity().length === 0 && g.grid.every(r => r.every(c => c && !c.isMine && c.count === 0));
            });

            check('Level-Skalierung monoton (1-60)', () => {
                let prev = MinesweeperGame.levelParams(1);
                for (let L = 2; L <= 60; L++) {
                    const p = MinesweeperGame.levelParams(L);
                    if (p.rows < prev.rows || p.speed <= prev.speed || p.mines < Math.floor(prev.mines * 0.75)) return { ok: false, detail: 'Level ' + L };
                    if (p.mines >= p.rows * p.cols - 9) return { ok: false, detail: 'Zu viele Minen L' + L };
                    prev = p;
                }
                return { ok: true, detail: 'Speed +10%/Level, Dichte/Gittergröße steigen' };
            });

            check('Nachbarschaft symmetrisch (Quadrat+Hex)', () => {
                for (const hex of [false, true]) {
                    const nb = MinesweeperGame.computeNeighbors(11, 13, hex);
                    for (let i = 0; i < nb.length; i++) for (const j of nb[i]) if (!nb[j].includes(i)) return { ok: false, detail: `hex=${hex} ${i}->${j}` };
                }
                return true;
            });

            check('Erster Klick sicher + Zahlen korrekt', () => {
                for (const L of [1, 3, 9, 20]) {
                    const g = make(L);
                    const s = (g.rows >> 1) * g.cols + (g.cols >> 1);
                    g.handleClick(g.rows >> 1, g.cols >> 1);
                    if ([s, ...g.nb[s]].some(i => cellAt(g, i).isMine)) return { ok: false, detail: 'Mine in Startzone L' + L };
                    let mines = 0;
                    for (let i = 0; i < g.rows * g.cols; i++) {
                        const cell = cellAt(g, i);
                        if (cell.isMine) { mines++; continue; }
                        if (g.nb[i].filter(j => cellAt(g, j).isMine).length !== cell.count) return { ok: false, detail: 'Zahl falsch L' + L };
                    }
                    if (mines !== g.totalMines) return { ok: false, detail: 'Minenanzahl L' + L };
                }
                return true;
            });

            check('Punkteberechnung', () => {
                const g = make(1);
                g.handleClick(g.rows >> 1, g.cols >> 1);
                let n = 0;
                g.grid.forEach(row => row.forEach(c => { if (c.isRevealed && !c.isMine) n++; }));
                const formula = MinesweeperGame.revealPoints(3, 4, 3) === Math.round(4 * 10 * 1.2 * 1.2);
                return { ok: g.score === MinesweeperGame.revealPoints(1, n, 1) && formula && g.combo === 1, detail: `${n} Felder = ${g.score} Pkt` };
            });

            check('Generator: Lösbarkeit (L1-30)', () => {
                let solvable = 0, ms = 0;
                for (let L = 1; L <= 30; L++) {
                    const g = make(L);
                    g.populateMines(g.rows >> 1, g.cols >> 1);
                    ms += g.genStats.ms;
                    if (g.solvable) solvable++;
                }
                return { ok: solvable === 30, detail: `${solvable}/30 lösbar, ø ${(ms / 30).toFixed(1)} ms` };
            });

            check(`Bot löst Level 1-${levels} headless`, () => {
                const g = new MinesweeperGame();
                for (let L = 1; L <= levels; L++) {
                    g.startLevel(L);
                    let steps = 0, last = g.score;
                    while (g.state === 'play' && steps++ < 5000) {
                        const act = g.botStep();
                        g.update(0.1);
                        if (g.score < last) return { ok: false, detail: 'Score sank' };
                        last = g.score;
                        if (act === 'none') break;
                    }
                    if (g.state !== 'complete') return { ok: false, detail: `Level ${L} Status ${g.state}` };
                    for (const row of g.grid) for (const c of row) {
                        if (!c.isMine && !c.isRevealed) return { ok: false, detail: 'Nicht aufgedeckte Zelle' };
                        if (c.isMine && c.isRevealed) return { ok: false, detail: 'Ungültige Kollision' };
                    }
                }
                return { ok: g.score > 0, detail: `Score ${g.score}` };
            });

            const ok = results.every(r => r.Ergebnis === 'PASS');
            console.group(`%c[Minesweeper] Self-Test ${ok ? 'PASS' : 'FAIL'}`, `color:${ok ? '#34d399' : '#f87171'};font-weight:bold`);
            console.table(results);
            console.groupEnd();
            return { ok, results };
        }
    }

    window.MinesweeperGame = MinesweeperGame;
})();
