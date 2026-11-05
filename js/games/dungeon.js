/**
 * Shadow Labyrinth - Roguelike Dungeon Crawler
 *
 * - Einheitliches Glassmorphism-UI (HUD, Overlays, Toasts) per JS injiziert
 * - Seed-basierte prozedurale Ebenen mit BFS-Loesbarkeitsgarantie
 * - Mathematisch skalierende Schwierigkeit (+10% Gegnertempo / Ebene, neue Gegnertypen)
 * - Juice: Partikel, Screen-Shake, Fog-of-War mit Lichtabfall, Fade-Uebergaenge
 * - Integrierter Self-Test mit Bot (Taste 'T' oder window.RUN_TESTS = true)
 */

(function () {
    'use strict';

    // ---------------------------------------------------------------- Design-System
    const UI_CSS = `
.gu-root{position:absolute;inset:0;pointer-events:none;font-family:'Inter','Segoe UI',system-ui,-apple-system,sans-serif;color:#e2e8f0;user-select:none}
.gu-glass{background:rgba(15,23,42,.75);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.1);border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.35)}
.gu-header{position:absolute;top:8px;left:8px;right:8px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;padding:8px 16px;pointer-events:auto;z-index:5}
.gu-left{display:flex;flex-direction:column;line-height:1.15}
.gu-title{font-weight:700;font-size:14px;letter-spacing:.04em}
.gu-level{font-size:12px;color:#22d3ee;font-weight:600;font-variant-numeric:tabular-nums}
.gu-center{text-align:center;font-variant-numeric:tabular-nums;line-height:1.15}
.gu-score{font-size:20px;font-weight:700}
.gu-best{font-size:11px;color:#94a3b8}
.gu-right{display:flex;align-items:center;justify-content:flex-end;gap:12px;font-size:13px}
.gu-hearts{display:flex;gap:2px;font-size:16px;color:#f43f5e}
.gu-bar{width:60px;height:7px;background:rgba(255,255,255,.12);border-radius:4px;overflow:hidden}
.gu-bar>div{height:100%;width:100%;background:linear-gradient(90deg,#38bdf8,#22d3ee);transition:width .2s}
.gu-gold{color:#fbbf24;font-weight:600}
.gu-icon-btn{pointer-events:auto;cursor:pointer;width:30px;height:30px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);color:#e2e8f0;font-size:14px;transition:background .15s,transform .1s}
.gu-icon-btn:hover{background:rgba(99,102,241,.35)}
.gu-icon-btn:active{transform:scale(.92)}
.gu-toasts{position:absolute;top:76px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px;z-index:6}
.gu-toast{padding:8px 18px;font-weight:700;font-size:14px;animation:gu-toast 1.8s ease forwards}
@keyframes gu-toast{0%{opacity:0;transform:translateY(-10px) scale(.9)}12%{opacity:1;transform:none}80%{opacity:1}100%{opacity:0;transform:translateY(-6px)}}
.gu-overlay{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(2,6,23,.5);pointer-events:auto;z-index:10}
.gu-overlay.active{display:flex;animation:gu-fade .25s ease}
@keyframes gu-fade{from{opacity:0}to{opacity:1}}
.gu-card{min-width:280px;max-width:420px;padding:28px 32px;text-align:center;animation:gu-pop .3s cubic-bezier(.2,.9,.3,1.2)}
@keyframes gu-pop{from{transform:scale(.9)}to{transform:scale(1)}}
.gu-card h2{margin:0 0 6px;font-size:26px;letter-spacing:.03em}
.gu-card p{margin:0 0 16px;color:#94a3b8;font-size:13px;line-height:1.5}
.gu-stats{margin:0 0 18px;font-size:14px;line-height:1.7;font-variant-numeric:tabular-nums}
.gu-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.gu-btn{cursor:pointer;border:none;border-radius:10px;padding:10px 22px;font-size:14px;font-weight:700;color:#fff;background:linear-gradient(135deg,#6366f1,#06b6d4);box-shadow:0 4px 16px rgba(99,102,241,.4);transition:transform .12s,box-shadow .12s,filter .12s}
.gu-btn:hover{filter:brightness(1.15);box-shadow:0 6px 22px rgba(99,102,241,.6);transform:translateY(-1px)}
.gu-btn:active{transform:scale(.95)}
.gu-btn.secondary{background:rgba(255,255,255,.08);box-shadow:none;border:1px solid rgba(255,255,255,.15)}
@media (max-width:640px){.gu-header{grid-template-columns:1fr 1fr;padding:6px 10px}.gu-center{grid-column:1/3;order:3}.gu-bar{width:40px}}
`;

    function injectStyles() {
        if (typeof document === 'undefined' || !document.head || !document.head.appendChild) return;
        if (document.getElementById && document.getElementById('gu-style')) return;
        const s = document.createElement('style');
        s.id = 'gu-style';
        s.textContent = UI_CSS;
        document.head.appendChild(s);
    }

    // ---------------------------------------------------------------- Helfer
    function mulberry32(a) {
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const DIRS = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
    const STEP = 1 / 60;
    const HS_KEY = 'shadow_labyrinth_highscore';

    // Schwierigkeitsformeln (zentral, nachvollziehbar)
    const Difficulty = {
        speedMul: (f) => Math.min(3, 1 + 0.10 * (f - 1)),            // +10% Tempo je Ebene
        hpMul: (f) => 1 + 0.10 * (f - 1),                            // +10% Gegner-HP je Ebene
        dmgMul: (f) => 1 + 0.05 * (f - 1),                           // +5% Gegner-Schaden je Ebene
        playerDmgMul: (f) => 1 + 0.06 * (f - 1),                     // Spieler skaliert langsamer
        enemyCount: (f) => Math.min(22, 3 + Math.floor(f * 0.8)),    // steigende Dichte
        roomCount: (f) => 5 + Math.min(8, Math.floor(f / 3)),
        types: (f) => (f >= 6 ? ['grunt', 'bat', 'brute'] : f >= 3 ? ['grunt', 'bat'] : ['grunt'])
    };

    const ENEMY_TYPES = {
        grunt: { hp: 30, dmg: 8, delay: 0.45, aggro: 9, radius: 0.32, color: '#ef4444', score: 30, erratic: 0 },
        bat: { hp: 18, dmg: 5, delay: 0.22, aggro: 12, radius: 0.24, color: '#a855f7', score: 40, erratic: 0.35 },
        brute: { hp: 90, dmg: 16, delay: 0.70, aggro: 8, radius: 0.42, color: '#f97316', score: 80, erratic: 0 }
    };

    window.DungeonGame = class {
        constructor() {
            this.container = null;
            this.canvas = null;
            this.ctx = null;
            this.animId = null;
            this.isPaused = false;      // von aussen (Portal/Boss-Screen)
            this.state = 'start';       // start | playing | paused | gameover | complete
            this.headless = false;
            this.destroyed = false;

            this.tileSize = 28;
            this.mapW = 28;
            this.mapH = 22;
            this.headerH = 64;
            this.grid = [];
            this.revealed = [];
            this.distMap = null;

            this.runSeed = (Math.random() * 1e9) | 0;
            this.rng = mulberry32(1);
            this.resetRun();

            this.enemies = [];
            this.items = [];
            this.projectiles = [];
            this.particles = [];
            this.swings = [];
            this.stairs = { x: 0, y: 0 };

            this.keys = {};
            this.botControlled = false;
            this.botInput = { dx: 0, dy: 0 };
            this.godMode = false;

            this.shake = 0;
            this.fade = 0;
            this.time = 0;
            this.stats = { kills: 0, goldCollected: 0 };
            this.perf = { fps: 0, renderMs: 0, updateMs: 0 };
            this.toastTimers = new Set();
            this.ui = null;
            this.highscore = this.loadHighscore();
        }

        resetRun() {
            this.floor = 1;
            this.score = 0;
            this.floorStartScore = 0;
            this.combo = 0;
            this.comboTimer = 0;
            this.player = {
                x: 5, y: 5, px: 5, py: 5,
                hp: 100, maxHp: 100,
                mana: 60, maxMana: 60,
                gold: 0,
                dir: { x: 0, y: 1 },
                moveCd: 0, atkCd: 0, fireCd: 0, invuln: 0
            };
        }

        // ------------------------------------------------------------ Lebenszyklus
        init(container, options = {}) {
            this.container = container;
            this.container.innerHTML = '';
            injectStyles();

            this.canvas = document.createElement('canvas');
            this.canvas.className = 'game-canvas';
            this.ctx = this.canvas.getContext('2d');
            this.container.appendChild(this.canvas);

            this.buildUI();
            this.bindEvents();
            this.resize();

            this.startLevel(options.levelIndex || 1);
            this.showOverlay('start');

            requestAnimationFrame(() => this.resize());

            this.loop = this.loop.bind(this);
            this.lastT = (typeof performance !== 'undefined' ? performance.now() : Date.now());
            this.acc = 0;
            this.animId = requestAnimationFrame(this.loop);

            const errs = this.checkInvariants();
            if (errs.length) console.error('[Dungeon] Initialisierungsfehler:', errs);
            if (window.RUN_TESTS) setTimeout(() => this.runSelfTest(), 0);
        }

        // Ohne DOM/Canvas instanziierbar (fuer Self-Test und Node-Tests)
        initHeadless(floor = 1, seed = 12345) {
            this.headless = true;
            this.runSeed = seed;
            this.startLevel(floor);
            this.state = 'playing';
        }

        buildUI() {
            const root = document.createElement('div');
            root.className = 'gu-root';
            root.innerHTML = `
                <div class="gu-header gu-glass">
                    <div class="gu-left"><span class="gu-title">Shadow Labyrinth</span><span class="gu-level" id="gu-level">Level 01</span></div>
                    <div class="gu-center"><div class="gu-score" id="gu-score">0</div><div class="gu-best" id="gu-best">Highscore 0</div></div>
                    <div class="gu-right">
                        <div class="gu-bar" title="Mana"><div id="gu-mana"></div></div>
                        <div class="gu-hearts" id="gu-hearts"></div>
                        <span class="gu-gold" id="gu-gold">0 ◈</span>
                        <button class="gu-icon-btn" id="gu-pause" title="Pause (P)">❚❚</button>
                        <button class="gu-icon-btn" id="gu-mute" title="Mute (M)">🔊</button>
                    </div>
                </div>
                <div class="gu-toasts" id="gu-toasts"></div>
                <div class="gu-overlay" id="gu-overlay"><div class="gu-card gu-glass" id="gu-card"></div></div>
            `;
            this.container.appendChild(root);

            const q = (s) => root.querySelector ? root.querySelector(s) : null;
            this.ui = {
                root,
                level: q('#gu-level'), score: q('#gu-score'), best: q('#gu-best'),
                mana: q('#gu-mana'), hearts: q('#gu-hearts'), gold: q('#gu-gold'),
                pause: q('#gu-pause'), mute: q('#gu-mute'),
                toasts: q('#gu-toasts'), overlay: q('#gu-overlay'), card: q('#gu-card'),
                heartEls: []
            };

            if (this.ui.hearts && this.ui.hearts.appendChild) {
                for (let i = 0; i < 5; i++) {
                    const h = document.createElement('span');
                    h.textContent = '♥';
                    this.ui.hearts.appendChild(h);
                    this.ui.heartEls.push(h);
                }
            }

            this.ui.pause.onclick = () => this.togglePause();
            this.ui.mute.onclick = () => this.toggleMute();
            this.ui.overlay.onclick = (e) => {
                const a = e && e.target && e.target.dataset ? e.target.dataset.action : null;
                if (a) this.handleAction(a);
            };
        }

        resize() {
            if (!this.container || !this.canvas) return;
            const rect = this.container.getBoundingClientRect();
            const w = rect.width > 50 ? rect.width : (window.innerWidth || 800);
            const h = rect.height > 50 ? rect.height : ((window.innerHeight || 648) - 48);

            this.canvas.width = w;
            this.canvas.height = h;

            const byH = Math.floor((h - this.headerH - 8) / this.mapH);
            const byW = Math.floor((w - 16) / this.mapW);
            this.tileSize = clamp(Math.min(byH, byW), 12, 36);
        }

        bindEvents() {
            this.onResize = () => this.resize();
            this.onKeyDown = (e) => {
                if (this.destroyed) return;
                const t = e.target;
                if (t && (t.tagName === 'INPUT' || t.isContentEditable)) return;
                const c = e.code;
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(c) && e.preventDefault) e.preventDefault();

                if (c === 'KeyT') { this.runSelfTest(); return; }
                if (c === 'KeyM') { this.toggleMute(); return; }
                if (c === 'KeyP' || c === 'Escape') { this.togglePause(); return; }

                if (this.state !== 'playing') {
                    if (c === 'Enter' || c === 'Space') this.handleAction(this.overlayPrimary);
                    return;
                }
                this.keys[c] = true;
                if (c === 'Space') this.melee();
                if (c === 'KeyF') this.fireball();
            };
            this.onKeyUp = (e) => { this.keys[e.code] = false; };
            window.addEventListener('resize', this.onResize);
            window.addEventListener('keydown', this.onKeyDown);
            window.addEventListener('keyup', this.onKeyUp);
        }

        pause() { this.isPaused = true; }
        resume() { this.isPaused = false; }

        destroy() {
            this.destroyed = true;
            if (this.animId) cancelAnimationFrame(this.animId);
            window.removeEventListener('resize', this.onResize);
            window.removeEventListener('keydown', this.onKeyDown);
            window.removeEventListener('keyup', this.onKeyUp);
            this.toastTimers.forEach((t) => clearTimeout(t));
            this.toastTimers.clear();
            if (this.container) this.container.innerHTML = '';
        }

        // ------------------------------------------------------------ Zustaende / UI
        showOverlay(kind) {
            const info = {
                start: {
                    state: 'start', title: 'Shadow Labyrinth', action: 'start', btn: 'Spiel starten',
                    sub: 'WASD/Pfeile: Bewegen · Leertaste: Schwert · F: Feuerball<br>P: Pause · M: Ton · T: Self-Test'
                },
                paused: { state: 'paused', title: 'Pause', action: 'resume', btn: 'Fortsetzen', sub: 'Die Schatten warten auf dich.', extra: ['restart', 'Neustart'] },
                gameover: { state: 'gameover', title: 'Game Over', action: 'retry', btn: 'Ebene neu starten', sub: 'Die Dunkelheit hat dich verschlungen.', stats: true, extra: ['restart', 'Neuer Run'] },
                complete: { state: 'complete', title: 'Level Complete', action: 'next', btn: 'Nächste Ebene ➔', sub: 'Die Treppe in die Tiefe ist frei.', stats: true }
            }[kind];
            if (!info) return;
            this.state = info.state;
            this.overlayPrimary = info.action;
            if (!this.ui) return;

            const statsHtml = info.stats
                ? `<div class="gu-stats">Score: <b>${this.score}</b><br>Highscore: <b>${this.highscore}</b><br>Besiegt: <b>${this.stats.kills}</b> · Gold: <b>${this.player.gold}</b></div>`
                : '';
            const extra = info.extra ? `<button class="gu-btn secondary" data-action="${info.extra[0]}">${info.extra[1]}</button>` : '';
            this.ui.card.innerHTML = `<h2>${info.title}</h2><p>${info.sub}</p>${statsHtml}<div class="gu-btns"><button class="gu-btn" data-action="${info.action}">${info.btn}</button>${extra}</div>`;
            this.ui.overlay.classList.add('active');
        }

        hideOverlay() {
            this.state = 'playing';
            if (this.ui) this.ui.overlay.classList.remove('active');
        }

        handleAction(a) {
            if (a === 'start' || a === 'resume') { this.hideOverlay(); this.snd('playClick'); }
            else if (a === 'next') { this.startLevel(this.floor + 1); this.hideOverlay(); this.toast(`Level Up! Ebene ${this.floor}`); }
            else if (a === 'retry') {
                this.player.hp = this.player.maxHp;
                this.score = this.floorStartScore;
                this.startLevel(this.floor);
                this.hideOverlay();
            } else if (a === 'restart') {
                this.resetRun();
                this.stats = { kills: 0, goldCollected: 0 };
                this.startLevel(1);
                this.hideOverlay();
            }
        }

        togglePause() {
            if (this.state === 'playing') this.showOverlay('paused');
            else if (this.state === 'paused') this.hideOverlay();
        }

        toggleMute() {
            const am = window.AudioManager;
            if (!am || !am.toggleMute) return;
            const muted = am.toggleMute();
            if (this.ui) this.ui.mute.textContent = muted ? '🔇' : '🔊';
        }

        toast(msg) {
            if (this.headless || !this.ui || !this.ui.toasts) return;
            const el = document.createElement('div');
            el.className = 'gu-toast gu-glass';
            el.textContent = msg;
            this.ui.toasts.appendChild(el);
            const t = setTimeout(() => {
                this.toastTimers.delete(t);
                if (el.parentNode && el.parentNode.removeChild) el.parentNode.removeChild(el);
            }, 1800);
            this.toastTimers.add(t);
        }

        snd(name) {
            if (this.headless) return;
            const am = window.AudioManager;
            if (am && am[name]) am[name]();
        }

        updateHUD() {
            if (!this.ui) return;
            const p = this.player;
            this.ui.level.textContent = `Level ${String(this.floor).padStart(2, '0')}`;
            this.ui.score.textContent = String(this.score);
            this.ui.best.textContent = `Highscore ${this.highscore}`;
            this.ui.gold.textContent = `${p.gold} ◈`;
            this.ui.mana.style.width = `${clamp(p.mana / p.maxMana, 0, 1) * 100}%`;
            const per = p.maxHp / this.ui.heartEls.length;
            this.ui.heartEls.forEach((h, i) => {
                h.style.opacity = String(clamp((p.hp - i * per) / per, 0.18, 1));
            });
        }

        loadHighscore() {
            try { return parseInt(localStorage.getItem(HS_KEY), 10) || 0; } catch (e) { return 0; }
        }

        saveHighscore() {
            if (this.score > this.highscore) {
                this.highscore = this.score;
                if (!this.headless) { try { localStorage.setItem(HS_KEY, String(this.highscore)); } catch (e) { /* ignore */ } }
            }
        }

        // ------------------------------------------------------------ Level-Generator
        startLevel(levelIndex = 1) {
            this.floor = Math.max(1, Math.floor(levelIndex) || 1);
            this.enemies = [];
            this.items = [];
            this.projectiles = [];
            this.particles = [];
            this.swings = [];
            this.floorStartScore = this.score;
            this.combo = 0;
            this.comboTimer = 0;
            this.fade = 1;

            let ok = false;
            for (let attempt = 0; attempt < 8 && !ok; attempt++) {
                this.generateDungeon(attempt);
                ok = this.validateLevel().length === 0;
            }
            if (!ok) console.warn('[Dungeon] Levelvalidierung nach 8 Versuchen nicht bestanden, Ebene', this.floor);

            const p = this.player;
            p.px = p.x; p.py = p.y;
            p.moveCd = 0; p.invuln = 0;
            this.updateFogOfWar();
            this.computeDistMap();
            this.updateHUD();
            if (this.state === 'playing') this.toast(`Ebene ${this.floor}`);
        }

        generateDungeon(attempt = 0) {
            const rng = this.rng = mulberry32((this.runSeed + this.floor * 7919 + attempt * 104729) >>> 0);
            const W = this.mapW, H = this.mapH;
            this.grid = Array.from({ length: H }, () => Array(W).fill(1));
            this.revealed = Array.from({ length: H }, () => Array(W).fill(false));

            const rooms = [];
            const target = Difficulty.roomCount(this.floor);
            for (let tries = 0; tries < target * 12 && rooms.length < target; tries++) {
                const rw = 4 + Math.floor(rng() * 4);
                const rh = 4 + Math.floor(rng() * 4);
                const rx = 1 + Math.floor(rng() * (W - rw - 2));
                const ry = 1 + Math.floor(rng() * (H - rh - 2));
                const overlaps = rooms.some((r) => rx < r.x + r.w + 1 && rx + rw + 1 > r.x && ry < r.y + r.h + 1 && ry + rh + 1 > r.y);
                if (overlaps) continue;
                rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: rx + (rw >> 1), cy: ry + (rh >> 1) });
            }
            for (const r of rooms) {
                for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) this.grid[y][x] = 0;
            }

            // Sequentielle Verbindung garantiert Zusammenhang
            for (let i = 0; i < rooms.length - 1; i++) this.carve(rooms[i], rooms[i + 1], rng);
            // Zusaetzliche Schleifen ab Ebene 3 (mehr Fluchtwege, kein Einfluss auf Loesbarkeit)
            if (this.floor >= 3) {
                for (let i = 0; i < rooms.length - 2; i += 2) this.carve(rooms[i], rooms[i + 2], rng);
            }
            this.rooms = rooms;

            const start = rooms[0];
            this.player.x = start.cx;
            this.player.y = start.cy;

            // Treppe: Raum mit groesster Pfaddistanz zum Start
            const { dist } = this.bfs(start.cx, start.cy);
            let best = rooms[rooms.length - 1], bestD = -1;
            for (let i = 1; i < rooms.length; i++) {
                const d = dist[rooms[i].cy * W + rooms[i].cx];
                if (d > bestD) { bestD = d; best = rooms[i]; }
            }
            this.stairs = { x: best.cx, y: best.cy };

            const occupied = new Set([start.cy * W + start.cx, best.cy * W + best.cx]);
            const pick = (room) => {
                for (let t = 0; t < 20; t++) {
                    const x = room.x + Math.floor(rng() * room.w);
                    const y = room.y + Math.floor(rng() * room.h);
                    if (!occupied.has(y * W + x)) { occupied.add(y * W + x); return { x, y }; }
                }
                return null;
            };

            const types = Difficulty.types(this.floor);
            const count = Difficulty.enemyCount(this.floor);
            const spawnRooms = rooms.slice(1);
            for (let i = 0; i < count && spawnRooms.length; i++) {
                const room = spawnRooms[Math.floor(rng() * spawnRooms.length)];
                const c = pick(room);
                if (!c || dist[c.y * W + c.x] < 6) continue;
                this.enemies.push(this.makeEnemy(types[Math.floor(rng() * types.length)], c.x, c.y));
            }

            for (let i = 1; i < rooms.length; i++) {
                if (rng() < 0.65) {
                    const c = pick(rooms[i]);
                    if (c) this.items.push({ x: c.x, y: c.y, type: 'gold', val: 20 + this.floor * 5 });
                }
                const r = rng();
                if (r < 0.25) {
                    const c = pick(rooms[i]);
                    if (c) this.items.push({ x: c.x, y: c.y, type: 'heart', val: 25 });
                } else if (r < 0.5) {
                    const c = pick(rooms[i]);
                    if (c) this.items.push({ x: c.x, y: c.y, type: 'mana', val: 25 });
                }
            }
        }

        carve(a, b, rng) {
            let cx = a.cx, cy = a.cy;
            const horizFirst = rng() < 0.5;
            const h = () => { while (cx !== b.cx) { this.grid[cy][cx] = 0; cx += b.cx > cx ? 1 : -1; } };
            const v = () => { while (cy !== b.cy) { this.grid[cy][cx] = 0; cy += b.cy > cy ? 1 : -1; } };
            if (horizFirst) { h(); v(); } else { v(); h(); }
            this.grid[cy][cx] = 0;
        }

        makeEnemy(type, x, y) {
            const t = ENEMY_TYPES[type];
            const hp = Math.round(t.hp * Difficulty.hpMul(this.floor));
            return {
                type, x, y, px: x, py: y,
                hp, maxHp: hp,
                dmg: Math.round(t.dmg * Difficulty.dmgMul(this.floor)),
                moveDelay: t.delay / Difficulty.speedMul(this.floor),
                moveCd: 0.3 + Math.random() * 0.4,
                atkCd: 0.5, flash: 0
            };
        }

        isFloor(x, y) {
            return y >= 0 && y < this.mapH && x >= 0 && x < this.mapW && this.grid[y][x] === 0;
        }

        enemyAt(x, y) {
            return this.enemies.find((e) => e.x === x && e.y === y) || null;
        }

        // BFS ueber begehbare Felder; blocked: Set aus Zellindizes
        bfs(sx, sy, blocked = null) {
            const W = this.mapW, H = this.mapH;
            const dist = new Int16Array(W * H).fill(-1);
            const prev = new Int32Array(W * H).fill(-1);
            const queue = [sy * W + sx];
            dist[queue[0]] = 0;
            for (let qi = 0; qi < queue.length; qi++) {
                const cur = queue[qi];
                const cx = cur % W, cy = (cur / W) | 0;
                for (const d of DIRS) {
                    const nx = cx + d.x, ny = cy + d.y;
                    if (!this.isFloor(nx, ny)) continue;
                    const ni = ny * W + nx;
                    if (dist[ni] !== -1 || (blocked && blocked.has(ni))) continue;
                    dist[ni] = dist[cur] + 1;
                    prev[ni] = cur;
                    queue.push(ni);
                }
            }
            return { dist, prev };
        }

        computeDistMap() {
            this.distMap = this.bfs(this.player.x, this.player.y).dist;
        }

        // Loesbarkeitspruefung des aktuellen Levels
        validateLevel() {
            const errs = [];
            const W = this.mapW;
            if (!this.isFloor(this.player.x, this.player.y)) errs.push('Startposition ist keine Bodenflaeche');
            if (!this.isFloor(this.stairs.x, this.stairs.y)) errs.push('Treppe liegt in einer Wand');
            const { dist } = this.bfs(this.player.x, this.player.y);
            if (dist[this.stairs.y * W + this.stairs.x] < 0) errs.push('Treppe nicht erreichbar');
            for (const e of this.enemies) if (dist[e.y * W + e.x] < 0) errs.push(`Gegner unerreichbar (${e.x},${e.y})`);
            for (const it of this.items) if (dist[it.y * W + it.x] < 0) errs.push(`Item unerreichbar (${it.x},${it.y})`);
            return errs;
        }

        updateFogOfWar() {
            const radius = 6;
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const nx = this.player.x + dx;
                    const ny = this.player.y + dy;
                    if (nx >= 0 && nx < this.mapW && ny >= 0 && ny < this.mapH && Math.hypot(dx, dy) <= radius) {
                        this.revealed[ny][nx] = true;
                    }
                }
            }
        }

        // ------------------------------------------------------------ Spielaktionen
        melee() {
            const p = this.player;
            if (p.atkCd > 0 || this.state !== 'playing') return false;
            p.atkCd = 0.25;
            const tx = p.x + p.dir.x, ty = p.y + p.dir.y;
            this.swings.push({ x: tx, y: ty, t: 0.14 });
            const en = this.enemyAt(tx, ty);
            if (en) {
                this.damageEnemy(en, 25 * Difficulty.playerDmgMul(this.floor), p.dir);
                this.snd('playHit');
                return true;
            }
            this.snd('playClick');
            return false;
        }

        fireball() {
            const p = this.player;
            if (p.mana < 15 || p.fireCd > 0 || this.state !== 'playing') return false;
            p.mana -= 15;
            p.fireCd = 0.3;
            this.projectiles.push({ x: p.x, y: p.y, dx: p.dir.x, dy: p.dir.y, range: 7, acc: 0, speed: 12, dead: false });
            this.snd('playLaser');
            this.updateHUD();
            return true;
        }

        damageEnemy(en, dmg, dir) {
            en.hp -= dmg;
            en.flash = 0.12;
            this.burst(en.x + 0.5, en.y + 0.5, ENEMY_TYPES[en.type].color, 8, 4);
            this.addShake(2);
            if (en.hp > 0) return false;

            const idx = this.enemies.indexOf(en);
            if (idx >= 0) this.enemies.splice(idx, 1);
            this.stats.kills++;
            this.combo = this.comboTimer > 0 ? this.combo + 1 : 1;
            this.comboTimer = 3;
            const pts = this.addScore(ENEMY_TYPES[en.type].score, true);
            this.player.gold += 10;
            this.burst(en.x + 0.5, en.y + 0.5, ENEMY_TYPES[en.type].color, 22, 7);
            this.addShake(4);
            this.snd('playExplosion');
            if (this.combo >= 2) this.toast(`Combo x${Math.min(this.combo, 5)}  +${pts}`);
            this.updateHUD();
            return true;
        }

        // Punkte: Kills werden mit dem Combo-Multiplikator (max. x5) bewertet
        addScore(base, useCombo) {
            const pts = Math.round(base * (useCombo ? clamp(this.combo, 1, 5) : 1));
            this.score += pts;
            this.saveHighscore();
            return pts;
        }

        damagePlayer(dmg) {
            const p = this.player;
            if (p.invuln > 0 || this.godMode || this.state !== 'playing') return;
            p.hp = Math.max(0, p.hp - dmg);
            p.invuln = 0.6;
            this.addShake(8);
            this.burst(p.x + 0.5, p.y + 0.5, '#f43f5e', 14, 5);
            this.snd('playHit');
            this.updateHUD();
            if (p.hp <= 0) this.triggerGameOver();
        }

        triggerGameOver() {
            this.saveHighscore();
            this.snd('playExplosion');
            this.showOverlay('gameover');
        }

        triggerWin() {
            this.addScore(100 * this.floor, false);
            this.snd('playWin');
            this.burst(this.stairs.x + 0.5, this.stairs.y + 0.5, '#10b981', 40, 8);
            this.updateHUD();
            this.showOverlay('complete');
        }

        tryMove(dx, dy) {
            const p = this.player;
            p.dir = { x: dx, y: dy };
            const nx = p.x + dx, ny = p.y + dy;
            if (!this.isFloor(nx, ny)) return false;
            if (this.enemyAt(nx, ny)) { this.melee(); return false; }
            p.x = nx; p.y = ny;
            this.updateFogOfWar();
            this.computeDistMap();
            this.checkPickups();
            if (p.x === this.stairs.x && p.y === this.stairs.y) this.triggerWin();
            return true;
        }

        checkPickups() {
            const p = this.player;
            for (let i = this.items.length - 1; i >= 0; i--) {
                const it = this.items[i];
                if (it.x !== p.x || it.y !== p.y) continue;
                this.items.splice(i, 1);
                if (it.type === 'gold') {
                    p.gold += it.val;
                    this.stats.goldCollected += it.val;
                    this.addScore(it.val, false);
                    this.burst(it.x + 0.5, it.y + 0.5, '#fbbf24', 10, 4);
                } else if (it.type === 'heart') {
                    p.hp = Math.min(p.maxHp, p.hp + it.val);
                    this.burst(it.x + 0.5, it.y + 0.5, '#f43f5e', 10, 4);
                    this.toast('+25 HP');
                } else if (it.type === 'mana') {
                    p.mana = Math.min(p.maxMana, p.mana + it.val);
                    this.burst(it.x + 0.5, it.y + 0.5, '#38bdf8', 10, 4);
                    this.toast('+25 Mana');
                }
                this.snd('playPowerup');
                this.updateHUD();
            }
        }

        // ------------------------------------------------------------ Update
        loop() {
            this.animId = requestAnimationFrame(this.loop);
            if (!this.ctx) return;
            const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
            const frame = Math.min(0.1, (now - this.lastT) / 1000);
            this.lastT = now;
            if (frame > 0) this.perf.fps = this.perf.fps * 0.9 + (1 / frame) * 0.1;

            if (!this.isPaused) {
                this.acc += frame;
                const t0 = now;
                let steps = 0;
                while (this.acc >= STEP && steps++ < 6) {
                    if (this.state === 'playing') this.update(STEP);
                    this.updateEffects(STEP);
                    this.acc -= STEP;
                }
                const t1 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
                this.perf.updateMs = this.perf.updateMs * 0.9 + (t1 - t0) * 0.1;
            }
            const r0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
            this.render();
            const r1 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
            this.perf.renderMs = this.perf.renderMs * 0.9 + (r1 - r0) * 0.1;
        }

        readInput() {
            if (this.botControlled) return this.botInput;
            const k = this.keys;
            let dx = 0, dy = 0;
            if (k['KeyW'] || k['ArrowUp']) dy = -1;
            else if (k['KeyS'] || k['ArrowDown']) dy = 1;
            else if (k['KeyA'] || k['ArrowLeft']) dx = -1;
            else if (k['KeyD'] || k['ArrowRight']) dx = 1;
            return { dx, dy };
        }

        update(dt) {
            const p = this.player;
            this.time += dt;
            p.moveCd -= dt;
            p.atkCd -= dt;
            p.fireCd -= dt;
            p.invuln -= dt;
            p.mana = Math.min(p.maxMana, p.mana + 3 * dt);
            if (this.comboTimer > 0) {
                this.comboTimer -= dt;
                if (this.comboTimer <= 0) this.combo = 0;
            }

            if (p.moveCd <= 0) {
                const { dx, dy } = this.readInput();
                if (dx !== 0 || dy !== 0) {
                    this.tryMove(dx, dy);
                    p.moveCd = 0.13;
                    if (this.state !== 'playing') return;
                }
            }

            this.updateEnemies(dt);
            this.updateProjectiles(dt);
            if (this.state === 'playing' && Math.floor(this.time * 2) !== Math.floor((this.time - dt) * 2)) this.updateHUD();
        }

        updateEnemies(dt) {
            const p = this.player;
            const W = this.mapW;
            for (const en of this.enemies) {
                const t = ENEMY_TYPES[en.type];
                en.moveCd -= dt;
                en.atkCd -= dt;
                en.flash -= dt;

                const adjacent = Math.abs(en.x - p.x) + Math.abs(en.y - p.y) === 1;
                if (adjacent) {
                    if (en.atkCd <= 0) {
                        en.atkCd = 0.9;
                        this.damagePlayer(en.dmg);
                        if (this.state !== 'playing') return;
                    }
                    continue;
                }
                if (en.moveCd > 0) continue;
                en.moveCd = en.moveDelay;

                const d = this.distMap ? this.distMap[en.y * W + en.x] : -1;
                const cands = DIRS
                    .map((v) => ({ x: en.x + v.x, y: en.y + v.y }))
                    .filter((c) => this.isFloor(c.x, c.y) && !this.enemyAt(c.x, c.y) && !(c.x === p.x && c.y === p.y));
                if (!cands.length) continue;

                let next;
                const chasing = d >= 0 && d <= t.aggro;
                if (chasing && Math.random() >= t.erratic) {
                    cands.sort((a, b) => this.distMap[a.y * W + a.x] - this.distMap[b.y * W + b.x]);
                    next = cands[0];
                    if (this.distMap[next.y * W + next.x] >= d) next = null;
                } else if (!chasing && Math.random() < 0.25) {
                    next = cands[Math.floor(Math.random() * cands.length)];
                } else if (chasing) {
                    next = cands[Math.floor(Math.random() * cands.length)];
                }
                if (next) { en.x = next.x; en.y = next.y; }
            }
        }

        // Tile-fuer-Tile-Bewegung: kein Tunneling bei hohen Geschwindigkeiten
        updateProjectiles(dt) {
            for (let i = this.projectiles.length - 1; i >= 0; i--) {
                const pr = this.projectiles[i];
                pr.acc += dt * pr.speed;
                while (pr.acc >= 1 && !pr.dead) {
                    pr.acc -= 1;
                    const nx = pr.x + pr.dx, ny = pr.y + pr.dy;
                    if (!this.isFloor(nx, ny)) {
                        this.burst(pr.x + 0.5, pr.y + 0.5, '#f97316', 8, 4);
                        pr.dead = true;
                        break;
                    }
                    pr.x = nx; pr.y = ny;
                    const en = this.enemyAt(nx, ny);
                    if (en) {
                        this.damageEnemy(en, 40 * Difficulty.playerDmgMul(this.floor), { x: pr.dx, y: pr.dy });
                        pr.dead = true;
                        break;
                    }
                    if (--pr.range <= 0) pr.dead = true;
                }
                if (pr.dead) this.projectiles.splice(i, 1);
            }
        }

        // ------------------------------------------------------------ Effekte
        addShake(v) { if (!this.headless) this.shake = Math.min(12, this.shake + v); }

        burst(x, y, color, n, speed) {
            if (this.headless) return;
            for (let i = 0; i < n && this.particles.length < 500; i++) {
                const a = Math.random() * Math.PI * 2;
                const s = (0.3 + Math.random()) * speed;
                const life = 0.3 + Math.random() * 0.4;
                this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color, size: 1.5 + Math.random() * 2.5 });
            }
        }

        updateEffects(dt) {
            if (this.headless) return;
            const p = this.player;
            const k = Math.min(1, dt * 16);
            p.px += (p.x - p.px) * k;
            p.py += (p.y - p.py) * k;
            for (const en of this.enemies) {
                const ek = Math.min(1, dt * 10);
                en.px += (en.x - en.px) * ek;
                en.py += (en.y - en.py) * ek;
            }
            for (let i = this.particles.length - 1; i >= 0; i--) {
                const pt = this.particles[i];
                pt.life -= dt;
                if (pt.life <= 0) { this.particles.splice(i, 1); continue; }
                pt.x += pt.vx * dt; pt.y += pt.vy * dt;
                pt.vx *= 0.94; pt.vy *= 0.94;
            }
            for (let i = this.swings.length - 1; i >= 0; i--) {
                this.swings[i].t -= dt;
                if (this.swings[i].t <= 0) this.swings.splice(i, 1);
            }
            for (const pr of this.projectiles) {
                if (Math.random() < 0.7) this.burst(pr.x + 0.5, pr.y + 0.5, '#fb923c', 1, 1);
            }
            this.shake *= 0.88;
            if (this.shake < 0.1) this.shake = 0;
            if (this.fade > 0) this.fade = Math.max(0, this.fade - dt * 2.5);
        }

        // ------------------------------------------------------------ Rendering
        render() {
            const ctx = this.ctx;
            if (!ctx) return;
            const ts = this.tileSize;
            const cw = this.canvas.width, ch = this.canvas.height;
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#05060d';
            ctx.fillRect(0, 0, cw, ch);

            const sx = this.shake ? (Math.random() - 0.5) * this.shake : 0;
            const sy = this.shake ? (Math.random() - 0.5) * this.shake : 0;
            const ox = Math.floor((cw - this.mapW * ts) / 2 + sx);
            const oy = Math.floor(this.headerH + (ch - this.headerH - this.mapH * ts) / 2 + sy);
            const p = this.player;
            const hue = (210 + this.floor * 12) % 360;
            const wallCol = `hsl(${hue},28%,9%)`;
            const floorCol = `hsl(${hue},18%,16%)`;
            const floorAlt = `hsl(${hue},18%,18%)`;
            const edgeCol = `hsl(${hue},35%,24%)`;
            const R = 7;

            // Licht: 1 nahe am Spieler, faellt zum Rand ab; bereits Entdecktes bleibt gedimmt
            const light = (x, y) => clamp(1 - Math.hypot(x + 0.5 - (p.px + 0.5), y + 0.5 - (p.py + 0.5)) / R, 0, 1);

            for (let y = 0; y < this.mapH; y++) {
                for (let x = 0; x < this.mapW; x++) {
                    if (!this.revealed[y][x]) continue;
                    const wall = this.grid[y][x] === 1;
                    const tx = ox + x * ts, ty = oy + y * ts;
                    ctx.fillStyle = wall ? wallCol : ((x + y) & 1 ? floorAlt : floorCol);
                    ctx.fillRect(tx, ty, ts, ts);
                    if (wall && y + 1 < this.mapH && this.grid[y + 1][x] === 0) {
                        ctx.fillStyle = edgeCol;
                        ctx.fillRect(tx, ty + ts - 3, ts, 3);
                    }
                    const dark = 0.82 - light(x, y) * 0.82;
                    ctx.globalAlpha = Math.max(dark, 0.35);
                    ctx.fillStyle = '#000';
                    ctx.fillRect(tx, ty, ts, ts);
                    ctx.globalAlpha = 1;
                }
            }

            // Treppe (pulsierend)
            if (this.revealed[this.stairs.y] && this.revealed[this.stairs.y][this.stairs.x]) {
                const pulse = 0.5 + 0.5 * Math.sin(this.time * 4);
                const cx = ox + (this.stairs.x + 0.5) * ts, cy = oy + (this.stairs.y + 0.5) * ts;
                ctx.globalAlpha = 0.15 + pulse * 0.15;
                ctx.fillStyle = '#10b981';
                ctx.beginPath(); ctx.arc(cx, cy, ts * 0.75, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 1;
                ctx.fillRect(cx - ts * 0.3, cy - ts * 0.3, ts * 0.6, ts * 0.6);
                ctx.fillStyle = '#064e3b';
                ctx.fillRect(cx - ts * 0.2, cy - ts * 0.2, ts * 0.4, ts * 0.12);
                ctx.fillRect(cx - ts * 0.2, cy + ts * 0.02, ts * 0.4, ts * 0.12);
            }

            // Items
            for (const it of this.items) {
                if (!this.revealed[it.y][it.x]) continue;
                const cx = ox + (it.x + 0.5) * ts, cy = oy + (it.y + 0.5) * ts + Math.sin(this.time * 4 + it.x) * 2;
                ctx.fillStyle = it.type === 'gold' ? '#fbbf24' : it.type === 'heart' ? '#f43f5e' : '#38bdf8';
                ctx.globalAlpha = 0.25;
                ctx.beginPath(); ctx.arc(cx, cy, ts * 0.38, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 1;
                ctx.beginPath(); ctx.arc(cx, cy, ts * 0.2, 0, Math.PI * 2); ctx.fill();
            }

            // Gegner (nur im Sichtfeld)
            for (const en of this.enemies) {
                if (light(en.x, en.y) <= 0) continue;
                const t = ENEMY_TYPES[en.type];
                const cx = ox + (en.px + 0.5) * ts, cy = oy + (en.py + 0.5) * ts;
                ctx.globalAlpha = 0.25;
                ctx.fillStyle = t.color;
                ctx.beginPath(); ctx.arc(cx, cy, ts * (t.radius + 0.15), 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 1;
                ctx.fillStyle = en.flash > 0 ? '#ffffff' : t.color;
                ctx.beginPath(); ctx.arc(cx, cy, ts * t.radius, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(cx - ts * 0.14, cy - ts * 0.08, ts * 0.08, ts * 0.08);
                ctx.fillRect(cx + ts * 0.06, cy - ts * 0.08, ts * 0.08, ts * 0.08);
                if (en.hp < en.maxHp) {
                    ctx.fillStyle = 'rgba(0,0,0,.6)';
                    ctx.fillRect(cx - ts * 0.4, cy - ts * 0.6, ts * 0.8, 3);
                    ctx.fillStyle = '#22c55e';
                    ctx.fillRect(cx - ts * 0.4, cy - ts * 0.6, ts * 0.8 * clamp(en.hp / en.maxHp, 0, 1), 3);
                }
            }

            // Schwertschlag
            for (const s of this.swings) {
                const cx = ox + (s.x + 0.5) * ts, cy = oy + (s.y + 0.5) * ts;
                ctx.globalAlpha = clamp(s.t / 0.14, 0, 1);
                ctx.strokeStyle = '#e2e8f0';
                ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(cx, cy, ts * 0.4, 0, Math.PI * 2); ctx.stroke();
                ctx.globalAlpha = 1;
            }

            // Feuerbaelle
            for (const pr of this.projectiles) {
                const cx = ox + (pr.x + 0.5 + pr.dx * pr.acc) * ts, cy = oy + (pr.y + 0.5 + pr.dy * pr.acc) * ts;
                ctx.fillStyle = '#f97316';
                ctx.globalAlpha = 0.3;
                ctx.beginPath(); ctx.arc(cx, cy, ts * 0.4, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 1;
                ctx.fillStyle = '#fde047';
                ctx.beginPath(); ctx.arc(cx, cy, ts * 0.2, 0, Math.PI * 2); ctx.fill();
            }

            // Spieler
            {
                const cx = ox + (p.px + 0.5) * ts, cy = oy + (p.py + 0.5) * ts;
                const blink = p.invuln > 0 && Math.floor(this.time * 20) % 2 === 0;
                ctx.fillStyle = '#22d3ee';
                ctx.globalAlpha = 0.2;
                ctx.beginPath(); ctx.arc(cx, cy, ts * 0.65, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = blink ? 0.35 : 1;
                ctx.fillStyle = '#f1f5f9';
                ctx.beginPath(); ctx.arc(cx, cy, ts * 0.34, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#6366f1';
                ctx.beginPath(); ctx.arc(cx + p.dir.x * ts * 0.2, cy + p.dir.y * ts * 0.2, ts * 0.1, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 1;
            }

            // Partikel
            for (const pt of this.particles) {
                ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
                ctx.fillStyle = pt.color;
                ctx.fillRect(ox + pt.x * ts - pt.size / 2, oy + pt.y * ts - pt.size / 2, pt.size, pt.size);
            }
            ctx.globalAlpha = 1;

            // Level-Uebergang
            if (this.fade > 0) {
                ctx.globalAlpha = this.fade;
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, cw, ch);
                ctx.globalAlpha = 1;
            }
        }

        // ------------------------------------------------------------ Invarianten
        checkInvariants() {
            const errs = [];
            const p = this.player;
            if (!this.grid || this.grid.length !== this.mapH || this.grid.some((r) => !r || r.length !== this.mapW)) {
                errs.push('Grid hat falsche Dimensionen');
                return errs;
            }
            if (!p) { errs.push('Player ist null'); return errs; }
            if (![p.x, p.y, p.hp, p.mana, p.gold, this.score].every(Number.isFinite)) errs.push('Nicht-numerischer Spielerwert (NaN/Infinity)');
            if (p.hp < 0 || p.hp > p.maxHp) errs.push(`HP ausserhalb des Bereichs: ${p.hp}`);
            if (p.mana < 0 || p.mana > p.maxMana + 1e-9) errs.push(`Mana ausserhalb des Bereichs: ${p.mana}`);
            if (this.score < 0) errs.push('Negativer Score');
            if (!this.isFloor(p.x, p.y)) errs.push(`Spieler steht in Wand (${p.x},${p.y})`);
            if (!this.isFloor(this.stairs.x, this.stairs.y)) errs.push('Treppe in Wand');
            const seen = new Set();
            for (const e of this.enemies) {
                if (!this.isFloor(e.x, e.y)) errs.push(`Gegner in Wand (${e.x},${e.y})`);
                if (e.x === p.x && e.y === p.y) errs.push('Gegner teilt Zelle mit Spieler');
                const key = e.y * this.mapW + e.x;
                if (seen.has(key)) errs.push(`Zwei Gegner auf (${e.x},${e.y})`);
                seen.add(key);
                if (!Number.isFinite(e.hp)) errs.push('Gegner-HP nicht numerisch');
            }
            for (const it of this.items) if (!this.isFloor(it.x, it.y)) errs.push(`Item in Wand (${it.x},${it.y})`);
            for (const pr of this.projectiles) if (!this.isFloor(pr.x, pr.y)) errs.push(`Projektil in Wand (${pr.x},${pr.y})`);
            return errs;
        }

        // ------------------------------------------------------------ Bot
        botThink() {
            const p = this.player;
            const W = this.mapW;
            this.botInput = { dx: 0, dy: 0 };

            for (const d of DIRS) {
                if (this.enemyAt(p.x + d.x, p.y + d.y)) {
                    p.dir = d;
                    this.melee();
                    return;
                }
            }
            if (p.mana >= 15 && p.fireCd <= 0) {
                for (const d of DIRS) {
                    for (let i = 1; i <= 5; i++) {
                        const x = p.x + d.x * i, y = p.y + d.y * i;
                        if (!this.isFloor(x, y)) break;
                        if (this.enemyAt(x, y)) { p.dir = d; this.fireball(); return; }
                    }
                }
            }

            const blocked = new Set(this.enemies.map((e) => e.y * W + e.x));
            let { dist, prev } = this.bfs(p.x, p.y, blocked);
            let target = null, bestD = 15;
            for (const it of this.items) {
                const d = dist[it.y * W + it.x];
                if (d > 0 && d < bestD) { bestD = d; target = it; }
            }
            if (!target) target = this.stairs;

            let ti = target.y * W + target.x;
            if (dist[ti] < 0) {
                ({ dist, prev } = this.bfs(p.x, p.y, null));
                ti = this.stairs.y * W + this.stairs.x;
            }
            if (dist[ti] <= 0) return;
            let cur = ti;
            while (prev[cur] !== p.y * W + p.x && prev[cur] !== -1) cur = prev[cur];
            this.botInput = { dx: (cur % W) - p.x, dy: ((cur / W) | 0) - p.y };
        }

        // ------------------------------------------------------------ Self-Test
        runSelfTest() {
            if (this._testing) return null;
            this._testing = true;
            const results = [];
            const record = (name, ok, details) => results.push({ Test: name, Status: ok ? 'PASS' : 'FAIL', Details: String(details) });
            const guard = (name, fn) => {
                try { fn(); } catch (e) { record(name, false, `Exception: ${e && e.message}`); }
            };
            const mk = (floor, seed) => {
                const g = new window.DungeonGame();
                g.initHeadless(floor, seed);
                return g;
            };
            const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

            guard('Initialisierung', () => {
                const g = mk(1, 42);
                const errs = g.checkInvariants();
                record('Initialisierung', errs.length === 0 && g.enemies.length > 0, errs.join('; ') || `${g.enemies.length} Gegner, ${g.items.length} Items`);
            });

            guard('Loesbarkeit (Ebene 1-60)', () => {
                let bad = [];
                for (let f = 1; f <= 60; f++) {
                    const g = mk(f, 1000 + f);
                    const errs = g.validateLevel().concat(g.checkInvariants());
                    if (errs.length) bad.push(`E${f}: ${errs[0]}`);
                }
                record('Loesbarkeit (Ebene 1-60)', bad.length === 0, bad.join('; ') || '60/60 Ebenen loesbar');
            });

            guard('Schwierigkeitsskalierung', () => {
                const ok = Math.abs(Difficulty.speedMul(2) / Difficulty.speedMul(1) - 1.1) < 1e-9
                    && Difficulty.enemyCount(10) > Difficulty.enemyCount(1)
                    && Difficulty.types(1).length === 1 && Difficulty.types(3).includes('bat') && Difficulty.types(6).includes('brute');
                record('Schwierigkeitsskalierung', ok, `Tempo E1=${Difficulty.speedMul(1)} E2=${Difficulty.speedMul(2).toFixed(2)}, Gegner E1=${Difficulty.enemyCount(1)} E10=${Difficulty.enemyCount(10)}`);
            });

            guard('Wandkollision', () => {
                const g = mk(1, 7);
                const p = g.player;
                g.grid = Array.from({ length: g.mapH }, () => Array(g.mapW).fill(1));
                g.grid[5][5] = 0;
                g.enemies = []; g.items = [];
                p.x = 5; p.y = 5; g.stairs = { x: 5, y: 5 };
                const d = DIRS[0];
                const bx = p.x, by = p.y;
                const moved = g.tryMove(d.x, d.y);
                record('Wandkollision', !moved && p.x === bx && p.y === by, `Bewegung in Wand blockiert: ${!moved}`);
            });

            guard('Projektil-Treffer (kein Tunneling)', () => {
                const g = mk(1, 9);
                g.grid = Array.from({ length: g.mapH }, () => Array(g.mapW).fill(1));
                for (let x = 2; x <= 12; x++) g.grid[5][x] = 0;
                g.player.x = 2; g.player.y = 5; g.player.dir = { x: 1, y: 0 };
                g.stairs = { x: 12, y: 5 };
                g.items = [];
                g.enemies = [g.makeEnemy('grunt', 6, 5), g.makeEnemy('grunt', 9, 5)];
                g.enemies.forEach((e) => { e.hp = e.maxHp = 10; e.moveCd = 1e9; });
                g.fireball();
                for (let i = 0; i < 120; i++) g.update(0.25); // grosse dt -> viele Tiles pro Update
                const firstDead = !g.enemyAt(6, 5);
                const secondAlive = !!g.enemyAt(9, 5);
                record('Projektil-Treffer (kein Tunneling)', firstDead && secondAlive, `erster getroffen=${firstDead}, zweiter verschont=${secondAlive}`);
            });

            guard('Punkteberechnung', () => {
                const g = mk(1, 11);
                g.godMode = true;
                g.score = 0;
                g.combo = 0; g.comboTimer = 0;
                const a = g.makeEnemy('grunt', 0, 0); a.hp = 1;
                const b = g.makeEnemy('grunt', 0, 0); b.hp = 1;
                g.enemies = [a, b];
                g.damageEnemy(a, 5, { x: 1, y: 0 });   // 30 * x1
                g.damageEnemy(b, 5, { x: 1, y: 0 });   // 30 * x2
                const expected = 30 + 60;
                const before = g.score;
                g.addScore(50, false);
                record('Punkteberechnung', before === expected && g.score === expected + 50 && g.combo === 2, `Score=${before} (erwartet ${expected}), nach Bonus=${g.score}`);
            });

            let simReport = null;
            guard('Bot-Autoplay (3 Ebenen)', () => {
                const g = mk(1, 2024);
                g.godMode = true;
                g.botControlled = true;
                const levelsTarget = 3;
                let cleared = 0, ticks = 0, errs = [];
                const t0 = nowMs();
                const maxTicks = 60 * 120 * levelsTarget;
                while (cleared < levelsTarget && ticks < maxTicks) {
                    ticks++;
                    if (ticks % 6 === 0) g.botThink();
                    g.update(STEP);
                    if (ticks % 30 === 0) errs = errs.concat(g.checkInvariants());
                    if (g.state === 'complete') {
                        cleared++;
                        g.startLevel(g.floor + 1);
                        g.state = 'playing';
                        errs = errs.concat(g.checkInvariants());
                    }
                }
                const ms = nowMs() - t0;
                simReport = { ticks, ms, cleared, kills: g.stats.kills, score: g.score };
                record('Bot-Autoplay (3 Ebenen)', cleared >= levelsTarget && errs.length === 0 && g.score > 0,
                    `${cleared}/${levelsTarget} Ebenen, ${g.stats.kills} Kills, Score ${g.score}, ${(ticks / 60).toFixed(0)}s simuliert${errs.length ? ', Fehler: ' + errs[0] : ''}`);
            });

            // Performance der Live-Instanz
            const perfRows = [];
            if (simReport) {
                perfRows.push({ Metrik: 'Simulation (ms/Tick)', Wert: (simReport.ms / Math.max(1, simReport.ticks)).toFixed(4) });
            }
            if (this.ctx && !this.headless) {
                const t0 = nowMs();
                for (let i = 0; i < 30; i++) this.render();
                perfRows.push({ Metrik: 'Render (ms/Frame, 30 Frames)', Wert: ((nowMs() - t0) / 30).toFixed(3) });
                perfRows.push({ Metrik: 'FPS (live, gleitend)', Wert: this.perf.fps.toFixed(1) });
            }

            const passed = results.filter((r) => r.Status === 'PASS').length;
            const report = { passed, total: results.length, ok: passed === results.length, results, perf: perfRows };
            window.DungeonGame.lastTestReport = report;

            console.group(`%c[Dungeon Self-Test] ${passed}/${results.length} bestanden`, `color:${report.ok ? '#22c55e' : '#ef4444'};font-weight:bold`);
            if (console.table) {
                console.table(results);
                if (perfRows.length) console.table(perfRows);
            } else {
                results.forEach((r) => console.log(`${r.Status} ${r.Test}: ${r.Details}`));
            }
            console.groupEnd();

            if (!this.headless) this.toast(report.ok ? `Self-Test OK (${passed}/${results.length})` : `Self-Test: ${results.length - passed} Fehler`);
            this._testing = false;
            return report;
        }
    };
})();
