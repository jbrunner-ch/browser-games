/**
 * Velocity Rush 3D - Arcade Racer (Three.js r128)
 *
 * - Einheitliches Glassmorphism-UI (HUD, Overlays, Toasts) dynamisch per JS injiziert
 * - Prozedurale, garantiert lösbare Strecken (Level 1 - 100+) mit mathematisch skalierender Schwierigkeit
 * - Substep-Physik (kein Tunneling), Zwei-Kreis-Hitboxen, Wand-/Hindernis-/Gegner-Kollision
 * - Partikel, Screen-Shake, Fade-Übergänge
 * - Self-Test: Taste 'T' oder window.RUN_TESTS = true (Sanity-Checks + Bot-Autoplay über 3 Level)
 *
 * Difficulty pro Level L (siehe Racing3DGame.difficulty):
 *   Gegner-Tempo  = 24 m/s * (1 + 0.10 * (L-1))   (gedeckelt bei 97% der Spieler-Höchstgeschwindigkeit)
 *   Spieler-Vmax  = 44 m/s * min(1.5, 1 + 0.03 * (L-1))
 *   Hindernisdichte = min(0.85, 0.30 + 0.025 * (L-1)), Zeilenabstand = max(26, 46 - 0.9 * L)
 *   Spuren 3 (+1 alle 8 Level, max 5), Fässer ab L3, Gegnertyp "weaver" ab L3, "blocker" ab L6
 */
