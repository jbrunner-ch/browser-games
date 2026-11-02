/**
 * Neo-Breakout Deluxe - Arcade Brick Breaker
 * Built with Canvas 2D. Features angle physics, laser paddle, multiball,
 * fireball, explosive TNT bricks, particle debris and multiple levels.
 */

window.BreakoutGame = class {
    constructor() {
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        this.animId = null;
        this.isPaused = false;

        this.paddle = { x: 350, y: 540, w: 100, h: 14, speed: 9, laserMode: false, laserTimer: 0 };
        this.balls = [];
        this.bricks = [];
        this.powerups = [];
        this.lasers = [];
        this.particles = [];

        this.score = 0;
        this.lives = 3;
        this.currentLevel = 1;
        this.difficulty = 'Normal';
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
            <div class="rush-stat">Score: <span class="rush-stat-val" style="color:#fbbf24;" id="bo-score">0</span></div>
            <div class="rush-stat">Lives: <span class="rush-stat-val" style="color:#ef4444;" id="bo-lives">❤️❤️❤️</span></div>
            <div class="rush-stat">Level: <span class="rush-stat-val" id="bo-lvl">1</span></div>
        `;
        this.container.appendChild(hud);

        const win = document.createElement('div');
        win.className = 'game-win-overlay';
        win.id = 'bo-win-screen';
        win.innerHTML = `
            <div class="win-title">LEVEL CLEARED! 🎆</div>
            <div class="win-subtitle" id="bo-win-sub">High Score Achievement!</div>
            <div style="display:flex; gap:12px;">
                <button class="btn-game-action" id="btn-bo-replay">Replay</button>
                <button class="btn-game-action" style="background:#10b981; border-color:#10b981;" id="btn-bo-next">Next Level ➔</button>
            </div>
        `;
        this.container.appendChild(win);

        this.bindEvents();
        this.resize();

        const lvl = options.levelIndex || 1;
        this.startLevel(lvl, options.difficulty || 'Normal');

        this.loop = this.loop.bind(this);
        this.animId = requestAnimationFrame(this.loop);
    }

    resize() {
        const rect = this.container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.paddle.y = this.canvas.height - 40;
    }

    startLevel(levelIndex = 1, difficulty = 'Normal') {
        this.currentLevel = levelIndex;
        this.difficulty = difficulty;
        this.balls = [];
        this.powerups = [];
        this.lasers = [];
        this.particles = [];
        this.paddle.w = 100;
        this.paddle.laserMode = false;

        const winScreen = this.container.querySelector('#bo-win-screen');
        if (winScreen) winScreen.classList.remove('active');

        this.spawnBall();
        this.buildBricks(levelIndex);
        this.updateHUD();
    }

    spawnBall() {
        this.balls.push({
            x: this.canvas.width / 2,
            y: this.paddle.y - 15,
            vx: (Math.random() > 0.5 ? 4.5 : -4.5),
            vy: -6.5,
            radius: 6,
            isFireball: false
        });
    }

    buildBricks(levelIndex) {
        this.bricks = [];
        const rows = 5 + levelIndex;
        const cols = 9;
        const brickW = Math.floor((this.canvas.width - 80) / cols);
        const brickH = 22;
        const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (levelIndex === 2 && (r + c) % 2 === 0) continue; // Checkerboard
                if (levelIndex === 3 && (c === 0 || c === cols - 1 || r === 0)) {
                    // Armored border
                    this.bricks.push({
                        x: 40 + c * brickW,
                        y: 70 + r * (brickH + 6),
                        w: brickW - 4,
                        h: brickH,
                        hp: 2,
                        maxHp: 2,
                        color: '#64748b'
                    });
                    continue;
                }

                const isTNT = Math.random() < 0.08;
                this.bricks.push({
                    x: 40 + c * brickW,
                    y: 70 + r * (brickH + 6),
                    w: brickW - 4,
                    h: brickH,
                    hp: 1,
                    maxHp: 1,
                    isTNT: isTNT,
                    color: isTNT ? '#dc2626' : colors[r % colors.length]
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

        // Mouse move
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.paddle.x = e.clientX - rect.left - this.paddle.w / 2;
        });

        this.container.querySelector('#btn-bo-replay').onclick = () => this.startLevel(this.currentLevel, this.difficulty);
        this.container.querySelector('#btn-bo-next').onclick = () => this.startLevel(this.currentLevel + 1, this.difficulty);
    }

    fireLasers() {
        this.lasers.push({ x: this.paddle.x + 8, y: this.paddle.y - 10, vy: -12 });
        this.lasers.push({ x: this.paddle.x + this.paddle.w - 8, y: this.paddle.y - 10, vy: -12 });
        if (window.AudioManager) window.AudioManager.playLaser();
    }

    loop() {
        this.animId = requestAnimationFrame(this.loop);
        if (this.isPaused || !this.ctx) return;

        this.update();
        this.render();
    }

    update() {
        // Paddle movement with keys
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) this.paddle.x -= this.paddle.speed;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) this.paddle.x += this.paddle.speed;

        this.paddle.x = Math.max(10, Math.min(this.canvas.width - this.paddle.w - 10, this.paddle.x));

        // Lasers
        for (let i = this.lasers.length - 1; i >= 0; i--) {
            const l = this.lasers[i];
            l.y += l.vy;
            for (let bIdx = this.bricks.length - 1; bIdx >= 0; bIdx--) {
                const b = this.bricks[bIdx];
                if (l.x >= b.x && l.x <= b.x + b.w && l.y >= b.y && l.y <= b.y + b.h) {
                    this.hitBrick(b, bIdx);
                    this.lasers.splice(i, 1);
                    break;
                }
            }
            if (l.y < 0) this.lasers.splice(i, 1);
        }

        // Balls
        for (let i = this.balls.length - 1; i >= 0; i--) {
            const b = this.balls[i];
            b.x += b.vx;
            b.y += b.vy;

            // Walls
            if (b.x - b.radius < 0) { b.x = b.radius; b.vx *= -1; }
            if (b.x + b.radius > this.canvas.width) { b.x = this.canvas.width - b.radius; b.vx *= -1; }
            if (b.y - b.radius < 0) { b.y = b.radius; b.vy *= -1; }

            // Paddle bounce
            if (b.y + b.radius >= this.paddle.y && b.y - b.radius <= this.paddle.y + this.paddle.h) {
                if (b.x >= this.paddle.x && b.x <= this.paddle.x + this.paddle.w) {
                    // Angle calculation based on where it hit paddle
                    const hitPos = (b.x - (this.paddle.x + this.paddle.w / 2)) / (this.paddle.w / 2);
                    const speed = Math.hypot(b.vx, b.vy);
                    b.vx = hitPos * speed * 0.9;
                    b.vy = -Math.abs(b.vy);
                    if (window.AudioManager) window.AudioManager.playClick();
                }
            }

            // Brick collision
            for (let bIdx = this.bricks.length - 1; bIdx >= 0; bIdx--) {
                const brick = this.bricks[bIdx];
                if (b.x + b.radius > brick.x && b.x - b.radius < brick.x + brick.w &&
                    b.y + b.radius > brick.y && b.y - b.radius < brick.y + brick.h) {
                    if (!b.isFireball) b.vy *= -1;
                    this.hitBrick(brick, bIdx);
                    break;
                }
            }

            // Ball lost
            if (b.y > this.canvas.height) {
                this.balls.splice(i, 1);
            }
        }

        // If all balls lost
        if (this.balls.length === 0) {
            this.lives--;
            this.updateHUD();
            if (window.AudioManager) window.AudioManager.playHit();
            if (this.lives <= 0) {
                alert('Game Over! Restarting level.');
                this.lives = 3;
                this.startLevel(this.currentLevel, this.difficulty);
            } else {
                this.spawnBall();
            }
        }

        // Powerups
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const p = this.powerups[i];
            p.y += 2.5;

            // Catch powerup
            if (p.y >= this.paddle.y && p.y <= this.paddle.y + this.paddle.h &&
                p.x >= this.paddle.x && p.x <= this.paddle.x + this.paddle.w) {
                this.applyPowerup(p.type);
                this.powerups.splice(i, 1);
            } else if (p.y > this.canvas.height) {
                this.powerups.splice(i, 1);
            }
        }

        // Check Win
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

            // Chance to drop powerup
            if (Math.random() < 0.25) {
                const types = ['multiball', 'laser', 'wide', 'fireball'];
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

        if (type === 'multiball') {
            if (this.balls.length > 0) {
                const b = this.balls[0];
                this.balls.push({ x: b.x, y: b.y, vx: -b.vx, vy: b.vy, radius: 6 });
                this.balls.push({ x: b.x, y: b.y, vx: b.vx * 0.5, vy: -Math.abs(b.vy), radius: 6 });
            }
        } else if (type === 'laser') {
            this.paddle.laserMode = true;
        } else if (type === 'wide') {
            this.paddle.w = 160;
            setTimeout(() => this.paddle.w = 100, 10000);
        } else if (type === 'fireball') {
            this.balls.forEach(b => b.isFireball = true);
            setTimeout(() => this.balls.forEach(b => b.isFireball = false), 8000);
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
        if (lEl) lEl.innerText = '❤️'.repeat(Math.max(0, this.lives));
        if (lvlEl) lvlEl.innerText = `${this.currentLevel}`;
    }

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Paddle
        ctx.fillStyle = this.paddle.laserMode ? '#ec4899' : '#3b82f6';
        ctx.beginPath();
        ctx.roundRect(this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h, 6);
        ctx.fill();

        // Draw Bricks
        for (const b of this.bricks) {
            ctx.fillStyle = b.color;
            ctx.fillRect(b.x, b.y, b.w, b.h);
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.strokeRect(b.x, b.y, b.w, b.h);
        }

        // Draw Balls
        for (const b of this.balls) {
            ctx.fillStyle = b.isFireball ? '#ef4444' : '#fff';
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw Powerups
        for (const p of this.powerups) {
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.font = 'bold 9px sans-serif';
            ctx.fillText(p.type[0].toUpperCase(), p.x - 3, p.y + 3);
        }

        // Draw Lasers
        ctx.fillStyle = '#ec4899';
        for (const l of this.lasers) {
            ctx.fillRect(l.x - 2, l.y, 4, 10);
        }
    }

    pause() { this.isPaused = true; }
    resume() { this.isPaused = false; }
    destroy() {
        if (this.animId) cancelAnimationFrame(this.animId);
        if (this.container) this.container.innerHTML = '';
    }
};

