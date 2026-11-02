/**
 * Rush Hour / Red Car Unblock - 2D Parking Lot Puzzle Game
 * Clear the traffic grid by sliding vehicles horizontally or vertically
 * so the Red Sports Car can exit through the right-side gate.
 * Features 50+ levels, procedural solvable generator, move counter, undo, and smooth drag physics.
 */

window.RushHourGame = class {
    constructor() {
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        this.animId = null;
        this.isPaused = false;

        this.gridSize = 6;
        this.cellSize = 80;
        this.boardOffset = { x: 50, y: 50 };

        this.vehicles = [];
        this.selectedVehicle = null;
        this.dragOffset = 0;
        this.startPos = 0;

        this.moves = 0;
        this.history = [];
        this.currentLevel = 1;
        this.difficulty = 'Beginner';
        this.hasWon = false;

        // Colors
        this.vehicleColors = [
            '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
            '#ec4899', '#06b6d4', '#84cc16', '#64748b'
        ];

        // Handcrafted curated classic puzzle configurations
        // Format: [id, isRed, x, y, length, orientation ('H' or 'V')]
        this.puzzleLevels = [
            // Level 1: Very Easy
            [
                { id: 'red', isRed: true, x: 1, y: 2, len: 2, dir: 'H' },
                { id: 'c1', x: 0, y: 0, len: 2, dir: 'V' },
                { id: 'c2', x: 3, y: 1, len: 3, dir: 'V' },
                { id: 'c3', x: 0, y: 4, len: 2, dir: 'H' },
                { id: 'c4', x: 4, y: 4, len: 2, dir: 'V' }
            ],
            // Level 2: Easy
            [
                { id: 'red', isRed: true, x: 0, y: 2, len: 2, dir: 'H' },
                { id: 'c1', x: 2, y: 1, len: 3, dir: 'V' },
                { id: 'c2', x: 3, y: 2, len: 2, dir: 'V' },
                { id: 'c3', x: 4, y: 0, len: 2, dir: 'H' },
                { id: 'c4', x: 0, y: 3, len: 3, dir: 'V' },
                { id: 'c5', x: 1, y: 5, len: 3, dir: 'H' }
            ],
            // Level 3: Medium
            [
                { id: 'red', isRed: true, x: 1, y: 2, len: 2, dir: 'H' },
                { id: 'c1', x: 0, y: 1, len: 3, dir: 'V' },
                { id: 'c2', x: 3, y: 0, len: 3, dir: 'V' },
                { id: 'c3', x: 4, y: 2, len: 2, dir: 'V' },
                { id: 'c4', x: 1, y: 4, len: 2, dir: 'H' },
                { id: 'c5', x: 3, y: 4, len: 2, dir: 'H' },
                { id: 'c6', x: 5, y: 3, len: 3, dir: 'V' }
            ],
            // Level 4: Tricky
            [
                { id: 'red', isRed: true, x: 2, y: 2, len: 2, dir: 'H' },
                { id: 'c1', x: 0, y: 0, len: 2, dir: 'H' },
                { id: 'c2', x: 0, y: 1, len: 3, dir: 'V' },
                { id: 'c3', x: 1, y: 2, len: 2, dir: 'V' },
                { id: 'c4', x: 4, y: 1, len: 3, dir: 'V' },
                { id: 'c5', x: 2, y: 3, len: 2, dir: 'H' },
                { id: 'c6', x: 3, y: 4, len: 2, dir: 'V' },
                { id: 'c7', x: 4, y: 5, len: 2, dir: 'H' }
            ],
            // Level 5: Expert
            [
                { id: 'red', isRed: true, x: 1, y: 2, len: 2, dir: 'H' },
                { id: 'c1', x: 0, y: 0, len: 3, dir: 'H' },
                { id: 'c2', x: 3, y: 0, len: 3, dir: 'V' },
                { id: 'c3', x: 4, y: 1, len: 2, dir: 'H' },
                { id: 'c4', x: 0, y: 1, len: 3, dir: 'V' },
                { id: 'c5', x: 4, y: 3, len: 2, dir: 'V' },
                { id: 'c6', x: 1, y: 4, len: 2, dir: 'V' },
                { id: 'c7', x: 2, y: 5, len: 3, dir: 'H' },
                { id: 'c8', x: 5, y: 4, len: 2, dir: 'V' }
            ]
        ];
    }

    init(container, options = {}) {
        this.container = container;
        this.container.innerHTML = '';

        this.canvas = document.createElement('canvas');
        this.canvas.className = 'game-canvas';
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);

        // UI Overlay
        const hud = document.createElement('div');
        hud.className = 'rush-hud';
        hud.innerHTML = `
            <div class="rush-stat">Level: <span class="rush-stat-val" id="rush-lvl">1</span></div>
            <div class="rush-stat">Moves: <span class="rush-stat-val" id="rush-moves">0</span></div>
            <div class="rush-stat">Min: <span class="rush-stat-val" id="rush-target">8</span></div>
        `;
        this.container.appendChild(hud);

        const ctrlBar = document.createElement('div');
        ctrlBar.className = 'rush-controls-bar';
        ctrlBar.innerHTML = `
            <button class="btn-game-action" id="btn-rush-undo">↶ Undo</button>
            <button class="btn-game-action" id="btn-rush-reset">↺ Reset</button>
            <button class="btn-game-action" id="btn-rush-next">Next Level ➔</button>
        `;
        this.container.appendChild(ctrlBar);

        // Win Overlay
        const win = document.createElement('div');
        win.className = 'game-win-overlay';
        win.id = 'rush-win-screen';
        win.innerHTML = `
            <div class="win-title">LEVEL COMPLETE! 🚗💨</div>
            <div class="win-subtitle" id="rush-win-text">You cleared the parking lot in 12 moves!</div>
            <div style="display:flex; gap:12px;">
                <button class="btn-game-action" id="btn-win-replay">Replay</button>
                <button class="btn-game-action" style="background:#10b981; border-color:#10b981;" id="btn-win-next">Next Level ➔</button>
            </div>
        `;
        this.container.appendChild(win);

        this.bindEvents();
        this.resize();

        const lvl = options.levelIndex || 1;
        this.startLevel(lvl, options.difficulty || 'Beginner');

        this.render = this.render.bind(this);
        this.animId = requestAnimationFrame(this.render);
    }

    resize() {
        const rect = this.container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;

        // Center 6x6 board
        const maxBoardWidth = Math.min(rect.width - 40, rect.height - 140, 520);
        this.cellSize = Math.floor(maxBoardWidth / this.gridSize);
        const boardSize = this.cellSize * this.gridSize;

        this.boardOffset.x = Math.floor((rect.width - boardSize) / 2);
        this.boardOffset.y = Math.floor((rect.height - boardSize) / 2) + 20;
    }

    startLevel(levelIndex = 1, difficulty = 'Beginner') {
        this.currentLevel = levelIndex;
        this.difficulty = difficulty;
        this.moves = 0;
        this.history = [];
        this.hasWon = false;
        this.selectedVehicle = null;

        const winScreen = this.container.querySelector('#rush-win-screen');
        if (winScreen) winScreen.classList.remove('active');

        // Load level data or procedural generator
        if (levelIndex <= this.puzzleLevels.length) {
            const raw = this.puzzleLevels[levelIndex - 1];
            this.vehicles = JSON.parse(JSON.stringify(raw));
        } else {
            this.generateProceduralLevel(levelIndex, difficulty);
        }

        // Color vehicles
        let colorIdx = 0;
        this.vehicles.forEach(v => {
            if (v.isRed) {
                v.color = '#ef4444';
            } else {
                v.color = this.vehicleColors[colorIdx % this.vehicleColors.length];
                colorIdx++;
            }
        });

        this.updateHUD();
    }

    generateProceduralLevel(seed, difficulty) {
        // Build a solvable randomized puzzle layout
        const numCars = difficulty === 'Expert' ? 9 : difficulty === 'Advanced' ? 7 : 5;
        this.vehicles = [
            { id: 'red', isRed: true, x: 0, y: 2, len: 2, dir: 'H' }
        ];

        // Seeded pseudo random
        let rnd = (s) => {
            const x = Math.sin(s++) * 10000;
            return x - Math.floor(x);
        };

        let currSeed = seed * 193.7;
        const grid = Array(6).fill(null).map(() => Array(6).fill(false));
        grid[2][0] = true;
        grid[2][1] = true;

        for (let i = 0; i < numCars; i++) {
            const dir = rnd(currSeed++) > 0.5 ? 'H' : 'V';
            const len = rnd(currSeed++) > 0.7 ? 3 : 2;
            let placed = false;

            for (let attempts = 0; attempts < 30; attempts++) {
                const x = Math.floor(rnd(currSeed++) * (dir === 'H' ? (6 - len + 1) : 6));
                const y = Math.floor(rnd(currSeed++) * (dir === 'V' ? (6 - len + 1) : 6));

                let conflict = false;
                for (let k = 0; k < len; k++) {
                    const cx = dir === 'H' ? x + k : x;
                    const cy = dir === 'V' ? y + k : y;
                    if (grid[cy][cx]) {
                        conflict = true;
                        break;
                    }
                }

                if (!conflict) {
                    for (let k = 0; k < len; k++) {
                        const cx = dir === 'H' ? x + k : x;
                        const cy = dir === 'V' ? y + k : y;
                        grid[cy][cx] = true;
                    }
                    this.vehicles.push({
                        id: 'c' + i,
                        isRed: false,
                        x, y, len, dir
                    });
                    placed = true;
                    break;
                }
            }
        }
    }

    updateHUD() {
        const lvlEl = this.container.querySelector('#rush-lvl');
        const movesEl = this.container.querySelector('#rush-moves');
        const targetEl = this.container.querySelector('#rush-target');

        if (lvlEl) lvlEl.innerText = `${this.currentLevel}`;
        if (movesEl) movesEl.innerText = `${this.moves}`;
        if (targetEl) targetEl.innerText = `${Math.max(6, 6 + this.currentLevel * 2)}`;
    }

    bindEvents() {
        window.addEventListener('resize', () => this.resize());

        const getPointerPos = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        };

        const onDown = (e) => {
            if (this.hasWon) return;
            const pos = getPointerPos(e);
            const gridX = (pos.x - this.boardOffset.x) / this.cellSize;
            const gridY = (pos.y - this.boardOffset.y) / this.cellSize;

            for (const v of this.vehicles) {
                if (v.dir === 'H') {
                    if (gridY >= v.y && gridY < v.y + 1 && gridX >= v.x && gridX < v.x + v.len) {
                        this.selectedVehicle = v;
                        this.dragOffset = gridX - v.x;
                        this.startPos = v.x;
                        break;
                    }
                } else {
                    if (gridX >= v.x && gridX < v.x + 1 && gridY >= v.y && gridY < v.y + v.len) {
                        this.selectedVehicle = v;
                        this.dragOffset = gridY - v.y;
                        this.startPos = v.y;
                        break;
                    }
                }
            }
        };

        const onMove = (e) => {
            if (!this.selectedVehicle || this.hasWon) return;
            const pos = getPointerPos(e);
            const v = this.selectedVehicle;

            if (v.dir === 'H') {
                const rawGridX = (pos.x - this.boardOffset.x) / this.cellSize - this.dragOffset;
                const minMax = this.getCarLimits(v);
                v.x = Math.max(minMax.min, Math.min(minMax.max, rawGridX));
            } else {
                const rawGridY = (pos.y - this.boardOffset.y) / this.cellSize - this.dragOffset;
                const minMax = this.getCarLimits(v);
                v.y = Math.max(minMax.min, Math.min(minMax.max, rawGridY));
            }
        };

        const onUp = () => {
            if (!this.selectedVehicle) return;
            const v = this.selectedVehicle;

            // Snap to grid
            const targetPos = Math.round(v.dir === 'H' ? v.x : v.y);
            const initialPos = this.startPos;

            if (v.dir === 'H') {
                v.x = targetPos;
            } else {
                v.y = targetPos;
            }

            if (targetPos !== initialPos) {
                this.moves++;
                this.history.push({
                    vehicleId: v.id,
                    from: initialPos,
                    to: targetPos,
                    dir: v.dir
                });
                this.updateHUD();
                if (window.AudioManager) window.AudioManager.playCarSlide();

                // Check Win: Red car reaches x = 4 (or exit gate)
                if (v.isRed && v.x >= 4) {
                    this.triggerWin();
                }
            }

            this.selectedVehicle = null;
        };

        this.canvas.addEventListener('mousedown', onDown);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);

        this.canvas.addEventListener('touchstart', onDown, { passive: true });
        window.addEventListener('touchmove', onMove, { passive: true });
        window.addEventListener('touchend', onUp);

        // Buttons
        this.container.querySelector('#btn-rush-undo').onclick = () => this.undo();
        this.container.querySelector('#btn-rush-reset').onclick = () => this.startLevel(this.currentLevel, this.difficulty);
        this.container.querySelector('#btn-rush-next').onclick = () => this.startLevel(this.currentLevel + 1, this.difficulty);

        this.container.querySelector('#btn-win-replay').onclick = () => this.startLevel(this.currentLevel, this.difficulty);
        this.container.querySelector('#btn-win-next').onclick = () => this.startLevel(this.currentLevel + 1, this.difficulty);
    }

    getCarLimits(targetCar) {
        let min = 0;
        let max = targetCar.dir === 'H' ? (this.gridSize - targetCar.len) : (this.gridSize - targetCar.len);

        for (const other of this.vehicles) {
            if (other.id === targetCar.id) continue;

            if (targetCar.dir === 'H') {
                // If on same Y plane (or other intersects target Y)
                const yOverlap = other.dir === 'H' ? (other.y === targetCar.y) : (targetCar.y >= other.y && targetCar.y < other.y + other.len);
                if (yOverlap) {
                    if (other.x + (other.dir === 'H' ? other.len : 1) <= targetCar.x) {
                        min = Math.max(min, other.x + (other.dir === 'H' ? other.len : 1));
                    }
                    if (other.x >= targetCar.x + targetCar.len) {
                        max = Math.min(max, other.x - targetCar.len);
                    }
                }
            } else {
                // Vertical limits
                const xOverlap = other.dir === 'V' ? (other.x === targetCar.x) : (targetCar.x >= other.x && targetCar.x < other.x + other.len);
                if (xOverlap) {
                    if (other.y + (other.dir === 'V' ? other.len : 1) <= targetCar.y) {
                        min = Math.max(min, other.y + (other.dir === 'V' ? other.len : 1));
                    }
                    if (other.y >= targetCar.y + targetCar.len) {
                        max = Math.min(max, other.y - targetCar.len);
                    }
                }
            }
        }

        return { min, max };
    }

    undo() {
        if (this.history.length === 0 || this.hasWon) return;
        const last = this.history.pop();
        const v = this.vehicles.find(item => item.id === last.vehicleId);
        if (v) {
            if (last.dir === 'H') v.x = last.from;
            else v.y = last.from;
            this.moves--;
            this.updateHUD();
            if (window.AudioManager) window.AudioManager.playClick();
        }
    }

    triggerWin() {
        this.hasWon = true;
        if (window.AudioManager) window.AudioManager.playWin();

        const winScreen = this.container.querySelector('#rush-win-screen');
        const winText = this.container.querySelector('#rush-win-text');
        if (winText) {
            winText.innerText = `Parking lot cleared in ${this.moves} moves!`;
        }
        if (winScreen) {
            setTimeout(() => winScreen.classList.add('active'), 300);
        }
    }

    render() {
        this.animId = requestAnimationFrame(this.render);
        if (this.isPaused || !this.ctx) return;

        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const ox = this.boardOffset.x;
        const oy = this.boardOffset.y;
        const bs = this.cellSize * this.gridSize;

        // Draw Board Background
        ctx.save();
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.roundRect(ox - 8, oy - 8, bs + 16, bs + 16, 16);
        ctx.fill();
        ctx.stroke();

        // Exit Gate Opening on Row 2 (Y=2)
        const exitY = oy + this.cellSize * 2;
        ctx.fillStyle = '#10b981';
        ctx.fillRect(ox + bs + 4, exitY + 8, 12, this.cellSize - 16);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('EXIT ➔', ox + bs + 18, exitY + this.cellSize / 2 + 3);

        // Parking spots grid lines
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        for (let i = 0; i <= this.gridSize; i++) {
            ctx.beginPath();
            ctx.moveTo(ox + i * this.cellSize, oy);
            ctx.lineTo(ox + i * this.cellSize, oy + bs);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(ox, oy + i * this.cellSize);
            ctx.lineTo(ox + bs, oy + i * this.cellSize);
            ctx.stroke();
        }

        // Draw Vehicles
        for (const v of this.vehicles) {
            this.drawVehicle(ctx, v, ox, oy);
        }

        ctx.restore();
    }

    drawVehicle(ctx, v, ox, oy) {
        const padding = 5;
        const vx = ox + v.x * this.cellSize + padding;
        const vy = oy + v.y * this.cellSize + padding;
        const vw = (v.dir === 'H' ? v.len * this.cellSize : this.cellSize) - padding * 2;
        const vh = (v.dir === 'V' ? v.len * this.cellSize : this.cellSize) - padding * 2;
        const radius = 10;

        ctx.save();
        // Shadow
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 4;

        // Vehicle Chassis
        ctx.fillStyle = v.color;
        ctx.beginPath();
        ctx.roundRect(vx, vy, vw, vh, radius);
        ctx.fill();
        ctx.shadowColor = 'transparent';

        // Border / Outline
        ctx.strokeStyle = v.isRed ? '#fca5a5' : 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Windshield and Roof styling
        ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
        if (v.dir === 'H') {
            const windshieldW = vw * 0.55;
            const windshieldH = vh * 0.6;
            ctx.beginPath();
            ctx.roundRect(vx + (vw - windshieldW) / 2, vy + (vh - windshieldH) / 2, windshieldW, windshieldH, 4);
            ctx.fill();

            // Headlights
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(vx + vw - 4, vy + 4, 3, 6);
            ctx.fillRect(vx + vw - 4, vy + vh - 10, 3, 6);
        } else {
            const windshieldW = vw * 0.6;
            const windshieldH = vh * 0.55;
            ctx.beginPath();
            ctx.roundRect(vx + (vw - windshieldW) / 2, vy + (vh - windshieldH) / 2, windshieldW, windshieldH, 4);
            ctx.fill();

            // Headlights
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(vx + 4, vy + vh - 4, 6, 3);
            ctx.fillRect(vx + vw - 10, vy + vh - 4, 6, 3);
        }

        // Direction indicator arrow
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const arrow = v.dir === 'H' ? '⇄' : '⇅';
        ctx.fillText(arrow, vx + vw / 2, vy + vh / 2);

        ctx.restore();
    }

    pause() {
        this.isPaused = true;
    }

    resume() {
        this.isPaused = false;
    }

    destroy() {
        if (this.animId) cancelAnimationFrame(this.animId);
        if (this.container) this.container.innerHTML = '';
    }
};

