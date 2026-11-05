/**
 * Cosmic Strike - Space Bullet-Hell Arcade
 *
 * - Einheitliches Glassmorphism-UI (HUD, Start/Pause/Game-Over/Level-Complete, Toasts), per JS injiziert
 * - Prozeduraler, validierter Level-Generator (seeded, garantiert loesbar)
 * - Juice: Partikel, Screen-Shake, Warp-Uebergaenge, Combo-System
 * - Praezise Kollisionen (Swept-Tests gegen Tunneling), feste Zeitschritte
 * - Selbsttest: Taste 'T' (Live-Bot) oder window.RUN_TESTS = true (Sanity-Checks + Headless-Bot)
 *
 * Schwierigkeitskurve (L = Level):
 *   Kugeltempo                = 170 * (1 + 0.10 * (L-1)) px/s   (Kappe 340, Spieler-Speed 420)
 *   Gegner-HP                 = Basis * min(4, 1 + 0.12 * (L-1))
 *   Schussbudget (global)     = min(6, 1.2 + 0.2 * L) Schuesse/s
 *   Gegneranzahl pro Welle    = min(24, 5 + floor(0.8 * L) + 2 * Welle)
 *   Neue Typen: Weaver ab L3, Shooter ab L5, Tank ab L8, Boss alle 5 Level
 */

