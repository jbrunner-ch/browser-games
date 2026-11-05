/**
 * Neo-Breakout - Arcade Brick Breaker (modernisiert)
 *
 * - Einheitliches Glassmorphism-UI (HUD, Overlays, Toasts), per JS injiziert
 * - Prozeduraler, garantiert lösbarer Level-Generator (seeded, symmetrisch)
 * - Mathematisch nachvollziehbare Schwierigkeitskurve (siehe difficulty())
 * - Substep-Physik (Kreis vs. AABB, kein Tunneling), Partikel, Screen-Shake
 * - Integrierter Selbsttest + Autoplay-Bot (Taste T / window.RUN_TESTS = true,
 *   Taste B schaltet den Bot live an/aus)
 */
(function () {
    'use strict';

    const STYLE_ID = 'gx-ui-style';
    const COLS = 10;
    const POINTS_PER_HIT = 10;
    const MAX_LIVES = 5;
    const HUD_H = 56;
    const BRICK_TOP = HUD_H + 28;
    const BALL_R = 6;

    const GX_CSS = `
.gx-root{position:absolute;inset:0;overflow:hidden;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f1f5f9;user-select:none}
.gx-root canvas{display:block;width:100%;height:100%}
.gx-hud{position:absolute;top:0;left:0;right:0;height:${HUD_H - 12}px;margin:6px 8px 0;padding:0 16px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;background:rgba(15,23,42,.75);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.1);border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.35);z-index:5}
.gx-hud-left{display:flex;align-items:baseline;gap:10px;min-width:0;white-space:nowrap}
.gx-title{font-weight:700;letter-spacing:.02em}
.gx-level{font-size:.8rem;color:#67e8f9;font-variant-numeric:tabular-nums}
.gx-hud-mid{text-align:center;font-variant-numeric:tabular-nums;line-height:1.1}
.gx-score{font-size:1.25rem;font-weight:700}
.gx-hi{font-size:.7rem;color:#94a3b8}
.gx-hud-right{display:flex;align-items:center;justify-content:flex-end;gap:10px}
.gx-hearts{display:flex;gap:2px;font-size:1.05rem}
.gx-heart{color:#f43f5e;transition:transform .2s,opacity .2s}
.gx-heart.off{color:#475569;opacity:.6;transform:scale(.8)}
.gx-icon-btn{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#f1f5f9;border-radius:10px;width:32px;height:32px;cursor:pointer;font-size:.95rem;transition:background .15s,transform .1s}
.gx-icon-btn:hover{background:rgba(99,102,241,.35)}
.gx-icon-btn:active{transform:scale(.92)}
.gx-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,.45);opacity:0;pointer-events:none;transition:opacity .25s;z-index:8}
.gx-overlay.active{opacity:1;pointer-events:auto}
.gx-modal{min-width:280px;max-width:90%;padding:28px 32px;text-align:center;background:rgba(15,23,42,.75);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.1);border-radius:20px;box-shadow:0 20px 50px rgba(0,0,0,.5);transform:translateY(12px) scale(.96);transition:transform .25s}
.gx-overlay.active .gx-modal{transform:none}
.gx-modal h2{margin:0 0 8px;font-size:1.7rem;letter-spacing:.03em}
.gx-modal p{margin:0 0 18px;color:#cbd5e1;font-size:.95rem;line-height:1.4}
.gx-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.gx-btn{padding:10px 22px;border:0;border-radius:12px;cursor:pointer;font:inherit;font-weight:600;color:#fff;background:linear-gradient(135deg,#6366f1,#06b6d4);box-shadow:0 6px 18px rgba(99,102,241,.4);transition:transform .12s,box-shadow .15s,filter .15s}
.gx-btn:hover{filter:brightness(1.12);box-shadow:0 8px 24px rgba(6,182,212,.45);transform:translateY(-1px)}
.gx-btn:active{transform:scale(.95)}
.gx-btn.secondary{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);box-shadow:none}
.gx-toasts{position:absolute;top:${HUD_H + 16}px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;z-index:7}
.gx-toast{padding:8px 18px;border-radius:999px;font-weight:700;background:rgba(15,23,42,.75);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.1);color:#e0f2fe;animation:gx-toast-in .25s ease-out;transition:opacity .3s,transform .3s}
.gx-toast.out{opacity:0;transform:translateY(-10px)}
@keyframes gx-toast-in{from{opacity:0;transform:translateY(-12px) scale(.9)}to{opacity:1;transform:none}}
`;

    function injectStyle() {
        const host = document.head || document.body;
        if (!host || !host.appendChild) return;
        if (document.getElementById && document.getElementById(STYLE_ID)) return;
        const st = document.createElement('style');
        st.id = STYLE_ID;
        st.textContent = GX_CSS;
        host.appendChild(st);
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

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    /**
     * Schwierigkeitskurve (pro Level L >= 1):
     *  - Ballgeschwindigkeit: +10 % der Basis pro Level, max. 2.5x
     *  - Reihen: 4 + floor(L/3), max. 9
     *  - Dichte: 0.60 + 0.03 * (L-1), max. 0.95
     *  - Gepanzerte Steine ab L3, explosive ab L5, zähe (3 HP) ab L8
     */
    function difficulty(L) {
        const lv = Math.max(1, Math.floor(L) || 1);
        const speedMul = Math.min(2.5, 1 + 0.1 * (lv - 1));
        return {
            level: lv,
            speedMul,
            ballSpeed: 380 * speedMul,
            rows: Math.min(9, 4 + Math.floor(lv / 3)),
            density: Math.min(0.95, 0.6 + 0.03 * (lv - 1)),
            pArmor: lv >= 3 ? Math.min(0.35, 0.08 + 0.02 * (lv - 3)) : 0,
            pExplosive: lv >= 5 ? Math.min(0.12, 0.04 + 0.01 * (lv - 5)) : 0,
            pTough: lv >= 8 ? Math.min(0.2, 0.05 + 0.015 * (lv - 8)) : 0,
            powerupChance: Math.max(0.12, 0.24 - 0.004 * lv)
        };
    }

    /**
     * Erzeugt ein Raster aus Steinen. Garantiert lösbar: alle Steine sind
     * zerstörbar (endliche HP), liegen im Spielfeld, es gibt keine
     * eingeschlossenen/unzerstörbaren Steine, und mindestens eine volle
     * obere Reihe bleibt erhalten. Das Ergebnis ist deterministisch pro Level.
     */
    function generateLevel(L) {
        const d = difficulty(L);
        const rng = mulberry32(L * 7919 + 17);
        const half = COLS / 2;
        const rows = d.rows;
        const patterns = [
            () => true,
            (r, cm) => (r + cm) % 2 === 0,
            (r, cm) => cm >= half - Math.ceil(((r + 1) * half) / rows),
            (r) => r % 2 === 0,
            (r, cm) => {
                const mid = (rows - 1) / 2 || 1;
                return cm >= Math.floor((Math.abs(r - (rows - 1) / 2) / mid) * (half - 1));
            },
            (r, cm) => cm % 2 === 0 || r === 0
        ];
        const available = Math.min(patterns.length, 1 + Math.floor(L / 2));
        const pattern = patterns[L === 1 ? 0 : Math.floor(rng() * available)];

        const cells = {};
        const bricks = [];
        for (let r = 0; r < rows; r++) {
            for (let cm = 0; cm < half; cm++) {
                let keep = pattern(r, cm);
                if (keep && r > 0 && rng() > d.density) keep = false;
                let type = 'normal';
                const x = rng();
                if (d.pExplosive && x < d.pExplosive) type = 'explosive';
                else if (d.pTough && x < d.pExplosive + d.pTough) type = 'tough';
                else if (d.pArmor && x < d.pExplosive + d.pTough + d.pArmor) type = 'armor';
                cells[r + ',' + cm] = keep ? type : null;
            }
        }
        for (let c = 0; c < COLS; c++) cells['0,' + Math.min(c, COLS - 1 - c)] = cells['0,' + Math.min(c, COLS - 1 - c)] || 'normal';

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < COLS; c++) {
                const type = cells[r + ',' + Math.min(c, COLS - 1 - c)];
                if (!type) continue;
                const hp = type === 'tough' ? 3 : type === 'armor' ? 2 : 1;
                bricks.push({ r, c, type, hp, maxHp: hp, x: 0, y: 0, w: 0, h: 0, alive: true });
            }
        }
        return bricks;
    }

    function validateLevel(bricks, canvasW, canvasH) {
        if (!bricks.length) return { ok: false, reason: 'keine Steine' };
        for (const b of bricks) {
            if (!Number.isFinite(b.hp) || b.hp < 1) return { ok: false, reason: 'unzerstörbarer Stein' };
            if (b.x < 0 || b.y < 0 || b.x + b.w > canvasW || b.y + b.h > canvasH * 0.7) {
                return { ok: false, reason: 'Stein außerhalb des Spielfelds' };
            }
        }
        if (!bricks.some((b) => b.r === 0)) return { ok: false, reason: 'obere Reihe fehlt' };
        return { ok: true, reason: 'ok' };
    }

    window.BreakoutGame = class {
        constructor() {
            this.container = null;
            this.canvas = null;
            this.ctx = null;
            this.animId = null;
            this.isPaused = false;
            this.state = 'start'; // start | playing | paused | gameover | complete
            this.destroyed = false;

            this.paddle = { x: 350, y: 540, w: 100, baseW: 100, h: 12, vx: 0, laserT: 0, wideT: 0, fireT: 0, laserCd: 0 };
            this.balls = [];
            this.bricks = [];
            this.powerups = [];
            this.lasers = [];
            this.particles = [];
            this.toastTimers = [];

            this.score = 0;
            this.highscore = this.loadHighscore();
            this.lives = 3;
            this.currentLevel = 1;
            this.combo = 0;
            this.keys = {};
            this.targetX = null;
            this.useTarget = false;
            this.shake = 0;
            this.introT = 1;
            this.time = 0;
            this.bot = false;
            this.simulating = false;
            this.perf = { fps: 0, updateMs: 0, renderMs: 0 };
            this.lastTs = 0;
            this.diff = difficulty(1);
            this.handlers = [];
        }

        // ---------- Lebenszyklus ----------

        init(container, options = {}) {
            this.container = container;
            this.container.innerHTML = '';
            injectStyle();

            this.root = document.createElement('div');
            this.root.className = 'gx-root';
            this.container.appendChild(this.root);

            this.canvas = document.createElement('canvas');
            this.canvas.className = 'game-canvas';
            this.ctx = this.canvas.getContext('2d');
            this.root.appendChild(this.canvas);

            this.buildUI();
            this.bindEvents();
            this.resize();

            this.startLevel(options.levelIndex || 1);
            this.showOverlay('start');

            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(() => this.resize());
            }
            this.loop = this.loop.bind(this);
            this.animId = requestAnimationFrame(this.loop);

            if (window.RUN_TESTS === true) {
                setTimeout(() => { if (!this.destroyed) this.runSelfTest(); }, 50);
            }
        }

        buildUI() {
            this.hud = document.createElement('div');
            this.hud.className = 'gx-hud';
            this.hud.innerHTML = `
                <div class="gx-hud-left"><span class="gx-title">Neo-Breakout</span><span class="gx-level" id="gx-level">Level 01</span></div>
                <div class="gx-hud-mid"><div class="gx-score" id="gx-score">0</div><div class="gx-hi" id="gx-hi">Highscore 0</div></div>
                <div class="gx-hud-right"><div class="gx-hearts" id="gx-hearts"></div>
                    <button class="gx-icon-btn" id="gx-pause" title="Pause (P)">⏸</button>
                    <button class="gx-icon-btn" id="gx-mute" title="Ton (M)">🔊</button></div>`;
            this.root.appendChild(this.hud);

            this.toasts = document.createElement('div');
            this.toasts.className = 'gx-toasts';
            this.root.appendChild(this.toasts);

            this.overlay = document.createElement('div');
            this.overlay.className = 'gx-overlay';
            this.root.appendChild(this.overlay);

            this.ui = {
                level: this.hud.querySelector('#gx-level'),
                score: this.hud.querySelector('#gx-score'),
                hi: this.hud.querySelector('#gx-hi'),
                hearts: this.hud.querySelector('#gx-hearts'),
                pause: this.hud.querySelector('#gx-pause'),
                mute: this.hud.querySelector('#gx-mute')
            };
            this.ui.pause.onclick = () => this.togglePause();
            this.ui.mute.onclick = () => {
                if (window.AudioManager && window.AudioManager.toggleMute) window.AudioManager.toggleMute();
                const m = window.AudioManager && window.AudioManager.muted;
                this.ui.mute.textContent = m ? '🔇' : '🔊';
            };
        }

        showOverlay(kind) {
            const L = String(this.currentLevel).padStart(2, '0');
            const defs = {
                start: ['Neo-Breakout', 'Maus oder ←/→ bewegen · Leertaste/Klick startet den Ball<br>P Pause · M Ton · T Selbsttest · B Bot', [['Start', 'start']]],
                pause: ['Pause', 'Das Spiel ist angehalten.', [['Weiter', 'resume'], ['Level neu starten', 'restart', 1]]],
                gameover: ['Game Over', `Punkte: ${this.score}<br>Highscore: ${this.highscore}`, [['Nochmal', 'retry']]],
                complete: [`Level ${L} geschafft!`, `Punkte: ${this.score}<br>Nächste Stufe: +${Math.round(10)}% Tempo`, [['Wiederholen', 'restart', 1], ['Nächstes Level ➔', 'next']]]
            };
            const [title, text, buttons] = defs[kind];
            this.overlay.innerHTML = `<div class="gx-modal"><h2>${title}</h2><p>${text}</p><div class="gx-actions">` +
                buttons.map((b) => `<button class="gx-btn${b[2] ? ' secondary' : ''}" data-act="${b[1]}">${b[0]}</button>`).join('') +
                '</div></div>';
            const actions = {
                start: () => this.beginPlay(),
                resume: () => this.resume(),
                restart: () => { this.startLevel(this.currentLevel); this.beginPlay(); },
                retry: () => { this.score = 0; this.lives = 3; this.startLevel(this.currentLevel); this.beginPlay(); },
                next: () => { this.startLevel(this.currentLevel + 1); this.beginPlay(); }
            };
            for (const b of buttons) {
                const el = this.overlay.querySelector(`[data-act="${b[1]}"]`);
                if (el) el.onclick = actions[b[1]];
            }
            this.overlay.classList.add('active');
        }

        hideOverlay() {
            if (this.overlay) this.overlay.classList.remove('active');
        }

        toast(msg) {
            if (this.simulating || !this.toasts) return;
            const el = document.createElement('div');
            el.className = 'gx-toast';
            el.textContent = msg;
            this.toasts.appendChild(el);
            const t1 = setTimeout(() => { el.className = 'gx-toast out'; }, 1300);
            const t2 = setTimeout(() => { if (el.remove) el.remove(); }, 1650);
            this.toastTimers.push(t1, t2);
        }

        updateHUD() {
            if (!this.ui) return;
            this.ui.level.textContent = `Level ${String(this.currentLevel).padStart(2, '0')}`;
            this.ui.score.textContent = `${this.score}`;
            this.ui.hi.textContent = `Highscore ${this.highscore}`;
            let hearts = '';
            for (let i = 0; i < MAX_LIVES; i++) hearts += `<span class="gx-heart${i < this.lives ? '' : ' off'}">♥</span>`;
            this.ui.hearts.innerHTML = hearts;
        }

        loadHighscore() {
            try { return parseInt(localStorage.getItem('breakout_highscore'), 10) || 0; } catch (e) { return 0; }
        }

        saveHighscore() {
            if (this.simulating) return;
            try { localStorage.setItem('breakout_highscore', String(this.highscore)); } catch (e) { /* ignorieren */ }
        }

        listen(target, type, fn, opts) {
            if (!target || !target.addEventListener) return;
            target.addEventListener(type, fn, opts);
            this.handlers.push([target, type, fn, opts]);
        }

        bindEvents() {
            this.listen(window, 'resize', () => this.resize());
            this.listen(window, 'keydown', (e) => {
                if (this.destroyed) return;
                const code = e.code;
                if (['Space', 'ArrowLeft', 'ArrowRight'].includes(code) && this.state === 'playing' && e.preventDefault) e.preventDefault();
                this.keys[code] = true;
                if (code === 'ArrowLeft' || code === 'ArrowRight' || code === 'KeyA' || code === 'KeyD') this.useTarget = false;
                if (code === 'Space') this.launchOrFire();
                if (code === 'KeyP' || code === 'Escape') this.togglePause();
                if (code === 'KeyM' && this.ui) this.ui.mute.onclick();
                if (code === 'KeyT') this.runSelfTest();
                if (code === 'KeyB') {
                    this.bot = !this.bot;
                    this.toast(this.bot ? 'Bot aktiv' : 'Bot aus');
                }
            });
            this.listen(window, 'keyup', (e) => { this.keys[e.code] = false; });
            this.listen(this.canvas, 'pointermove', (e) => {
                const rect = this.canvas.getBoundingClientRect();
                this.targetX = e.clientX - rect.left - this.paddle.w / 2;
                this.useTarget = true;
            });
            this.listen(this.canvas, 'pointerdown', () => this.launchOrFire());
        }

        resize() {
            if (!this.container || !this.canvas) return;
            const rect = this.container.getBoundingClientRect();
            const w = rect.width > 50 ? rect.width : (window.innerWidth || 800);
            const h = rect.height > 50 ? rect.height : ((window.innerHeight || 648) - 48);
            this.canvas.width = Math.floor(w);
            this.canvas.height = Math.floor(h);
            this.paddle.y = this.canvas.height - 36;
            this.layoutBricks();
            this.paddle.x = clamp(this.paddle.x, 8, Math.max(8, this.canvas.width - this.paddle.w - 8));
        }

        layoutBricks() {
            const W = this.canvas.width;
            const margin = 24;
            const gap = 4;
            const bw = (W - margin * 2 - gap * (COLS - 1)) / COLS;
            const bh = clamp((this.canvas.height * 0.5) / 12, 14, 24);
            for (const b of this.bricks) {
                b.x = margin + b.c * (bw + gap);
                b.y = BRICK_TOP + b.r * (bh + gap);
                b.w = bw;
                b.h = bh;
            }
        }

        // ---------- Level / Zustand ----------

        startLevel(levelIndex = 1) {
            this.currentLevel = Math.max(1, Math.floor(levelIndex) || 1);
            this.diff = difficulty(this.currentLevel);
            this.balls = [];
            this.powerups = [];
            this.lasers = [];
            this.particles = [];
            this.combo = 0;
            this.introT = 0;
            this.paddle.baseW = clamp(110 - this.currentLevel * 0.8, 70, 110);
            this.paddle.w = this.paddle.baseW;
            this.paddle.laserT = this.paddle.wideT = this.paddle.fireT = 0;
            this.paddle.vx = 0;
            this.paddle.x = (this.canvas.width - this.paddle.w) / 2;
            this.targetX = this.paddle.x;

            this.bricks = generateLevel(this.currentLevel);
            this.layoutBricks();
            this.spawnStuckBall();
            this.updateHUD();
            this.syncPortalLevel();
            this.isPaused = false;
        }

        syncPortalLevel() {
            if (!document.getElementById) return;
            const pill = document.getElementById('active-level-indicator');
            if (pill) pill.innerText = `Level ${this.currentLevel} ▾`;
            if (window.portal) window.portal.currentLevel = this.currentLevel;
        }

        beginPlay() {
            this.state = 'playing';
            this.isPaused = false;
            this.hideOverlay();
            if (this.currentLevel > 1 || this.score > 0) this.toast(`Level ${String(this.currentLevel).padStart(2, '0')}`);
        }

        togglePause() {
            if (this.state === 'playing') this.pause();
            else if (this.state === 'paused' && this.overlay && this.overlay.className.indexOf('active') >= 0) this.resume();
        }

        pause() {
            if (this.state !== 'playing') return;
            this.state = 'paused';
            this.isPaused = true;
            this.showOverlay('pause');
        }

        resume() {
            if (this.state !== 'paused') return;
            this.state = 'playing';
            this.isPaused = false;
            this.hideOverlay();
        }

        spawnStuckBall() {
            this.balls.push({
                x: this.paddle.x + this.paddle.w / 2,
                y: this.paddle.y - BALL_R - 1,
                vx: 0, vy: 0, r: BALL_R, stuck: true, trail: []
            });
        }

        launchOrFire() {
            if (this.state !== 'playing') return;
            let launched = false;
            for (const b of this.balls) {
                if (b.stuck) {
                    const a = (Math.random() * 0.6 - 0.3);
                    b.stuck = false;
                    b.vx = Math.sin(a) * this.diff.ballSpeed;
                    b.vy = -Math.cos(a) * this.diff.ballSpeed;
                    launched = true;
                }
            }
            if (!launched && this.paddle.laserT > 0) this.fireLasers();
        }

        fireLasers() {
            if (this.paddle.laserCd > 0) return;
            this.paddle.laserCd = 0.25;
            const p = this.paddle;
            this.lasers.push({ x: p.x + 6, y: p.y - 8, vy: -720 }, { x: p.x + p.w - 6, y: p.y - 8, vy: -720 });
            this.sfx('playLaser');
        }

        sfx(name) {
            if (this.simulating) return;
            const a = window.AudioManager;
            if (a && typeof a[name] === 'function') a[name]();
        }

        // ---------- Hauptschleife ----------

        loop(ts) {
            if (this.destroyed) return;
            this.animId = requestAnimationFrame(this.loop);
            if (!this.ctx) return;
            const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
            const dt = clamp(this.lastTs ? (now - this.lastTs) / 1000 : 1 / 60, 0.001, 0.05);
            this.lastTs = now;
            this.perf.fps = this.perf.fps ? this.perf.fps * 0.9 + (1 / dt) * 0.1 : 1 / dt;

            const t0 = now;
            if (this.state === 'playing' && !this.isPaused) this.update(dt);
            else this.tickEffects(dt);
            const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
            this.render();
            const t2 = typeof performance !== 'undefined' ? performance.now() : Date.now();
            this.perf.updateMs = this.perf.updateMs * 0.9 + (t1 - t0) * 0.1;
            this.perf.renderMs = this.perf.renderMs * 0.9 + (t2 - t1) * 0.1;
        }

        tickEffects(dt) {
            this.time += dt;
            this.introT = Math.min(1, this.introT + dt / 0.9);
            this.shake = Math.max(0, this.shake - dt * 30);
            for (let i = this.particles.length - 1; i >= 0; i--) {
                const p = this.particles[i];
                p.life -= dt;
                if (p.life <= 0) { this.particles.splice(i, 1); continue; }
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.vy += 500 * dt;
            }
        }

        update(dt) {
            this.tickEffects(dt);
            const p = this.paddle;

            if (this.bot) this.botThink();

            // Paddle: Trägheit (Tastatur) oder gedämpftes Folgen (Maus/Bot)
            const prevX = p.x;
            const left = this.keys.KeyA || this.keys.ArrowLeft;
            const right = this.keys.KeyD || this.keys.ArrowRight;
            if (this.useTarget && this.targetX !== null && !left && !right) {
                const d = this.targetX - p.x;
                const maxMove = 1600 * dt;
                p.x += clamp(d * Math.min(1, 30 * dt), -maxMove, maxMove);
            } else {
                const axis = (right ? 1 : 0) - (left ? 1 : 0);
                if (axis) p.vx += axis * 5200 * dt;
                else p.vx *= Math.exp(-14 * dt);
                p.vx = clamp(p.vx, -950, 950);
                p.x += p.vx * dt;
            }
            p.x = clamp(p.x, 8, this.canvas.width - p.w - 8);
            p.vx = (p.x - prevX) / dt;

            // Timer der Power-ups
            p.laserCd = Math.max(0, p.laserCd - dt);
            p.laserT = Math.max(0, p.laserT - dt);
            p.fireT = Math.max(0, p.fireT - dt);
            if (p.wideT > 0) {
                p.wideT -= dt;
                if (p.wideT <= 0) this.setPaddleWidth(p.baseW);
            }
            if (this.keys.Space && p.laserT > 0) this.fireLasers();

            this.updateLasers(dt);
            this.updateBalls(dt);
            this.updatePowerups(dt);

            if (this.balls.length === 0) this.loseLife();
            if (this.state === 'playing' && this.bricks.length === 0) this.completeLevel();
        }

        setPaddleWidth(w) {
            const p = this.paddle;
            const cx = p.x + p.w / 2;
            p.w = w;
            p.x = clamp(cx - w / 2, 8, this.canvas.width - w - 8);
        }

        updateLasers(dt) {
            for (let i = this.lasers.length - 1; i >= 0; i--) {
                const l = this.lasers[i];
                const prevY = l.y;
                l.y += l.vy * dt;
                let hit = null;
                for (const br of this.bricks) {
                    if (l.x >= br.x && l.x <= br.x + br.w && br.y + br.h >= l.y && br.y <= prevY && (!hit || br.y > hit.y)) hit = br;
                }
                if (hit) {
                    this.hitBrick(hit);
                    this.lasers.splice(i, 1);
                } else if (l.y < -10) {
                    this.lasers.splice(i, 1);
                }
            }
        }

        updateBalls(dt) {
            const W = this.canvas.width;
            const H = this.canvas.height;
            const p = this.paddle;

            for (let i = this.balls.length - 1; i >= 0; i--) {
                const b = this.balls[i];
                if (b.stuck) {
                    b.x = p.x + p.w / 2;
                    b.y = p.y - b.r - 1;
                    continue;
                }
                // Substeps: pro Schritt max. r/2 Weg => kein Tunneling
                const dist = Math.hypot(b.vx, b.vy) * dt;
                const steps = clamp(Math.ceil(dist / (b.r * 0.5)), 1, 80);
                const sdt = dt / steps;
                for (let s = 0; s < steps; s++) {
                    b.x += b.vx * sdt;
                    b.y += b.vy * sdt;

                    if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx); this.wallFx(b); }
                    else if (b.x + b.r > W) { b.x = W - b.r; b.vx = -Math.abs(b.vx); this.wallFx(b); }
                    if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy); this.wallFx(b); }

                    this.collidePaddle(b);
                    this.collideBricks(b);
                    this.fixDirection(b);
                }
                b.trail.push({ x: b.x, y: b.y });
                if (b.trail.length > 8) b.trail.shift();
                if (b.y - b.r > H) this.balls.splice(i, 1);
            }
        }

        wallFx(b) {
            this.fixDirection(b);
        }

        // Verhindert endlose, fast waagerechte Bahnen und hält das Tempo konstant
        fixDirection(b) {
            const target = this.diff.ballSpeed;
            let vx = b.vx, vy = b.vy;
            const minVy = target * 0.22;
            if (Math.abs(vy) < minVy) vy = (vy < 0 ? -1 : 1) * minVy;
            const k = target / Math.hypot(vx, vy);
            b.vx = vx * k;
            b.vy = vy * k;
        }

        // Kreis gegen AABB: liefert Normale + Eindringtiefe
        circleRect(b, x, y, w, h) {
            const cx = clamp(b.x, x, x + w);
            const cy = clamp(b.y, y, y + h);
            let dx = b.x - cx, dy = b.y - cy;
            const d2 = dx * dx + dy * dy;
            if (d2 > b.r * b.r) return null;
            if (d2 > 1e-9) {
                const d = Math.sqrt(d2);
                return { nx: dx / d, ny: dy / d, pen: b.r - d };
            }
            const l = b.x - x, r = x + w - b.x, t = b.y - y, bt = y + h - b.y;
            const m = Math.min(l, r, t, bt);
            if (m === t) return { nx: 0, ny: -1, pen: b.r + t };
            if (m === bt) return { nx: 0, ny: 1, pen: b.r + bt };
            if (m === l) return { nx: -1, ny: 0, pen: b.r + l };
            return { nx: 1, ny: 0, pen: b.r + r };
        }

        collidePaddle(b) {
            const p = this.paddle;
            const hit = this.circleRect(b, p.x, p.y, p.w, p.h);
            if (!hit) return;
            if (hit.ny < -0.3 && b.vy > 0) {
                const rel = clamp((b.x - (p.x + p.w / 2)) / (p.w / 2), -1, 1);
                const ang = rel * (Math.PI / 3);
                const spd = this.diff.ballSpeed;
                b.vx = Math.sin(ang) * spd + p.vx * 0.08;
                b.vy = -Math.cos(ang) * spd;
                b.y = p.y - b.r - 0.01;
                this.combo = 0;
                this.sfx('playClick');
                this.burst(b.x, p.y, '#67e8f9', 6, 140);
            } else if (hit.ny >= -0.3) {
                b.x += hit.nx * hit.pen;
                b.y += hit.ny * hit.pen;
                if (hit.nx * b.vx < 0) b.vx = -b.vx;
            }
        }

        collideBricks(b) {
            let best = null, bestHit = null, bestD = Infinity;
            const fire = this.paddle.fireT > 0;
            for (const br of this.bricks) {
                if (Math.abs(br.x + br.w / 2 - b.x) > br.w / 2 + b.r + 1 || Math.abs(br.y + br.h / 2 - b.y) > br.h / 2 + b.r + 1) continue;
                const hit = this.circleRect(b, br.x, br.y, br.w, br.h);
                if (!hit) continue;
                if (fire) { this.hitBrick(br, true); continue; }
                const d = Math.hypot(br.x + br.w / 2 - b.x, br.y + br.h / 2 - b.y);
                if (d < bestD) { bestD = d; best = br; bestHit = hit; }
            }
            if (!best) return;
            b.x += bestHit.nx * bestHit.pen;
            b.y += bestHit.ny * bestHit.pen;
            const dot = b.vx * bestHit.nx + b.vy * bestHit.ny;
            if (dot < 0) {
                b.vx -= 2 * dot * bestHit.nx;
                b.vy -= 2 * dot * bestHit.ny;
            }
            this.hitBrick(best);
        }

        brickColor(b) {
            if (b.type === 'explosive') return '#f97316';
            if (b.type === 'tough') return '#64748b';
            if (b.type === 'armor') return '#94a3b8';
            return `hsl(${(200 + b.r * 28) % 360},80%,60%)`;
        }

        hitBrick(brick, pierce = false) {
            if (!brick.alive) return;
            this.combo++;
            const mult = Math.min(8, 1 + Math.floor((this.combo - 1) / 3));
            this.score += POINTS_PER_HIT * mult;
            if (this.combo > 1 && this.combo % 3 === 0) this.toast(`Combo x${mult}`);
            brick.hp -= pierce ? brick.hp : 1;
            this.burst(brick.x + brick.w / 2, brick.y + brick.h / 2, this.brickColor(brick), brick.hp <= 0 ? 10 : 4, 160);
            this.shake = Math.min(6, this.shake + (brick.hp <= 0 ? 1.2 : 0.5));
            if (brick.hp <= 0) this.destroyBrick(brick);
            else this.sfx('playClick');
            if (this.score > this.highscore) {
                this.highscore = this.score;
                this.saveHighscore();
            }
            this.updateHUD();
        }

        destroyBrick(brick) {
            const queue = [brick];
            while (queue.length) {
                const br = queue.pop();
                if (!br.alive) continue;
                br.alive = false;
                this.sfx(br.type === 'explosive' ? 'playExplosion' : 'playHit');
                if (br.type === 'explosive') {
                    this.shake = Math.min(10, this.shake + 4);
                    this.burst(br.x + br.w / 2, br.y + br.h / 2, '#fb923c', 22, 320);
                    for (const o of this.bricks) {
                        if (o.alive && Math.abs(o.r - br.r) <= 1 && Math.abs(o.c - br.c) <= 1) {
                            o.hp -= 1;
                            this.score += POINTS_PER_HIT;
                            if (o.hp <= 0) queue.push(o);
                        }
                    }
                }
                if (Math.random() < this.diff.powerupChance) {
                    const types = ['multiball', 'laser', 'wide', 'fire', 'life'];
                    const weights = [3, 3, 3, 2, 0.6];
                    let r = Math.random() * weights.reduce((a, v) => a + v, 0), k = 0;
                    while (k < weights.length - 1 && (r -= weights[k]) > 0) k++;
                    this.powerups.push({ x: br.x + br.w / 2, y: br.y, type: types[k] });
                }
            }
            this.bricks = this.bricks.filter((b) => b.alive);
        }

        updatePowerups(dt) {
            const p = this.paddle;
            for (let i = this.powerups.length - 1; i >= 0; i--) {
                const u = this.powerups[i];
                const prev = u.y;
                u.y += 150 * dt;
                if (u.y + 8 >= p.y && prev - 8 <= p.y + p.h && u.x >= p.x - 6 && u.x <= p.x + p.w + 6) {
                    this.applyPowerup(u.type);
                    this.powerups.splice(i, 1);
                } else if (u.y > this.canvas.height + 10) {
                    this.powerups.splice(i, 1);
                }
            }
        }

        applyPowerup(type) {
            this.sfx('playPowerup');
            const p = this.paddle;
            const names = { multiball: 'Multiball!', laser: 'Laser!', wide: 'Breiter Paddle!', fire: 'Feuerball!', life: 'Extra-Leben!' };
            this.toast(names[type]);
            this.burst(p.x + p.w / 2, p.y, '#fbbf24', 14, 220);
            if (type === 'multiball') {
                const src = this.balls.find((b) => !b.stuck);
                if (src) {
                    for (const a of [-0.5, 0.5]) {
                        const c = Math.cos(a), s = Math.sin(a);
                        this.balls.push({ x: src.x, y: src.y, vx: src.vx * c - src.vy * s, vy: src.vx * s + src.vy * c, r: BALL_R, stuck: false, trail: [] });
                    }
                }
            } else if (type === 'laser') p.laserT = 10;
            else if (type === 'wide') { p.wideT = 8; this.setPaddleWidth(Math.min(170, p.baseW * 1.5)); }
            else if (type === 'fire') p.fireT = 6;
            else if (type === 'life') { this.lives = Math.min(MAX_LIVES, this.lives + 1); this.updateHUD(); }
        }

        loseLife() {
            this.lives--;
            this.combo = 0;
            this.shake = 8;
            this.sfx('playHit');
            this.updateHUD();
            if (this.lives <= 0) {
                this.state = 'gameover';
                this.showOverlay('gameover');
            } else {
                this.paddle.laserT = this.paddle.fireT = 0;
                this.toast(`Noch ${this.lives} Leben`);
                this.spawnStuckBall();
            }
        }

        completeLevel() {
            const bonus = this.lives * 50;
            this.score += bonus;
            if (this.score > this.highscore) { this.highscore = this.score; this.saveHighscore(); }
            this.updateHUD();
            this.sfx('playWin');
            this.state = 'complete';
            this.burst(this.canvas.width / 2, this.canvas.height / 2, '#a5b4fc', 40, 400);
            this.toast(`Level Up! +${bonus}`);
            this.showOverlay('complete');
        }

        burst(x, y, color, n, speed) {
            if (this.particles.length > 400) return;
            for (let i = 0; i < n; i++) {
                const a = Math.random() * Math.PI * 2;
                const v = speed * (0.3 + Math.random() * 0.7);
                this.particles.push({
                    x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40,
                    life: 0.35 + Math.random() * 0.4, max: 0.75, size: 1.5 + Math.random() * 2.5, color
                });
            }
        }

        // ---------- Autoplay-Bot ----------

        botThink() {
            const p = this.paddle;
            const W = this.canvas.width;
            this.useTarget = true;

            if (this.balls.some((b) => b.stuck)) {
                this.targetX = this.targetX === null ? p.x : p.x;
                this.botLaunchT = (this.botLaunchT || 0) + 1;
                if (this.botLaunchT > 12) { this.botLaunchT = 0; this.launchOrFire(); }
                return;
            }
            if (p.laserT > 0) this.fireLasers();

            let ball = null;
            for (const b of this.balls) if (!b.stuck && (!ball || b.y > ball.y)) ball = b;
            if (!ball) return;

            if (ball.vy < 0) {
                const pu = this.powerups.reduce((a, u) => (!a || u.y > a.y ? u : a), null);
                this.targetX = (pu ? pu.x : ball.x) - p.w / 2;
                return;
            }
            // Auftreffpunkt inkl. Wandreflexionen vorhersagen
            const t = (p.y - ball.r - ball.y) / ball.vy;
            const span = W - 2 * ball.r;
            let px = ball.x - ball.r + ball.vx * t;
            px = ((px % (2 * span)) + 2 * span) % (2 * span);
            if (px > span) px = 2 * span - px;
            px += ball.r;

            // Auf unterste Steinspalte in Nähe zielen
            let aim = null;
            for (const br of this.bricks) {
                if (!aim || br.y > aim.y || (br.y === aim.y && Math.abs(br.x - px) < Math.abs(aim.x - px))) aim = br;
            }
            const rel = aim ? clamp((aim.x + aim.w / 2 - px) / 220, -0.6, 0.6) : 0;
            this.targetX = px - rel * (p.w / 2) - p.w / 2;
        }

        // ---------- Rendering ----------

        render() {
            const ctx = this.ctx;
            const W = this.canvas.width, H = this.canvas.height;
            ctx.save();
            ctx.fillStyle = '#0b1020';
            ctx.fillRect(0, 0, W, H);
            if (ctx.createLinearGradient) {
                const g = ctx.createLinearGradient(0, 0, 0, H);
                g.addColorStop(0, '#111a35');
                g.addColorStop(1, '#070b16');
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, W, H);
            }
            if (this.shake > 0.05 && ctx.translate) {
                ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
            }

            // Bricks inkl. Einflug-Animation
            for (const b of this.bricks) {
                const k = clamp(this.introT * 1.6 - b.r * 0.08 - b.c * 0.01, 0, 1);
                const e = 1 - Math.pow(1 - k, 3);
                ctx.globalAlpha = e * (b.hp < b.maxHp ? 0.7 : 1);
                ctx.shadowColor = this.brickColor(b);
                ctx.shadowBlur = 8;
                ctx.fillStyle = this.brickColor(b);
                ctx.beginPath();
                ctx.roundRect(b.x, b.y - (1 - e) * 40, b.w, b.h, 4);
                ctx.fill();
                ctx.shadowBlur = 0;
                if (b.maxHp > 1) {
                    ctx.fillStyle = 'rgba(15,23,42,.8)';
                    for (let i = 0; i < b.hp; i++) ctx.fillRect(b.x + 5 + i * 7, b.y - (1 - e) * 40 + b.h / 2 - 2, 5, 4);
                }
                if (b.type === 'explosive') {
                    ctx.fillStyle = '#fff';
                    ctx.fillText('✸', b.x + b.w / 2 - 4, b.y + b.h / 2 + 4);
                }
            }
            ctx.globalAlpha = 1;

            // Paddle
            const p = this.paddle;
            ctx.shadowColor = p.laserT > 0 ? '#ec4899' : '#22d3ee';
            ctx.shadowBlur = 14;
            ctx.fillStyle = p.laserT > 0 ? '#f472b6' : '#e0f2fe';
            ctx.beginPath();
            ctx.roundRect(p.x, p.y, p.w, p.h, 6);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Powerups
            const pcol = { multiball: '#22d3ee', laser: '#ec4899', wide: '#a78bfa', fire: '#f97316', life: '#f43f5e' };
            for (const u of this.powerups) {
                ctx.fillStyle = pcol[u.type];
                ctx.shadowColor = pcol[u.type];
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.arc(u.x, u.y, 8, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.shadowBlur = 0;

            // Laser
            ctx.fillStyle = '#f472b6';
            for (const l of this.lasers) ctx.fillRect(l.x - 2, l.y, 4, 12);

            // Bälle + Trail
            const fire = p.fireT > 0;
            for (const b of this.balls) {
                for (let i = 0; i < b.trail.length; i++) {
                    ctx.globalAlpha = (i / b.trail.length) * 0.35;
                    ctx.fillStyle = fire ? '#fb923c' : '#67e8f9';
                    ctx.beginPath();
                    ctx.arc(b.trail[i].x, b.trail[i].y, b.r * (i / b.trail.length), 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.globalAlpha = 1;
                ctx.shadowColor = fire ? '#f97316' : '#22d3ee';
                ctx.shadowBlur = 12;
                ctx.fillStyle = fire ? '#fdba74' : '#fff';
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }

            // Partikel
            for (const q of this.particles) {
                ctx.globalAlpha = clamp(q.life / q.max, 0, 1);
                ctx.fillStyle = q.color;
                ctx.fillRect(q.x, q.y, q.size, q.size);
            }
            ctx.globalAlpha = 1;
            ctx.restore();
        }

        // ---------- Selbsttest ----------

        runSelfTest() {
            if (this.simulating || !this.canvas) return null;
            const results = [];
            const check = (name, fn) => {
                try {
                    const r = fn();
                    results.push({ test: name, status: r === true || r === undefined ? 'PASS' : 'FAIL', detail: r === true || r === undefined ? '' : String(r) });
                } catch (e) {
                    results.push({ test: name, status: 'FAIL', detail: 'Exception: ' + e.message });
                }
            };

            const snap = { score: this.score, lives: this.lives, level: this.currentLevel, state: this.state, hs: this.highscore, bot: this.bot };
            this.simulating = true;
            this.state = 'playing';
            const perf = { steps: 0, updateMs: 0, renderMs: 0 };
            const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

            try {
                check('Init: Canvas/Context/Paddle gültig', () =>
                    !!this.canvas && !!this.ctx && this.paddle.w > 0 && Number.isFinite(this.paddle.x) ? true : 'Initialisierung unvollständig');

                check('Levelgenerator: Level 1-60 gültig & deterministisch', () => {
                    for (let L = 1; L <= 60; L++) {
                        const a = generateLevel(L), c = generateLevel(L);
                        if (JSON.stringify(a) !== JSON.stringify(c)) return `Level ${L} nicht deterministisch`;
                        this.startLevel(L);
                        const v = validateLevel(this.bricks, this.canvas.width, this.canvas.height);
                        if (!v.ok) return `Level ${L}: ${v.reason}`;
                    }
                    return true;
                });

                check('Schwierigkeit: monoton steigend (Speed, Reihen)', () => {
                    for (let L = 2; L <= 60; L++) {
                        const a = difficulty(L - 1), b = difficulty(L);
                        if (b.ballSpeed < a.ballSpeed || b.rows < a.rows) return `Rückschritt bei Level ${L}`;
                    }
                    return Math.abs(difficulty(2).speedMul - 1.1) < 1e-9 ? true : 'Level 2 != +10 %';
                });

                check('Punkte: Treffer = +10, Combo-Multiplikator korrekt', () => {
                    this.startLevel(1);
                    this.score = 0; this.combo = 0;
                    const br = this.bricks[0];
                    br.hp = br.maxHp = 1;
                    this.hitBrick(br);
                    if (this.score !== POINTS_PER_HIT) return `Erwartet 10, erhalten ${this.score}`;
                    this.score = 0; this.combo = 3;
                    const br2 = this.bricks[0];
                    this.hitBrick(br2);
                    return this.score === POINTS_PER_HIT * 2 ? true : `Combo-Score ${this.score}`;
                });

                check('Kollision: schneller Ball tunnelt nicht', () => {
                    this.startLevel(1);
                    const br = this.bricks.reduce((a, b) => (b.y > a.y ? b : a));
                    const before = this.bricks.length;
                    this.balls = [{ x: br.x + br.w / 2, y: br.y + br.h + 60, vx: 0, vy: -4000, r: BALL_R, stuck: false, trail: [] }];
                    const saveSpeed = this.diff.ballSpeed;
                    this.diff.ballSpeed = 4000;
                    this.updateBalls(1 / 30);
                    this.diff.ballSpeed = saveSpeed;
                    const b = this.balls[0];
                    return this.bricks.length < before && (!b || b.y > br.y) ? true : 'Ball hat Stein durchquert';
                });

                check('Kollision: Ball-Paddle reflektiert nach oben', () => {
                    this.startLevel(1);
                    const p = this.paddle;
                    this.balls = [{ x: p.x + p.w / 2, y: p.y - 3, vx: 0, vy: 300, r: BALL_R, stuck: false, trail: [] }];
                    this.collidePaddle(this.balls[0]);
                    return this.balls[0].vy < 0 ? true : 'Ball nicht reflektiert';
                });

                check('Kein NaN/Null in Entitäten nach 600 Schritten', () => {
                    this.startLevel(3);
                    this.balls.forEach((b) => { b.stuck = false; b.vx = 100; b.vy = -this.diff.ballSpeed; });
                    this.bot = true;
                    for (let i = 0; i < 600 && this.state === 'playing'; i++) this.update(1 / 60);
                    for (const b of this.balls) if (![b.x, b.y, b.vx, b.vy].every(Number.isFinite)) return 'NaN im Ball';
                    for (const b of this.bricks) if (![b.x, b.y, b.w, b.h].every(Number.isFinite)) return 'NaN im Stein';
                    return Number.isFinite(this.score) && Number.isFinite(this.paddle.x) ? true : 'NaN in Score/Paddle';
                });

                // Bot spielt Level 1-3 vollständig durch
                this.score = 0; this.lives = 3;
                const botRows = [];
                for (let L = 1; L <= 3; L++) {
                    this.state = 'playing';
                    this.startLevel(L);
                    this.state = 'playing';
                    this.bot = true;
                    const scoreStart = this.score;
                    let t = 0, steps = 0;
                    while (this.state === 'playing' && t < 240) {
                        const t0 = now();
                        this.update(1 / 60);
                        perf.updateMs += now() - t0;
                        if (steps % 4 === 0) {
                            const r0 = now();
                            this.render();
                            perf.renderMs += now() - r0;
                        }
                        t += 1 / 60;
                        steps++;
                    }
                    perf.steps += steps;
                    const done = this.state === 'complete';
                    botRows.push({ level: L, ergebnis: done ? 'geschafft' : this.state, simSekunden: +t.toFixed(1), punkte: this.score - scoreStart, leben: this.lives, ballTempo: Math.round(this.diff.ballSpeed) });
                    check(`Bot: Level ${L} abgeschlossen`, () => (done ? true : `Status ${this.state} nach ${t.toFixed(0)}s`));
                    if (!done) break;
                }
                check('Bot: Score steigt über Level hinweg', () => (this.score > 0 ? true : 'Score 0'));

                const failed = results.filter((r) => r.status !== 'PASS').length;
                const renders = Math.max(1, Math.ceil(perf.steps / 4));
                const report = {
                    passed: failed === 0,
                    results,
                    bot: botRows,
                    perf: {
                        simSteps: perf.steps,
                        updateMsAvg: +(perf.updateMs / Math.max(1, perf.steps)).toFixed(4),
                        renderMsAvg: +(perf.renderMs / renders).toFixed(4),
                        liveFps: +this.perf.fps.toFixed(1),
                        liveRenderMs: +this.perf.renderMs.toFixed(3)
                    }
                };
                console.group(`%c[Breakout Selbsttest] ${report.passed ? 'BESTANDEN' : failed + ' FEHLER'}`, `color:${report.passed ? '#22c55e' : '#ef4444'};font-weight:bold`);
                console.table(results);
                console.table(botRows);
                console.table([report.perf]);
                console.groupEnd();
                window.BREAKOUT_TEST_RESULTS = report;
                return report;
            } finally {
                this.simulating = false;
                this.bot = snap.bot;
                this.highscore = snap.hs;
                this.state = snap.state === 'start' ? 'start' : 'playing';
                this.startLevel(snap.level);
                this.score = snap.score;
                this.lives = snap.lives;
                this.keys = {};
                if (snap.state === 'start') this.showOverlay('start');
                else { this.state = 'paused'; this.showOverlay('pause'); }
                this.updateHUD();
            }
        }

        destroy() {
            this.destroyed = true;
            if (this.animId) cancelAnimationFrame(this.animId);
            this.animId = null;
            for (const [target, type, fn, opts] of this.handlers) {
                if (target && target.removeEventListener) target.removeEventListener(type, fn, opts);
            }
            this.handlers = [];
            this.toastTimers.forEach((t) => clearTimeout(t));
            this.toastTimers = [];
            if (this.container) this.container.innerHTML = '';
        }
    };
})();