(function () {
    'use strict';

    const LANE_W = 4.2;
    const KERB = 1.2;
    const CAR_R = 1.05;
    const CAR_CIRCLE_OFF = 1.1;
    const FIXED_DT = 1 / 60;
    const START_CLEAR = 60;
    const END_CLEAR = 30;
    const CHECKPOINTS_PER_LAP = 8;
    const HS_KEY = 'vr3d_highscore';
    const STYLE_ID = 'vr3d-style';

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const wrapAngle = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
    const pad2 = (n) => String(n).padStart(2, '0');
    const hexRGB = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];

    function mulberry32(seed) {
        let a = seed | 0;
        return function () {
            a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    const CSS = `
.vr-root{position:absolute;inset:0;overflow:hidden;font-family:'Inter','Segoe UI',system-ui,-apple-system,sans-serif;color:#e2e8f0;user-select:none;-webkit-user-select:none}
.vr-root canvas{display:block;width:100%;height:100%}
.vr-glass{background:rgba(15,23,42,.75);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.1);border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.35)}
.vr-hud{position:absolute;top:10px;left:10px;right:10px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;padding:8px 14px;z-index:5;pointer-events:none}
.vr-hud-left{display:flex;flex-direction:column;gap:2px}
.vr-title{font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a5b4fc}
.vr-level{font-size:18px;font-weight:700;color:#f8fafc}
.vr-hud-mid{text-align:center}
.vr-score{font-size:24px;font-weight:800;font-variant-numeric:tabular-nums;color:#f8fafc;line-height:1.1}
.vr-best{font-size:11px;letter-spacing:.1em;color:#94a3b8;font-variant-numeric:tabular-nums}
.vr-hud-right{display:flex;align-items:center;justify-content:flex-end;gap:10px}
.vr-hearts{display:flex;gap:3px;font-size:18px;letter-spacing:1px}
.vr-heart-off{filter:grayscale(1);opacity:.25}
.vr-icon-btn{pointer-events:auto;cursor:pointer;width:34px;height:34px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#e2e8f0;font-size:15px;transition:background .15s,transform .1s}
.vr-icon-btn:hover{background:rgba(99,102,241,.35)}
.vr-icon-btn:active{transform:scale(.92)}
.vr-info{position:absolute;left:10px;right:10px;bottom:12px;display:flex;justify-content:space-between;align-items:flex-end;gap:10px;z-index:5;pointer-events:none}
.vr-chips{display:flex;gap:8px}
.vr-chip{padding:8px 14px;min-width:78px;text-align:center}
.vr-chip .l{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#94a3b8}
.vr-chip .v{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums;color:#f8fafc}
.vr-speed{padding:8px 18px;text-align:center}
.vr-speed .v{font-size:34px;font-weight:800;font-variant-numeric:tabular-nums;color:#67e8f9;line-height:1}
.vr-speed .u{font-size:10px;letter-spacing:.2em;color:#94a3b8}
.vr-toasts{position:absolute;top:84px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;z-index:8;pointer-events:none}
.vr-toast{padding:8px 20px;font-size:16px;font-weight:700;border-radius:999px;animation:vr-toast 1.9s ease forwards}
.vr-toast.warn{color:#fca5a5;border-color:rgba(248,113,113,.4)}
.vr-toast.good{color:#67e8f9;border-color:rgba(34,211,238,.4)}
.vr-toast.gold{color:#fde68a;border-color:rgba(250,204,21,.4)}
@keyframes vr-toast{0%{opacity:0;transform:translateY(-12px) scale(.9)}12%{opacity:1;transform:translateY(0) scale(1.05)}20%{transform:scale(1)}80%{opacity:1}100%{opacity:0;transform:translateY(-8px)}}
.vr-overlay{position:absolute;inset:0;z-index:10;display:none;align-items:center;justify-content:center;background:rgba(2,6,23,.45);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
.vr-overlay.on{display:flex;animation:vr-fade .25s ease}
@keyframes vr-fade{from{opacity:0}to{opacity:1}}
.vr-modal{padding:28px 36px;min-width:300px;max-width:440px;text-align:center;animation:vr-pop .3s cubic-bezier(.2,1.2,.4,1)}
@keyframes vr-pop{from{transform:scale(.9);opacity:0}to{transform:scale(1);opacity:1}}
.vr-modal h2{margin:0 0 6px;font-size:28px;font-weight:800;color:#f8fafc;letter-spacing:.02em}
.vr-modal .sub{color:#94a3b8;font-size:14px;margin-bottom:14px}
.vr-modal .stats{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0 18px}
.vr-modal .stat{background:rgba(255,255,255,.05);border-radius:10px;padding:8px}
.vr-modal .stat b{display:block;font-size:18px;color:#f8fafc}
.vr-modal .stat span{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#94a3b8}
.vr-modal .hint{font-size:12px;color:#94a3b8;line-height:1.8;margin-bottom:16px}
.vr-modal kbd{background:rgba(255,255,255,.1);border-radius:4px;padding:1px 6px;font-size:11px;margin:0 1px}
.vr-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.vr-btn{cursor:pointer;border:none;border-radius:10px;padding:10px 22px;font-size:15px;font-weight:700;color:#fff;background:linear-gradient(135deg,#6366f1,#06b6d4);box-shadow:0 4px 18px rgba(99,102,241,.4);transition:transform .12s,box-shadow .12s,filter .12s}
.vr-btn:hover{filter:brightness(1.15);transform:translateY(-2px);box-shadow:0 8px 24px rgba(34,211,238,.35)}
.vr-btn:active{transform:scale(.95)}
.vr-btn.ghost{background:rgba(255,255,255,.08);box-shadow:none;border:1px solid rgba(255,255,255,.12)}
.vr-fade{position:absolute;inset:0;background:#020617;opacity:0;pointer-events:none;transition:opacity .35s ease;z-index:9}
.vr-fade.on{opacity:1}
.vr-test{position:absolute;top:84px;left:14px;z-index:7;padding:6px 12px;font-size:12px;color:#67e8f9;display:none}
.vr-test.on{display:block}
`;

    class Racing3DGame {
        constructor() {
            this.container = null;
            this.headless = false;
            this.scene = null;
            this.camera = null;
            this.renderer = null;
            this.animId = null;
            this.hostPaused = false;
            this.state = 'start';
            this.ui = null;
            this.timers = [];
            this.listeners = [];

            this.keys = {};
            this.inputOverride = null;
            this.test = { active: false };

            this.currentLevel = 1;
            this.cfg = null;
            this.track = null;
            this.level = null;
            this.levelGroup = null;
            this.car = null;
            this.aiCars = [];
            this.particles = null;
            this.instCoins = null;

            this.score = 0;
            this.levelStartScore = 0;
            this.highscore = this.loadHighscore();
            this.combo = 0;
            this.comboTimer = 0;
            this.time = 0;
            this.maxHP = 3;
            this.racePosition = 1;
            this.hitCount = 0;
            this.shakeAmt = 0;
            this.sfxCooldown = 0;
            this.camRot = 0;
            this.camSnap = true;
            this.acc = 0;
            this.lastFrame = 0;
            this.perf = { frames: 0, fps: 0, renderMs: 0, simMs: 0, worstFrameMs: 0, fpsAcc: 0, fpsT: 0 };
            this._hudCache = {};

            this.createCar();
        }

        /* ------------------------------------------------------------------ */
        /* Difficulty & helpers                                               */
        /* ------------------------------------------------------------------ */

        static difficulty(level) {
            const L = Math.max(1, Math.floor(level) || 1);
            const lanes = Math.min(5, 3 + Math.floor((L - 1) / 8));
            const speedFactor = 1 + 0.1 * (L - 1);
            const playerMax = 44 * Math.min(1.5, 1 + 0.03 * (L - 1));
            const aiTypes = ['racer'];
            if (L >= 3) aiTypes.push('weaver');
            if (L >= 6) aiTypes.push('blocker');
            return {
                level: L,
                lanes,
                roadW: lanes * LANE_W,
                limit: lanes * LANE_W / 2 + KERB,
                laps: L >= 6 ? 3 : 2,
                speedFactor,
                playerMax,
                aiSpeed: Math.min(playerMax * 0.97, 24 * speedFactor),
                aiCount: Math.min(6, 3 + Math.floor(L / 4)),
                aiTypes,
                density: Math.min(0.85, 0.30 + 0.025 * (L - 1)),
                rowSpacing: Math.max(26, 46 - 0.9 * L),
                barrelChance: L < 3 ? 0 : Math.min(0.6, 0.1 + 0.04 * (L - 3)),
                coinChance: 0.7
            };
        }

        static createHeadless(level = 1) {
            const g = new Racing3DGame();
            g.headless = true;
            g.startLevel(level);
            g.state = 'playing';
            return g;
        }

        loadHighscore() {
            try { return parseInt(localStorage.getItem(HS_KEY), 10) || 0; } catch (e) { return 0; }
        }

        saveHighscore() {
            if (this.headless || this.test.active) return;
            try { localStorage.setItem(HS_KEY, String(this.highscore)); } catch (e) { /* ignore */ }
        }

        sfx(name, ...args) {
            if (this.headless) return;
            try {
                const am = window.AudioManager;
                if (am && typeof am[name] === 'function') am[name](...args);
            } catch (e) { /* audio is optional */ }
        }

        later(fn, ms) {
            const id = setTimeout(() => {
                this.timers = this.timers.filter(t => t !== id);
                fn();
            }, ms);
            this.timers.push(id);
        }

        on(target, type, fn, opts) {
            target.addEventListener(type, fn, opts);
            this.listeners.push([target, type, fn, opts]);
        }

        /* ------------------------------------------------------------------ */
        /* Lifecycle                                                          */
        /* ------------------------------------------------------------------ */

        init(container, options = {}) {
            this.container = container;
            container.innerHTML = '';
            try {
                if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
            } catch (e) { /* ignore */ }

            if (typeof THREE === 'undefined') {
                container.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:40px;font-family:sans-serif;"><h3>Three.js 3D Engine konnte nicht geladen werden</h3><p style="margin-top:8px;font-size:13px;">Bitte Internetverbindung (CDN) prüfen.</p></div>';
                return;
            }

            this.injectStyle();
            this.buildUI();
            this.buildScene();
            this.bindEvents();

            this.startLevel(options.levelIndex || 1);
            this.setState('start');

            const sanity = this.runSanityChecks({ quiet: true, skipLevels: true });
            if (!sanity.ok) console.warn('[Velocity Rush 3D] Sanity-Check fehlgeschlagen', sanity.failed);

            requestAnimationFrame(() => this.resize());
            this.animate = this.animate.bind(this);
            this.lastFrame = performance.now();
            this.animId = requestAnimationFrame(this.animate);

            if (window.RUN_TESTS === true) this.later(() => this.runSelfTest(), 300);
        }

        destroy() {
            if (this.animId) cancelAnimationFrame(this.animId);
            this.animId = null;
            this.test.active = false;
            this.timers.forEach(clearTimeout);
            this.timers = [];
            this.listeners.forEach(([t, type, fn, o]) => t.removeEventListener(type, fn, o));
            this.listeners = [];
            this.sfx('stopCarEngine');
            if (this.levelGroup) this.disposeGroup(this.levelGroup);
            this.levelGroup = null;
            if (this.renderer) {
                this.renderer.dispose();
                this.renderer = null;
            }
            this.scene = null;
            if (this.container) this.container.innerHTML = '';
            this.ui = null;
        }

        pause() {
            this.hostPaused = true;
            if (this.state === 'playing' && !this.test.active) this.setPaused(true);
            this.sfx('stopCarEngine');
        }

        resume() {
            this.hostPaused = false;
            this.lastFrame = performance.now();
            if (this.state === 'paused') this.setPaused(false);
        }

        setPaused(p) {
            if (p && this.state === 'playing') this.setState('paused');
            else if (!p && this.state === 'paused') this.setState('playing');
        }

        resize() {
            if (!this.renderer || !this.container) return;
            const w = Math.max(300, this.container.clientWidth || window.innerWidth);
            const h = Math.max(300, this.container.clientHeight || (window.innerHeight - 48));
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(w, h, false);
        }

        /* ------------------------------------------------------------------ */
        /* UI (injected)                                                      */
        /* ------------------------------------------------------------------ */

        injectStyle() {
            if (document.getElementById(STYLE_ID)) return;
            const st = document.createElement('style');
            st.id = STYLE_ID;
            st.textContent = CSS;
            document.head.appendChild(st);
        }

        buildUI() {
            const root = document.createElement('div');
            root.className = 'vr-root';
            root.innerHTML = `
                <canvas class="game-canvas"></canvas>
                <div class="vr-hud vr-glass">
                    <div class="vr-hud-left"><div class="vr-title">Velocity Rush 3D</div><div class="vr-level" data-ref="level">Level 01</div></div>
                    <div class="vr-hud-mid"><div class="vr-score" data-ref="score">0</div><div class="vr-best" data-ref="best">BEST 0</div></div>
                    <div class="vr-hud-right">
                        <div class="vr-hearts" data-ref="hearts"></div>
                        <button class="vr-icon-btn" data-act="pause" title="Pause (Esc)">⏸</button>
                        <button class="vr-icon-btn" data-act="mute" data-ref="mute" title="Ton (M)">🔊</button>
                    </div>
                </div>
                <div class="vr-test vr-glass" data-ref="test">🤖 Self-Test läuft…</div>
                <div class="vr-toasts" data-ref="toasts"></div>
                <div class="vr-info">
                    <div class="vr-chips">
                        <div class="vr-chip vr-glass"><div class="l">Position</div><div class="v" data-ref="pos">1/4</div></div>
                        <div class="vr-chip vr-glass"><div class="l">Runde</div><div class="v" data-ref="lap">1/2</div></div>
                        <div class="vr-chip vr-glass"><div class="l">Zeit</div><div class="v" data-ref="time">00:00.0</div></div>
                    </div>
                    <div class="vr-speed vr-glass"><div class="v" data-ref="speed">0</div><div class="u">KM/H</div></div>
                </div>
                <div class="vr-fade" data-ref="fade"></div>
                <div class="vr-overlay" data-ref="overlay"><div class="vr-modal vr-glass" data-ref="modal"></div></div>
            `;
            this.container.appendChild(root);
            const ref = (n) => root.querySelector(`[data-ref="${n}"]`);
            this.ui = {
                root, canvas: root.querySelector('canvas'),
                level: ref('level'), score: ref('score'), best: ref('best'), hearts: ref('hearts'), mute: ref('mute'),
                toasts: ref('toasts'), pos: ref('pos'), lap: ref('lap'), time: ref('time'), speed: ref('speed'),
                fade: ref('fade'), overlay: ref('overlay'), modal: ref('modal'), test: ref('test')
            };
            root.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-act]');
                if (btn) this.onAction(btn.getAttribute('data-act'));
            });
        }

        onAction(act) {
            this.sfx('playClick');
            switch (act) {
                case 'start': this.beginPlay(); break;
                case 'pause': this.setPaused(this.state === 'playing'); break;
                case 'resume': this.setPaused(false); break;
                case 'restart':
                case 'retry':
                    this.score = this.levelStartScore;
                    this.restartLevel();
                    break;
                case 'next': this.nextLevel(); break;
                case 'mute':
                    try {
                        const m = window.AudioManager && window.AudioManager.toggleMute();
                        this.ui.mute.textContent = m ? '🔇' : '🔊';
                    } catch (e) { /* ignore */ }
                    break;
            }
        }

        showOverlay(kind) {
            if (!this.ui) return;
            const lvl = `Level ${pad2(this.currentLevel)}`;
            const best = Math.max(this.highscore, this.score);
            const html = {
                start: `<h2>Velocity Rush 3D</h2><div class="sub">${lvl} · ${this.cfg.laps} Runden · ${this.cfg.aiCount} Gegner</div>
                    <div class="hint"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / Pfeile fahren · <kbd>Space</kbd> Handbremse (Drift)<br><kbd>Esc</kbd> Pause · <kbd>M</kbd> Ton · <kbd>T</kbd> Self-Test<br>Weiche Hindernissen aus, sammle 💎 für Combos!</div>
                    <div class="vr-btns"><button class="vr-btn" data-act="start">Start</button></div>`,
                paused: `<h2>Pause</h2><div class="sub">${lvl}</div>
                    <div class="vr-btns"><button class="vr-btn" data-act="resume">Weiter</button><button class="vr-btn ghost" data-act="restart">Neustart</button></div>`,
                gameover: `<h2>Game Over</h2><div class="sub">${lvl} · Dein Wagen ist Schrott.</div>
                    <div class="stats"><div class="stat"><b>${this.score}</b><span>Score</span></div><div class="stat"><b>${best}</b><span>Highscore</span></div></div>
                    <div class="vr-btns"><button class="vr-btn" data-act="retry">Nochmal</button></div>`,
                complete: `<h2>Level Complete!</h2><div class="sub">${lvl} · Platz ${this.racePosition} von ${this.cfg.aiCount + 1}</div>
                    <div class="stats"><div class="stat"><b>${this.score}</b><span>Score</span></div><div class="stat"><b>${this.timeString(this.time)}</b><span>Zeit</span></div>
                    <div class="stat"><b>${this.hitCount}</b><span>Treffer</span></div><div class="stat"><b>${best}</b><span>Highscore</span></div></div>
                    <div class="vr-btns"><button class="vr-btn ghost" data-act="restart">Wiederholen</button><button class="vr-btn" data-act="next">Nächstes Level ➔</button></div>`
            }[kind];
            this.ui.modal.innerHTML = html;
            this.ui.overlay.classList.add('on');
        }

        hideOverlay() {
            if (this.ui) this.ui.overlay.classList.remove('on');
        }

        toast(msg, kind = 'good') {
            if (!this.ui) return;
            const el = document.createElement('div');
            el.className = `vr-toast vr-glass ${kind}`;
            el.textContent = msg;
            this.ui.toasts.appendChild(el);
            while (this.ui.toasts.children.length > 3) this.ui.toasts.removeChild(this.ui.toasts.firstChild);
            this.later(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 1950);
        }

        setText(key, value) {
            if (!this.ui || this._hudCache[key] === value) return;
            this._hudCache[key] = value;
            this.ui[key].textContent = value;
        }

        timeString(sec) {
            const m = pad2(Math.floor(sec / 60));
            const s = (sec % 60).toFixed(1).padStart(4, '0');
            return `${m}:${s}`;
        }

        updateHUD() {
            if (!this.ui) return;
            const c = this.car;
            this.setText('level', `Level ${pad2(this.currentLevel)}`);
            this.setText('score', String(this.score));
            this.setText('best', `BEST ${Math.max(this.highscore, this.score)}`);
            this.setText('speed', String(Math.round(Math.hypot(c.vx, c.vz) * 3.6)));
            this.setText('lap', `${Math.min(Math.floor(c.maxTotal) + 1, this.cfg.laps)}/${this.cfg.laps}`);
            this.setText('pos', `${this.racePosition}/${this.cfg.aiCount + 1}`);
            this.setText('time', this.timeString(this.time));
            let hearts = '';
            for (let i = 0; i < this.maxHP; i++) hearts += `<span class="${i < c.hp ? '' : 'vr-heart-off'}">❤️</span>`;
            if (this._hudCache.hearts !== hearts) {
                this._hudCache.hearts = hearts;
                this.ui.hearts.innerHTML = hearts;
            }
        }

        fade(fn) {
            if (!this.ui || this.test.active) { fn(); return; }
            this.ui.fade.classList.add('on');
            this.later(() => {
                fn();
                this.later(() => { if (this.ui) this.ui.fade.classList.remove('on'); }, 80);
            }, 360);
        }

        /* ------------------------------------------------------------------ */
        /* State                                                              */
        /* ------------------------------------------------------------------ */

        setState(s) {
            this.state = s;
            if (s === 'playing') {
                this.hideOverlay();
                this.sfx('startCarEngine');
            } else {
                this.sfx('stopCarEngine');
                if (!this.test.active && (s === 'start' || s === 'paused' || s === 'gameover' || s === 'complete')) this.showOverlay(s);
            }
        }

        beginPlay() {
            this.setState('playing');
            this.toast(`Level ${pad2(this.currentLevel)} – Los!`, 'good');
            this.lastFrame = performance.now();
        }

        restartLevel() {
            this.fade(() => {
                this.startLevel(this.currentLevel);
                this.setState('playing');
            });
        }

        nextLevel() {
            this.fade(() => {
                this.startLevel(this.currentLevel + 1);
                this.setState('playing');
                this.toast(`Level ${pad2(this.currentLevel)}`, 'gold');
            });
        }

        syncPortal() {
            if (this.headless) return;
            try {
                if (window.portal) {
                    window.portal.currentLevel = this.currentLevel;
                    const pill = document.getElementById('active-level-indicator');
                    if (pill && window.portal.getDifficultyName) {
                        pill.innerText = `Level ${this.currentLevel} (${window.portal.getDifficultyName(this.currentLevel)}) ▾`;
                    }
                }
            } catch (e) { /* ignore */ }
        }

        /* ------------------------------------------------------------------ */
        /* Level generation                                                   */
        /* ------------------------------------------------------------------ */

        startLevel(levelIndex = 1) {
            const L = Math.max(1, Math.floor(levelIndex) || 1);
            this.currentLevel = L;
            this.cfg = Racing3DGame.difficulty(L);
            this.levelStartScore = this.score;
            this.time = 0;
            this.combo = 0;
            this.comboTimer = 0;
            this.hitCount = 0;
            this.acc = 0;
            this.camSnap = true;

            this.track = this.buildTrackData(L, this.cfg);
            this.level = this.buildLevelData(L, this.cfg, this.track);
            this.resetCar();
            this.createAI();

            if (this.scene) this.buildLevelMeshes();
            this.syncPortal();
            this.updateHUD();
        }

        buildTrackData(L, cfg) {
            const rng = mulberry32(L * 7919 + 13);
            const harmonics = Math.min(6, 2 + Math.floor(L / 6));
            const baseR = 150 + Math.min(120, L * 5);
            let amp = 0.10 + Math.min(0.12, L * 0.006);
            const phases = [];
            for (let k = 0; k < harmonics; k++) phases.push(rng() * Math.PI * 2);

            let track = null;
            for (let attempt = 0; attempt < 16; attempt++) {
                const ctrl = [];
                const M = 48;
                for (let i = 0; i < M; i++) {
                    const th = (i / M) * Math.PI * 2;
                    let f = 1;
                    for (let k = 0; k < harmonics; k++) f += (amp / (k + 1)) * Math.cos((k + 2) * th + phases[k]);
                    const r = baseR * f;
                    ctrl.push(new THREE.Vector3(Math.cos(th) * r, 0.05, Math.sin(th) * r * 0.72));
                }
                const curve = new THREE.CatmullRomCurve3(ctrl, true, 'centripetal');
                curve.arcLengthDivisions = 1200;
                track = this.sampleTrack(curve);
                track.amp = amp;
                if (this.trackOk(track, cfg).ok) break;
                amp *= 0.8;
            }
            return track;
        }

        sampleTrack(curve) {
            const length = curve.getLength();
            const N = Math.max(64, Math.ceil(length / 4));
            const raw = curve.getSpacedPoints(N);
            const px = new Float32Array(N), pz = new Float32Array(N);
            const tx = new Float32Array(N), tz = new Float32Array(N);
            for (let i = 0; i < N; i++) { px[i] = raw[i].x; pz[i] = raw[i].z; }
            for (let i = 0; i < N; i++) {
                const a = (i - 1 + N) % N, b = (i + 1) % N;
                const dx = px[b] - px[a], dz = pz[b] - pz[a];
                const l = Math.hypot(dx, dz) || 1;
                tx[i] = dx / l; tz[i] = dz / l;
            }
            return { px, pz, tx, tz, N, length, ds: length / N };
        }

        trackMinRadius(track) {
            const { N, tx, tz, ds } = track;
            let minR = Infinity;
            for (let i = 0; i < N; i++) {
                const a = (i - 2 + N) % N, b = (i + 2) % N;
                const ang = Math.abs(wrapAngle(Math.atan2(tx[b], tz[b]) - Math.atan2(tx[a], tz[a])));
                if (ang > 1e-4) minR = Math.min(minR, (4 * ds) / ang);
            }
            return minR;
        }

        trackMinClearance(track) {
            const { N, px, pz, ds } = track;
            const skip = Math.ceil(80 / ds);
            let minD = Infinity;
            for (let i = 0; i < N; i += 2) {
                for (let j = i + 1; j < N; j += 2) {
                    const gap = Math.min(j - i, N - (j - i));
                    if (gap < skip) continue;
                    const d = Math.hypot(px[i] - px[j], pz[i] - pz[j]);
                    if (d < minD) minD = d;
                }
            }
            return minD;
        }

        trackOk(track, cfg) {
            const minR = this.trackMinRadius(track);
            const clearance = this.trackMinClearance(track);
            return { ok: minR >= 60 && clearance >= cfg.limit * 2 + 6, minR, clearance };
        }

        frameAt(s) {
            const T = this.track;
            const sm = ((s % T.length) + T.length) % T.length;
            const f = sm / T.ds;
            const i = Math.floor(f) % T.N;
            const j = (i + 1) % T.N;
            const t = f - Math.floor(f);
            let tx = T.tx[i] + (T.tx[j] - T.tx[i]) * t;
            let tz = T.tz[i] + (T.tz[j] - T.tz[i]) * t;
            const l = Math.hypot(tx, tz) || 1;
            tx /= l; tz /= l;
            return {
                x: T.px[i] + (T.px[j] - T.px[i]) * t,
                z: T.pz[i] + (T.pz[j] - T.pz[i]) * t,
                tx, tz, nx: -tz, nz: tx
            };
        }

        laneOffset(lane, lanes = this.cfg.lanes) {
            return (lane - (lanes - 1) / 2) * LANE_W;
        }

        buildLevelData(L, cfg, track) {
            const rng = mulberry32(L * 104729 + 7);
            const rows = [];
            const obstacles = [];
            const coins = [];
            let free = Math.floor(cfg.lanes / 2);
            let k = 0;
            for (let s = START_CLEAR; s < track.length - END_CLEAR; s += cfg.rowSpacing, k++) {
                // Die freie Spur wechselt pro Zeile um höchstens eine Spur -> immer ein befahrbarer Pfad
                const r = rng();
                free = clamp(free + (r < 0.25 ? -1 : r > 0.75 ? 1 : 0), 0, cfg.lanes - 1);
                const row = { k, s, free, blocked: [], obstacles: [] };
                const fr = this.frameAt(s);
                for (let lane = 0; lane < cfg.lanes; lane++) {
                    if (lane === free || rng() >= cfg.density) continue;
                    const type = rng() < cfg.barrelChance ? 'barrel' : 'cone';
                    const off = this.laneOffset(lane, cfg.lanes);
                    const o = {
                        type, lane, s, r: type === 'barrel' ? 0.9 : 0.7, alive: true, row: k,
                        x: fr.x + fr.nx * off, z: fr.z + fr.nz * off, inst: -1, instMesh: null
                    };
                    row.blocked.push(lane);
                    row.obstacles.push(o);
                    obstacles.push(o);
                }
                rows.push(row);
                const cs = s + cfg.rowSpacing / 2;
                if (cs < track.length - END_CLEAR && rng() < cfg.coinChance) {
                    const cf = this.frameAt(cs);
                    const off = this.laneOffset(free, cfg.lanes);
                    coins.push({ s: cs, lane: free, x: cf.x + cf.nx * off, z: cf.z + cf.nz * off, alive: true, inst: -1, instMesh: null });
                }
            }
            return { rows, obstacles, coins, start: START_CLEAR, spacing: cfg.rowSpacing };
        }

        rowIndexAt(s) {
            return Math.round((s - this.level.start) / this.level.spacing);
        }

        /* Lösbarkeits-Beweis: existiert eine Spurfolge (±1 pro Zeile) ohne Hindernis? */
        validateLevel() {
            const issues = [];
            const cfg = this.cfg, lv = this.level, T = this.track;
            if (!T || !lv) return { ok: false, issues: ['Level-Daten fehlen'], minR: 0, clearance: 0 };
            const tk = this.trackOk(T, cfg);
            if (tk.minR < 60) issues.push(`Kurvenradius ${tk.minR.toFixed(1)} < 60`);
            if (tk.clearance < cfg.limit * 2 + 6) issues.push(`Streckenengstelle ${tk.clearance.toFixed(1)}`);
            const closeGap = Math.hypot(T.px[0] - T.px[T.N - 1], T.pz[0] - T.pz[T.N - 1]);
            if (closeGap > T.ds * 1.6) issues.push('Strecke nicht geschlossen');

            let reach = new Set([Math.floor(cfg.lanes / 2)]);
            for (const row of lv.rows) {
                const next = new Set();
                for (let l = 0; l < cfg.lanes; l++) {
                    if (row.blocked.includes(l)) continue;
                    if (reach.has(l - 1) || reach.has(l) || reach.has(l + 1)) next.add(l);
                }
                if (next.size === 0) { issues.push(`Zeile ${row.k}: kein freier Pfad`); break; }
                reach = next;
            }
            for (const o of lv.obstacles) {
                if (!Number.isFinite(o.x) || !Number.isFinite(o.z)) { issues.push('Hindernis NaN'); break; }
                if (o.s < START_CLEAR - 1) { issues.push('Hindernis in Startzone'); break; }
            }
            return { ok: issues.length === 0, issues, minR: tk.minR, clearance: tk.clearance };
        }

        /* ------------------------------------------------------------------ */
        /* Car & AI                                                           */
        /* ------------------------------------------------------------------ */

        createCar() {
            this.car = {
                x: 0, z: 0, rot: 0, vx: 0, vz: 0, steer: 0,
                hp: 3, invuln: 0, idx: -1, d: 0, s: 0, lastP: 0, total: 0, maxTotal: 0,
                mesh: null, body: null, wheels: [], front: [], drifting: false, _fs: 0, _ls: 0
            };
        }

        resetCar() {
            const c = this.car;
            const f = this.frameAt(0);
            c.x = f.x; c.z = f.z;
            c.rot = Math.atan2(f.tx, f.tz);
            c.vx = 0; c.vz = 0; c.steer = 0; c._fs = 0; c._ls = 0;
            c.hp = this.maxHP; c.invuln = 0;
            c.idx = 0; c.d = 0; c.s = 0; c.lastP = 0; c.total = 0; c.maxTotal = 0;
            c.drifting = false;
        }

        createAI() {
            const cfg = this.cfg;
            this.aiCars = [];
            const colors = { racer: 0x3b82f6, weaver: 0x10b981, blocker: 0xa855f7 };
            for (let i = 0; i < cfg.aiCount; i++) {
                const type = cfg.aiTypes[i % cfg.aiTypes.length];
                const s = 10 + i * 9;
                const f = this.frameAt(s);
                this.aiCars.push({
                    type, color: colors[type], s, total: s / this.track.length,
                    lat: this.laneOffset(i % cfg.lanes), phase: i * 1.7,
                    speed: cfg.aiSpeed * (0.94 + 0.03 * (i % 3)),
                    x: f.x, z: f.z, rot: Math.atan2(f.tx, f.tz), mesh: null
                });
            }
            this.racePosition = this.computePosition();
        }

        computePosition() {
            let ahead = 0;
            for (const ai of this.aiCars) if (ai.total > this.car.total) ahead++;
            return ahead + 1;
        }

        carCircles(x, z, rot) {
            const fx = Math.sin(rot), fz = Math.cos(rot);
            return [
                { x: x + fx * CAR_CIRCLE_OFF, z: z + fz * CAR_CIRCLE_OFF },
                { x: x - fx * CAR_CIRCLE_OFF, z: z - fz * CAR_CIRCLE_OFF }
            ];
        }

        locate(x, z, hint) {
            const T = this.track, N = T.N;
            let best = -1, bd = Infinity;
            if (hint >= 0) {
                for (let o = -24; o <= 24; o++) {
                    const i = (hint + o + N) % N;
                    const d2 = (x - T.px[i]) ** 2 + (z - T.pz[i]) ** 2;
                    if (d2 < bd) { bd = d2; best = i; }
                }
            }
            if (best < 0 || bd > 900) {
                bd = Infinity;
                for (let i = 0; i < N; i++) {
                    const d2 = (x - T.px[i]) ** 2 + (z - T.pz[i]) ** 2;
                    if (d2 < bd) { bd = d2; best = i; }
                }
            }
            const nx = -T.tz[best], nz = T.tx[best];
            const dx = x - T.px[best], dz = z - T.pz[best];
            return { i: best, d: dx * nx + dz * nz, a: dx * T.tx[best] + dz * T.tz[best], nx, nz };
        }

        /* ------------------------------------------------------------------ */
        /* Input                                                              */
        /* ------------------------------------------------------------------ */

        getInput() {
            if (this.inputOverride) return this.inputOverride(this);
            if (this.test.active) return this.botInput();
            const k = this.keys;
            const up = k.KeyW || k.ArrowUp, down = k.KeyS || k.ArrowDown;
            const left = k.KeyA || k.ArrowLeft, right = k.KeyD || k.ArrowRight;
            return { throttle: up ? 1 : 0, brake: down ? 1 : 0, steer: (left ? 1 : 0) - (right ? 1 : 0), handbrake: !!k.Space };
        }

        bindEvents() {
            this.on(window, 'keydown', (e) => {
                const tag = e.target && e.target.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA') return;
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
                this.keys[e.code] = true;
                if (e.repeat) return;
                if (e.code === 'Escape' || e.code === 'KeyP') {
                    if (this.state === 'playing' && !this.test.active) this.setPaused(true);
                    else if (this.state === 'paused') this.setPaused(false);
                } else if ((e.code === 'Enter' || e.code === 'Space') && this.state === 'start') this.beginPlay();
                else if (e.code === 'Enter' && this.state === 'complete') this.nextLevel();
                else if (e.code === 'Enter' && this.state === 'gameover') this.onAction('retry');
                else if (e.code === 'KeyM') this.onAction('mute');
                else if (e.code === 'KeyT') this.runSelfTest();
            });
            this.on(window, 'keyup', (e) => { this.keys[e.code] = false; });
            this.on(window, 'blur', () => { this.keys = {}; });
            this.on(window, 'resize', () => this.resize());
        }

        /* ------------------------------------------------------------------ */
        /* Simulation                                                         */
        /* ------------------------------------------------------------------ */

        stepSim(dt) {
            if (this.state !== 'playing') return;
            const c = this.car;
            this.time += dt;
            c.invuln = Math.max(0, c.invuln - dt);
            this.sfxCooldown = Math.max(0, this.sfxCooldown - dt);
            if (this.comboTimer > 0) {
                this.comboTimer -= dt;
                if (this.comboTimer <= 0) this.combo = 0;
            }

            const inp = this.getInput();
            c.steer += (clamp(inp.steer, -1, 1) - c.steer) * Math.min(1, 9 * dt);

            // Substeps: pro Teilschritt max. ~0.6 m Weg -> kein Tunneling
            const sp = Math.hypot(c.vx, c.vz);
            const n = Math.min(24, Math.max(1, Math.ceil((sp * dt) / 0.6)));
            const h = dt / n;
            for (let i = 0; i < n && this.state === 'playing'; i++) {
                this.integrate(h, inp);
                this.collideWalls();
                this.collideObstacles();
                this.collectCoins();
            }
            if (this.state !== 'playing') return;
            this.updateAI(dt);
            this.collideAI();
            this.updateProgress();
            this.racePosition = this.computePosition();
        }

        integrate(h, inp) {
            const c = this.car, cfg = this.cfg;
            let fx = Math.sin(c.rot), fz = Math.cos(c.rot);
            let fs = c.vx * fx + c.vz * fz;

            // Lenkung: Gierrate sinkt mit Tempo; Handbremse dreht stärker ein
            const yaw = (c.steer * 3.0 / (1 + Math.abs(fs) / 22)) * clamp(fs / 6, -1, 1) * (inp.handbrake ? 1.5 : 1);
            c.rot += yaw * h;
            fx = Math.sin(c.rot); fz = Math.cos(c.rot);
            const rx = -fz, rz = fx;
            fs = c.vx * fx + c.vz * fz;
            let ls = c.vx * rx + c.vz * rz;

            if (inp.throttle > 0) fs += 26 * (1 - clamp(fs / cfg.playerMax, 0, 1.2)) * inp.throttle * h;
            if (inp.brake > 0) {
                if (fs > 0.5) fs = Math.max(0, fs - 38 * inp.brake * h);
                else fs = Math.max(-12, fs - 13 * h);
            }
            fs -= fs * 0.32 * h;
            if (Math.abs(fs) < 0.05 && !inp.throttle && !inp.brake) fs = 0;

            const grip = inp.handbrake ? 2.2 : 9;
            if (inp.handbrake) fs -= fs * 0.5 * h;
            ls *= Math.exp(-grip * h);
            c.drifting = Math.abs(ls) > 3.5;

            c.vx = fx * fs + rx * ls;
            c.vz = fz * fs + rz * ls;
            c.x += c.vx * h;
            c.z += c.vz * h;
            c._fs = fs; c._ls = ls;

            if (c.drifting && this.particles && Math.random() < 0.6) {
                const b = this.carCircles(c.x, c.z, c.rot)[1];
                this.emit(b.x, 0.3, b.z, 0xcbd5e1, 1, 2.5);
            }
        }

        collideWalls() {
            const c = this.car, limit = this.cfg.limit;
            for (let pass = 0; pass < 2; pass++) {
                for (const cc of this.carCircles(c.x, c.z, c.rot)) {
                    const loc = this.locate(cc.x, cc.z, c.idx);
                    const over = Math.abs(loc.d) + CAR_R - limit;
                    if (over <= 0) continue;
                    const sgn = loc.d >= 0 ? 1 : -1;
                    c.x -= sgn * loc.nx * over;
                    c.z -= sgn * loc.nz * over;
                    const vn = (c.vx * loc.nx + c.vz * loc.nz) * sgn;
                    if (vn > 0) {
                        c.vx -= 1.25 * vn * sgn * loc.nx;
                        c.vz -= 1.25 * vn * sgn * loc.nz;
                        if (vn > 6) {
                            this.emit(cc.x, 0.6, cc.z, 0xfbbf24, Math.min(14, Math.round(vn)), 6);
                            this.shake(Math.min(0.5, vn / 30));
                            if (this.sfxCooldown <= 0) { this.sfx('playHit'); this.sfxCooldown = 0.25; }
                        }
                        if (vn > 14) this.hit('wall');
                    }
                    c.vx *= 0.995; c.vz *= 0.995;
                }
            }
            const loc = this.locate(c.x, c.z, c.idx);
            c.idx = loc.i;
            c.d = loc.d;
            c.s = loc.i * this.track.ds + loc.a;
        }

        collideObstacles() {
            const c = this.car, lv = this.level;
            const k = this.rowIndexAt(c.s);
            const circles = this.carCircles(c.x, c.z, c.rot);
            for (let kk = k - 1; kk <= k + 1; kk++) {
                const row = lv.rows[kk];
                if (!row) continue;
                for (const o of row.obstacles) {
                    if (!o.alive) continue;
                    for (const cc of circles) {
                        const dx = o.x - cc.x, dz = o.z - cc.z;
                        const rr = CAR_R + o.r;
                        if (dx * dx + dz * dz >= rr * rr) continue;
                        this.destroyObstacle(o);
                        break;
                    }
                }
            }
        }

        destroyObstacle(o) {
            const c = this.car;
            o.alive = false;
            this.hideInstance(o);
            const isBarrel = o.type === 'barrel';
            this.emit(o.x, 0.6, o.z, isBarrel ? 0xef4444 : 0xfb923c, isBarrel ? 26 : 14, isBarrel ? 9 : 6);
            this.shake(isBarrel ? 0.8 : 0.35);
            this.sfx(isBarrel ? 'playExplosion' : 'playHit');
            const f = isBarrel ? 0.55 : 0.85;
            c.vx *= f; c.vz *= f;
            this.combo = 0;
            this.comboTimer = 0;
            if (isBarrel) this.hit('barrel');
        }

        hit(source) {
            const c = this.car;
            if (c.invuln > 0 || this.state !== 'playing') return false;
            c.hp -= 1;
            c.invuln = 1.6;
            this.hitCount++;
            this.shake(0.9);
            this.toast(source === 'wall' ? 'Wandtreffer! -1 ❤' : 'Treffer! -1 ❤', 'warn');
            this.updateHUD();
            if (c.hp <= 0) this.triggerGameOver();
            return true;
        }

        collectCoins() {
            const c = this.car;
            for (const coin of this.level.coins) {
                if (!coin.alive || Math.abs(coin.s - c.s) > 8) continue;
                if ((coin.x - c.x) ** 2 + (coin.z - c.z) ** 2 < 2.4 * 2.4) {
                    coin.alive = false;
                    this.hideInstance(coin);
                    this.collectCoin(coin);
                }
            }
        }

        collectCoin(coin) {
            this.combo = this.comboTimer > 0 ? this.combo + 1 : 1;
            this.comboTimer = 2.5;
            this.addScore(100 * Math.min(this.combo, 5));
            if (coin) this.emit(coin.x, 1, coin.z, 0xfacc15, 12, 5);
            this.sfx('playSelect');
            if (this.combo >= 3) this.toast(`Combo x${this.combo}`, 'gold');
        }

        addScore(n) {
            this.score += Math.max(0, Math.round(n));
            if (this.score > this.highscore) this.highscore = this.score;
        }

        updateAI(dt) {
            const cfg = this.cfg, c = this.car, len = this.track.length;
            for (const ai of this.aiCars) {
                ai.s += ai.speed * dt;
                ai.total = ai.s / len;
                const sm = ai.s % len;
                const row = this.level.rows[Math.ceil((sm + 3 - this.level.start) / this.level.spacing)];
                let target = 0;
                if (row && row.s - sm < 60) {
                    target = this.laneOffset(row.free);
                    if (ai.type === 'blocker' && c.s < sm && sm - c.s < 50) {
                        for (let l = 0; l < cfg.lanes; l++) {
                            if (row.blocked.includes(l)) continue;
                            const v = this.laneOffset(l);
                            if (Math.abs(v - c.d) < Math.abs(target - c.d)) target = v;
                        }
                    }
                }
                if (ai.type === 'weaver') target += Math.sin(this.time * 1.6 + ai.phase) * 0.9;
                ai.lat += clamp(target - ai.lat, -6 * dt, 6 * dt);
                const f = this.frameAt(sm);
                ai.x = f.x + f.nx * ai.lat;
                ai.z = f.z + f.nz * ai.lat;
                ai.rot = Math.atan2(f.tx, f.tz);
            }
        }

        collideAI() {
            const c = this.car, len = this.track.length;
            const mine = this.carCircles(c.x, c.z, c.rot);
            for (const ai of this.aiCars) {
                const gap = Math.abs((ai.s % len) - c.s);
                if (Math.min(gap, len - gap) > 12) continue;
                const theirs = this.carCircles(ai.x, ai.z, ai.rot);
                for (const a of mine) {
                    for (const b of theirs) {
                        const dx = a.x - b.x, dz = a.z - b.z;
                        const d = Math.hypot(dx, dz);
                        const min = CAR_R * 2 - 0.1;
                        if (d >= min || d < 1e-6) continue;
                        const nx = dx / d, nz = dz / d, over = min - d;
                        c.x += nx * over; c.z += nz * over;
                        const vn = c.vx * nx + c.vz * nz;
                        if (vn < 0) { c.vx -= 1.3 * vn * nx; c.vz -= 1.3 * vn * nz; }
                        c.vx *= 0.99; c.vz *= 0.99;
                        if (this.sfxCooldown <= 0) {
                            this.emit((a.x + b.x) / 2, 0.7, (a.z + b.z) / 2, 0xe2e8f0, 8, 4);
                            this.shake(0.25);
                            this.sfx('playHit');
                            this.sfxCooldown = 0.3;
                        }
                    }
                }
            }
        }

        updateProgress() {
            const c = this.car, T = this.track;
            const p = (c.s / T.length + 1) % 1;
            let dp = p - c.lastP;
            if (dp > 0.5) dp -= 1;
            if (dp < -0.5) dp += 1;
            c.lastP = p;
            c.total += dp;
            if (c.total <= c.maxTotal) return;
            const prevCp = Math.floor(c.maxTotal * CHECKPOINTS_PER_LAP);
            const prevLap = Math.floor(c.maxTotal);
            c.maxTotal = c.total;
            if (c.maxTotal >= this.cfg.laps) { this.triggerComplete(); return; }
            if (Math.floor(c.maxTotal * CHECKPOINTS_PER_LAP) > prevCp) {
                this.addScore(50);
                this.emit(c.x, 1, c.z, 0x22d3ee, 10, 6);
                if (Math.floor(c.maxTotal) > prevLap) {
                    this.toast(`Runde ${Math.floor(c.maxTotal) + 1}/${this.cfg.laps}`, 'good');
                    this.sfx('playPowerup');
                }
            }
        }

        triggerComplete() {
            if (this.state !== 'playing') return;
            this.racePosition = this.computePosition();
            const cfg = this.cfg;
            const par = (this.track.length * cfg.laps) / (0.8 * cfg.playerMax);
            this.addScore(1000 + (cfg.aiCount + 1 - this.racePosition) * 250 + Math.max(0, Math.round((par - this.time) * 10)));
            this.saveHighscore();
            this.shake(0.4);
            this.emit(this.car.x, 2, this.car.z, 0xfde047, 40, 12);
            this.sfx('playWin');
            this.toast(this.racePosition === 1 ? 'Sieg! 🏆' : 'Ziel erreicht!', 'gold');
            this.updateHUD();
            this.setState('complete');
        }

        triggerGameOver() {
            this.saveHighscore();
            this.emit(this.car.x, 1, this.car.z, 0xef4444, 50, 12);
            this.sfx('playExplosion');
            this.setState('gameover');
        }

        shake(a) {
            this.shakeAmt = Math.max(this.shakeAmt, a);
        }

        /* ------------------------------------------------------------------ */
        /* Scene                                                              */
        /* ------------------------------------------------------------------ */

        buildScene() {
            const w = Math.max(300, this.container.clientWidth || window.innerWidth);
            const h = Math.max(300, this.container.clientHeight || (window.innerHeight - 48));

            this.scene = new THREE.Scene();
            this.scene.background = this.canvasTexture(4, 256, (g, cw, ch) => {
                const grad = g.createLinearGradient(0, 0, 0, ch);
                grad.addColorStop(0, '#070b1f');
                grad.addColorStop(0.55, '#2b2260');
                grad.addColorStop(0.85, '#c2410c');
                grad.addColorStop(1, '#fb923c');
                g.fillStyle = grad;
                g.fillRect(0, 0, cw, ch);
            });
            this.scene.fog = new THREE.FogExp2(0x2b2260, 0.0055);

            this.camera = new THREE.PerspectiveCamera(65, w / h, 0.1, 1200);
            this.renderer = new THREE.WebGLRenderer({ canvas: this.ui.canvas, antialias: true });
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            this.renderer.setSize(w, h, false);
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.15;
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

            this.scene.add(new THREE.HemisphereLight(0x93a5ff, 0x24103a, 0.75));
            const sun = new THREE.DirectionalLight(0xffd7a8, 1.15);
            sun.position.set(60, 90, 40);
            sun.castShadow = true;
            sun.shadow.mapSize.set(1024, 1024);
            const sc = sun.shadow.camera;
            sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 260;
            this.scene.add(sun);
            this.scene.add(sun.target);
            this.sun = sun;

            const ground = new THREE.Mesh(
                new THREE.PlaneGeometry(3000, 3000),
                new THREE.MeshStandardMaterial({ color: 0x0b1020, roughness: 1 })
            );
            ground.rotation.x = -Math.PI / 2;
            ground.position.y = -0.02;
            ground.receiveShadow = true;
            this.scene.add(ground);

            this.buildCarMesh();
            this.buildParticles();
        }

        buildCarMesh() {
            const g = new THREE.Group();
            const body = new THREE.Group();
            const paint = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.25, metalness: 0.5 });
            const glass = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.05, metalness: 0.8 });
            const lower = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.6, 4.4), paint);
            lower.position.y = 0.55;
            const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.0), glass);
            cabin.position.set(0, 1.05, -0.3);
            const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.5), paint);
            spoiler.position.set(0, 1.15, -2.0);
            const head = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3c4, emissiveIntensity: 1.6 });
            const tail = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff2222, emissiveIntensity: 1.4 });
            [-0.7, 0.7].forEach((x) => {
                const hl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.1), head);
                hl.position.set(x, 0.6, 2.2);
                const tl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.1), tail);
                tl.position.set(x, 0.65, -2.2);
                body.add(hl, tl);
            });
            body.add(lower, cabin, spoiler);
            body.traverse(o => { if (o.isMesh) o.castShadow = true; });
            g.add(body);

            const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 14);
            const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0f, roughness: 0.8 });
            const c = this.car;
            c.wheels = []; c.front = [];
            [[-1.05, 1.3, true], [1.05, 1.3, true], [-1.05, -1.3, false], [1.05, -1.3, false]].forEach(([x, z, front]) => {
                const pivot = new THREE.Group();
                pivot.rotation.order = 'YXZ';
                pivot.position.set(x, 0.42, z);
                const wm = new THREE.Mesh(wheelGeo, wheelMat);
                wm.rotation.z = Math.PI / 2;
                wm.castShadow = true;
                pivot.add(wm);
                g.add(pivot);
                c.wheels.push(pivot);
                if (front) c.front.push(pivot);
            });
            c.mesh = g;
            c.body = body;
            this.scene.add(g);
        }

        buildAIMesh(color) {
            const g = new THREE.Group();
            const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.4 });
            const lower = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.6, 4.2), paint);
            lower.position.y = 0.55;
            const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.45, 1.9), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.7 }));
            cabin.position.set(0, 1.0, -0.2);
            const tail = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.15, 0.1), new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff2222, emissiveIntensity: 1.2 }));
            tail.position.set(0, 0.65, -2.1);
            const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
            const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0f });
            g.add(lower, cabin, tail);
            [[-1, 1.3], [1, 1.3], [-1, -1.3], [1, -1.3]].forEach(([x, z]) => {
                const w = new THREE.Mesh(wheelGeo, wheelMat);
                w.rotation.z = Math.PI / 2;
                w.position.set(x, 0.42, z);
                g.add(w);
            });
            g.traverse(o => { if (o.isMesh) o.castShadow = true; });
            return g;
        }

        disposeGroup(group) {
            if (!group) return;
            if (this.scene) this.scene.remove(group);
            group.traverse((o) => {
                if (o.geometry) o.geometry.dispose();
                if (o.material) {
                    const mats = Array.isArray(o.material) ? o.material : [o.material];
                    mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
                }
            });
        }

        canvasTexture(w, h, draw, repeatV) {
            const cv = document.createElement('canvas');
            cv.width = w; cv.height = h;
            draw(cv.getContext('2d'), w, h);
            const t = new THREE.CanvasTexture(cv);
            if (repeatV) t.wrapT = THREE.RepeatWrapping;
            t.anisotropy = 8;
            return t;
        }

        makeStrip(aOff, aY, bOff, bY, vScale, material) {
            const T = this.track, N = T.N;
            const pos = [], uv = [], idx = [];
            for (let i = 0; i <= N; i++) {
                const j = i % N;
                const nx = -T.tz[j], nz = T.tx[j];
                const v = (i * T.ds) / vScale;
                pos.push(T.px[j] + nx * aOff, aY, T.pz[j] + nz * aOff);
                pos.push(T.px[j] + nx * bOff, bY, T.pz[j] + nz * bOff);
                uv.push(0, v, 1, v);
            }
            for (let i = 0; i < N; i++) {
                const a = i * 2;
                idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
            geo.setIndex(idx);
            geo.computeVertexNormals();
            const m = new THREE.Mesh(geo, material);
            m.receiveShadow = true;
            return m;
        }

        buildLevelMeshes() {
            if (this.levelGroup) this.disposeGroup(this.levelGroup);
            const cfg = this.cfg, lv = this.level, T = this.track;
            const group = new THREE.Group();
            this.levelGroup = group;
            const half = cfg.roadW / 2;

            const roadTex = this.canvasTexture(512, 128, (g, w, h) => {
                g.fillStyle = '#2b2f3a'; g.fillRect(0, 0, w, h);
                for (let i = 0; i < 1400; i++) {
                    g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.06})`;
                    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
                }
                g.fillStyle = 'rgba(255,255,255,.65)';
                for (let l = 1; l < cfg.lanes; l++) g.fillRect((l / cfg.lanes) * w - 3, 0, 6, h / 2);
                g.fillStyle = '#f8fafc';
                g.fillRect(4, 0, 8, h); g.fillRect(w - 12, 0, 8, h);
            }, true);
            group.add(this.makeStrip(-half, 0.03, half, 0.03, 12, new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide })));

            const kerbTex = this.canvasTexture(32, 64, (g, w, h) => {
                g.fillStyle = '#ef4444'; g.fillRect(0, 0, w, h / 2);
                g.fillStyle = '#f8fafc'; g.fillRect(0, h / 2, w, h / 2);
            }, true);
            const kerbMat = new THREE.MeshStandardMaterial({ map: kerbTex, roughness: 0.7, side: THREE.DoubleSide });
            group.add(this.makeStrip(half, 0.04, cfg.limit, 0.04, 4, kerbMat));
            group.add(this.makeStrip(-cfg.limit, 0.04, -half, 0.04, 4, kerbMat));

            const wallMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6, emissive: 0x0f172a, side: THREE.DoubleSide });
            group.add(this.makeStrip(cfg.limit + 0.1, 0, cfg.limit + 0.1, 1.1, 8, wallMat));
            group.add(this.makeStrip(-cfg.limit - 0.1, 0, -cfg.limit - 0.1, 1.1, 8, wallMat));

            const f0 = this.frameAt(0);
            const chk = this.canvasTexture(128, 32, (g) => {
                for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) {
                    g.fillStyle = (x + y) % 2 ? '#f8fafc' : '#0f172a';
                    g.fillRect(x * 8, y * 8, 8, 8);
                }
            });
            const line = new THREE.Mesh(new THREE.PlaneGeometry(cfg.roadW, 2.4), new THREE.MeshBasicMaterial({ map: chk }));
            line.rotation.order = 'YXZ';
            line.rotation.set(-Math.PI / 2, Math.atan2(f0.tx, f0.tz), 0);
            line.position.set(f0.x, 0.06, f0.z);
            group.add(line);

            const postCount = Math.ceil(T.length / 36);
            const postMesh = new THREE.InstancedMesh(
                new THREE.BoxGeometry(0.35, 4.5, 0.35),
                new THREE.MeshStandardMaterial({ color: 0x111827, emissive: 0xffffff, emissiveIntensity: 1 }),
                postCount * 2
            );
            const dummy = new THREE.Object3D();
            const col = new THREE.Color();
            let pi = 0;
            for (let n = 0; n < postCount; n++) {
                const f = this.frameAt(n * 36);
                [-1, 1].forEach((side) => {
                    const off = side * (cfg.limit + 3);
                    dummy.position.set(f.x + f.nx * off, 2.25, f.z + f.nz * off);
                    dummy.updateMatrix();
                    postMesh.setMatrixAt(pi, dummy.matrix);
                    col.setHex(n % 2 ? 0x22d3ee : 0xa855f7);
                    postMesh.setColorAt(pi, col);
                    pi++;
                });
            }
            postMesh.instanceColor.needsUpdate = true;
            postMesh.frustumCulled = false;
            group.add(postMesh);

            this.makeInstanced(group, new THREE.ConeGeometry(0.6, 1.3, 10), new THREE.MeshStandardMaterial({ color: 0xfb923c, roughness: 0.5, emissive: 0x7c2d12 }), lv.obstacles.filter(o => o.type === 'cone'), 0.65);
            this.makeInstanced(group, new THREE.CylinderGeometry(0.8, 0.8, 1.4, 14), new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4, emissive: 0x450a0a }), lv.obstacles.filter(o => o.type === 'barrel'), 0.7);
            this.instCoins = this.makeInstanced(group, new THREE.OctahedronGeometry(0.7), new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xca8a04, emissiveIntensity: 1, metalness: 0.6, roughness: 0.25 }), lv.coins, 1.2);

            this.aiCars.forEach((ai) => {
                ai.mesh = this.buildAIMesh(ai.color);
                group.add(ai.mesh);
            });
            this.scene.add(group);
        }

        makeInstanced(group, geo, mat, items, y) {
            if (!items.length) return null;
            const mesh = new THREE.InstancedMesh(geo, mat, items.length);
            const d = new THREE.Object3D();
            items.forEach((it, i) => {
                d.position.set(it.x, y, it.z);
                d.updateMatrix();
                mesh.setMatrixAt(i, d.matrix);
                it.inst = i;
                it.instMesh = mesh;
            });
            mesh.castShadow = true;
            mesh.frustumCulled = false;
            group.add(mesh);
            return mesh;
        }

        hideInstance(item) {
            const mesh = item.instMesh;
            if (!mesh || item.inst < 0) return;
            const d = new THREE.Object3D();
            d.scale.set(0, 0, 0);
            d.updateMatrix();
            mesh.setMatrixAt(item.inst, d.matrix);
            mesh.instanceMatrix.needsUpdate = true;
        }

        /* ------------------------------------------------------------------ */
        /* Particles                                                          */
        /* ------------------------------------------------------------------ */

        buildParticles() {
            const n = 360;
            const geo = new THREE.BufferGeometry();
            const pos = new Float32Array(n * 3).fill(-9999);
            const col = new Float32Array(n * 3);
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
            const pts = new THREE.Points(geo, new THREE.PointsMaterial({
                size: 0.7, vertexColors: true, transparent: true, opacity: 0.95,
                depthWrite: false, blending: THREE.AdditiveBlending
            }));
            pts.frustumCulled = false;
            this.scene.add(pts);
            this.particles = {
                n, pts, pos, col, rgb: new Float32Array(n * 3),
                vel: new Float32Array(n * 3), life: new Float32Array(n), max: new Float32Array(n), next: 0
            };
        }

        emit(x, y, z, color, count, speed) {
            const p = this.particles;
            if (!p) return;
            const [r, g, b] = hexRGB(color);
            for (let k = 0; k < count; k++) {
                const i = p.next;
                p.next = (p.next + 1) % p.n;
                const a = Math.random() * Math.PI * 2, e = Math.random() * 0.9;
                const sp = speed * (0.4 + Math.random() * 0.8);
                p.pos[i * 3] = x; p.pos[i * 3 + 1] = y; p.pos[i * 3 + 2] = z;
                p.vel[i * 3] = Math.cos(a) * sp * (1 - e * 0.4);
                p.vel[i * 3 + 1] = e * sp + 1;
                p.vel[i * 3 + 2] = Math.sin(a) * sp * (1 - e * 0.4);
                p.rgb[i * 3] = r; p.rgb[i * 3 + 1] = g; p.rgb[i * 3 + 2] = b;
                p.max[i] = p.life[i] = 0.5 + Math.random() * 0.6;
            }
        }

        updateParticles(dt) {
            const p = this.particles;
            if (!p) return;
            for (let i = 0; i < p.n; i++) {
                if (p.life[i] <= 0) continue;
                p.life[i] -= dt;
                const o = i * 3;
                if (p.life[i] <= 0) {
                    p.pos[o + 1] = -9999;
                    p.col[o] = p.col[o + 1] = p.col[o + 2] = 0;
                    continue;
                }
                p.vel[o + 1] -= 14 * dt;
                p.pos[o] += p.vel[o] * dt;
                p.pos[o + 1] = Math.max(0.05, p.pos[o + 1] + p.vel[o + 1] * dt);
                p.pos[o + 2] += p.vel[o + 2] * dt;
                const f = p.life[i] / p.max[i];
                p.col[o] = p.rgb[o] * f; p.col[o + 1] = p.rgb[o + 1] * f; p.col[o + 2] = p.rgb[o + 2] * f;
            }
            p.pts.geometry.attributes.position.needsUpdate = true;
            p.pts.geometry.attributes.color.needsUpdate = true;
        }

        /* ------------------------------------------------------------------ */
        /* Render loop                                                        */
        /* ------------------------------------------------------------------ */

        updateVisuals(dt) {
            const c = this.car;
            if (!c.mesh) return;
            const sp = Math.hypot(c.vx, c.vz);
            const fs = c._fs || 0;

            c.mesh.position.set(c.x, 0, c.z);
            c.mesh.rotation.y = c.rot;
            c.body.rotation.z = clamp(-c.steer * fs * 0.0022, -0.07, 0.07);
            c.wheels.forEach(w => { w.rotation.x += (fs * dt) / 0.42; });
            c.front.forEach(w => { w.rotation.y = c.steer * 0.45; });
            c.mesh.visible = !(c.invuln > 0 && Math.floor(this.time * 14) % 2 === 0);

            this.aiCars.forEach((ai) => {
                if (!ai.mesh) return;
                ai.mesh.position.set(ai.x, 0, ai.z);
                ai.mesh.rotation.y = ai.rot;
            });

            this.sun.position.set(c.x + 60, 90, c.z + 40);
            this.sun.target.position.set(c.x, 0, c.z);

            const heading = sp > 3 ? Math.atan2(c.vx, c.vz) * 0.35 + c.rot * 0.65 : c.rot;
            if (this.camSnap) this.camRot = c.rot;
            this.camRot += wrapAngle(heading - this.camRot) * (1 - Math.exp(-6 * dt));
            const dist = 8.2 + (sp / this.cfg.playerMax) * 2.2;
            const bx = c.x - Math.sin(this.camRot) * dist, bz = c.z - Math.cos(this.camRot) * dist;
            const by = 3.6 + sp * 0.02;
            if (this.camSnap) {
                this.camera.position.set(bx, by, bz);
                this.camSnap = false;
            } else {
                const k = 1 - Math.exp(-12 * dt);
                this.camera.position.x += (bx - this.camera.position.x) * k;
                this.camera.position.y += (by - this.camera.position.y) * k;
                this.camera.position.z += (bz - this.camera.position.z) * k;
            }
            this.shakeAmt *= Math.exp(-6 * dt);
            if (this.shakeAmt < 0.005) this.shakeAmt = 0;
            this.camera.position.x += (Math.random() - 0.5) * this.shakeAmt;
            this.camera.position.y += (Math.random() - 0.5) * this.shakeAmt * 0.6;
            this.camera.lookAt(c.x, 1.3, c.z);

            const targetFov = 65 + 14 * clamp(sp / this.cfg.playerMax, 0, 1);
            if (Math.abs(this.camera.fov - targetFov) > 0.05) {
                this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-4 * dt));
                this.camera.updateProjectionMatrix();
            }
            if (this.instCoins) this.instCoins.material.emissiveIntensity = 0.8 + Math.sin(performance.now() / 180) * 0.4;
            this.updateParticles(dt);
        }

        animate() {
            this.animId = requestAnimationFrame(this.animate);
            if (!this.renderer || this.hostPaused) return;

            const now = performance.now();
            const frameDt = Math.min(0.1, (now - this.lastFrame) / 1000);
            this.lastFrame = now;
            this.trackPerf(frameDt);

            if (this.state === 'playing' && !this.test.active) {
                const t0 = performance.now();
                this.acc += frameDt;
                let guard = 0;
                while (this.acc >= FIXED_DT && guard++ < 5) {
                    this.stepSim(FIXED_DT);
                    this.acc -= FIXED_DT;
                }
                if (guard >= 5) this.acc = 0;
                this.perf.simMs += (performance.now() - t0 - this.perf.simMs) * 0.1;
                this.sfx('updateCarEnginePitch', clamp(Math.hypot(this.car.vx, this.car.vz) / this.cfg.playerMax, 0, 1));
            }

            this.updateVisuals(frameDt);
            this.updateHUD();
            const r0 = performance.now();
            this.renderer.render(this.scene, this.camera);
            this.perf.renderMs += (performance.now() - r0 - this.perf.renderMs) * 0.1;
        }

        trackPerf(dt) {
            const p = this.perf;
            p.frames++;
            p.fpsAcc++;
            p.fpsT += dt;
            p.worstFrameMs = Math.max(p.worstFrameMs, dt * 1000);
            if (p.fpsT >= 0.5) {
                p.fps = p.fpsAcc / p.fpsT;
                p.fpsAcc = 0;
                p.fpsT = 0;
            }
        }

        /* ------------------------------------------------------------------ */
        /* Bot / Autoplay                                                     */
        /* ------------------------------------------------------------------ */

        botInput() {
            const c = this.car, cfg = this.cfg, lv = this.level;
            const sp = Math.hypot(c.vx, c.vz);
            const look = clamp(9 + sp * 0.55, 12, 34);

            const curLane = clamp(Math.round(c.d / LANE_W + (cfg.lanes - 1) / 2), 0, cfg.lanes - 1);
            const k0 = Math.ceil((c.s + 3 - lv.start) / lv.spacing);
            const rowsAhead = [];
            for (let k = k0; k < k0 + 2; k++) {
                const row = lv.rows[k];
                if (row && row.s - c.s < 75) rowsAhead.push(row);
            }

            let lane = Math.floor(cfg.lanes / 2);
            if (rowsAhead.length) {
                let cand = [];
                for (let l = 0; l < cfg.lanes; l++) if (rowsAhead.every(r => !r.blocked.includes(l))) cand.push(l);
                if (!cand.length) for (let l = 0; l < cfg.lanes; l++) if (!rowsAhead[0].blocked.includes(l)) cand.push(l);
                const coinBonus = (l) => (lv.coins.some(co => co.alive && co.lane === l && co.s > c.s && co.s < c.s + 50) ? 0.6 : 0);
                const cost = (l) => Math.abs(l - curLane) - coinBonus(l);
                lane = cand.reduce((b, l) => (cost(l) < cost(b) ? l : b), cand[0]);
                if (Math.abs(lane - curLane) > 1) lane = curLane + Math.sign(lane - curLane);
            }

            const f = this.frameAt(c.s + look);
            const off = this.laneOffset(lane);
            const err = wrapAngle(Math.atan2(f.x + f.nx * off - c.x, f.z + f.nz * off - c.z) - c.rot);
            const steer = clamp(err * 2.4, -1, 1);

            const fa = this.frameAt(c.s), fb = this.frameAt(c.s + look * 2.2);
            const ang = Math.abs(wrapAngle(Math.atan2(fb.tx, fb.tz) - Math.atan2(fa.tx, fa.tz)));
            const R = (look * 2.2) / Math.max(ang, 1e-3);
            let vmax = Math.min(cfg.playerMax, Math.sqrt(30 * R));
            if (rowsAhead.length && rowsAhead[0].s - c.s < 38 && lane !== curLane) vmax = Math.min(vmax, 26);
            if (Math.abs(c.d - off) > 2.2) vmax = Math.min(vmax, 24);

            this.test.stuck = sp < 1.5 ? (this.test.stuck || 0) + FIXED_DT : 0;
            if (this.test.stuck > 2.5) {
                const g = this.frameAt(c.s);
                c.x = g.x; c.z = g.z; c.rot = Math.atan2(g.tx, g.tz); c.vx = 0; c.vz = 0;
                this.test.stuck = 0;
                this.test.recoveries = (this.test.recoveries || 0) + 1;
            }

            return { throttle: sp < vmax ? 1 : 0, brake: sp > vmax + 4 ? 1 : 0, steer, handbrake: false };
        }

        /* ------------------------------------------------------------------ */
        /* Self-Test                                                          */
        /* ------------------------------------------------------------------ */

        runSanityChecks(opts = {}) {
            const rows = [];
            const check = (name, fn) => {
                const t0 = performance.now();
                try {
                    const r = fn();
                    const ok = r === undefined || r === true || (r && r.ok !== false);
                    rows.push({ Test: name, Ergebnis: ok ? 'PASS' : 'FAIL', Details: (r && r.detail) || '', ms: +(performance.now() - t0).toFixed(1) });
                } catch (e) {
                    rows.push({ Test: name, Ergebnis: 'FAIL', Details: String((e && e.message) || e), ms: +(performance.now() - t0).toFixed(1) });
                }
            };
            const finite = (...v) => v.every(Number.isFinite);
            let g = null;

            check('THREE verfügbar', () => ({ ok: typeof THREE !== 'undefined' && !!THREE.CatmullRomCurve3 }));
            check('Initialisierung (Auto/Strecke/Level/Gegner nicht null)', () => {
                g = Racing3DGame.createHeadless(1);
                const ok = !!(g.car && g.track && g.level && g.cfg && g.aiCars.length === g.cfg.aiCount && g.level.rows.length > 0);
                return { ok, detail: `${g.level.rows.length} Zeilen, ${g.level.obstacles.length} Hindernisse, ${g.level.coins.length} Coins` };
            });
            if (!opts.skipLevels) {
                check('Generator lösbar (Level 1,2,3,5,8,10,16,25,50,100)', () => {
                    const bad = [];
                    let minR = Infinity;
                    [1, 2, 3, 5, 8, 10, 16, 25, 50, 100].forEach((L) => {
                        g.startLevel(L);
                        const v = g.validateLevel();
                        minR = Math.min(minR, v.minR);
                        if (!v.ok) bad.push(`L${L}: ${v.issues.join(', ')}`);
                    });
                    return { ok: bad.length === 0, detail: bad.length ? bad.join(' | ') : `min. Kurvenradius ${minR.toFixed(0)} m` };
                });
            }
            check('Schwierigkeit steigt monoton (Level 1-100)', () => {
                let prev = Racing3DGame.difficulty(1);
                for (let L = 2; L <= 100; L++) {
                    const d = Racing3DGame.difficulty(L);
                    if (d.aiSpeed < prev.aiSpeed || d.density < prev.density || d.rowSpacing > prev.rowSpacing || d.lanes < prev.lanes) return { ok: false, detail: `Bruch bei L${L}` };
                    prev = d;
                }
                const ratio = Racing3DGame.difficulty(2).speedFactor / Racing3DGame.difficulty(1).speedFactor;
                return { ok: Math.abs(ratio - 1.1) < 1e-9, detail: '+10% Tempo/Level' };
            });
            check('Kollision: kein Tunneling bei 80 m/s und dt=0.1', () => {
                g.startLevel(5);
                g.state = 'playing';
                const row = g.level.rows.find(r => r.obstacles.length);
                const o = row.obstacles[0];
                const c = g.car;
                const f = g.frameAt(row.s - 25);
                const off = g.laneOffset(o.lane);
                c.x = f.x + f.nx * off; c.z = f.z + f.nz * off;
                c.rot = Math.atan2(f.tx, f.tz);
                c.vx = f.tx * 80; c.vz = f.tz * 80;
                c.hp = 99; c.idx = -1;
                g.inputOverride = () => ({ throttle: 1, brake: 0, steer: 0, handbrake: false });
                for (let i = 0; i < 4; i++) g.stepSim(0.1);
                g.inputOverride = null;
                return { ok: !o.alive, detail: 'Hindernis getroffen' };
            });
            check('Wand hält Auto auf der Strecke', () => {
                g.startLevel(3);
                g.state = 'playing';
                const c = g.car;
                c.hp = 99;
                g.inputOverride = () => ({ throttle: 1, brake: 0, steer: -0.6, handbrake: false });
                let worst = 0;
                for (let i = 0; i < 360; i++) {
                    g.stepSim(FIXED_DT);
                    worst = Math.max(worst, Math.abs(g.locate(c.x, c.z, c.idx).d));
                }
                g.inputOverride = null;
                return { ok: worst <= g.cfg.limit + 0.15 && finite(c.x, c.z), detail: `max. Abweichung ${worst.toFixed(2)} / ${g.cfg.limit.toFixed(2)}` };
            });
            check('Punkteberechnung (Combo 100+200+300, Highscore)', () => {
                g.startLevel(1);
                g.score = 0; g.highscore = 0; g.combo = 0; g.comboTimer = 0;
                g.collectCoin(null); g.collectCoin(null); g.collectCoin(null);
                const a = g.score;
                g.addScore(-50);
                return { ok: a === 600 && g.score === 600 && g.highscore === 600, detail: `Score ${a}` };
            });
            check('Stabilität: 1800 Zufallsframes ohne NaN/Null', () => {
                g.startLevel(8);
                g.state = 'playing';
                g.car.hp = 9999;
                g.inputOverride = () => ({ throttle: Math.random() < 0.8 ? 1 : 0, brake: Math.random() < 0.1 ? 1 : 0, steer: Math.random() * 2 - 1, handbrake: Math.random() < 0.1 });
                for (let i = 0; i < 1800 && g.state === 'playing'; i++) g.stepSim(FIXED_DT);
                g.inputOverride = null;
                const c = g.car;
                return { ok: finite(c.x, c.z, c.vx, c.vz, c.rot, g.score) && g.aiCars.every(a => finite(a.x, a.z)) };
            });

            const failed = rows.filter(r => r.Ergebnis !== 'PASS');
            if (!opts.quiet) {
                console.group('%c[Velocity Rush 3D] Sanity-Checks', 'color:#6366f1;font-weight:bold');
                console.table(rows);
                console.groupEnd();
            }
            return { ok: failed.length === 0, rows, failed };
        }

        async runSelfTest(opts = {}) {
            if (this.test.active) return null;
            const headless = this.headless || !this.renderer;
            const firstLevel = opts.startLevel || 1;
            const levelsToPlay = opts.levels || 3;
            const saved = { level: this.currentLevel, score: this.score };
            const results = [];

            console.log('%c[Velocity Rush 3D] Self-Test gestartet', 'color:#22d3ee;font-weight:bold');
            const sanity = this.runSanityChecks();

            this.test = { active: true, stuck: 0, recoveries: 0 };
            if (this.ui) this.ui.test.classList.add('on');
            this.hideOverlay();
            this.toast('🤖 Self-Test: Bot fährt', 'good');
            this.score = 0;
            const frames0 = this.perf.frames;
            const stepsPerChunk = headless ? 1500 : 12;
            const wait = () => new Promise(r => (headless ? setTimeout(r, 0) : requestAnimationFrame(() => r())));

            for (let i = 0; i < levelsToPlay && this.test.active; i++) {
                const L = firstLevel + i;
                this.startLevel(L);
                this.test.recoveries = 0;
                this.state = 'playing';
                this.sfx('stopCarEngine');
                const scoreBefore = this.score;
                const wall0 = performance.now();
                let steps = 0;
                while (this.state === 'playing' && steps < 60 * 400 && this.test.active) {
                    const t0 = performance.now();
                    let n = 0;
                    for (; n < stepsPerChunk && this.state === 'playing'; n++, steps++) this.stepSim(FIXED_DT);
                    if (n) this.perf.simMs += ((performance.now() - t0) / n - this.perf.simMs) * 0.1;
                    await wait();
                }
                const done = this.state === 'complete';
                const valid = this.validateLevel();
                results.push({
                    Level: L,
                    Ergebnis: done && valid.ok && this.car.hp > 0 && this.score > scoreBefore ? 'PASS' : 'FAIL',
                    'Zeit (Sim s)': +this.time.toFixed(1),
                    Platz: `${this.racePosition}/${this.cfg.aiCount + 1}`,
                    'HP übrig': this.car.hp,
                    Treffer: this.hitCount,
                    Score: this.score - scoreBefore,
                    Recoveries: this.test.recoveries,
                    'Sim-Schritte/s': Math.round(steps / Math.max(0.001, (performance.now() - wall0) / 1000))
                });
            }

            const aborted = !this.test.active;
            this.test.active = false;
            if (this.ui) this.ui.test.classList.remove('on');

            const perfRow = {
                'FPS (aktuell)': headless ? 'n/a (headless)' : +this.perf.fps.toFixed(1),
                'Render ms (EMA)': +this.perf.renderMs.toFixed(2),
                'Sim ms/Schritt (EMA)': +this.perf.simMs.toFixed(3),
                'Worst Frame ms': +this.perf.worstFrameMs.toFixed(1),
                Frames: this.perf.frames - frames0
            };
            const levelsOk = results.length === levelsToPlay && results.every(r => r.Ergebnis === 'PASS');
            const report = { ok: sanity.ok && levelsOk && !aborted, sanity: sanity.rows, bot: results, perf: perfRow };

            console.group(`%c[Velocity Rush 3D] Self-Test ${report.ok ? 'BESTANDEN ✔' : 'FEHLGESCHLAGEN ✘'}`, `color:${report.ok ? '#22c55e' : '#ef4444'};font-weight:bold`);
            console.log('Bot-Autoplay (Level-Validierung):');
            console.table(results);
            console.log('Performance:');
            console.table([perfRow]);
            console.groupEnd();
            window.__racingTestReport = report;

            if (this.scene && !aborted) {
                this.score = saved.score;
                this.startLevel(saved.level);
                this.setState('start');
                this.toast(report.ok ? '✔ Self-Test bestanden' : '✘ Self-Test fehlgeschlagen', report.ok ? 'good' : 'warn');
            }
            return report;
        }
    }

    window.Racing3DGame = Racing3DGame;
})();
