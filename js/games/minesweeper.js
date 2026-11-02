/**
 * Hexa & Classic Minesweeper Deluxe
 * Levels 1 - 100+ with fair first-click guarantee, dual grid modes,
 * progressive grid scaling and mine percentage.
 */

window.MinesweeperGame = class {
    constructor() {
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        this.animId = null;
        this.isPaused = false;

        this.rows = 9;
        this.cols = 9;
        this.totalMines = 10;
        this.isHex = false;

        this.grid = [];
        this.firstClick = true;
        this.gameOver = false;
        this.hasWon = false;

        this.flagCount = 0;
        this.startTime = 0;
        this.elapsed = 0;
        this.currentLevel = 1;

        this.cellSize = 34;
        this.boardOffset = { x: 50, y: 70 };
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
            <div class="rush-stat">Minen: <span class="rush-stat-val" style="color:#ef4444;" id="ms-mines">10</span></div>
            <div class="rush-stat">Zeit: <span class="rush-stat-val" style="font-family:monospace;" id="ms-time">000</span></div>
            <button class="btn-game-action" id="btn-ms-mode">Modus: Quadrat</button>
            <button class="btn-game-action" id="btn-ms-reset">↺ Reset</button>
        `;
        this.container.appendChild(hud);

        const win = document.createElement('div');
        win.className = 'game-win-overlay';
        win.id = 'ms-win-screen';
        win.innerHTML = `
            <div class="win-title">MINENFELD GERÄUMT!</div>
            <div class="win-subtitle" id="ms-win-sub">Alle Minen entschärft.</div>
            <div style="display:flex; gap:8px;">
                <button class="btn-game-action" id="btn-ms-replay">Wiederholen</button>
                <button class="btn-game-action" style="background:#2563eb; color:#fff;" id="btn-ms-next">Nächstes Level ➔</button>
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

        this.cellSize = Math.max(22, Math.min(38, Math.floor((h - 120) / this.rows)));
        this.boardOffset.x = Math.max(16, Math.floor((w - this.cols * this.cellSize) / 2));
        this.boardOffset.y = Math.max(50, Math.floor((h - this.rows * this.cellSize) / 2) + 15);
    }

    startLevel(levelIndex = 1) {
        this.currentLevel = levelIndex;

        // Scaling rows, cols, and mine density from level 1 to 100+
        const baseSize = 8 + Math.min(12, Math.floor(levelIndex / 4));
        this.rows = baseSize;
        this.cols = Math.min(22, baseSize + Math.floor(levelIndex / 8));
        this.isHex = (levelIndex % 3 === 0);

        const density = 0.12 + Math.min(0.10, levelIndex * 0.003);
        this.totalMines = Math.max(6, Math.floor(this.rows * this.cols * density));

        const modeBtn = this.container.querySelector('#btn-ms-mode');
        if (modeBtn) modeBtn.innerText = this.isHex ? 'Modus: Hexagon' : 'Modus: Quadrat';

        this.firstClick = true;
        this.gameOver = false;
        this.hasWon = false;
        this.flagCount = 0;
        this.startTime = performance.now();
        this.elapsed = 0;

        const winScreen = this.container.querySelector('#ms-win-screen');
        if (winScreen) winScreen.classList.remove('active');

        this.initGrid();
        this.resize();
        this.updateHUD();
    }

    initGrid() {
        this.grid = [];
        for (let r = 0; r < this.rows; r++) {
            const row = [];
            for (let c = 0; c < this.cols; c++) {
                row.push({
                    isMine: false,
                    isRevealed: false,
                    isFlagged: false,
                    count: 0
                });
            }
            this.grid.push(row);
        }
    }

    populateMines(safeR, safeC) {
        let placed = 0;
        while (placed < this.totalMines) {
            const r = Math.floor(Math.random() * this.rows);
            const c = Math.floor(Math.random() * this.cols);

            if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
            if (!this.grid[r][c].isMine) {
                this.grid[r][c].isMine = true;
                placed++;
            }
        }

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (!this.grid[r][c].isMine) {
                    this.grid[r][c].count = this.getNeighbors(r, c).filter(nb => this.grid[nb.r][nb.c].isMine).length;
                }
            }
        }
    }

    getNeighbors(r, c) {
        const neighbors = [];
        if (!this.isHex) {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const nr = r + dr;
                    const nc = c + dc;
                    if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                        neighbors.push({ r: nr, c: nc });
                    }
                }
            }
        } else {
            const isOffset = (r % 2 === 1);
            const deltas = isOffset
                ? [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]]
                : [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]];

            for (const [dr, dc] of deltas) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                    neighbors.push({ r: nr, c: nc });
                }
            }
        }
        return neighbors;
    }

    bindEvents() {
        window.addEventListener('resize', () => this.resize());
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        this.canvas.addEventListener('mousedown', (e) => {
            if (this.gameOver || this.hasWon) return;

            const rect = this.canvas.getBoundingClientRect();
            const cx = e.clientX - rect.left - this.boardOffset.x;
            const cy = e.clientY - rect.top - this.boardOffset.y;

            const col = Math.floor(cx / this.cellSize);
            const row = Math.floor(cy / this.cellSize);

            if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
                if (e.button === 2) this.toggleFlag(row, col);
                else if (e.button === 0) this.handleClick(row, col);
            }
        });

        this.container.querySelector('#btn-ms-reset').onclick = () => this.startLevel(this.currentLevel);
        this.container.querySelector('#btn-ms-mode').onclick = () => {
            this.isHex = !this.isHex;
            const btn = this.container.querySelector('#btn-ms-mode');
            if (btn) btn.innerText = this.isHex ? 'Modus: Hexagon' : 'Modus: Quadrat';
            this.startLevel(this.currentLevel);
        };
        this.container.querySelector('#btn-ms-replay').onclick = () => this.startLevel(this.currentLevel);
        this.container.querySelector('#btn-ms-next').onclick = () => {
            if (window.portal) window.portal.launchGame('minesweeper', this.currentLevel + 1);
            else this.startLevel(this.currentLevel + 1);
        };
    }

    handleClick(r, c) {
        const cell = this.grid[r][c];
        if (cell.isFlagged) return;

        if (this.firstClick) {
            this.firstClick = false;
            this.populateMines(r, c);
        }

        if (cell.isRevealed) {
            const nbs = this.getNeighbors(r, c);
            const flagged = nbs.filter(nb => this.grid[nb.r][nb.c].isFlagged).length;
            if (flagged === cell.count) {
                nbs.forEach(nb => {
                    if (!this.grid[nb.r][nb.c].isRevealed && !this.grid[nb.r][nb.c].isFlagged) {
                        this.revealCell(nb.r, nb.c);
                    }
                });
            }
        } else {
            this.revealCell(r, c);
        }
        this.checkWinCondition();
    }

    revealCell(r, c) {
        const cell = this.grid[r][c];
        if (cell.isRevealed || cell.isFlagged) return;

        cell.isRevealed = true;
        if (cell.isMine) {
            this.triggerGameOver();
            return;
        }

        if (window.AudioManager) window.AudioManager.playClick();

        if (cell.count === 0) {
            this.getNeighbors(r, c).forEach(nb => this.revealCell(nb.r, nb.c));
        }
    }

    toggleFlag(r, c) {
        const cell = this.grid[r][c];
        if (cell.isRevealed) return;

        cell.isFlagged = !cell.isFlagged;
        this.flagCount += (cell.isFlagged ? 1 : -1);
        this.updateHUD();
        if (window.AudioManager) window.AudioManager.playDigBlock();
    }

    checkWinCondition() {
        let unrevealed = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (!this.grid[r][c].isMine && !this.grid[r][c].isRevealed) unrevealed++;
            }
        }
        if (unrevealed === 0 && !this.gameOver) {
            this.triggerWin();
        }
    }

    triggerGameOver() {
        this.gameOver = true;
        if (window.AudioManager) window.AudioManager.playExplosion();
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c].isMine) this.grid[r][c].isRevealed = true;
            }
        }
    }

    triggerWin() {
        this.hasWon = true;
        if (window.AudioManager) window.AudioManager.playWin();
        const winScreen = this.container.querySelector('#ms-win-screen');
        if (winScreen) winScreen.classList.add('active');
    }

    updateHUD() {
        const mEl = this.container.querySelector('#ms-mines');
        const tEl = this.container.querySelector('#ms-time');
        if (mEl) mEl.innerText = `${Math.max(0, this.totalMines - this.flagCount)}`;
        if (tEl && !this.gameOver && !this.hasWon) {
            this.elapsed = Math.floor((performance.now() - this.startTime) / 1000);
            tEl.innerText = `${this.elapsed.toString().padStart(3, '0')}`;
        }
    }

    loop() {
        this.animId = requestAnimationFrame(this.loop);
        if (this.isPaused || !this.ctx) return;
        if (!this.gameOver && !this.hasWon && !this.firstClick) this.updateHUD();
        this.render();
    }

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const cs = this.cellSize;
        const ox = this.boardOffset.x;
        const oy = this.boardOffset.y;

        const numColors = ['#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899', '#ffffff'];

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = this.grid[r][c];
                const x = ox + c * cs + (this.isHex && (r % 2 === 1) ? cs * 0.5 : 0);
                const y = oy + r * cs;

                if (cell.isRevealed) {
                    ctx.fillStyle = cell.isMine ? '#dc2626' : '#18181b';
                    ctx.fillRect(x, y, cs - 2, cs - 2);

                    if (cell.isMine) {
                        ctx.fillStyle = '#f4f4f5';
                        ctx.font = '12px monospace';
                        ctx.fillText('💣', x + cs * 0.25, y + cs * 0.7);
                    } else if (cell.count > 0) {
                        ctx.fillStyle = numColors[cell.count - 1];
                        ctx.font = 'bold 13px monospace';
                        ctx.fillText(`${cell.count}`, x + cs * 0.35, y + cs * 0.7);
                    }
                } else {
                    ctx.fillStyle = '#27272a';
                    ctx.fillRect(x, y, cs - 2, cs - 2);

                    if (cell.isFlagged) {
                        ctx.fillStyle = '#ef4444';
                        ctx.font = '12px monospace';
                        ctx.fillText('⚑', x + cs * 0.3, y + cs * 0.7);
                    }
                }
            }
        }
    }

    pause() { this.isPaused = true; }
    resume() { this.isPaused = false; }
    destroy() {
        if (this.animId) cancelAnimationFrame(this.animId);
        if (this.container) this.container.innerHTML = '';
    }
};
