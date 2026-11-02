/**
 * Neo-Breakout - Arcade Brick Breaker
 * Levels 1 - 100+ with procedural brick patterns, armored bricks,
 * multiball, laser paddle, fireball, and scaling ball speeds.
 */

window.BreakoutGame = class {
    constructor() {
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        this.animId = null;
        this.isPaused = false;

        this.paddle = { x: 350, y: 540, w: 90, h: 12, speed: 9, laserMode: false };
        this.balls = [];
        this.bricks = [];
        this.powerups = [];
        this.lasers = [];

        this.score = 0;
        this.lives = 3;
        this.currentLevel = 1;
        this.keys = {};
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
            <div class="rush-stat">Punkte: <span class="rush-stat-val" style="color:#fbbf24;" id="bo-score">0</span></div>
            <div class="rush-stat">Leben: <span class="rush-stat-val" style="color:#ef4444;" id="bo-lives">3</span></div>
            <div class="rush-stat">Level: <span class="rush-stat-val" id="bo-lvl">1</span></div>
        `;
        this.container.appendChild(hud);

        const win = document.createElement('div');
        win.className = 'game-win-overlay';
        win.id = 'bo-win-screen';
        win.innerHTML = `
            <div class="win-title">LEVEL GESCHAFFT!</div>
            <div class="win-subtitle" id="bo-win-sub">Alle Steine zerstört.</div>
            <div style="display:flex; gap:8px;">
                <button class="btn-game-action" id="btn-bo-replay">Wiederholen</button>
                <button class="btn-game-action" style="background:#2563eb; color:#fff;" id="btn-bo-next">Nächstes Level ➔</button>
            </div>
        `;
        this.container.appendChild(win);

        this.bindEvents();
        this.resize();

        const lvl = options.levelIndex || 1;
        this.startLevel(lvl);

        requestAnimationFrame(() => this.resize());

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
        this.paddle.y = h - 35;
    }

    startLevel(levelIndex = 1) {
        this.currentLevel = levelIndex;
        this.balls = [];
        this.powerups = [];
        this.lasers = [];
        this.paddle.w = 90;
        this.paddle.laserMode = false;

        const winScreen = this.container.querySelector('#bo-win-screen');
        if (winScreen) winScreen.classList.remove('active');

        this.spawnBall();
        this.buildBricks(levelIndex);
        this.updateHUD();
    }

    spawnBall() {
        const baseSpeed = 5.5 + Math.min(4.0, this.currentLevel * 0.1);
        this.balls.push({
            x: this.canvas.width / 2,
            y: this.paddle.y - 12,
            vx: (Math.random() > 0.5 ? 1 : -1) * (baseSpeed * 0.7),
            vy: -baseSpeed,
            radius: 5,
            isFireball: false
        });
    }

    buildBricks(levelIndex) {
        this.bricks = [];
        const rows = 4 + Math.min(6, Math.floor(levelIndex / 4));
        const cols = 8;
        const brickW = Math.floor((this.canvas.width - 60) / cols);
        const brickH = 20;

        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
        const seed = levelIndex * 53.71;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const isArmored = Math.sin(r * 4 + c * 3 + seed) > 0.4 && levelIndex > 2;
                const hp = isArmored ? 2 : 1;

                this.bricks.push({
                    x: 30 + c * brickW,
                    y: 60 + r * (brickH + 4),
                    w: brickW - 4,
                    h: brickH,
                    hp: hp,
                    maxHp: hp,
                    color: isArmored ? '#52525b' : colors[r % colors.length]
                });
            }
        }
    }

    bindEvents() {
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'Space' && this.paddle.laserMode) {
                this.fireLasers();
            }
        });
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.paddle.x = e.clientX - rect.left - this.paddle.w / 2;
        });

        this.container.querySelector('#btn-bo-replay').onclick = () => this.startLevel(this.currentLevel);
        this.container.querySelector('#btn-bo-next').onclick = () => {
            if (window.portal) window.portal.launchGame('breakout', this.currentLevel + 1);
            else this.startLevel(this.currentLevel + 1);
        };
    }

    fireLasers() {
        this.lasers.push({ x: this.paddle.x + 6, y: this.paddle.y - 8, vy: -12 });
        this.lasers.push({ x: this.paddle.x + this.paddle.w - 6, y: this.paddle.y - 8, vy: -12 });
        if (window.AudioManager) window.AudioManager.playLaser();
    }

    loop() {
        this.animId = requestAnimationFrame(this.loop);
        if (this.isPaused || !this.ctx) return;

        this.update();
        this.render();
    }

    update() {
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) this.paddle.x -= this.paddle.speed;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) this.paddle.x += this.paddle.speed;

        this.paddle.x = Math.max(8, Math.min(this.canvas.width - this.paddle.w - 8, this.paddle.x));

        for (let i = this.lasers.length - 1; i >= 0; i--) {
            const l = this.lasers[i];
            l.y += l.vy;
            for (let b = this.bricks.length - 1; b >= 0; b--) {
                const br = this.bricks[b];
                if (l.x >= br.x && l.x <= br.x + br.w && l.y >= br.y && l.y <= br.y + br.h) {
                    this.hitBrick(br, b);
                    this.lasers.splice(i, 1);
                    break;
                }
            }
            if (l.y < 0) this.lasers.splice(i, 1);
        }

        for (let i = this.balls.length - 1; i >= 0; i--) {
            const b = this.balls[i];
            b.x += b.vx;
            b.y += b.vy;

            if (b.x - b.radius < 0) { b.x = b.radius; b.vx *= -1; }
            if (b.x + b.radius > this.canvas.width) { b.x = this.canvas.width - b.radius; b.vx *= -1; }
            if (b.y - b.radius < 0) { b.y = b.radius; b.vy *= -1; }

            // Paddle bounce
            if (b.y + b.radius >= this.paddle.y && b.y - b.radius <= this.paddle.y + this.paddle.h) {
                if (b.x >= this.paddle.x && b.x <= this.paddle.x + this.paddle.w) {
                    const hit = (b.x - (this.paddle.x + this.paddle.w / 2)) / (this.paddle.w / 2);
                    const spd = Math.hypot(b.vx, b.vy);
                    b.vx = hit * spd * 0.9;
                    b.vy = -Math.abs(b.vy);
                    if (window.AudioManager) window.AudioManager.playClick();
                }
            }

            // Brick collision
            for (let idx = this.bricks.length - 1; idx >= 0; idx--) {
                const br = this.bricks[idx];
                if (b.x + b.radius > br.x && b.x - b.radius < br.x + br.w &&
                    b.y + b.radius > br.y && b.y - b.radius < br.y + br.h) {
                    if (!b.isFireball) b.vy *= -1;
                    this.hitBrick(br, idx);
                    break;
                }
            }

            if (b.y > this.canvas.height) {
                this.balls.splice(i, 1);
            }
        }

        if (this.balls.length === 0) {
            this.lives--;
            this.updateHUD();
            if (window.AudioManager) window.AudioManager.playHit();
            if (this.lives <= 0) {
                alert('Keine Leben mehr! Level wird neu gestartet.');
                this.lives = 3;
                this.startLevel(this.currentLevel);
            } else {
                this.spawnBall();
            }
        }

        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const p = this.powerups[i];
            p.y += 2.2;
            if (p.y >= this.paddle.y && p.y <= this.paddle.y + this.paddle.h &&
                p.x >= this.paddle.x && p.x <= this.paddle.x + this.paddle.w) {
                this.applyPowerup(p.type);
                this.powerups.splice(i, 1);
            } else if (p.y > this.canvas.height) {
                this.powerups.splice(i, 1);
            }
        }

        if (this.bricks.length === 0) {
            this.triggerWin();
        }
    }

    hitBrick(brick, idx) {
        brick.hp--;
        this.score += 20;

        if (brick.hp <= 0) {
            this.bricks.splice(idx, 1);
            if (window.AudioManager) window.AudioManager.playHit();

            if (Math.random() < 0.22) {
                const types = ['multiball', 'laser', 'wide'];
                this.powerups.push({
                    x: brick.x + brick.w / 2,
                    y: brick.y,
                    type: types[Math.floor(Math.random() * types.length)]
                });
            }
        }
        this.updateHUD();
    }

    applyPowerup(type) {
        if (window.AudioManager) window.AudioManager.playPowerup();

        if (type === 'multiball' && this.balls.length > 0) {
            const b = this.balls[0];
            this.balls.push({ x: b.x, y: b.y, vx: -b.vx, vy: b.vy, radius: 5 });
        } else if (type === 'laser') {
            this.paddle.laserMode = true;
        } else if (type === 'wide') {
            this.paddle.w = 140;
            setTimeout(() => this.paddle.w = 90, 8000);
        }
    }

    triggerWin() {
        if (window.AudioManager) window.AudioManager.playWin();
        const winScreen = this.container.querySelector('#bo-win-screen');
        if (winScreen) winScreen.classList.add('active');
    }

    updateHUD() {
        const sEl = this.container.querySelector('#bo-score');
        const lEl = this.container.querySelector('#bo-lives');
        const lvlEl = this.container.querySelector('#bo-lvl');

        if (sEl) sEl.innerText = `${this.score}`;
        if (lEl) lEl.innerText = `${this.lives}`;
        if (lvlEl) lvlEl.innerText = `${this.currentLevel}`;
    }

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Paddle
        ctx.fillStyle = this.paddle.laserMode ? '#ec4899' : '#f4f4f5';
        ctx.beginPath();
        ctx.roundRect(this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h, 4);
        ctx.fill();

        // Bricks
        for (const b of this.bricks) {
            ctx.fillStyle = b.color;
            ctx.fillRect(b.x, b.y, b.w, b.h);
            ctx.strokeStyle = '#18181b';
            ctx.strokeRect(b.x, b.y, b.w, b.h);
        }

        // Balls
        ctx.fillStyle = '#f4f4f5';
        for (const b of this.balls) {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        // Powerups
        for (const p of this.powerups) {
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
            ctx.fill();
        }

        // Lasers
        ctx.fillStyle = '#ec4899';
        for (const l of this.lasers) {
            ctx.fillRect(l.x - 2, l.y, 4, 8);
        }
    }

    pause() { this.isPaused = true; }
    resume() { this.isPaused = false; }
    destroy() {
        if (this.animId) cancelAnimationFrame(this.animId);
        if (this.container) this.container.innerHTML = '';
    }
};
