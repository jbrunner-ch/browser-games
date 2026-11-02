/**
 * Cyber Siege - Tower Defense Game
 * Levels 1 - 100+ with procedural road paths, turret upgrades,
 * elemental effects, wave scaling and boss tiers.
 */

window.TowerDefenseGame = class {
    constructor() {
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        this.animId = null;
        this.isPaused = false;

        this.credits = 350;
        this.lives = 20;
        this.wave = 1;
        this.maxWaves = 10;
        this.currentLevel = 1;
        this.difficulty = 'Einfach';

        this.waypoints = [];
        this.turrets = [];
        this.enemies = [];
        this.projectiles = [];

        this.selectedTowerType = 'blaster';
        this.waveInProgress = false;
        this.waveSpawnTimer = 0;
        this.enemiesToSpawn = [];

        this.towerTypes = {
            blaster: { name: 'Gatling', cost: 100, range: 110, rate: 0.18, damage: 20, color: '#3b82f6' },
            plasma: { name: 'Plasma', cost: 180, range: 130, rate: 0.65, damage: 50, splash: 50, color: '#f59e0b' },
            cryo: { name: 'Cryo', cost: 140, range: 100, rate: 0.45, damage: 14, slow: 0.5, color: '#06b6d4' },
            tesla: { name: 'Tesla', cost: 240, range: 125, rate: 0.75, damage: 70, chain: 3, color: '#a855f7' }
        };
    }

    init(container, options = {}) {
        this.container = container;
        this.container.innerHTML = '';

        this.canvas = document.createElement('canvas');
        this.canvas.className = 'game-canvas';
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);

        const hud = document.createElement('div');
        hud.className = 'rush-hud';
        hud.innerHTML = `
            <div class="rush-stat">Credits: <span class="rush-stat-val" style="color:#fbbf24;" id="td-credits">$350</span></div>
            <div class="rush-stat">Leben: <span class="rush-stat-val" style="color:#ef4444;" id="td-lives">20</span></div>
            <div class="rush-stat">Welle: <span class="rush-stat-val" id="td-wave">1/10</span></div>
            <button class="btn-game-action" id="btn-td-wave">Welle starten</button>
        `;
        this.container.appendChild(hud);

        const shop = document.createElement('div');
        shop.className = 'td-shop';
        shop.innerHTML = `
            <div class="td-tower-card selected" data-type="blaster"><div class="td-tower-name">Gatling</div><div class="td-tower-cost">$100</div></div>
            <div class="td-tower-card" data-type="plasma"><div class="td-tower-name">Plasma</div><div class="td-tower-cost">$180</div></div>
            <div class="td-tower-card" data-type="cryo"><div class="td-tower-name">Cryo</div><div class="td-tower-cost">$140</div></div>
            <div class="td-tower-card" data-type="tesla"><div class="td-tower-name">Tesla</div><div class="td-tower-cost">$240</div></div>
        `;
        this.container.appendChild(shop);

        const win = document.createElement('div');
        win.className = 'game-win-overlay';
        win.id = 'td-win-screen';
        win.innerHTML = `
            <div class="win-title">SEKTOR BEREINIGT!</div>
            <div class="win-subtitle" id="td-win-sub">Alle Wellen erfolgreich abgewehrt.</div>
            <div style="display:flex; gap:8px;">
                <button class="btn-game-action" id="btn-td-replay">Wiederholen</button>
                <button class="btn-game-action" style="background:#2563eb; color:#fff;" id="btn-td-next">Nächster Sektor ➔</button>
            </div>
        `;
        this.container.appendChild(win);

        this.bindEvents();
        this.resize();

        const lvl = options.levelIndex || 1;
        this.startLevel(lvl, options.difficulty || 'Einfach');

        requestAnimationFrame(() => this.resize());

        this.lastTime = performance.now();
        this.loop = this.loop.bind(this);
        this.animId = requestAnimationFrame(this.loop);
    }

    resize() {
        if (!this.container || !this.canvas) return;
        const rect = this.container.getBoundingClientRect();
        const w = rect.width > 50 ? rect.width : (window.innerWidth || 800);
        const h = rect.height > 50 ? rect.height : (window.innerHeight - 48 || 600);

        this.canvas.width = w;
        this.canvas.height = h;
    }

    startLevel(levelIndex = 1, difficulty = 'Einfach') {
        this.currentLevel = levelIndex;
        this.difficulty = difficulty;
        this.credits = 350 + (levelIndex * 25);
        this.lives = 20;
        this.wave = 1;
        this.maxWaves = 8 + Math.min(12, Math.floor(levelIndex / 4));
        this.turrets = [];
        this.enemies = [];
        this.projectiles = [];
        this.waveInProgress = false;

        const winScreen = this.container.querySelector('#td-win-screen');
        if (winScreen) winScreen.classList.remove('active');

        this.generatePath(levelIndex);
        this.updateHUD();
    }

    generatePath(levelIndex) {
        const w = this.canvas.width || 800;
        const h = this.canvas.height || 600;

        // Path geometry changes dynamically per level
        const variant = levelIndex % 3;
        if (variant === 1) {
            this.waypoints = [
                { x: 0, y: h * 0.25 },
                { x: w * 0.75, y: h * 0.25 },
                { x: w * 0.75, y: h * 0.65 },
                { x: w * 0.25, y: h * 0.65 },
                { x: w * 0.25, y: h * 0.85 },
                { x: w + 40, y: h * 0.85 }
            ];
        } else if (variant === 2) {
            this.waypoints = [
                { x: 0, y: h * 0.2 },
                { x: w * 0.85, y: h * 0.2 },
                { x: w * 0.85, y: h * 0.8 },
                { x: w * 0.15, y: h * 0.8 },
                { x: w * 0.15, y: h * 0.5 },
                { x: w + 40, y: h * 0.5 }
            ];
        } else {
            this.waypoints = [
                { x: 0, y: h * 0.15 },
                { x: w * 0.8, y: h * 0.15 },
                { x: w * 0.2, y: h * 0.4 },
                { x: w * 0.8, y: h * 0.65 },
                { x: w * 0.1, y: h * 0.85 },
                { x: w + 40, y: h * 0.85 }
            ];
        }
    }

    bindEvents() {
        window.addEventListener('resize', () => {
            this.resize();
            this.generatePath(this.currentLevel);
        });

        const cards = this.container.querySelectorAll('.td-tower-card');
        cards.forEach(card => {
            card.onclick = () => {
                cards.forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.selectedTowerType = card.dataset.type;
                if (window.AudioManager) window.AudioManager.playClick();
            };
        });

        this.container.querySelector('#btn-td-wave').onclick = () => this.startNextWave();

        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.handleCanvasClick(e.clientX - rect.left, e.clientY - rect.top);
        });

        this.container.querySelector('#btn-td-replay').onclick = () => this.startLevel(this.currentLevel);
        this.container.querySelector('#btn-td-next').onclick = () => {
            if (window.portal) window.portal.launchGame('towerdefense', this.currentLevel + 1);
            else this.startLevel(this.currentLevel + 1);
        };
    }

    handleCanvasClick(x, y) {
        if (this.isNearPath(x, y, 32)) return;

        // Upgrade existing
        for (const t of this.turrets) {
            if (Math.hypot(t.x - x, t.y - y) < 22) {
                const cost = Math.floor(t.cost * 0.7);
                if (this.credits >= cost) {
                    this.credits -= cost;
                    t.level++;
                    t.damage = Math.floor(t.damage * 1.4);
                    t.range += 15;
                    this.updateHUD();
                    if (window.AudioManager) window.AudioManager.playPowerup();
                }
                return;
            }
        }

        // Place new
        const info = this.towerTypes[this.selectedTowerType];
        if (this.credits >= info.cost) {
            this.credits -= info.cost;
            this.turrets.push({
                x, y,
                type: this.selectedTowerType,
                cost: info.cost,
                range: info.range,
                rate: info.rate,
                damage: info.damage,
                splash: info.splash || 0,
                slow: info.slow || 0,
                color: info.color,
                cooldown: 0,
                level: 1
            });
            this.updateHUD();
            if (window.AudioManager) window.AudioManager.playPlaceBlock();
        }
    }

    isNearPath(x, y, threshold) {
        for (let i = 0; i < this.waypoints.length - 1; i++) {
            const p1 = this.waypoints[i];
            const p2 = this.waypoints[i + 1];
            if (this.distToSegment({ x, y }, p1, p2) < threshold) return true;
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

    startNextWave() {
        if (this.waveInProgress) return;
        this.waveInProgress = true;
        this.enemiesToSpawn = [];

        const count = 7 + this.wave * 3;
        const hpMultiplier = 1 + (this.currentLevel * 0.15);

        for (let i = 0; i < count; i++) {
            const hp = Math.floor((30 + this.wave * 16) * hpMultiplier);
            this.enemiesToSpawn.push({
                hp: hp,
                maxHp: hp,
                speed: 1.0 + (Math.random() * 0.35),
                radius: 10,
                color: '#ef4444',
                reward: 12 + this.wave * 2
            });
        }

        if (this.wave % 4 === 0) {
            const bossHp = Math.floor((350 + this.wave * 100) * hpMultiplier);
            this.enemiesToSpawn.push({
                hp: bossHp,
                maxHp: bossHp,
                speed: 0.65,
                radius: 18,
                color: '#ec4899',
                reward: 100,
                isBoss: true
            });
        }
        this.waveSpawnTimer = 0;
    }

    updateHUD() {
        const cEl = this.container.querySelector('#td-credits');
        const lEl = this.container.querySelector('#td-lives');
        const wEl = this.container.querySelector('#td-wave');
        if (cEl) cEl.innerText = `$${this.credits}`;
        if (lEl) lEl.innerText = `${this.lives}`;
        if (wEl) wEl.innerText = `${this.wave}/${this.maxWaves}`;
    }

    loop(time) {
        this.animId = requestAnimationFrame(this.loop);
        if (this.isPaused || !this.ctx) return;

        const delta = Math.min((time - this.lastTime) / 1000, 0.1);
        this.lastTime = time;

        this.update(delta);
        this.render();
    }

    update(delta) {
        if (this.enemiesToSpawn.length > 0) {
            this.waveSpawnTimer -= delta;
            if (this.waveSpawnTimer <= 0) {
                const en = this.enemiesToSpawn.shift();
                en.waypointIdx = 0;
                en.x = this.waypoints[0].x;
                en.y = this.waypoints[0].y;
                en.slowTimer = 0;
                this.enemies.push(en);
                this.waveSpawnTimer = 0.6;
            }
        } else if (this.enemies.length === 0 && this.waveInProgress) {
            this.waveInProgress = false;
            this.credits += 45 + this.wave * 8;
            this.wave++;
            this.updateHUD();

            if (this.wave > this.maxWaves) {
                this.triggerWin();
            }
        }

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const en = this.enemies[i];
            const target = this.waypoints[en.waypointIdx + 1];

            if (!target) {
                this.lives--;
                this.enemies.splice(i, 1);
                this.updateHUD();
                if (window.AudioManager) window.AudioManager.playHit();
                if (this.lives <= 0) {
                    alert('Basis überrannt! Level wird neu gestartet.');
                    this.startLevel(this.currentLevel);
                }
                continue;
            }

            const currentSpeed = en.slowTimer > 0 ? en.speed * 0.5 : en.speed;
            if (en.slowTimer > 0) en.slowTimer -= delta;

            const dx = target.x - en.x;
            const dy = target.y - en.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 5) {
                en.waypointIdx++;
            } else {
                en.x += (dx / dist) * currentSpeed * 75 * delta;
                en.y += (dy / dist) * currentSpeed * 75 * delta;
            }
        }

        this.turrets.forEach(t => {
            t.cooldown -= delta;
            if (t.cooldown <= 0) {
                let target = null;
                let minDist = t.range;

                for (const en of this.enemies) {
                    const d = Math.hypot(en.x - t.x, en.y - t.y);
                    if (d <= minDist) {
                        minDist = d;
                        target = en;
                    }
                }

                if (target) {
                    t.cooldown = t.rate;
                    this.projectiles.push({
                        x: t.x, y: t.y,
                        target: target,
                        damage: t.damage,
                        splash: t.splash,
                        slow: t.slow,
                        color: t.color,
                        speed: 420
                    });
                    if (window.AudioManager) window.AudioManager.playLaser();
                }
            }
        });

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            const dx = p.target.x - p.x;
            const dy = p.target.y - p.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 12 || !this.enemies.includes(p.target)) {
                if (p.splash > 0) {
                    for (const en of this.enemies) {
                        if (Math.hypot(en.x - p.x, en.y - p.y) < p.splash) {
                            en.hp -= p.damage;
                        }
                    }
                } else {
                    p.target.hp -= p.damage;
                    if (p.slow > 0) p.target.slowTimer = 2.0;
                }

                for (let e = this.enemies.length - 1; e >= 0; e--) {
                    if (this.enemies[e].hp <= 0) {
                        this.credits += this.enemies[e].reward;
                        this.enemies.splice(e, 1);
                        this.updateHUD();
                        if (window.AudioManager) window.AudioManager.playExplosion();
                    }
                }
                this.projectiles.splice(i, 1);
            } else {
                p.x += (dx / dist) * p.speed * delta;
                p.y += (dy / dist) * p.speed * delta;
            }
        }
    }

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Path
        ctx.save();
        ctx.strokeStyle = '#27272a';
        ctx.lineWidth = 36;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        this.waypoints.forEach((pt, i) => {
            if (i === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();

        ctx.strokeStyle = '#18181b';
        ctx.lineWidth = 30;
        ctx.stroke();
        ctx.restore();

        // Turrets
        for (const t of this.turrets) {
            ctx.save();
            ctx.fillStyle = t.color;
            ctx.beginPath();
            ctx.arc(t.x, t.y, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#27272a';
            ctx.lineWidth = 2;
            ctx.stroke();

            if (t.level > 1) {
                ctx.fillStyle = '#fbbf24';
                ctx.font = 'bold 9px monospace';
                ctx.fillText(`+${t.level}`, t.x - 5, t.y - 18);
            }
            ctx.restore();
        }

        // Enemies
        for (const en of this.enemies) {
            ctx.save();
            ctx.fillStyle = en.slowTimer > 0 ? '#38bdf8' : en.color;
            ctx.beginPath();
            ctx.arc(en.x, en.y, en.radius, 0, Math.PI * 2);
            ctx.fill();

            const barW = en.radius * 2;
            ctx.fillStyle = '#18181b';
            ctx.fillRect(en.x - en.radius, en.y - en.radius - 6, barW, 3);
            ctx.fillStyle = '#10b981';
            ctx.fillRect(en.x - en.radius, en.y - en.radius - 6, barW * (en.hp / en.maxHp), 3);
            ctx.restore();
        }

        // Projectiles
        for (const p of this.projectiles) {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    triggerWin() {
        if (window.AudioManager) window.AudioManager.playWin();
        const winScreen = this.container.querySelector('#td-win-screen');
        if (winScreen) winScreen.classList.add('active');
    }

    pause() { this.isPaused = true; }
    resume() { this.isPaused = false; this.lastTime = performance.now(); }
    destroy() {
        if (this.animId) cancelAnimationFrame(this.animId);
        if (this.container) this.container.innerHTML = '';
    }
};
