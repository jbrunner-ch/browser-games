/**
 * Cosmic Strike - Arcade Bullet-Hell Space Shooter
 * Built with Canvas 2D. Features starfield parallax, spread blasters, homing missiles,
 * dynamic enemy waves, capital Boss encounters, powerup drops and multi-level progression.
 */

window.SpaceShooterGame = class {
    constructor() {
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        this.animId = null;
        this.isPaused = false;

        this.player = {
            x: 400, y: 500,
            w: 32, h: 36,
            speed: 7.5,
            weaponLevel: 1,
            shield: 100,
            maxShield: 100,
            isInvulnerable: false
        };

        this.bullets = [];
        this.enemyBullets = [];
        this.enemies = [];
        this.stars = [];
        this.particles = [];
        this.powerups = [];

        this.score = 0;
        this.wave = 1;
        this.currentLevel = 1;
        this.difficulty = 'Normal';
        this.keys = {};
        this.fireCooldown = 0;
        this.boss = null;
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
            <div class="rush-stat">Score: <span class="rush-stat-val" style="color:#fbbf24;" id="space-score">0</span></div>
            <div class="rush-stat">Shield: <span class="rush-stat-val" style="color:#38bdf8;" id="space-shield">100%</span></div>
            <div class="rush-stat">Sector: <span class="rush-stat-val" id="space-lvl">1</span></div>
        `;
        this.container.appendChild(hud);

        const win = document.createElement('div');
        win.className = 'game-win-overlay';
        win.id = 'space-win-screen';
        win.innerHTML = `
            <div class="win-title">SECTOR SECURED! 🚀</div>
            <div class="win-subtitle" id="space-win-sub">Capital Flagship Annihilated!</div>
            <div style="display:flex; gap:12px;">
                <button class="btn-game-action" id="btn-space-replay">Replay</button>
                <button class="btn-game-action" style="background:#10b981; border-color:#10b981;" id="btn-space-next">Next Sector ➔</button>
            </div>
        `;
        this.container.appendChild(win);

        this.bindEvents();
        this.resize();
        this.initStars();

        const lvl = options.levelIndex || 1;
        this.startLevel(lvl, options.difficulty || 'Normal');

        this.loop = this.loop.bind(this);
        this.animId = requestAnimationFrame(this.loop);
    }

    resize() {
        const rect = this.container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    initStars() {
        this.stars = [];
        const w = this.canvas.width || 800;
        const h = this.canvas.height || 600;
        for (let i = 0; i < 90; i++) {
            this.stars.push({
                x: Math.random() * w,
                y: Math.random() * h,
                speed: 0.5 + Math.random() * 2.5,
                size: 1 + Math.random() * 2
            });
        }
    }

    startLevel(levelIndex = 1, difficulty = 'Normal') {
        this.currentLevel = levelIndex;
        this.difficulty = difficulty;
        this.player.shield = 100;
        this.player.weaponLevel = 1;
        this.bullets = [];
        this.enemyBullets = [];
        this.enemies = [];
        this.powerups = [];
        this.boss = null;
        this.wave = 1;

        const winScreen = this.container.querySelector('#space-win-screen');
        if (winScreen) winScreen.classList.remove('active');

        this.spawnWave();
        this.updateHUD();
    }

    spawnWave() {
        const count = 5 + this.wave * 2;
        const w = this.canvas.width || 800;

        for (let i = 0; i < count; i++) {
            this.enemies.push({
                x: 80 + (i % 6) * (w / 7),
                y: -40 - Math.floor(i / 6) * 60,
                targetY: 80 + Math.floor(i / 6) * 50,
                vx: (Math.random() > 0.5 ? 1 : -1) * 2,
                hp: 20 + this.currentLevel * 10,
                maxHp: 20 + this.currentLevel * 10,
                shootTimer: 1 + Math.random() * 3,
                color: '#ef4444'
            });
        }

        // Spawn Boss on Wave 4
        if (this.wave === 4 && !this.boss) {
            this.boss = {
                x: w / 2 - 60,
                y: -100,
                targetY: 80,
                w: 120,
                h: 80,
                hp: 600 + this.currentLevel * 250,
                maxHp: 600 + this.currentLevel * 250,
                vx: 2.5,
                shootTimer: 0.8
            };
        }
    }

    bindEvents() {
        window.addEventListener('resize', () => {
            this.resize();
            this.initStars();
        });

        window.addEventListener('keydown', (e) => this.keys[e.code] = true);
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.player.x = e.clientX - rect.left - this.player.w / 2;
            this.player.y = e.clientY - rect.top - this.player.h / 2;
        });

        this.container.querySelector('#btn-space-replay').onclick = () => this.startLevel(this.currentLevel, this.difficulty);
        this.container.querySelector('#btn-space-next').onclick = () => this.startLevel(this.currentLevel + 1, this.difficulty);
    }

    loop() {
        this.animId = requestAnimationFrame(this.loop);
        if (this.isPaused || !this.ctx) return;

        this.update();
        this.render();
    }

    update() {
        const p = this.player;

        // Key movement
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) p.x -= p.speed;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) p.x += p.speed;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) p.y -= p.speed;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) p.y += p.speed;

        p.x = Math.max(10, Math.min(this.canvas.width - p.w - 10, p.x));
        p.y = Math.max(10, Math.min(this.canvas.height - p.h - 10, p.y));

        // Auto Fire
        this.fireCooldown -= 0.05;
        if (this.fireCooldown <= 0) {
            this.firePlayerBullets();
            this.fireCooldown = 0.16;
        }

        // Stars parallax
        for (const s of this.stars) {
            s.y += s.speed;
            if (s.y > this.canvas.height) {
                s.y = 0;
                s.x = Math.random() * this.canvas.width;
            }
        }

        // Update player bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.x += b.vx || 0;
            b.y += b.vy;

            // Hit enemy
            for (let eIdx = this.enemies.length - 1; eIdx >= 0; eIdx--) {
                const en = this.enemies[eIdx];
                if (Math.hypot(b.x - en.x, b.y - en.y) < 20) {
                    en.hp -= 15;
                    this.bullets.splice(i, 1);
                    if (en.hp <= 0) {
                        this.score += 50;
                        if (Math.random() < 0.2) {
                            this.powerups.push({ x: en.x, y: en.y, type: 'weapon' });
                        }
                        this.enemies.splice(eIdx, 1);
                        if (window.AudioManager) window.AudioManager.playExplosion();
                    }
                    break;
                }
            }

            // Hit Boss
            if (this.boss && b.x >= this.boss.x && b.x <= this.boss.x + this.boss.w &&
                b.y >= this.boss.y && b.y <= this.boss.y + this.boss.h) {
                this.boss.hp -= 15;
                this.bullets.splice(i, 1);
                if (this.boss.hp <= 0) {
                    this.triggerWin();
                    this.boss = null;
                }
            }

            if (b.y < -10) this.bullets.splice(i, 1);
        }

        // Update Enemies
        for (const en of this.enemies) {
            if (en.y < en.targetY) en.y += 2;
            else {
                en.x += en.vx;
                if (en.x < 30 || en.x > this.canvas.width - 30) en.vx *= -1;
            }

            en.shootTimer -= 0.02;
            if (en.shootTimer <= 0) {
                this.enemyBullets.push({ x: en.x, y: en.y + 10, vy: 4.5 });
                en.shootTimer = 2.5 + Math.random() * 2;
            }
        }

        // Update Boss
        if (this.boss) {
            if (this.boss.y < this.boss.targetY) this.boss.y += 1.5;
            else {
                this.boss.x += this.boss.vx;
                if (this.boss.x < 40 || this.boss.x > this.canvas.width - this.boss.w - 40) {
                    this.boss.vx *= -1;
                }
            }

            this.boss.shootTimer -= 0.02;
            if (this.boss.shootTimer <= 0) {
                // Ring spread
                for (let a = 0; a < Math.PI; a += 0.4) {
                    this.enemyBullets.push({
                        x: this.boss.x + this.boss.w / 2,
                        y: this.boss.y + this.boss.h,
                        vx: Math.cos(a) * 3.5,
                        vy: Math.sin(a) * 3.5
                    });
                }
                this.boss.shootTimer = 1.6;
            }
        }

        // Update Enemy Bullets
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            const eb = this.enemyBullets[i];
            eb.x += eb.vx || 0;
            eb.y += eb.vy;

            // Hit player
            if (Math.hypot(eb.x - (p.x + p.w / 2), eb.y - (p.y + p.h / 2)) < 18) {
                p.shield -= 20;
                this.enemyBullets.splice(i, 1);
                this.updateHUD();
                if (window.AudioManager) window.AudioManager.playHit();

                if (p.shield <= 0) {
                    alert('Ship destroyed! Sector restarted.');
                    this.startLevel(this.currentLevel, this.difficulty);
                    return;
                }
            }

            if (eb.y > this.canvas.height + 10) this.enemyBullets.splice(i, 1);
        }

        // Powerups
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const pw = this.powerups[i];
            pw.y += 2.0;
            if (Math.hypot(pw.x - (p.x + p.w / 2), pw.y - (p.y + p.h / 2)) < 24) {
                p.weaponLevel = Math.min(3, p.weaponLevel + 1);
                p.shield = Math.min(100, p.shield + 25);
                this.powerups.splice(i, 1);
                this.updateHUD();
                if (window.AudioManager) window.AudioManager.playPowerup();
            }
        }

        // Wave finished check
        if (this.enemies.length === 0 && !this.boss) {
            this.wave++;
            if (this.wave > 4) {
                this.triggerWin();
            } else {
                this.spawnWave();
            }
        }
    }

    firePlayerBullets() {
        const p = this.player;
        const cx = p.x + p.w / 2;
        const cy = p.y;

        if (p.weaponLevel === 1) {
            this.bullets.push({ x: cx, y: cy, vy: -12 });
        } else if (p.weaponLevel === 2) {
            this.bullets.push({ x: cx - 8, y: cy, vy: -12 });
            this.bullets.push({ x: cx + 8, y: cy, vy: -12 });
        } else {
            this.bullets.push({ x: cx, y: cy, vy: -12 });
            this.bullets.push({ x: cx - 10, y: cy, vx: -2.5, vy: -11 });
            this.bullets.push({ x: cx + 10, y: cy, vx: 2.5, vy: -11 });
        }
        if (window.AudioManager) window.AudioManager.playLaser();
    }

    triggerWin() {
        if (window.AudioManager) window.AudioManager.playWin();
        const winScreen = this.container.querySelector('#space-win-screen');
        if (winScreen) winScreen.classList.add('active');
    }

    updateHUD() {
        const sEl = this.container.querySelector('#space-score');
        const shEl = this.container.querySelector('#space-shield');
        const lvlEl = this.container.querySelector('#space-lvl');

        if (sEl) sEl.innerText = `${this.score}`;
        if (shEl) shEl.innerText = `${Math.max(0, this.player.shield)}%`;
        if (lvlEl) lvlEl.innerText = `${this.currentLevel}`;
    }

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Starfield
        ctx.fillStyle = '#fff';
        for (const s of this.stars) {
            ctx.fillRect(s.x, s.y, s.size, s.size);
        }

        // Draw Player Ship
        const p = this.player;
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(p.x + p.w / 2, p.y);
        ctx.lineTo(p.x + p.w, p.y + p.h);
        ctx.lineTo(p.x, p.y + p.h);
        ctx.fill();

        // Engine glow
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(p.x + p.w / 2, p.y + p.h + 2, 5, 0, Math.PI * 2);
        ctx.fill();

        // Draw Enemies
        for (const en of this.enemies) {
            ctx.fillStyle = en.color;
            ctx.beginPath();
            ctx.arc(en.x, en.y, 14, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw Boss
        if (this.boss) {
            ctx.fillStyle = '#8b5cf6';
            ctx.fillRect(this.boss.x, this.boss.y, this.boss.w, this.boss.h);
            // Health bar
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(this.boss.x, this.boss.y - 12, this.boss.w * (this.boss.hp / this.boss.maxHp), 6);
        }

        // Draw Bullets
        ctx.fillStyle = '#fde047';
        for (const b of this.bullets) {
            ctx.fillRect(b.x - 2, b.y, 4, 10);
        }

        ctx.fillStyle = '#f87171';
        for (const eb of this.enemyBullets) {
            ctx.beginPath();
            ctx.arc(eb.x, eb.y, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw Powerups
        ctx.fillStyle = '#10b981';
        for (const pw of this.powerups) {
            ctx.beginPath();
            ctx.arc(pw.x, pw.y, 8, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    pause() { this.isPaused = true; }
    resume() { this.isPaused = false; }
    destroy() {
        if (this.animId) cancelAnimationFrame(this.animId);
        if (this.container) this.container.innerHTML = '';
    }
};

