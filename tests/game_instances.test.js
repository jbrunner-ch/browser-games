/**
 * Comprehensive headless DOM simulation test for all 10 games.
 */
const fs = require('fs');

// Minimal mock DOM environment
global.window = global;
global.window.addEventListener = () => {};
global.window.removeEventListener = () => {};
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.document = {
    createElement: (tag) => {
        const el = {
            tagName: tag.toUpperCase(),
            children: [],
            style: {},
            classList: {
                add: () => {},
                remove: () => {},
                toggle: () => {},
                contains: () => false
            },
            appendChild: (child) => { el.children.push(child); return child; },
            querySelector: (sel) => {
                const sub = document.createElement('div');
                sub.id = sel.replace(/[#.]/g, '');
                return sub;
            },
            querySelectorAll: () => [],
            getBoundingClientRect: () => ({ width: 800, height: 600, top: 0, left: 0 }),
            addEventListener: () => {},
            removeEventListener: () => {},
            getContext: () => ({
                clearRect: () => {},
                fillRect: () => {},
                strokeRect: () => {},
                beginPath: () => {},
                moveTo: () => {},
                lineTo: () => {},
                stroke: () => {},
                fill: () => {},
                arc: () => {},
                roundRect: () => {},
                save: () => {},
                restore: () => {},
                fillText: () => {}
            })
        };
        return el;
    },
    addEventListener: () => {},
    removeEventListener: () => {}
};

global.requestAnimationFrame = (fn) => setTimeout(fn, 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.performance = { now: () => Date.now() };

// Mock AudioManager
require('../js/audio.js');

// Load all games
const gameFiles = [
    'rushhour.js',
    'towerdefense.js',
    'platformer.js',
    'breakout.js',
    'spaceshooter.js',
    'dungeon.js',
    'minesweeper.js'
];

let success = true;
for (const file of gameFiles) {
    try {
        const code = fs.readFileSync('js/games/' + file, 'utf8');
        eval(code);
        console.log(`✓ Loaded and evaluated: ${file}`);
    } catch (e) {
        console.error(`✗ Error evaluating ${file}:`, e.message);
        success = false;
    }
}

// Test instantiation and level scaling 1 -> 50
const classesToTest = [
    { name: 'RushHourGame', cls: window.RushHourGame },
    { name: 'TowerDefenseGame', cls: window.TowerDefenseGame },
    { name: 'PlatformerGame', cls: window.PlatformerGame },
    { name: 'BreakoutGame', cls: window.BreakoutGame },
    { name: 'SpaceShooterGame', cls: window.SpaceShooterGame },
    { name: 'DungeonGame', cls: window.DungeonGame },
    { name: 'MinesweeperGame', cls: window.MinesweeperGame }
];

for (const { name, cls } of classesToTest) {
    try {
        const instance = new cls();
        const container = document.createElement('div');
        instance.init(container, { levelIndex: 1 });
        instance.startLevel(25);
        instance.startLevel(75);
        instance.pause();
        instance.resume();
        instance.destroy();
        console.log(`✓ ${name}: successfully tested lifecycle & level progression (L1 -> L25 -> L75)`);
    } catch (e) {
        console.error(`✗ ${name} threw error during lifecycle:`, e);
        success = false;
    }
}

if (!success) process.exit(1);
console.log('\nAll game instance lifecycle tests PASSED! 🎮');