window.SpaceShooterGame = class {
    static get WORLD_W() { return 800; }
    static get WORLD_H() { return 600; }
    static get HUD_H() { return 56; }

    static get TYPES() {
        return {
            grunt:   { minLevel: 1, hp: 20, r: 13, pts: 50,  color: '#f87171', weight: 5 },
            weaver:  { minLevel: 3, hp: 28, r: 12, pts: 80,  color: '#fbbf24', weight: 3 },
            shooter: { minLevel: 5, hp: 36, r: 14, pts: 120, color: '#c084fc', weight: 3 },
            tank:    { minLevel: 8, hp: 90, r: 20, pts: 200, color: '#fb923c', weight: 2 }
        };
    }

    /* ---------- Reine Hilfsfunktionen (testbar) ---------- */

    static rng(seed) {
        let a = seed >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    static bulletSpeed(level) { return Math.min(340, 170 * (1 + 0.10 * (level - 1))); }
    static hpScale(level) { return Math.min(4, 1 + 0.12 * (level - 1)); }
    static shotBudget(level) { return Math.min(6, 1.2 + 0.2 * level); }
    static pointsFor(type, combo) {
        const T = window.SpaceShooterGame.TYPES[type];
        const base = T ? T.pts : 0;
        return Math.round(base * (1 + 0.1 * Math.min(Math.max(combo, 1) - 1, 9)));
    }

    static distSegPoint(x1, y1, x2, y2, px, py) {
        const dx = x2 - x1, dy = y2 - y1;
        const len2 = dx * dx + dy * dy;
        let t = len2 > 0 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(x1 + dx * t - px, y1 + dy * t - py);
    }

    // Segment-Rechteck-Test per feinem Sampling (3px) -> kein Tunneling
    static segHitsRect(x1, y1, x2, y2, rx, ry, rw, rh, pad) {
        const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 3));
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
            if (x >= rx - pad && x <= rx + rw + pad && y >= ry - pad && y <= ry + rh + pad) return true;
        }
        return false;
    }

    /** Erzeugt eine deterministische, validierte Levelbeschreibung. */
    static generateLevel(level) {
        const G = window.SpaceShooterGame;
        const W = G.WORLD_W;
        for (let attempt = 0; attempt < 6; attempt++) {
            const spec = G.buildLevel(level, attempt);
            if (G.validateLevel(spec).length === 0) { spec.attempts = attempt + 1; return spec; }
        }
        // Garantierter Fallback: minimale, trivial loesbare Stufe
        const hp = Math.round(G.TYPES.grunt.hp * G.hpScale(level));
        const enemies = [];
        for (let i = 0; i < 5; i++) {
            enemies.push({ type: 'grunt', hx: 100 + i * ((W - 200) / 4), hy: 90, hp, phase: i, delay: i * 0.2 });
        }
        return { level, waves: [{ enemies }], boss: null, budget: 1.2, bulletSpeed: Math.min(G.bulletSpeed(level), 240), attempts: 7, fallback: true };
    }

    static buildLevel(level, attempt) {
        const G = window.SpaceShooterGame;
        const W = G.WORLD_W;
        const rand = G.rng(level * 7919 + 13 + attempt * 101);
        const unlocked = Object.keys(G.TYPES).filter(k => G.TYPES[k].minLevel <= level);
        const waveCount = Math.min(4, 2 + Math.floor((level - 1) / 4));
        const shrink = 1 - attempt * 0.15;
        const waves = [];

        for (let w = 0; w < waveCount; w++) {
            const n = Math.max(3, Math.min(24, Math.floor((5 + Math.floor(0.8 * level) + 2 * w) * shrink)));
            const cols = Math.min(8, n);
            const enemies = [];
            for (let i = 0; i < n; i++) {
                const col = i % cols, row = Math.floor(i / cols);
                const inRow = Math.min(cols, n - row * cols);
                const span = Math.min(W - 160, (inRow - 1) * 100);
                const hx = inRow === 1 ? W / 2 : (W / 2 - span / 2) + col * (span / (inRow - 1));

                let total = 0;
                for (const k of unlocked) total += G.TYPES[k].weight;
                let roll = rand() * total, type = unlocked[0];
                for (const k of unlocked) { roll -= G.TYPES[k].weight; if (roll <= 0) { type = k; break; } }

                enemies.push({
                    type, hx, hy: 80 + row * 48,
                    hp: Math.round(G.TYPES[type].hp * G.hpScale(level)),
                    phase: rand() * Math.PI * 2,
                    delay: col * 0.12 + row * 0.35
                });
            }
            waves.push({ enemies });
        }

        const boss = (level % 5 === 0) ? {
            hp: Math.round(500 + 110 * level),
            fan: Math.min(11, 5 + Math.floor(level / 5)),
            arc: 140 * Math.PI / 180
        } : null;

        return {
            level, waves, boss,
            budget: G.shotBudget(level) * shrink,
            bulletSpeed: G.bulletSpeed(level) * (attempt > 0 ? 0.9 : 1)
        };
    }

    /** Prueft die Loesbarkeits-Invarianten. Gibt eine Liste von Fehlern zurueck (leer = valide). */
    static validateLevel(spec) {
        const G = window.SpaceShooterGame;
        const errs = [];
        const W = G.WORLD_W;
        if (!spec || !spec.waves || spec.waves.length === 0) return ['keine Wellen'];
        let totalHp = 0;
        for (const [wi, wave] of spec.waves.entries()) {
            if (!wave.enemies.length || wave.enemies.length > 24) errs.push(`Welle ${wi}: ungueltige Gegneranzahl`);
            for (const e of wave.enemies) {
                if (!G.TYPES[e.type]) errs.push(`unbekannter Typ ${e.type}`);
                if (!(e.hx >= 40 && e.hx <= W - 40)) errs.push(`Welle ${wi}: Gegner ausserhalb (${e.hx})`);
                if (!(e.hy >= 60 && e.hy <= 280)) errs.push(`Welle ${wi}: Reihe zu tief (${e.hy})`);
                if (!(e.hp > 0) || !isFinite(e.hp)) errs.push(`Welle ${wi}: ungueltige HP`);
                totalHp += e.hp;
            }
        }
        if (spec.boss) {
            totalHp += spec.boss.hp;
            if (spec.boss.arc / (spec.boss.fan - 1) < 12 * Math.PI / 180) errs.push('Boss-Faecher ohne ausreichende Luecke');
        }
        if (spec.bulletSpeed > 340) errs.push('Kugeln schneller als erlaubt');
        if (spec.budget > 6) errs.push('Schussbudget zu hoch');
        const clearTime = totalHp / (3 * 15 / 0.16); // Waffenstufe 3
        if (clearTime > 150) errs.push(`Level zu lang (${clearTime.toFixed(0)}s)`);
        return errs;
    }

    /* ---------- Lebenszyklus ---------- */

    constructor() {
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        this.animId = null;
        this.isPaused = false;
        this.state = 'ready';
        this.currentLevel = 1;
        this.score = 0;
        this.levelStartScore = 0;
        this.highScore = this.loadHighScore();
        this.keys = {};
        this.handlers = [];
        this.bot = false;
        this.silent = false;
        this.testStats = null;
        this.stars = [];
        this.stats = { fps: 0, updateMs: 0, renderMs: 0, frames: 0, acc: 0 };
        this.resetEntities();
        this.player = this.makePlayer();
    }

    makePlayer() {
        const G = window.SpaceShooterGame;
        return {
            x: G.WORLD_W / 2, y: G.WORLD_H - 90, vx: 0, vy: 0,
            w: 28, h: 32, hitR: 5, maxSpeed: 420, accel: 14,
            hearts: 3, maxHearts: 3, invuln: 0, weaponLevel: 1, fireCd: 0
        };
    }

    resetEntities() {
        this.bullets = [];
        this.enemyBullets = [];
        this.enemies = [];
        this.powerups = [];
        this.particles = [];
        this.boss = null;
        this.shake = 0;
        this.warp = 0;
        this.time = 0;
        this.combo = 0;
        this.comboTimer = 0;
        this.waveIdx = 0;
        this.waveDelay = 0;
        this.shotTokens = 2;
        this.spec = null;
        this.bossSpawned = false;
        this.pointer = null;
        this.stateTimer = 0;
    }

    loadHighScore() {
        try { return parseInt(window.localStorage.getItem('cosmic_strike_hi'), 10) || 0; } catch (e) { return 0; }
    }

    saveHighScore() {
        try { window.localStorage.setItem('cosmic_strike_hi', String(this.highScore)); } catch (e) { /* kein Storage */ }
    }

    init(container, options = {}) {
        this.container = container;
        this.container.innerHTML = '';
        if (this.container.style && !this.container.style.position) this.container.style.position = 'relative';

        this.injectStyles();
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'game-canvas';
        this.canvas.style.touchAction = 'none';
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);

        this.buildUI();
        this.bindEvents();
        this.resize();

        this.startLevel(options.levelIndex || 1, true);
        this.showOverlay('start');

        this.loop = this.loop.bind(this);
        this.lastTs = 0;
        this.accum = 0;
        this.animId = requestAnimationFrame(this.loop);

        if (window.RUN_TESTS === true) setTimeout(() => { if (this.ctx) this.runAllTests(); }, 0);
    }

    /* ---------- UI (Design-System) ---------- */

    injectStyles() {
        if (!document.head || (document.getElementById && document.getElementById('cs-ui-style'))) return;
        const st = document.createElement('style');
        st.id = 'cs-ui-style';
        st.textContent = `
        .cs-ui, .cs-ui * { box-sizing: border-box; font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif; }
        .cs-hud { position: absolute; top: 0; left: 0; right: 0; height: 56px; display: grid; grid-template-columns: 1fr auto 1fr;
            align-items: center; gap: 12px; padding: 0 18px; z-index: 20; color: #f1f5f9; user-select: none;
            background: rgba(15,23,42,0.75); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            border-bottom: 1px solid rgba(255,255,255,0.1); }
        .cs-hud-left { display: flex; align-items: baseline; gap: 10px; }
        .cs-title { font-weight: 700; letter-spacing: .04em; font-size: 15px; }
        .cs-level { font-size: 12px; color: #22d3ee; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: rgba(34,211,238,0.12); }
        .cs-hud-mid { text-align: center; font-variant-numeric: tabular-nums; }
        .cs-score { font-size: 20px; font-weight: 700; color: #fbbf24; line-height: 1; }
        .cs-hi { font-size: 11px; color: #94a3b8; margin-top: 2px; }
        .cs-hud-right { display: flex; justify-content: flex-end; align-items: center; gap: 12px; }
        .cs-hearts { font-size: 18px; letter-spacing: 2px; color: #f43f5e; text-shadow: 0 0 8px rgba(244,63,94,.5); }
        .cs-hearts .off { color: rgba(255,255,255,0.18); text-shadow: none; }
        .cs-icon-btn { width: 32px; height: 32px; border-radius: 10px; cursor: pointer; font-size: 15px; color: #e2e8f0;
            background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); transition: all .15s ease; }
        .cs-icon-btn:hover { background: rgba(99,102,241,0.35); transform: translateY(-1px); }
        .cs-icon-btn:active { transform: scale(.92); }
        .cs-overlay { position: absolute; inset: 56px 0 0 0; display: none; align-items: center; justify-content: center; z-index: 30;
            background: rgba(2,6,23,0.45); }
        .cs-overlay.active { display: flex; animation: csFade .25s ease; }
        .cs-modal { min-width: 300px; max-width: 90%; text-align: center; padding: 28px 36px; border-radius: 20px; color: #f1f5f9;
            background: rgba(15,23,42,0.75); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
            border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 20px 60px rgba(0,0,0,.5); animation: csPop .3s ease; }
        .cs-modal h2 { margin: 0 0 6px; font-size: 26px; letter-spacing: .03em; }
        .cs-modal p { margin: 4px 0 18px; color: #94a3b8; font-size: 14px; line-height: 1.5; }
        .cs-btn-row { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
        .cs-btn { cursor: pointer; border: 0; color: #fff; font-weight: 600; font-size: 14px; padding: 10px 22px; border-radius: 12px;
            background: linear-gradient(135deg, #6366f1, #06b6d4); box-shadow: 0 6px 20px rgba(99,102,241,.35);
            transition: transform .15s ease, box-shadow .15s ease, filter .15s ease; }
        .cs-btn:hover { transform: translateY(-2px); filter: brightness(1.12); box-shadow: 0 10px 26px rgba(99,102,241,.5); }
        .cs-btn:active { transform: scale(.95); }
        .cs-btn.secondary { background: rgba(255,255,255,0.08); box-shadow: none; border: 1px solid rgba(255,255,255,0.12); }
        .cs-toasts { position: absolute; top: 74px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column;
            align-items: center; gap: 8px; z-index: 40; pointer-events: none; }
        .cs-toast { padding: 8px 18px; border-radius: 999px; color: #f8fafc; font-weight: 700; font-size: 14px; letter-spacing: .04em;
            background: rgba(15,23,42,0.75); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1); animation: csToast 1.8s ease forwards; }
        @keyframes csFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes csPop { from { opacity: 0; transform: scale(.9) translateY(10px) } to { opacity: 1; transform: none } }
        @keyframes csToast { 0% { opacity: 0; transform: translateY(-12px) scale(.9) } 12% { opacity: 1; transform: none }
            80% { opacity: 1 } 100% { opacity: 0; transform: translateY(-8px) } }
        `;
        document.head.appendChild(st);
    }

    buildUI() {
        const ui = document.createElement('div');
        ui.className = 'cs-ui';
        ui.innerHTML = `
            <div class="cs-hud">
                <div class="cs-hud-left"><span class="cs-title">COSMIC STRIKE</span><span class="cs-level" data-r="level">Level 01</span></div>
                <div class="cs-hud-mid"><div class="cs-score" data-r="score">0</div><div class="cs-hi">Highscore <span data-r="hi">0</span></div></div>
                <div class="cs-hud-right">
                    <span class="cs-hearts" data-r="hearts"></span>
                    <button class="cs-icon-btn" data-r="btn-pause" title="Pause (P)">⏸</button>
                    <button class="cs-icon-btn" data-r="btn-mute" title="Ton (M)">🔊</button>
                </div>
            </div>
            <div class="cs-toasts" data-r="toasts"></div>
            <div class="cs-overlay" data-r="overlay"><div class="cs-modal" data-r="modal"></div></div>
        `;
        this.container.appendChild(ui);
        const q = (n) => ui.querySelector(`[data-r="${n}"]`);
        this.el = {
            level: q('level'), score: q('score'), hi: q('hi'), hearts: q('hearts'),
            pause: q('btn-pause'), mute: q('btn-mute'), toasts: q('toasts'), overlay: q('overlay'), modal: q('modal')
        };
        this.el.pause.onclick = () => this.togglePause();
        this.el.mute.onclick = () => this.toggleMute();
    }

    showOverlay(kind, data = {}) {
        if (!this.el) return;
        const L = String(this.currentLevel).padStart(2, '0');
        const views = {
            start: { t: 'Cosmic Strike', p: 'Weiche den Kugeln aus, vernichte die Flotte und besiege die Flaggschiffe.<br>Maus / WASD · Auto-Fire · P Pause · T Bot-Test',
                     b: [['Start', 'start', 0]] },
            pause: { t: 'Pause', p: `Level ${L} · Punkte ${this.score}`, b: [['Weiter', 'resume', 0], ['Level neu starten', 'restart', 1]] },
            over: { t: 'Game Over', p: `Punkte: <b>${this.score}</b><br>Highscore: <b>${this.highScore}</b>`, b: [['Erneut versuchen', 'restart', 0]] },
            complete: { t: 'Level geschafft!', p: `Level ${L} abgeschlossen<br>Bonus: <b>+${data.bonus || 0}</b> · Punkte: <b>${this.score}</b>`,
                        b: [['Nächstes Level ➔', 'next', 0], ['Wiederholen', 'restart', 1]] }
        };
        const v = views[kind];
        if (!v) return;
        this.el.modal.innerHTML = `<h2>${v.t}</h2><p>${v.p}</p><div class="cs-btn-row">` +
            v.b.map(b => `<button class="cs-btn${b[2] ? ' secondary' : ''}" data-act="${b[1]}">${b[0]}</button>`).join('') + '</div>';
        const actions = {
            start: () => { this.initAudio(); this.state = 'playing'; this.hideOverlay(); this.toast(`Level ${L}`); },
            resume: () => this.togglePause(),
            restart: () => { this.score = this.levelStartScore; this.startLevel(this.currentLevel); },
            next: () => this.startLevel(this.currentLevel + 1)
        };
        for (const b of v.b) {
            const btn = this.el.modal.querySelector(`[data-act="${b[1]}"]`);
            if (btn) btn.onclick = () => { this.sfx('playClick'); actions[b[1]](); };
        }
        this.el.overlay.classList.add('active');
    }

    hideOverlay() { if (this.el) this.el.overlay.classList.remove('active'); }

    toast(text) {
        if (!this.el || !this.el.toasts || this.silent) return;
        const t = document.createElement('div');
        t.className = 'cs-toast';
        t.textContent = text;
        this.el.toasts.appendChild(t);
        setTimeout(() => { if (t.remove) t.remove(); }, 1900);
    }

    updateHUD() {
        if (!this.el) return;
        const p = this.player;
        this.el.level.textContent = `Level ${String(this.currentLevel).padStart(2, '0')}`;
        this.el.score.textContent = `${this.score}`;
        this.el.hi.textContent = `${Math.max(this.highScore, this.score)}`;
        let h = '';
        for (let i = 0; i < p.maxHearts; i++) h += i < p.hearts ? '♥' : '<span class="off">♥</span>';
        this.el.hearts.innerHTML = h;
    }

    initAudio() {
        if (this.silent || !window.AudioManager || !window.AudioManager.init) return;
        try { window.AudioManager.init(); } catch (e) { /* Audio optional */ }
    }

    sfx(name) {
        if (this.silent || !window.AudioManager || typeof window.AudioManager[name] !== 'function') return;
        try { window.AudioManager[name](); } catch (e) { /* Audio optional */ }
    }

    toggleMute() {
        if (!window.AudioManager || !window.AudioManager.toggleMute) return;
        const muted = window.AudioManager.toggleMute();
        if (this.el) this.el.mute.textContent = muted ? '🔇' : '🔊';
    }

    togglePause() {
        if (this.state === 'playing') {
            this.state = 'paused';
            this.showOverlay('pause');
            if (this.el) this.el.pause.textContent = '▶';
        } else if (this.state === 'paused') {
            this.state = 'playing';
            this.hideOverlay();
            if (this.el) this.el.pause.textContent = '⏸';
        }
    }

    /* ---------- Events / Layout ---------- */

    on(target, type, fn, opts) {
        if (!target || !target.addEventListener) return;
        target.addEventListener(type, fn, opts);
        this.handlers.push([target, type, fn, opts]);
    }

    bindEvents() {
        this.on(window, 'resize', () => this.resize());
        this.on(window, 'keydown', (e) => {
            this.keys[e.code] = true;
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
            if (e.code === 'KeyP' || e.code === 'Escape') this.togglePause();
            else if (e.code === 'KeyM') this.toggleMute();
            else if (e.code === 'KeyT') this.toggleBot();
            else if (e.code === 'Space' && this.state === 'ready') {
                const b = this.el.modal.querySelector('[data-act="start"]');
                if (b && b.onclick) b.onclick();
            }
        });
        this.on(window, 'keyup', (e) => { this.keys[e.code] = false; });
        const move = (e) => { if (!this.bot) this.pointer = this.toWorld(e.clientX, e.clientY); };
        this.on(this.canvas, 'pointermove', move);
        this.on(this.canvas, 'pointerdown', move);
    }

    toWorld(cx, cy) {
        const rect = this.canvas.getBoundingClientRect();
        const v = this.view;
        return { x: (cx - rect.left - v.ox) / v.scale, y: (cy - rect.top - v.oy) / v.scale };
    }

    resize() {
        if (!this.container || !this.canvas) return;
        const G = window.SpaceShooterGame;
        const rect = this.container.getBoundingClientRect();
        const w = rect.width > 50 ? rect.width : (window.innerWidth || 800);
        const h = rect.height > 50 ? rect.height : ((window.innerHeight || 648) - 48);
        this.canvas.width = Math.floor(w);
        this.canvas.height = Math.floor(h);
        const availH = Math.max(100, h - G.HUD_H);
        const scale = Math.min(w / G.WORLD_W, availH / G.WORLD_H);
        this.view = { scale, ox: (w - G.WORLD_W * scale) / 2, oy: G.HUD_H + (availH - G.WORLD_H * scale) / 2 };
        this.initStars();
    }

    initStars() {
        const G = window.SpaceShooterGame;
        const rnd = G.rng(42);
        this.stars = [];
        for (let i = 0; i < 90; i++) {
            const depth = rnd();
            this.stars.push({ x: rnd() * G.WORLD_W, y: rnd() * G.WORLD_H, speed: 15 + depth * 90, size: 0.6 + depth * 1.8, a: 0.3 + depth * 0.7 });
        }
    }

    /* ---------- Level-Steuerung ---------- */

    // keepState=true: Level vorbereiten, aber im Start-Zustand bleiben (Titelbildschirm)
    startLevel(levelIndex = 1, keepState = false) {
        const G = window.SpaceShooterGame;
        const keepWeapon = this.player ? this.player.weaponLevel : 1;
        this.currentLevel = Math.max(1, Math.floor(levelIndex) || 1);
        this.resetEntities();
        this.player = this.makePlayer();
        this.player.weaponLevel = Math.max(1, Math.min(2, keepWeapon));
        this.levelStartScore = this.score;
        this.spec = G.generateLevel(this.currentLevel);
        this.warp = 1;
        this.state = keepState ? 'ready' : 'playing';
        this.hideOverlay();
        if (this.el) this.el.pause.textContent = '⏸';
        this.spawnWave();
        this.updateHUD();
        if (!keepState) this.toast(`Level ${String(this.currentLevel).padStart(2, '0')}`);
    }

    spawnWave() {
        const wave = this.spec.waves[this.waveIdx];
        if (!wave) return;
        const G = window.SpaceShooterGame;
        for (const e of wave.enemies) {
            const T = G.TYPES[e.type];
            this.enemies.push({
                type: e.type, x: e.hx, y: -40, hx: e.hx, hy: e.hy, hp: e.hp, maxHp: e.hp, r: T.r, color: T.color,
                phase: e.phase, delay: e.delay, entered: false, t: 0,
                shootTimer: 1.2 + Math.random() * 2.2, flash: 0
            });
        }
        if (this.waveIdx > 0) this.toast(`Welle ${this.waveIdx + 1}/${this.spec.waves.length}`);
    }

    spawnBoss() {
        const G = window.SpaceShooterGame;
        const b = this.spec.boss;
        this.boss = { x: G.WORLD_W / 2 - 60, y: -100, w: 120, h: 64, hp: b.hp, maxHp: b.hp, t: 0, shootTimer: 1.5, flash: 0, entered: false };
        this.bossSpawned = true;
        this.toast('⚠ Flaggschiff naht!');
        this.addShake(8);
    }

    /* ---------- Hauptschleife ---------- */

    loop(ts) {
        this.animId = requestAnimationFrame(this.loop);
        if (!this.ctx) return;
        const dtReal = this.lastTs ? Math.min(0.1, (ts - this.lastTs) / 1000) : 1 / 60;
        this.lastTs = ts;

        const st = this.stats;
        st.acc += dtReal; st.frames++;
        if (st.acc >= 1) { st.fps = Math.round(st.frames / st.acc); st.frames = 0; st.acc = 0; }

        if (!this.isPaused) {
            this.accum += dtReal;
            const step = 1 / 60;
            let n = 0;
            const t0 = performance.now();
            while (this.accum >= step && n < 5) { this.update(step); this.accum -= step; n++; }
            if (n > 0) st.updateMs = st.updateMs * 0.9 + (performance.now() - t0) / n * 0.1;
            if (n === 5) this.accum = 0;
        }

        const r0 = performance.now();
        this.render();
        st.renderMs = st.renderMs * 0.9 + (performance.now() - r0) * 0.1;
    }

    update(dt) {
        this.updateStars(dt);
        this.updateParticles(dt);
        this.shake = Math.max(0, this.shake - dt * 30);
        if (this.warp > 0) this.warp = Math.max(0, this.warp - dt * 1.6);

        if (this.state === 'ready' || this.state === 'paused') return;

        if (this.state === 'complete' || this.state === 'over') {
            this.stateTimer += dt;
            if (this.bot && this.stateTimer > 0.6) {
                if (this.state === 'complete') this.startLevel(this.currentLevel + 1);
                else { this.score = this.levelStartScore; this.startLevel(this.currentLevel); }
            }
            return;
        }

        this.time += dt;
        const p = this.player;
        if (this.bot) this.runBot();
        this.updatePlayer(dt);

        if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.combo = 0; }
        this.shotTokens = Math.min(3, this.shotTokens + this.spec.budget * dt);

        this.updatePlayerBullets(dt);
        this.updateEnemies(dt);
        if (this.state !== 'playing') return;
        this.updateBoss(dt);
        this.updateEnemyBullets(dt);
        this.updatePowerups(dt);
        if (this.state !== 'playing') return;

        if (!this.boss && this.enemies.length === 0) {
            if (this.waveIdx < this.spec.waves.length - 1) {
                this.waveDelay += dt;
                if (this.waveDelay > 1.0) { this.waveDelay = 0; this.waveIdx++; this.spawnWave(); }
            } else if (this.spec.boss && !this.bossSpawned) {
                this.waveDelay += dt;
                if (this.waveDelay > 1.0) { this.waveDelay = 0; this.spawnBoss(); }
            } else {
                this.completeLevel();
            }
        }
        if (p.invuln > 0) p.invuln -= dt;
    }

    updateStars(dt) {
        const G = window.SpaceShooterGame;
        for (const s of this.stars) {
            s.y += s.speed * dt * (1 + this.warp * 14);
            if (s.y > G.WORLD_H) { s.y = 0; s.x = Math.random() * G.WORLD_W; }
        }
    }

    updatePlayer(dt) {
        const G = window.SpaceShooterGame;
        const p = this.player;
        const k = this.keys;
        let ax = 0, ay = 0;
        if (k.KeyA || k.ArrowLeft) ax -= 1;
        if (k.KeyD || k.ArrowRight) ax += 1;
        if (k.KeyW || k.ArrowUp) ay -= 1;
        if (k.KeyS || k.ArrowDown) ay += 1;

        let dvx = 0, dvy = 0;
        if (ax || ay) {
            const len = Math.hypot(ax, ay);
            dvx = ax / len * p.maxSpeed; dvy = ay / len * p.maxSpeed;
            if (!this.bot) this.pointer = null;
        } else if (this.pointer) {
            const dx = this.pointer.x - p.x, dy = this.pointer.y - p.y;
            const d = Math.hypot(dx, dy);
            if (d > 1) {
                const sp = Math.min(p.maxSpeed, d * 10);
                dvx = dx / d * sp; dvy = dy / d * sp;
            }
        }
        const f = Math.min(1, dt * p.accel);
        p.vx += (dvx - p.vx) * f;
        p.vy += (dvy - p.vy) * f;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.x = Math.max(p.w / 2 + 4, Math.min(G.WORLD_W - p.w / 2 - 4, p.x));
        p.y = Math.max(G.WORLD_H * 0.4, Math.min(G.WORLD_H - p.h / 2 - 4, p.y));

        p.fireCd -= dt;
        if (p.fireCd <= 0) { this.firePlayerBullets(); p.fireCd = 0.16; }

        if (!this.silent && Math.random() < 0.6) {
            this.spawnParticle(p.x + (Math.random() - 0.5) * 8, p.y + p.h / 2, (Math.random() - 0.5) * 30, 120 + Math.random() * 60, 0.3, 2, '#38bdf8');
        }
    }

    firePlayerBullets() {
        const p = this.player;
        const y = p.y - p.h / 2;
        const push = (dx, vx) => this.bullets.push({ x: p.x + dx, y, px: p.x + dx, py: y, vx, vy: -720, dmg: 15 });
        if (p.weaponLevel === 1) push(0, 0);
        else if (p.weaponLevel === 2) { push(-7, 0); push(7, 0); }
        else { push(0, 0); push(-10, -90); push(10, 90); }
        this.sfx('playLaser');
    }

    updatePlayerBullets(dt) {
        const G = window.SpaceShooterGame;
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.px = b.x; b.py = b.y;
            b.x += b.vx * dt; b.y += b.vy * dt;
            let hit = false;

            for (const en of this.enemies) {
                if (en.delay > 0 || (!en.entered && en.y < 0)) continue;
                if (en.hp > 0 && G.distSegPoint(b.px, b.py, b.x, b.y, en.x, en.y) < en.r + 3) {
                    this.damageEnemy(en, b.dmg, b.x, b.y);
                    hit = true; break;
                }
            }
            if (!hit && this.boss && G.segHitsRect(b.px, b.py, b.x, b.y, this.boss.x, this.boss.y, this.boss.w, this.boss.h, 3)) {
                this.damageBoss(b.dmg, b.x, b.y);
                hit = true;
            }
            if (hit || b.y < -20 || b.x < -20 || b.x > G.WORLD_W + 20) this.bullets.splice(i, 1);
        }
        this.enemies = this.enemies.filter(e => e.hp > 0);
    }

    damageEnemy(en, dmg, x, y) {
        en.hp -= dmg;
        en.flash = 0.08;
        this.burst(x, y, 4, '#fde68a', 120, 0.25);
        if (en.hp > 0) { this.sfx('playHit'); return; }
        this.combo++;
        this.comboTimer = 1.5;
        this.addScore(window.SpaceShooterGame.pointsFor(en.type, this.combo));
        this.burst(en.x, en.y, 22, en.color, 220, 0.6);
        this.addShake(3);
        this.sfx('playExplosion');
        if (this.combo >= 3 && this.combo % 3 === 0) this.toast(`Combo x${this.combo}`);
        const r = Math.random();
        if (r < 0.12) this.powerups.push({ x: en.x, y: en.y, type: 'weapon' });
        else if (r < 0.17) this.powerups.push({ x: en.x, y: en.y, type: 'heal' });
    }

    damageBoss(dmg, x, y) {
        const b = this.boss;
        b.hp -= dmg;
        b.flash = 0.06;
        this.burst(x, y, 3, '#c4b5fd', 100, 0.25);
        if (b.hp > 0) return;
        this.addScore(2000 + this.currentLevel * 100);
        this.burst(b.x + b.w / 2, b.y + b.h / 2, 90, '#a78bfa', 380, 1.1);
        this.addShake(16);
        this.sfx('playExplosion');
        this.enemyBullets = [];
        this.boss = null;
        this.toast('Flaggschiff zerstört!');
    }

    addScore(n) {
        this.score += n;
        if (this.score > this.highScore) { this.highScore = this.score; if (!this.silent) this.saveHighScore(); }
        this.updateHUD();
    }

    enemyFire(x, y, vx, vy) {
        if (this.enemyBullets.length >= 90) return;
        this.enemyBullets.push({ x, y, px: x, py: y, vx, vy });
    }

    updateEnemies(dt) {
        const p = this.player;
        const spd = this.spec.bulletSpeed;
        const lvl = this.currentLevel;
        const interval = Math.max(1.2, 3.2 / (1 + 0.05 * (lvl - 1)));
        const swayMul = Math.min(2, 1 + 0.1 * (lvl - 1));

        for (const en of this.enemies) {
            if (en.delay > 0) { en.delay -= dt; continue; }
            en.t += dt;
            if (en.flash > 0) en.flash -= dt;

            if (!en.entered) {
                en.y += 150 * dt;
                if (en.y >= en.hy) { en.y = en.hy; en.entered = true; }
                continue;
            }
            const amp = en.type === 'weaver' ? 50 : (en.type === 'tank' ? 18 : 32);
            const freq = (en.type === 'weaver' ? 1.3 : 0.8) * swayMul;
            en.x = en.hx + Math.sin(en.t * freq + en.phase) * amp;
            en.y = en.hy + (en.type === 'weaver' ? Math.sin(en.t * freq * 1.7 + en.phase) * 14 : 0);

            en.shootTimer -= dt;
            if (en.shootTimer <= 0) {
                if (this.shotTokens >= 1) {
                    this.shotTokens -= 1;
                    en.shootTimer = interval * (0.8 + Math.random() * 0.5);
                    if (en.type === 'shooter') {
                        const a = Math.atan2(p.y - en.y, p.x - en.x);
                        this.enemyFire(en.x, en.y + 10, Math.cos(a) * spd, Math.sin(a) * spd);
                    } else if (en.type === 'tank') {
                        for (const da of [-0.3, 0, 0.3]) this.enemyFire(en.x, en.y + 14, Math.sin(da) * spd, Math.cos(da) * spd);
                    } else {
                        this.enemyFire(en.x, en.y + 10, 0, spd);
                    }
                } else {
                    en.shootTimer = 0.2;
                }
            }

            if (p.invuln <= 0 && en.hp > 0 && Math.hypot(en.x - p.x, en.y - p.y) < en.r + p.hitR + 4) {
                en.hp = 0;
                this.burst(en.x, en.y, 16, en.color, 200, 0.5);
                this.hurtPlayer();
                if (this.state !== 'playing') return;
            }
        }
        this.enemies = this.enemies.filter(e => e.hp > 0);
    }

    updateBoss(dt) {
        const b = this.boss;
        if (!b) return;
        const G = window.SpaceShooterGame;
        const p = this.player;
        const spec = this.spec;
        b.t += dt;
        if (b.flash > 0) b.flash -= dt;
        if (!b.entered) {
            b.y += 70 * dt;
            if (b.y >= 70) { b.y = 70; b.entered = true; }
            return;
        }
        b.x = (G.WORLD_W - b.w) / 2 + Math.sin(b.t * 0.9) * (G.WORLD_W / 2 - b.w / 2 - 40);

        const enraged = b.hp < b.maxHp * 0.5;
        b.shootTimer -= dt;
        if (b.shootTimer <= 0) {
            const cx = b.x + b.w / 2, cy = b.y + b.h;
            const spd = Math.min(300, spec.bulletSpeed * 0.9);
            const n = spec.boss.fan;
            const start = (Math.PI - spec.boss.arc) / 2;
            const shift = Math.sin(b.t) * 0.1;
            for (let i = 0; i < n; i++) {
                const a = start + (spec.boss.arc / (n - 1)) * i + shift;
                this.enemyFire(cx, cy, Math.cos(a) * spd, Math.sin(a) * spd);
            }
            if (enraged) {
                const a = Math.atan2(p.y - cy, p.x - cx);
                this.enemyFire(cx, cy, Math.cos(a) * spd, Math.sin(a) * spd);
            }
            b.shootTimer = enraged ? 1.4 : 2.0;
            this.sfx('playLaser');
        }
    }

    updateEnemyBullets(dt) {
        const G = window.SpaceShooterGame;
        const p = this.player;
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            const eb = this.enemyBullets[i];
            eb.px = eb.x; eb.py = eb.y;
            eb.x += eb.vx * dt; eb.y += eb.vy * dt;

            if (p.invuln <= 0 && G.distSegPoint(eb.px, eb.py, eb.x, eb.y, p.x, p.y) < p.hitR + 3.5) {
                this.enemyBullets.splice(i, 1);
                this.hurtPlayer();
                if (this.state !== 'playing') return;
                continue;
            }
            if (eb.y > G.WORLD_H + 20 || eb.y < -40 || eb.x < -40 || eb.x > G.WORLD_W + 40) this.enemyBullets.splice(i, 1);
        }
    }

    updatePowerups(dt) {
        const G = window.SpaceShooterGame;
        const p = this.player;
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const pw = this.powerups[i];
            pw.y += 110 * dt;
            const d = Math.hypot(pw.x - p.x, pw.y - p.y);
            if (d < 90) pw.x += (p.x - pw.x) * dt * 4;
            if (d < 24) {
                if (pw.type === 'weapon') {
                    if (p.weaponLevel < 3) { p.weaponLevel++; this.toast('Waffen-Upgrade!'); }
                    else this.addScore(100);
                } else if (p.hearts < p.maxHearts) { p.hearts++; this.toast('+1 Leben'); }
                else this.addScore(100);
                this.burst(pw.x, pw.y, 14, pw.type === 'weapon' ? '#34d399' : '#fb7185', 160, 0.5);
                this.powerups.splice(i, 1);
                this.updateHUD();
                this.sfx('playPowerup');
            } else if (pw.y > G.WORLD_H + 20) {
                this.powerups.splice(i, 1);
            }
        }
    }

    hurtPlayer() {
        const p = this.player;
        if (p.invuln > 0 || this.state !== 'playing') return;
        p.hearts--;
        p.invuln = 1.6;
        p.weaponLevel = Math.max(1, p.weaponLevel - 1);
        this.combo = 0;
        this.addShake(12);
        this.burst(p.x, p.y, 28, '#f43f5e', 260, 0.7);
        this.sfx('playHit');
        this.updateHUD();
        if (p.hearts <= 0) this.gameOver();
        else this.toast('Treffer!');
    }

    gameOver() {
        this.state = 'over';
        this.stateTimer = 0;
        this.burst(this.player.x, this.player.y, 70, '#fda4af', 340, 1.0);
        if (this.testStats) this.testStats.deaths++;
        this.showOverlay('over');
    }

    completeLevel() {
        const bonus = this.currentLevel * 500 + this.player.hearts * 250;
        this.addScore(bonus);
        this.state = 'complete';
        this.stateTimer = 0;
        this.sfx('playWin');
        this.toast('Level Up!');
        this.showOverlay('complete', { bonus });
        const t = this.testStats;
        if (t) {
            t.levelsCompleted++;
            t.levels.push({ level: this.currentLevel, zeit_s: +this.time.toFixed(1), herzen: this.player.hearts, punkte: this.score });
            if (t.live && t.levelsCompleted >= t.target) this.finishLiveTest(false);
        }
    }

    /* ---------- Juice ---------- */

    addShake(v) { this.shake = Math.min(18, Math.max(this.shake, v)); }

    spawnParticle(x, y, vx, vy, life, size, color) {
        if (this.silent || this.particles.length > 450) return;
        this.particles.push({ x, y, vx, vy, life, max: life, size, color });
    }

    burst(x, y, n, color, speed, life) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, s = speed * (0.2 + Math.random() * 0.8);
            this.spawnParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.5 + Math.random() * 0.7), 1.5 + Math.random() * 2.5, color);
        }
    }

    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const q = this.particles[i];
            q.life -= dt;
            if (q.life <= 0) { this.particles.splice(i, 1); continue; }
            q.x += q.vx * dt; q.y += q.vy * dt;
            q.vx *= 0.98; q.vy *= 0.98;
        }
    }

    /* ---------- Rendering ---------- */

    render() {
        const ctx = this.ctx;
        if (!ctx || !this.view) return;
        const G = window.SpaceShooterGame;
        const cw = this.canvas.width, ch = this.canvas.height;
        const v = this.view;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const bg = ctx.createLinearGradient(0, 0, 0, ch);
        bg.addColorStop(0, '#020617');
        bg.addColorStop(0.6, '#0b1230');
        bg.addColorStop(1, '#1e1b4b');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, cw, ch);

        const sx = this.shake ? (Math.random() - 0.5) * this.shake : 0;
        const sy = this.shake ? (Math.random() - 0.5) * this.shake : 0;
        ctx.setTransform(v.scale, 0, 0, v.scale, v.ox + sx * v.scale, v.oy + sy * v.scale);

        const neb = ctx.createRadialGradient(G.WORLD_W * 0.75, G.WORLD_H * 0.25, 10, G.WORLD_W * 0.75, G.WORLD_H * 0.25, 320);
        neb.addColorStop(0, 'rgba(99,102,241,0.22)');
        neb.addColorStop(1, 'rgba(99,102,241,0)');
        ctx.fillStyle = neb;
        ctx.fillRect(0, 0, G.WORLD_W, G.WORLD_H);

        ctx.fillStyle = '#e2e8f0';
        for (const s of this.stars) {
            ctx.globalAlpha = s.a;
            ctx.fillRect(s.x, s.y, s.size, s.size + this.warp * 40 * (s.speed / 100));
        }
        ctx.globalAlpha = 1;

        for (const pw of this.powerups) this.drawPowerup(ctx, pw);
        for (const en of this.enemies) { if (en.delay <= 0) this.drawEnemy(ctx, en); }
        if (this.boss) this.drawBoss(ctx, this.boss);

        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(56,189,248,0.9)';
        ctx.lineWidth = 3;
        for (const b of this.bullets) {
            ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.012, b.y + 12); ctx.stroke();
        }
        for (const eb of this.enemyBullets) {
            ctx.fillStyle = 'rgba(248,113,113,0.35)';
            ctx.beginPath(); ctx.arc(eb.x, eb.y, 8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fecaca';
            ctx.beginPath(); ctx.arc(eb.x, eb.y, 3.5, 0, Math.PI * 2); ctx.fill();
        }
        for (const q of this.particles) {
            ctx.globalAlpha = Math.max(0, q.life / q.max);
            ctx.fillStyle = q.color;
            ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';

        if (this.state !== 'over') this.drawPlayer(ctx);

        if (this.warp > 0) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = `rgba(165,180,252,${this.warp * 0.35})`;
            ctx.fillRect(0, 0, cw, ch);
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    drawPlayer(ctx) {
        const p = this.player;
        if (p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0) return;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 14;
        const g = ctx.createLinearGradient(0, -p.h / 2, 0, p.h / 2);
        g.addColorStop(0, '#f8fafc');
        g.addColorStop(1, '#6366f1');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, -p.h / 2);
        ctx.lineTo(p.w / 2, p.h / 2);
        ctx.lineTo(0, p.h / 4);
        ctx.lineTo(-p.w / 2, p.h / 2);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath(); ctx.arc(0, -2, 3.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    drawEnemy(ctx, en) {
        ctx.save();
        ctx.translate(en.x, en.y);
        ctx.shadowColor = en.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = en.flash > 0 ? '#ffffff' : en.color;
        ctx.beginPath();
        if (en.type === 'weaver') {
            ctx.moveTo(0, en.r); ctx.lineTo(en.r, -en.r * 0.6); ctx.lineTo(0, -en.r * 0.2); ctx.lineTo(-en.r, -en.r * 0.6);
        } else if (en.type === 'shooter') {
            for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; ctx.lineTo(Math.cos(a) * en.r, Math.sin(a) * en.r); }
        } else if (en.type === 'tank') {
            ctx.rect(-en.r, -en.r * 0.75, en.r * 2, en.r * 1.5);
        } else {
            ctx.arc(0, 0, en.r, 0, Math.PI * 2);
        }
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(15,23,42,0.75)';
        ctx.beginPath(); ctx.arc(0, 0, en.r * 0.35, 0, Math.PI * 2); ctx.fill();
        if (en.type === 'tank' && en.hp < en.maxHp) {
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(-en.r, -en.r - 6, en.r * 2 * (en.hp / en.maxHp), 3);
        }
        ctx.restore();
    }

    drawBoss(ctx, b) {
        ctx.save();
        ctx.shadowColor = '#8b5cf6';
        ctx.shadowBlur = 20;
        ctx.fillStyle = b.flash > 0 ? '#ffffff' : '#7c3aed';
        ctx.beginPath();
        ctx.moveTo(b.x, b.y + 14);
        ctx.lineTo(b.x + b.w * 0.5, b.y);
        ctx.lineTo(b.x + b.w, b.y + 14);
        ctx.lineTo(b.x + b.w * 0.85, b.y + b.h);
        ctx.lineTo(b.x + b.w * 0.15, b.y + b.h);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(b.x, b.y - 12, b.w, 5);
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(b.x, b.y - 12, b.w * Math.max(0, b.hp / b.maxHp), 5);
        ctx.restore();
    }

    drawPowerup(ctx, pw) {
        ctx.save();
        ctx.translate(pw.x, pw.y);
        const c = pw.type === 'weapon' ? '#34d399' : '#fb7185';
        ctx.shadowColor = c;
        ctx.shadowBlur = 12;
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(0, 0, 8 + Math.sin(this.time * 6) * 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pw.type === 'weapon' ? 'W' : '♥', 0, 1);
        ctx.restore();
    }

    /* ---------- Bot / Autoplay ---------- */

    toggleBot() {
        this.bot = !this.bot;
        if (this.bot) {
            this.testStats = this.newTestStats(true);
            this.keys = {};
            if (this.state === 'ready') {
                const b = this.el.modal.querySelector('[data-act="start"]');
                if (b && b.onclick) b.onclick();
            }
            this.toast('🤖 Bot-Test an');
            console.log('%c[CosmicStrike] Live-Bot-Test gestartet (Ziel: 3 Level)', 'color:#22d3ee');
        } else {
            this.toast('Bot-Test aus');
            this.finishLiveTest(true);
        }
    }

    runBot() {
        const p = this.player;
        const G = window.SpaceShooterGame;
        const W = G.WORLD_W, H = G.WORLD_H;
        this.keys = {};

        // Ziel-X: naechster Gegner/Boss; Powerups haben Vorrang
        let targetX = W / 2, bestD = Infinity;
        for (const e of this.enemies) {
            if (e.delay > 0 || e.y <= 0) continue;
            const d = Math.abs(e.x - p.x) + (H - e.y) * 0.1;
            if (d < bestD) { bestD = d; targetX = e.x; }
        }
        if (this.boss) targetX = this.boss.x + this.boss.w / 2;
        let pu = null;
        for (const pw of this.powerups) { if (pw.y < p.y + 40 && (!pu || pw.y > pu.y)) pu = pw; }
        if (pu) targetX = pu.x;

        // Kandidatenpositionen bewerten: Gefahr durch Kugelbahnen (0.7s Vorausschau) dominiert
        const baseY = H - 70;
        let best = null;
        for (let dx = -160; dx <= 160; dx += 20) {
            for (const yo of [0, -60, 40]) {
                const cx = Math.max(20, Math.min(W - 20, p.x + dx));
                const cy = Math.max(H * 0.45, Math.min(H - 20, baseY + yo));
                let danger = 0;
                for (const eb of this.enemyBullets) {
                    const rx = eb.x - cx, ry = eb.y - cy;
                    const vv = eb.vx * eb.vx + eb.vy * eb.vy;
                    let t = vv > 0 ? -(rx * eb.vx + ry * eb.vy) / vv : 0;
                    t = Math.max(0, Math.min(0.7, t));
                    const d = Math.hypot(rx + eb.vx * t, ry + eb.vy * t);
                    if (d < 30) danger += (30 - d) * (1.2 - t);
                }
                for (const e of this.enemies) {
                    if (e.delay <= 0 && cy > e.y && cy - e.y < 90 && Math.abs(e.x - cx) < e.r + 14) danger += 8;
                }
                const cost = danger * 100 + Math.abs(cx - targetX) * 0.3 + Math.hypot(cx - p.x, cy - p.y) * 0.05 + Math.abs(yo) * 0.05;
                if (!best || cost < best.cost) best = { cost, x: cx, y: cy };
            }
        }
        this.pointer = best ? { x: best.x, y: best.y } : { x: p.x, y: p.y };
    }

    newTestStats(live) {
        return { live, target: 3, levelsCompleted: 0, levels: [], deaths: 0, anomalies: [] };
    }

    finishLiveTest(aborted) {
        const t = this.testStats;
        if (!t) return;
        this.bot = false;
        this.pointer = null;
        console.group('%c[CosmicStrike] Live-Bot-Test ' + (aborted ? '(abgebrochen)' : 'abgeschlossen'), 'color:#22d3ee;font-weight:bold');
        console.table(t.levels);
        console.table({
            Level: t.levelsCompleted, Tode: t.deaths, Anomalien: t.anomalies.length,
            FPS: this.stats.fps, 'Update (ms)': +this.stats.updateMs.toFixed(3), 'Render (ms)': +this.stats.renderMs.toFixed(3)
        });
        console.groupEnd();
        this.testStats = null;
    }

    /* ---------- Tests ---------- */

    /** Sanity-Checks. Gibt eine Liste {name, ok, detail} zurueck. */
    runSanityChecks() {
        const G = window.SpaceShooterGame;
        const res = [];
        const check = (name, fn) => {
            try {
                const r = fn();
                const ok = r === true;
                res.push({ name, ok, detail: ok ? '' : String(r) });
            } catch (e) {
                res.push({ name, ok: false, detail: e.message });
            }
        };
        const finite = (...v) => v.every(n => typeof n === 'number' && isFinite(n));

        check('Canvas + Context vorhanden', () => (!!this.canvas && !!this.ctx) || 'fehlt');
        check('UI-Referenzen vorhanden', () => !!(this.el && this.el.score && this.el.hearts && this.el.modal) || 'fehlt');
        check('Spielerzustand endlich', () => finite(this.player.x, this.player.y, this.player.vx, this.player.vy) || 'NaN');
        check('Spieler innerhalb der Welt', () => (this.player.x >= 0 && this.player.x <= G.WORLD_W && this.player.y >= 0 && this.player.y <= G.WORLD_H) || 'ausserhalb');
        check('Punkte (grunt, Combo 1 = 50)', () => G.pointsFor('grunt', 1) === 50 || G.pointsFor('grunt', 1));
        check('Punkte (tank, Combo 3 = 240)', () => G.pointsFor('tank', 3) === 240 || G.pointsFor('tank', 3));
        check('Punkte (Combo-Kappe x1.9 = 95)', () => G.pointsFor('grunt', 99) === 95 || G.pointsFor('grunt', 99));
        check('Swept-Kollision (kein Tunneling)', () => G.distSegPoint(0, 0, 1000, 0, 500, 3) === 3 || 'falsch');
        check('Swept-Rechteck-Kollision', () => (G.segHitsRect(0, 50, 2000, 50, 400, 40, 20, 20, 0) && !G.segHitsRect(0, 0, 2000, 0, 400, 40, 20, 20, 0)) || 'falsch');
        check('RNG deterministisch', () => G.rng(5)() === G.rng(5)() || 'abweichend');
        check('Level 1..60 valide & deterministisch', () => {
            for (let l = 1; l <= 60; l++) {
                const a = G.generateLevel(l), b = G.generateLevel(l);
                const errs = G.validateLevel(a);
                if (errs.length) return `Level ${l}: ${errs[0]}`;
                if (a.fallback) return `Level ${l}: Fallback verwendet`;
                if (JSON.stringify(a) !== JSON.stringify(b)) return `Level ${l} nicht deterministisch`;
            }
            return true;
        });
        check('Typ-Freischaltung (L1 nur grunt, L10 neue Typen)', () => {
            const t1 = new Set(G.generateLevel(1).waves.flatMap(w => w.enemies.map(e => e.type)));
            const t10 = G.generateLevel(10).waves.flatMap(w => w.enemies.map(e => e.type));
            return (t1.size === 1 && t1.has('grunt') && t10.some(t => t === 'tank' || t === 'shooter')) || 'falsch';
        });
        check('Boss alle 5 Level', () => (!G.generateLevel(4).boss && !!G.generateLevel(5).boss && !!G.generateLevel(10).boss) || 'falsch');
        check('Kugeltempo +10%/Level', () => Math.abs(G.bulletSpeed(2) / G.bulletSpeed(1) - 1.1) < 1e-9 || 'falsch');
        check('Validator erkennt defekte Level', () =>
            G.validateLevel({ waves: [{ enemies: [{ type: 'grunt', hx: -5, hy: 100, hp: 10 }] }], bulletSpeed: 100, budget: 1 }).length > 0 || 'nicht erkannt');
        return res;
    }

    /** Headless-Bot-Lauf (ohne Rendering) ueber mehrere Level; setzt das Spiel danach zurueck. */
    runHeadless(levels = 3, maxSimSeconds = 240) {
        const savedScore = this.score, savedHi = this.highScore;
        this.silent = true;
        const stats = this.newTestStats(false);
        stats.target = levels;
        this.testStats = stats;
        this.score = 0;
        this.bot = true;
        this.startLevel(1);

        const dt = 1 / 60;
        let steps = 0, updateTotal = 0, prevScore = 0, levelTime = 0, lastLevel = 1;
        const maxSteps = Math.floor(maxSimSeconds * 60) * levels;
        while (stats.levelsCompleted < levels && steps < maxSteps) {
            const t0 = performance.now();
            try { this.update(dt); } catch (e) { stats.anomalies.push(`Exception: ${e.message}`); break; }
            updateTotal += performance.now() - t0;
            steps++;
            const p = this.player;
            if (!isFinite(p.x) || !isFinite(p.y)) { stats.anomalies.push('Spielerposition NaN'); break; }
            if (this.score < prevScore) stats.anomalies.push('Score gesunken');
            prevScore = this.score;
            if (p.hearts < 0 || p.hearts > p.maxHearts) stats.anomalies.push('Herzen ausserhalb Bereich');
            if (this.enemyBullets.length > 90) stats.anomalies.push('Zu viele Gegnerkugeln');
            if (this.enemies.some(e => !isFinite(e.x) || !isFinite(e.y))) stats.anomalies.push('Gegner NaN');
            if (this.currentLevel !== lastLevel) { lastLevel = this.currentLevel; levelTime = 0; }
            levelTime += dt;
            if (levelTime > maxSimSeconds) { stats.anomalies.push(`Level ${this.currentLevel} Timeout`); break; }
            if (stats.anomalies.length > 5) break;
        }

        const report = {
            levels: stats.levels, levelsCompleted: stats.levelsCompleted, deaths: stats.deaths,
            anomalies: stats.anomalies, steps, avgUpdateMs: steps ? updateTotal / steps : 0,
            passed: stats.levelsCompleted >= levels && stats.anomalies.length === 0
        };
        this.bot = false;
        this.pointer = null;
        this.testStats = null;
        this.silent = false;
        this.highScore = savedHi;
        this.score = savedScore;
        return report;
    }

    runAllTests() {
        const sanity = this.runSanityChecks();
        const bot = this.runHeadless(3);
        const failed = sanity.filter(s => !s.ok).length;
        const ok = failed === 0 && bot.passed;
        console.group('%c[CosmicStrike] Selbsttest', 'color:#22d3ee;font-weight:bold;font-size:13px');
        console.table(sanity);
        console.table(bot.levels);
        console.table({
            'Level abgeschlossen': bot.levelsCompleted, Tode: bot.deaths, Anomalien: bot.anomalies.length,
            'Sim-Schritte': bot.steps, 'Update ø (ms)': +bot.avgUpdateMs.toFixed(4),
            'FPS (live)': this.stats.fps, 'Render ø (ms)': +this.stats.renderMs.toFixed(3)
        });
        if (bot.anomalies.length) console.warn('Anomalien:', bot.anomalies);
        console.log(`%c${ok ? '✔ ALLE TESTS BESTANDEN' : '✘ TESTS FEHLGESCHLAGEN'} (Sanity: ${sanity.length - failed}/${sanity.length}, Bot: ${bot.levelsCompleted}/3 Level)`,
            `color:${ok ? '#34d399' : '#f87171'};font-weight:bold`);
        console.groupEnd();
        this.testResults = { sanity, bot, ok };
        this.startLevel(1, true);
        this.showOverlay('start');
        return this.testResults;
    }

    /* ---------- Portal-Schnittstelle ---------- */

    pause() { this.isPaused = true; }
    resume() { this.isPaused = false; this.lastTs = 0; }

    destroy() {
        if (this.animId) cancelAnimationFrame(this.animId);
        this.animId = null;
        for (const [t, type, fn, opts] of this.handlers) {
            if (t.removeEventListener) t.removeEventListener(type, fn, opts);
        }
        this.handlers = [];
        this.ctx = null;
        if (this.container) this.container.innerHTML = '';
    }
};
