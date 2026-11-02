/**
 * Hexa & Classic Minesweeper Deluxe
 * Features fair first-click guarantee, dual grid modes (Classic Square & Hexagonal),
 * chording, flagging, timer, customizable difficulties and procedural board generations.
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

        this.grid = []; // { isMine, isRevealed, isFlagged, count }
        this.firstClick = true;
        this.gameOver = false;
        this.hasWon = false;

        this.flagCount = 0;
        this.startTime = 0;
        this.elapsed = 0;
        this.currentLevel = 1;
        this.difficulty = 'Beginner';

        this.cellSize = 36;
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
            <div class="rush-stat">Mines: <span class="rush-stat-val" style="color:#ef4444;" id="ms-mines">10</span></div>
            <div class="rush-stat">Time: <span class="rush-stat-val" style="font-family:monospace;" id="ms-time">000</span></div>
            <button class="btn-game-action" id="btn-ms-mode">Mode: Square</button>
            <button class="btn-game-action" id="btn-ms-reset">↺ Reset</button>
        `;
        this.container.appendChild(hud);

        const win = document.createElement('div');
        win.className = 'game-win-overlay';
        win.id = 'ms-win-screen';
        win.innerHTML = `
            <div class="win-title">FIELD CLEARED! 🚩</div>
            <div class="win-subtitle" id="ms-win-sub">All mines safely disarmed!</div>
            <div style="display:flex; gap:12px;">
                <button class="btn-game-action" id="btn-ms-replay">Play Again</button>
                <button class="btn-game-action" style="background:#10b981; border-color:#10b981;" id="btn-ms-next">Next Level ➔</button>
            </div>
        `;
        this.container.appendChild(win);

        this.bindEvents();
        this.resize();

        const lvl = options.levelIndex || 1;
        this.startLevel(lvl, options.difficulty || 'Beginner');

        this.loop = this.loop.bind(this);
        this.animId = requestAnimationFrame(this.loop);
    }

    resize() {
        const rect = this.container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;

        this.boardOffset.x = Math.max(20, Math.floor((rect.width - this.cols * this.cellSize) / 2));
        this.boardOffset.y = Math.max(60, Math.floor((rect.height - this.rows * this.cellSize) / 2) + 15);
    }

    startLevel(levelIndex = 1, difficulty = 'Beginner') {
        this.currentLevel = levelIndex;
        this.difficulty = difficulty;

        if (levelIndex === 1) {
            this.rows = 9; this.cols = 9; this.totalMines = 10; this.isHex = false;
        } else if (levelIndex === 2) {
            this.rows = 12; this.cols = 12; this.totalMines = 20; this.isHex = false;
        } else if (levelIndex === 3) {
            this.rows = 16; this.cols = 16; this.totalMines = 40; this.isHex = false;
        } else if (levelIndex === 4) {
            // Hexagonal Mode!
            this.rows = 10; this.cols = 10; this.totalMines = 16; this.isHex = true;
        } else {
            this.rows = 14; this.cols = 14; this.totalMines = 32; this.isHex = true;
        }

        const modeBtn = this.container.querySelector('#btn-ms-mode');
        if (modeBtn) modeBtn.innerText = this.isHex ? 'Mode: Hexagon' : 'Mode: Square';

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

            // Keep initial click and immediate neighbors mine-free
            if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
            if (!this.grid[r][c].isMine) {
                this.grid[r][c].isMine = true;
                placed++;
            }
        }

        // Compute neighbor counts
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
            // 8 neighbors
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
            // 6 hex neighbors (offset coordinates)
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
            const clickX = e.clientX - rect.left - this.boardOffset.x;
            const clickY = e.clientY - rect.top - this.boardOffset.y;

            const col = Math.floor(clickX / this.cellSize);
            const row = Math.floor(clickY / this.cellSize);

            if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
                if (e.button === 2) {
                    // Right click = Flag
                    this.toggleFlag(row, col);
                } else if (e.button === 0) {
                    // Left click = Reveal / Chord
                    this.handleClick(row, col);
                }
            }
        });

        this.container.querySelector('#btn-ms-reset').onclick = () => this.startLevel(this.currentLevel, this.difficulty);
        this.container.querySelector('#btn-ms-mode').onclick = () => {
            this.isHex = !this.isHex;
            this.startLevel(this.isHex ? 4 : 1, this.difficulty);
        };
        this.container.querySelector('#btn-ms-replay').onclick = () => this.startLevel(this.currentLevel, this.difficulty);
        this.container.querySelector('#btn-ms-next').onclick = () => this.startLevel(this.currentLevel + 1, this.difficulty);
    }

    handleClick(r, c) {
        const cell = this.grid[r][c];
        if (cell.isFlagged) return;

        if (this.firstClick) {
            this.firstClick = false;
            this.populateMines(r, c);
        }

        if (cell.isRevealed) {
            // Chording: if flags equal neighbor count, reveal others
            const nbs = this.getNeighbors(r, c);
            const flaggedCount = nbs.filter(nb => this.grid[nb.r][nb.c].isFlagged).length;
            if (flaggedCount === cell.count) {
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
            // Hit a mine!
            this.triggerGameOver();
            return;
        }

        if (window.AudioManager) window.AudioManager.playClick();

        // Flood fill zeros
        if (cell.count === 0) {
            this.getNeighbors(r, c).forEach(nb => {
                this.revealCell(nb.r, nb.c);
            });
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
        let unrevealedNonMines = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (!this.grid[r][c].isMine && !this.grid[r][c].isRevealed) {
                    unrevealedNonMines++;
                }
            }
        }

        if (unrevealedNonMines === 0 && !this.gameOver) {
            this.triggerWin();
        }
    }

    triggerGameOver() {
        this.gameOver = true;
        if (window.AudioManager) window.AudioManager.playExplosion();

        // Reveal all mines
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

        if (!this.gameOver && !this.hasWon && !this.firstClick) {
            this.updateHUD();
        }
        this.render();
    }

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const cs = this.cellSize;
        const ox = this.boardOffset.x;
        const oy = this.boardOffset.y;

        const numColors = [
            '#3b82f6', '#10b981', '#ef4444', '#8b5cf6',
            '#f59e0b', '#06b6d4', '#e11d48', '#ffffff'
        ];

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = this.grid[r][c];
                const x = ox + c * cs + (this.isHex && (r % 2 === 1) ? cs * 0.5 : 0);
                const y = oy + r * cs;

                if (cell.isRevealed) {
                    ctx.fillStyle = cell.isMine ? '#dc2626' : '#1e293b';
                    ctx.fillRect(x, y, cs - 2, cs - 2);

                    if (cell.isMine) {
                        ctx.fillStyle = '#fff';
                        ctx.font = 'bold 16px sans-serif';
                        ctx.fillText('💣', x + cs * 0.2, y + cs * 0.7);
                    } else if (cell.count > 0) {
                        ctx.fillStyle = numColors[cell.count - 1];
                        ctx.font = 'bold 16px sans-serif';
                        ctx.fillText(`${cell.count}`, x + cs * 0.35, y + cs * 0.7);
                    }
                } else {
                    ctx.fillStyle = '#334155';
                    ctx.fillRect(x, y, cs - 2, cs - 2);

                    if (cell.isFlagged) {
                        ctx.fillStyle = '#ef4444';
                        ctx.font = 'bold 16px sans-serif';
                        ctx.fillText('🚩', x + cs * 0.2, y + cs * 0.7);
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

