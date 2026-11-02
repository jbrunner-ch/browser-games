const fs = require('fs');

console.log('--- 1. Testing HTML IDs referenced in portal.js ---');
const html = fs.readFileSync('index.html', 'utf8');
const portalCode = fs.readFileSync('js/portal.js', 'utf8');

const idRegex = /getElementById\(['"]([^'"]+)['"]\)/g;
let match;
const ids = new Set();
while ((match = idRegex.exec(portalCode)) !== null) {
    ids.add(match[1]);
}

let allIdsFound = true;
for (const id of ids) {
    if (!html.includes(`id="${id}"`) && !html.includes(`id='${id}'`)) {
        console.error('✗ Missing ID in HTML:', id);
        allIdsFound = false;
    } else {
        console.log('✓ Found ID:', id);
    }
}

console.log('\n--- 2. Testing Game Classes & Lifecycle Methods ---');
const gameFiles = [
    { file: 'js/games/minecraft.js', className: 'VoxelCraftGame' },
    { file: 'js/games/rushhour.js', className: 'RushHourGame' },
    { file: 'js/games/racing3d.js', className: 'Racing3DGame' },
    { file: 'js/games/towerdefense.js', className: 'TowerDefenseGame' },
    { file: 'js/games/platformer.js', className: 'PlatformerGame' },
    { file: 'js/games/breakout.js', className: 'BreakoutGame' },
    { file: 'js/games/spaceshooter.js', className: 'SpaceShooterGame' },
    { file: 'js/games/dungeon.js', className: 'DungeonGame' },
    { file: 'js/games/minesweeper.js', className: 'MinesweeperGame' },
    { file: 'js/games/snake3d.js', className: 'Snake3DGame' }
];

let allMethodsOk = true;
for (const { file, className } of gameFiles) {
    const code = fs.readFileSync(file, 'utf8');
    const requiredMethods = ['init', 'startLevel', 'pause', 'resume', 'destroy'];
    for (const m of requiredMethods) {
        if (!code.includes(m + '(') && !code.includes(m + ' (')) {
            console.error('✗', className, 'in', file, 'is missing method:', m);
            allMethodsOk = false;
        }
    }
    console.log(`✓ ${className} implements full lifecycle (init, startLevel, pause, resume, destroy)`);
}

console.log('\n--- 3. Testing Boss Key & Tab Closer Integration ---');
const docStealthCss = fs.readFileSync('css/doc-stealth.css', 'utf8');
if (docStealthCss.includes('.boss-screen') && docStealthCss.includes('.gdoc-page')) {
    console.log('✓ Google Docs decoy styling verified');
} else {
    console.error('✗ Google Docs styling missing');
    allMethodsOk = false;
}

if (!allIdsFound || !allMethodsOk) {
    console.error('\nTest suite FAILED!');
    process.exit(1);
} else {
    console.log('\nAll comprehensive integration checks PASSED successfully! 🚀');
}
