/**
 * VoxelCraft 3D - Procedural Minecraft-style 3D Voxel Sandbox
 * Built with Three.js. Levels 1 - 100+ with procedural world generation,
 * procedural 16x16 pixel-art block textures, 3D held voxel pickaxe,
 * instanced surface-culled chunks, voxel clouds, day/night cycle & block particles.
 */

window.VoxelCraftGame = class {
    constructor() {
        this.container = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = null;
        this.animId = null;
        this.isPaused = false;

        this.player = {
            pos: { x: 0, y: 15, z: 0 },
            vel: { x: 0, y: 0, z: 0 },
            yaw: 0,
            pitch: 0,
            height: 1.7,
            radius: 0.35,
            onGround: false,
            speed: 7.0,
            jumpStrength: 8.5
        };

        this.keys = {};
        this.isLocked = false;
        this.isDragging = false;
        this.dragMoved = false;
        this.lastMouse = { x: 0, y: 0 };
        this.spawnY = 14;

        this.worldSize = 34;
        this.worldHeight = 24;
        this.blocks = new Map();
        this.chunkMesh = null;
        this.highlightMesh = null;
        this.waterMesh = null;
        this.cloudGroup = null;
        this.handGroup = null;
        this.sunMesh = null;
        this.moonMesh = null;
        this.starField = null;
        this.particles = null;

        this.swingT = 0;
        this.walkCycle = 0;
        this.disposables = [];

        this.blockTypes = [
            { id: 1, name: 'Gras', color: 0x4f8f3f },
            { id: 2, name: 'Erde', color: 0x6e4a2c },
            { id: 3, name: 'Stein', color: 0x737373 },
            { id: 4, name: 'Kopfstein', color: 0x525252 },
            { id: 5, name: 'Holz', color: 0x784826 },
            { id: 6, name: 'Laub', color: 0x2e7d32, transparent: true, opacity: 0.92 },
            { id: 7, name: 'Ziegel', color: 0x993d2e },
            { id: 8, name: 'Sand', color: 0xd4b870 },
            { id: 9, name: 'Glas', color: 0x93c5fd, transparent: true, opacity: 0.55 },
            { id: 10, name: 'Gold', color: 0xf59e0b }
        ];

        this.blockMaterials = new Map();
        this.blockIcons = new Map();
        this.boxGeo = null;
        this.selectedBlockId = 1;
        this.dayTime = 0.22;
        this.currentLevel = 1;
        this.isNether = false;
        this.isDesert = false;
    }

    init(container, options = {}) {
        this.container = container;
        this.container.innerHTML = '';

        if (typeof THREE === 'undefined') {
            this.container.innerHTML = `
                <div style="color:var(--text-secondary); text-align:center; padding:40px; font-family:sans-serif;">
                    <h3>Three.js 3D Engine wird geladen...</h3>
                    <p style="margin-top:8px; font-size:13px;">Bitte stelle sicher, dass eine Internetverbindung für CDN besteht.</p>
                </div>
            `;
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.className = 'game-canvas';
        this.container.appendChild(canvas);

        const hud = document.createElement('div');
        hud.className = 'mc-hud';
        hud.innerHTML = `
            <div class="mc-debug-info">
                <div><strong>VoxelCraft</strong> · Level <span id="mc-lvl">1</span> <span id="mc-biome" style="color:#38bdf8;"></span></div>
                <div style="font-size:11px; color:#a1a1aa; margin-top:2px;">Klick/Ziehen oder Pfeiltasten: Blick · WASD + Leertaste · L-Klick Abbau · R-Klick Bau</div>
            </div>
            <div class="mc-crosshair"></div>
            <div class="mc-hotbar-container" id="mc-hotbar"></div>
        `;
        this.container.appendChild(hud);

        const w = Math.max(300, this.container.clientWidth || window.innerWidth);
        const h = Math.max(300, this.container.clientHeight || (window.innerHeight - 48));

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb);
        this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.022);

        this.camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
        this.camera.rotation.order = 'YXZ';
        this.scene.add(this.camera);

        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

        this.clock = new THREE.Clock();

        // Lighting: Hemisphere + orbiting Directional Sun
        this.hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x3b2f24, 0.65);
        this.scene.add(this.hemiLight);

        this.sunLight = new THREE.DirectionalLight(0xfff7ed, 0.9);
        this.sunLight.position.set(50, 80, 40);
        this.scene.add(this.sunLight);

        // Cached procedural 16x16 voxel textures & materials
        this.generateBlockAssets();
        this.setupHotbar();

        // Crisp 3D block target highlight (edges + subtle tint)
        const hlGroup = new THREE.Group();
        const hlBoxGeo = new THREE.BoxGeometry(1.008, 1.008, 1.008);
        const hlEdges = new THREE.EdgesGeometry(hlBoxGeo);
        hlBoxGeo.dispose();
        const hlLineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
        const hlFillGeo = new THREE.BoxGeometry(1.004, 1.004, 1.004);
        const hlFillMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.12, depthWrite: false });
        hlGroup.add(new THREE.LineSegments(hlEdges, hlLineMat));
        hlGroup.add(new THREE.Mesh(hlFillGeo, hlFillMat));
        hlGroup.visible = false;
        this.highlightMesh = hlGroup;
        this.scene.add(this.highlightMesh);
        this.disposables.push(hlEdges, hlLineMat, hlFillGeo, hlFillMat);

        this.buildSkyAndEnvironment();
        this.buildHandModel();
        this.buildParticles();

        this.raycaster = new THREE.Raycaster();
        this.mousePos = new THREE.Vector2(0, 0);

        this.bindEvents(canvas);

        const lvl = options.levelIndex || 1;
        this.startLevel(lvl, options.difficulty || 'Einfach');

        requestAnimationFrame(() => this.resize());

        this.animate = this.animate.bind(this);
        this.animId = requestAnimationFrame(this.animate);
    }

    /* ------------------------------------------------------------------ *
     * Procedural 16x16 Pixel-Art Textures & Cached Block Materials
     * ------------------------------------------------------------------ */

    makePixelTexture(drawFn, transparent = false) {
        const cv = document.createElement('canvas');
        cv.width = 16;
        cv.height = 16;
        const g = cv.getContext('2d');
        drawFn(g, 16, 16);
        const tex = new THREE.CanvasTexture(cv);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        this.disposables.push(tex);
        return { tex, dataUrl: cv.toDataURL(), transparent };
    }

    generateBlockAssets() {
        this.boxGeo = new THREE.BoxGeometry(1, 1, 1);
        this.disposables.push(this.boxGeo);

        const hash = (x, y, s) => {
            const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
            return n - Math.floor(n);
        };

        const fillNoise = (g, palette, seed, alpha = 1) => {
            for (let y = 0; y < 16; y++) {
                for (let x = 0; x < 16; x++) {
                    const idx = Math.floor(hash(x, y, seed) * palette.length);
                    g.globalAlpha = alpha;
                    g.fillStyle = palette[idx];
                    g.fillRect(x, y, 1, 1);
                }
            }
            g.globalAlpha = 1;
        };

        const grassTop = this.makePixelTexture((g) => fillNoise(g, ['#4ade80', '#22c55e', '#16a34a', '#15803d'], 1));
        const dirtTex = this.makePixelTexture((g) => fillNoise(g, ['#7c4a26', '#6e4222', '#5c361b', '#8a5630'], 2));
        const grassSide = this.makePixelTexture((g) => {
            fillNoise(g, ['#7c4a26', '#6e4222', '#5c361b', '#8a5630'], 3);
            for (let x = 0; x < 16; x++) {
                const depth = 3 + Math.floor(hash(x, 0, 11) * 3);
                for (let y = 0; y < depth; y++) {
                    g.fillStyle = hash(x, y, 13) > 0.45 ? '#22c55e' : '#16a34a';
                    g.fillRect(x, y, 1, 1);
                }
                g.fillStyle = '#14532d';
                g.fillRect(x, depth, 1, 1);
            }
        });
        const stoneTex = this.makePixelTexture((g) => {
            fillNoise(g, ['#737373', '#6b7280', '#7e838c', '#5a5f66'], 4);
            g.fillStyle = '#4b5563';
            g.fillRect(2, 4, 5, 1); g.fillRect(9, 10, 6, 1); g.fillRect(4, 13, 4, 1);
        });
        const cobbleTex = this.makePixelTexture((g) => {
            g.fillStyle = '#374151';
            g.fillRect(0, 0, 16, 16);
            const stones = [
                [0, 0, 7, 5, '#6b7280'], [8, 0, 8, 4, '#52525b'],
                [0, 6, 5, 5, '#52525b'], [6, 5, 6, 6, '#71717a'], [13, 5, 3, 6, '#64748b'],
                [0, 12, 8, 4, '#71717a'], [9, 12, 7, 4, '#52525b']
            ];
            for (const [sx, sy, sw, sh, col] of stones) {
                g.fillStyle = col;
                g.fillRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
                g.fillStyle = '#9ca3af';
                g.fillRect(sx + 1, sy + 1, Math.max(1, sw - 3), 1);
            }
        });
        const woodSide = this.makePixelTexture((g) => {
            fillNoise(g, ['#784826', '#6b3e1f', '#5c3318'], 5);
            g.fillStyle = '#45230f';
            for (let x = 1; x < 16; x += 3) g.fillRect(x, 0, 1, 16);
        });
        const woodTop = this.makePixelTexture((g) => {
            g.fillStyle = '#b47b48';
            g.fillRect(0, 0, 16, 16);
            g.strokeStyle = '#8b5a2b';
            g.lineWidth = 1;
            g.strokeRect(2.5, 2.5, 11, 11);
            g.strokeRect(5.5, 5.5, 5, 5);
            g.strokeStyle = '#5c3318';
            g.strokeRect(0.5, 0.5, 15, 15);
        });
        const leafTex = this.makePixelTexture((g) => {
            fillNoise(g, ['#166534', '#15803d', '#22c55e', '#14532d'], 6);
            for (let y = 0; y < 16; y++) {
                for (let x = 0; x < 16; x++) {
                    if (hash(x, y, 19) < 0.22) g.clearRect(x, y, 1, 1);
                }
            }
        }, true);
        const brickTex = this.makePixelTexture((g) => {
            g.fillStyle = '#cbd5e1';
            g.fillRect(0, 0, 16, 16);
            const cols = ['#991b1b', '#b91c1c', '#a32c20', '#7f1d1d'];
            for (let row = 0; row < 4; row++) {
                const off = (row % 2) * 4;
                for (let c = -1; c < 3; c++) {
                    g.fillStyle = cols[Math.floor(hash(c + 2, row, 7) * cols.length)];
                    g.fillRect(c * 8 + off + 0.5, row * 4 + 0.5, 7, 3);
                }
            }
        });
        const sandTex = this.makePixelTexture((g) => {
            fillNoise(g, ['#e7cf8b', '#d4b870', '#c7a95f', '#eed898'], 8);
        });
        const glassTex = this.makePixelTexture((g) => {
            g.fillStyle = 'rgba(147, 197, 253, 0.22)';
            g.fillRect(0, 0, 16, 16);
            g.fillStyle = 'rgba(224, 242, 254, 0.9)';
            g.fillRect(0, 0, 16, 1); g.fillRect(0, 15, 16, 1);
            g.fillRect(0, 0, 1, 16); g.fillRect(15, 0, 1, 16);
            g.fillStyle = 'rgba(255, 255, 255, 0.75)';
            g.fillRect(3, 3, 2, 1); g.fillRect(4, 4, 2, 1); g.fillRect(5, 5, 2, 1);
            g.fillRect(10, 9, 2, 1); g.fillRect(11, 10, 2, 1);
        }, true);
        const goldTex = this.makePixelTexture((g) => {
            fillNoise(g, ['#737373', '#6b7280', '#5a5f66'], 9);
            const spots = [[3, 3, 3, 2], [10, 4, 3, 3], [5, 10, 4, 3], [11, 11, 2, 2]];
            for (const [sx, sy, sw, sh] of spots) {
                g.fillStyle = '#f59e0b';
                g.fillRect(sx, sy, sw, sh);
                g.fillStyle = '#fde047';
                g.fillRect(sx, sy, Math.max(1, sw - 1), 1);
            }
        });

        const makeMat = (t, opts = {}) => {
            const m = new THREE.MeshLambertMaterial({
                map: t.tex,
                transparent: !!opts.transparent,
                opacity: opts.opacity !== undefined ? opts.opacity : 1.0,
                alphaTest: opts.alphaTest || 0,
                side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide
            });
            this.disposables.push(m);
            return m;
        };

        const mGrassTop = makeMat(grassTop);
        const mGrassSide = makeMat(grassSide);
        const mDirt = makeMat(dirtTex);
        const mWoodSide = makeMat(woodSide);
        const mWoodTop = makeMat(woodTop);

        this.blockMaterials.set(1, [mGrassSide, mGrassSide, mGrassTop, mDirt, mGrassSide, mGrassSide]);
        this.blockMaterials.set(2, mDirt);
        this.blockMaterials.set(3, makeMat(stoneTex));
        this.blockMaterials.set(4, makeMat(cobbleTex));
        this.blockMaterials.set(5, [mWoodSide, mWoodSide, mWoodTop, mWoodTop, mWoodSide, mWoodSide]);
        this.blockMaterials.set(6, makeMat(leafTex, { transparent: true, opacity: 0.96, alphaTest: 0.25, doubleSide: true }));
        this.blockMaterials.set(7, makeMat(brickTex));
        this.blockMaterials.set(8, makeMat(sandTex));
        this.blockMaterials.set(9, makeMat(glassTex, { transparent: true, opacity: 0.85, doubleSide: true }));
        this.blockMaterials.set(10, makeMat(goldTex));

        this.blockIcons.set(1, grassSide.dataUrl);
        this.blockIcons.set(2, dirtTex.dataUrl);
        this.blockIcons.set(3, stoneTex.dataUrl);
        this.blockIcons.set(4, cobbleTex.dataUrl);
        this.blockIcons.set(5, woodSide.dataUrl);
        this.blockIcons.set(6, leafTex.dataUrl);
        this.blockIcons.set(7, brickTex.dataUrl);
        this.blockIcons.set(8, sandTex.dataUrl);
        this.blockIcons.set(9, glassTex.dataUrl);
        this.blockIcons.set(10, goldTex.dataUrl);
    }

    /* ------------------------------------------------------------------ *
     * 3D Sky, Voxel Clouds, Water, Held Pickaxe & Block Debris Particles
     * ------------------------------------------------------------------ */

    buildSkyAndEnvironment() {
        // 3D Voxel Sun & Moon
        const sunGeo = new THREE.BoxGeometry(5, 5, 5);
        const sunMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
        this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
        this.scene.add(this.sunMesh);

        const moonGeo = new THREE.BoxGeometry(3.8, 3.8, 3.8);
        const moonMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
        this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
        this.scene.add(this.moonMesh);
        this.disposables.push(sunGeo, sunMat, moonGeo, moonMat);

        // Starfield for night sky
        const starCount = 160;
        const sPos = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount; i++) {
            const th = Math.random() * Math.PI * 2;
            const ph = Math.random() * Math.PI * 0.44;
            const r = 130;
            sPos[i * 3] = Math.cos(th) * Math.cos(ph) * r;
            sPos[i * 3 + 1] = Math.sin(ph) * r + 15;
            sPos[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * r;
        }
        const sGeo = new THREE.BufferGeometry();
        sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
        const sMat = new THREE.PointsMaterial({ color: 0xf8fafc, size: 1.1, transparent: true, opacity: 0 });
        this.starField = new THREE.Points(sGeo, sMat);
        this.scene.add(this.starField);
        this.disposables.push(sGeo, sMat);

        // Instanced Voxel Clouds (single draw call)
        const cloudGeo = new THREE.BoxGeometry(1, 0.85, 1);
        const cloudMat = new THREE.MeshLambertMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.86 });
        const cloudCount = 36;
        this.cloudGroup = new THREE.InstancedMesh(cloudGeo, cloudMat, cloudCount);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < cloudCount; i++) {
            const cluster = Math.floor(i / 3);
            const cx = ((cluster * 19) % 70) - 35 + ((i % 3) - 1) * 2.4;
            const cz = ((cluster * 29) % 70) - 35 + ((i % 2) * 1.6);
            dummy.position.set(cx, 22 + (cluster % 3) * 1.2, cz);
            dummy.scale.set(3.2 + (i % 3) * 1.4, 1.1, 2.6 + ((i + 1) % 2) * 1.2);
            dummy.updateMatrix();
            this.cloudGroup.setMatrixAt(i, dummy.matrix);
        }
        this.cloudGroup.instanceMatrix.needsUpdate = true;
        this.scene.add(this.cloudGroup);
        this.disposables.push(cloudGeo, cloudMat);

        // Translucent Water Plane for low valleys
        const waterTex = this.makePixelTexture((g) => {
            for (let y = 0; y < 16; y++) {
                for (let x = 0; x < 16; x++) {
                    const wave = (x + y) % 5 === 0 ? '#38bdf8' : ((x * 3 + y) % 7 === 0 ? '#0ea5e9' : '#0284c7');
                    g.fillStyle = wave;
                    g.fillRect(x, y, 1, 1);
                }
            }
        });
        waterTex.tex.wrapS = THREE.RepeatWrapping;
        waterTex.tex.wrapT = THREE.RepeatWrapping;
        waterTex.tex.repeat.set(16, 16);
        this.waterTex = waterTex.tex;

        const wGeo = new THREE.PlaneGeometry(this.worldSize + 1, this.worldSize + 1);
        const wMat = new THREE.MeshLambertMaterial({
            map: waterTex.tex,
            transparent: true,
            opacity: 0.62,
            side: THREE.DoubleSide
        });
        this.waterMesh = new THREE.Mesh(wGeo, wMat);
        this.waterMesh.rotation.x = -Math.PI / 2;
        this.waterMesh.position.set(0.5, 2.72, 0.5);
        this.scene.add(this.waterMesh);
        this.disposables.push(wGeo, wMat);
    }

    buildHandModel() {
        const g = new THREE.Group();
        const pick = new THREE.Group();

        const woodMat = new THREE.MeshLambertMaterial({ color: 0x854d0e });
        const darkWoodMat = new THREE.MeshLambertMaterial({ color: 0x5c3318 });
        const diamondMat = new THREE.MeshLambertMaterial({ color: 0x22d3ee, emissive: 0x0891b2, emissiveIntensity: 0.35 });
        const edgeMat = new THREE.MeshLambertMaterial({ color: 0xa5f3fc, emissive: 0x22d3ee, emissiveIntensity: 0.4 });
        const box = new THREE.BoxGeometry(1, 1, 1);

        // Voxel Handle
        for (let i = 0; i < 6; i++) {
            const seg = new THREE.Mesh(box, i % 2 === 0 ? woodMat : darkWoodMat);
            seg.scale.set(0.055, 0.085, 0.055);
            seg.position.set(0, -0.18 + i * 0.075, 0);
            pick.add(seg);
        }
        // Voxel Pickaxe Head (curved diamond arc)
        const headVoxels = [
            [-0.14, 0.16, 0, edgeMat], [-0.09, 0.21, 0, diamondMat],
            [-0.04, 0.24, 0, diamondMat], [0.0, 0.25, 0, edgeMat],
            [0.04, 0.24, 0, diamondMat], [0.09, 0.21, 0, diamondMat],
            [0.14, 0.16, 0, edgeMat]
        ];
        for (const [vx, vy, vz, mat] of headVoxels) {
            const m = new THREE.Mesh(box, mat);
            m.scale.set(0.06, 0.06, 0.065);
            m.position.set(vx, vy, vz);
            pick.add(m);
        }

        pick.rotation.set(-0.35, -0.55, 0.25);
        g.add(pick);
        g.position.set(0.42, -0.34, -0.62);
        this.handPick = pick;
        this.handGroup = g;
        this.camera.add(this.handGroup);
        this.disposables.push(box, woodMat, darkWoodMat, diamondMat, edgeMat);
    }

    buildParticles() {
        const cap = 180;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(cap * 3).fill(-9999);
        const col = new Float32Array(cap * 3);
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const mat = new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, opacity: 0.95 });
        const pts = new THREE.Points(geo, mat);
        pts.frustumCulled = false;
        this.scene.add(pts);
        this.disposables.push(geo, mat);
        this.particles = {
            cap, pts, pos, col, next: 0,
            vel: new Float32Array(cap * 3),
            life: new Float32Array(cap),
            max: new Float32Array(cap),
            rgb: new Float32Array(cap * 3)
        };
    }

    emitBlockDebris(bx, by, bz, blockId, count = 14) {
        const p = this.particles;
        if (!p) return;
        const bt = this.blockTypes.find(t => t.id === blockId);
        const c = new THREE.Color(bt ? bt.color : 0x94a3b8);
        for (let k = 0; k < count; k++) {
            const i = p.next;
            p.next = (p.next + 1) % p.cap;
            p.pos[i * 3] = bx + 0.2 + Math.random() * 0.6;
            p.pos[i * 3 + 1] = by + 0.2 + Math.random() * 0.6;
            p.pos[i * 3 + 2] = bz + 0.2 + Math.random() * 0.6;
            p.vel[i * 3] = (Math.random() - 0.5) * 4.5;
            p.vel[i * 3 + 1] = 1.5 + Math.random() * 3.5;
            p.vel[i * 3 + 2] = (Math.random() - 0.5) * 4.5;
            p.rgb[i * 3] = c.r;
            p.rgb[i * 3 + 1] = c.g;
            p.rgb[i * 3 + 2] = c.b;
            p.max[i] = p.life[i] = 0.35 + Math.random() * 0.35;
        }
    }

    updateParticles(delta) {
        const p = this.particles;
        if (!p) return;
        for (let i = 0; i < p.cap; i++) {
            if (p.life[i] <= 0) continue;
            p.life[i] -= delta;
            const o = i * 3;
            if (p.life[i] <= 0) {
                p.pos[o + 1] = -9999;
                p.col[o] = p.col[o + 1] = p.col[o + 2] = 0;
                continue;
            }
            p.vel[o + 1] -= 16 * delta;
            p.pos[o] += p.vel[o] * delta;
            p.pos[o + 1] += p.vel[o + 1] * delta;
            p.pos[o + 2] += p.vel[o + 2] * delta;
            const f = p.life[i] / p.max[i];
            p.col[o] = p.rgb[o] * f;
            p.col[o + 1] = p.rgb[o + 1] * f;
            p.col[o + 2] = p.rgb[o + 2] * f;
        }
        p.pts.geometry.attributes.position.needsUpdate = true;
        p.pts.geometry.attributes.color.needsUpdate = true;
    }

    updateAtmosphere(delta) {
        if (!this.scene) return;
        this.dayTime = (this.dayTime + delta * 0.006) % 1;
        const ang = this.dayTime * Math.PI * 2;
        const sy = Math.sin(ang);
        const sx = Math.cos(ang);

        if (this.sunMesh) {
            this.sunMesh.position.set(sx * 95, sy * 95, -25);
            this.sunMesh.visible = sy > -0.15;
        }
        if (this.moonMesh) {
            this.moonMesh.position.set(-sx * 95, -sy * 95, -25);
            this.moonMesh.visible = sy < 0.15;
        }

        const dayFactor = Math.max(0, Math.min(1, (sy + 0.18) / 0.55));
        if (this.isNether) {
            this.scene.background.setHex(0x2a0a0a);
            this.scene.fog.color.setHex(0x2a0a0a);
            this.sunLight.intensity = 0.65;
            this.hemiLight.intensity = 0.55;
            if (this.starField) this.starField.material.opacity = 0;
            if (this.cloudGroup) this.cloudGroup.visible = false;
        } else {
            const nightCol = new THREE.Color(0x090f24);
            const dayCol = new THREE.Color(this.isDesert ? 0xbae6fd : 0x7dd3fc);
            const skyCol = nightCol.lerp(dayCol, dayFactor);
            this.scene.background.copy(skyCol);
            this.scene.fog.color.copy(skyCol);
            this.sunLight.position.set(sx * 60, Math.max(12, sy * 80), 30);
            this.sunLight.intensity = 0.2 + dayFactor * 0.78;
            this.hemiLight.intensity = 0.3 + dayFactor * 0.42;
            if (this.starField) this.starField.material.opacity = Math.max(0, 0.85 * (1 - dayFactor * 1.4));
            if (this.cloudGroup) {
                this.cloudGroup.visible = true;
                this.cloudGroup.position.x = ((this.cloudGroup.position.x + delta * 0.65 + 35) % 70) - 35;
            }
        }

        if (this.waterTex) {
            this.waterTex.offset.x = (this.waterTex.offset.x + delta * 0.08) % 1;
            this.waterTex.offset.y = (this.waterTex.offset.y + delta * 0.04) % 1;
        }
    }

    resize() {
        if (!this.renderer || !this.container) return;
        const w = Math.max(300, this.container.clientWidth || window.innerWidth);
        const h = Math.max(300, this.container.clientHeight || (window.innerHeight - 48));
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    setupHotbar() {
        const bar = this.container.querySelector('#mc-hotbar');
        if (!bar) return;
        bar.innerHTML = '';
        this.blockTypes.forEach((b, idx) => {
            const slot = document.createElement('div');
            slot.className = `mc-hotbar-slot ${b.id === this.selectedBlockId ? 'active' : ''}`;
            slot.dataset.id = b.id;
            const iconUrl = this.blockIcons.get(b.id);
            const iconStyle = iconUrl
                ? `background-image: url(${iconUrl}); background-size: cover; image-rendering: pixelated;`
                : `background-color: #${b.color.toString(16).padStart(6, '0')};`;
            slot.innerHTML = `
                <div class="mc-block-icon" title="${b.name}" style="${iconStyle}"></div>
                <span class="mc-slot-num">${idx === 9 ? 0 : idx + 1}</span>
            `;
            slot.onclick = (e) => {
                e.stopPropagation();
                this.selectBlock(b.id);
            };
            bar.appendChild(slot);
        });
    }

    selectBlock(id) {
        this.selectedBlockId = id;
        this.container.querySelectorAll('.mc-hotbar-slot').forEach(s => {
            s.classList.toggle('active', parseInt(s.dataset.id, 10) === id);
        });
        if (window.AudioManager) window.AudioManager.playClick();
    }

    startLevel(levelIndex = 1, difficulty = 'Einfach') {
        this.currentLevel = levelIndex;
        this.blocks.clear();

        const lvlEl = this.container.querySelector('#mc-lvl');
        if (lvlEl) lvlEl.innerText = `${levelIndex}`;

        const half = Math.floor(this.worldSize / 2);
        const seed = levelIndex * 89.17 + 10;

        this.isDesert = (levelIndex % 4 === 3);
        this.isMountain = (levelIndex % 4 === 2);
        this.isNether = (levelIndex % 5 === 0);

        const biomeEl = this.container.querySelector('#mc-biome');
        if (biomeEl) {
            biomeEl.innerText = this.isNether ? '· Nether' : (this.isDesert ? '· Wüste' : (this.isMountain ? '· Gebirge' : '· Wald'));
        }
        if (this.waterMesh) {
            this.waterMesh.visible = !this.isNether && !this.isDesert;
        }

        for (let x = -half; x <= half; x++) {
            for (let z = -half; z <= half; z++) {
                let h = 0;
                if (this.isMountain) {
                    h = Math.floor(8 + Math.sin(x * 0.28 + seed) * 5 + Math.cos(z * 0.28 + seed) * 5);
                } else if (this.isDesert) {
                    h = Math.floor(4 + Math.sin(x * 0.15 + seed) * 2 + Math.cos(z * 0.15 + seed) * 2);
                } else {
                    h = Math.floor(4.3 + Math.sin(x * 0.2 + seed) * 2.5 + Math.cos(z * 0.2 + seed) * 2.5);
                }

                h = Math.max(1, Math.min(this.worldHeight - 4, h));
                const nearSpawn = Math.abs(x) <= 2 && Math.abs(z) <= 2;
                if (nearSpawn) h = Math.max(h, 4);

                for (let y = 0; y <= h; y++) {
                    let type = 3;
                    if (this.isDesert) {
                        type = 8;
                    } else if (this.isNether) {
                        type = (y === h) ? 7 : (Math.random() < 0.1 ? 10 : 4);
                    } else {
                        if (y === h) type = h <= 2 ? 8 : 1;
                        else if (y >= h - 2) type = 2;
                        else type = (Math.random() < 0.05) ? 10 : 3;
                    }
                    this.setBlock(x, y, z, type);
                }

                // Trees above waterline / Cacti in desert (keep spawn clearing open)
                if (!nearSpawn && !this.isNether && !this.isDesert && h > 2 && Math.random() < 0.035 && Math.abs(x) < half - 2 && Math.abs(z) < half - 2) {
                    this.generateTree(x, h + 1, z);
                } else if (!nearSpawn && this.isDesert && Math.random() < 0.025 && Math.abs(x) < half - 2 && Math.abs(z) < half - 2) {
                    this.setBlock(x, h + 1, z, 6);
                    this.setBlock(x, h + 2, z, 6);
                }
            }
        }

        let topY = 10;
        for (let y = this.worldHeight; y >= 0; y--) {
            if (this.getBlock(0, y, 0)) { topY = y; break; }
        }
        this.spawnY = topY + 1 + this.player.height;
        this.player.pos = { x: 0.5, y: this.spawnY, z: 0.5 };
        this.player.vel = { x: 0, y: 0, z: 0 };
        this.player.yaw = 0.55;
        this.player.pitch = -0.12;
        this.player.onGround = true;
        if (this.camera) {
            this.camera.position.set(this.player.pos.x, this.player.pos.y, this.player.pos.z);
            this.camera.rotation.set(this.player.pitch, this.player.yaw, 0, 'YXZ');
        }

        this.buildWorldMesh();
    }

    generateTree(x, baseY, z) {
        for (let y = 0; y < 4; y++) {
            this.setBlock(x, baseY + y, z, 5);
        }
        const leafY = baseY + 3;
        for (let ox = -2; ox <= 2; ox++) {
            for (let oz = -2; oz <= 2; oz++) {
                for (let oy = 0; oy <= 2; oy++) {
                    if (Math.abs(ox) === 2 && Math.abs(oz) === 2 && oy === 2) continue;
                    if (!this.getBlock(x + ox, leafY + oy, z + oz)) {
                        this.setBlock(x + ox, leafY + oy, z + oz, 6);
                    }
                }
            }
        }
    }

    setBlock(x, y, z, id) {
        const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
        if (id === 0) this.blocks.delete(key);
        else this.blocks.set(key, id);
    }

    getBlock(x, y, z) {
        return this.blocks.get(`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`) || 0;
    }

    isBlockExposed(x, y, z) {
        const transparentIds = (id) => id === 0 || id === 6 || id === 9;
        return (
            transparentIds(this.getBlock(x + 1, y, z)) ||
            transparentIds(this.getBlock(x - 1, y, z)) ||
            transparentIds(this.getBlock(x, y + 1, z)) ||
            transparentIds(this.getBlock(x, y - 1, z)) ||
            transparentIds(this.getBlock(x, y, z + 1)) ||
            transparentIds(this.getBlock(x, y, z - 1))
        );
    }

    buildWorldMesh() {
        if (this.chunkMesh) this.scene.remove(this.chunkMesh);

        // Surface culling: only instance exposed blocks (huge GPU & CPU boost)
        const buckets = new Map();
        this.blocks.forEach((id, key) => {
            const parts = key.split(',');
            const bx = Number(parts[0]);
            const by = Number(parts[1]);
            const bz = Number(parts[2]);
            if (by > 0 && !this.isBlockExposed(bx, by, bz)) return;
            let list = buckets.get(id);
            if (!list) {
                list = [];
                buckets.set(id, list);
            }
            list.push([bx, by, bz]);
        });

        const group = new THREE.Group();
        const dummy = new THREE.Object3D();

        for (const bType of this.blockTypes) {
            const coords = buckets.get(bType.id);
            if (!coords || !coords.length) continue;

            const mat = this.blockMaterials.get(bType.id);
            const iMesh = new THREE.InstancedMesh(this.boxGeo, mat, coords.length);

            for (let i = 0; i < coords.length; i++) {
                const [bx, by, bz] = coords[i];
                dummy.position.set(bx + 0.5, by + 0.5, bz + 0.5);
                dummy.updateMatrix();
                iMesh.setMatrixAt(i, dummy.matrix);
            }
            iMesh.instanceMatrix.needsUpdate = true;
            group.add(iMesh);
        }

        this.chunkMesh = group;
        this.scene.add(this.chunkMesh);
    }

    bindEvents(canvas) {
        this.canvas = canvas;
        this.onKeyDown = (e) => {
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
            }
            this.keys[e.code] = true;
            if (e.code >= 'Digit1' && e.code <= 'Digit9') {
                const idx = parseInt(e.code.replace('Digit', ''), 10);
                if (idx >= 1 && idx <= this.blockTypes.length) {
                    this.selectBlock(idx);
                }
            } else if (e.code === 'Digit0' && this.blockTypes.length >= 10) {
                this.selectBlock(10);
            }
        };

        this.onKeyUp = (e) => { this.keys[e.code] = false; };

        this.onMouseDown = (e) => {
            if (this.isLocked) {
                if (e.button === 0) this.mineTargetBlock();
                else if (e.button === 2) this.placeTargetBlock();
                return;
            }
            this.isDragging = true;
            this.dragMoved = false;
            this.lastMouse = { x: e.clientX, y: e.clientY };
        };

        this.onMouseMove = (e) => {
            const maxP = Math.PI / 2 - 0.05;
            if (this.isLocked) {
                const sens = 0.0022;
                this.player.yaw -= e.movementX * sens;
                this.player.pitch = Math.max(-maxP, Math.min(maxP, this.player.pitch - e.movementY * sens));
            } else if (this.isDragging) {
                const dx = e.clientX - this.lastMouse.x;
                const dy = e.clientY - this.lastMouse.y;
                if (Math.hypot(dx, dy) > 1) this.dragMoved = true;
                const sens = 0.004;
                this.player.yaw -= dx * sens;
                this.player.pitch = Math.max(-maxP, Math.min(maxP, this.player.pitch - dy * sens));
                this.lastMouse = { x: e.clientX, y: e.clientY };
            }
        };

        this.onMouseUp = (e) => {
            if (!this.isLocked && this.isDragging && !this.dragMoved && e.target === canvas) {
                if (e.button === 0) {
                    this.mineTargetBlock();
                    try {
                        if (canvas.requestPointerLock) {
                            const res = canvas.requestPointerLock();
                            if (res && typeof res.catch === 'function') res.catch(() => {});
                        }
                    } catch (err) {}
                } else if (e.button === 2) {
                    this.placeTargetBlock();
                }
            }
            this.isDragging = false;
        };

        this.onLockChange = () => {
            this.isLocked = document.pointerLockElement === canvas;
            if (this.isLocked) this.isDragging = false;
        };

        this.onContextMenu = (e) => e.preventDefault();
        this.onResize = () => this.resize();
        window.addEventListener('resize', this.onResize);

        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        canvas.addEventListener('mousedown', this.onMouseDown);
        window.addEventListener('mouseup', this.onMouseUp);
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('pointerlockchange', this.onLockChange);
        canvas.addEventListener('contextmenu', this.onContextMenu);
    }

    getTargetBlock() {
        if (!this.raycaster || !this.camera) return { hit: false };
        this.raycaster.setFromCamera(this.mousePos, this.camera);
        const origin = this.camera.position.clone();
        const dir = this.raycaster.ray.direction.clone().normalize();

        const step = 0.08;
        const maxDist = 6.0;
        const curr = origin.clone();
        let prev = null;

        for (let dist = 0; dist <= maxDist; dist += step) {
            curr.addScaledVector(dir, step);
            const bx = Math.floor(curr.x);
            const by = Math.floor(curr.y);
            const bz = Math.floor(curr.z);

            const bId = this.getBlock(bx, by, bz);
            if (bId !== 0) {
                return {
                    hit: true,
                    block: { x: bx, y: by, z: bz, id: bId },
                    adjacent: prev || { x: bx, y: by + 1, z: bz }
                };
            }
            prev = { x: bx, y: by, z: bz };
        }
        return { hit: false };
    }

    mineTargetBlock() {
        const target = this.getTargetBlock();
        this.swingT = 1.0;
        if (target.hit) {
            this.emitBlockDebris(target.block.x, target.block.y, target.block.z, target.block.id, 18);
            this.setBlock(target.block.x, target.block.y, target.block.z, 0);
            this.buildWorldMesh();
            if (window.AudioManager) window.AudioManager.playDigBlock();
        }
    }

    placeTargetBlock() {
        const target = this.getTargetBlock();
        if (target.hit && target.adjacent) {
            const adj = target.adjacent;
            const px = Math.floor(this.player.pos.x);
            const py1 = Math.floor(this.player.pos.y);
            const py2 = Math.floor(this.player.pos.y - 1);
            const pz = Math.floor(this.player.pos.z);

            if (adj.x === px && (adj.y === py1 || adj.y === py2) && adj.z === pz) return;

            this.swingT = 0.7;
            this.setBlock(adj.x, adj.y, adj.z, this.selectedBlockId);
            this.emitBlockDebris(adj.x, adj.y, adj.z, this.selectedBlockId, 8);
            this.buildWorldMesh();
            if (window.AudioManager) window.AudioManager.playPlaceBlock();
        }
    }

    updatePhysics(delta) {
        const p = this.player;
        const speed = p.speed;

        const turnSpeed = 2.0 * delta;
        const maxP = Math.PI / 2 - 0.05;
        if (this.keys['ArrowLeft']) p.yaw += turnSpeed;
        if (this.keys['ArrowRight']) p.yaw -= turnSpeed;
        if (this.keys['ArrowUp']) p.pitch = Math.min(maxP, p.pitch + turnSpeed);
        if (this.keys['ArrowDown']) p.pitch = Math.max(-maxP, p.pitch - turnSpeed);

        let mx = 0, mz = 0;
        if (this.keys['KeyW']) mz -= 1;
        if (this.keys['KeyS']) mz += 1;
        if (this.keys['KeyA']) mx -= 1;
        if (this.keys['KeyD']) mx += 1;

        const len = Math.hypot(mx, mz);
        if (len > 0) {
            mx /= len; mz /= len;
            const sin = Math.sin(p.yaw);
            const cos = Math.cos(p.yaw);
            p.vel.x = (mx * cos + mz * sin) * speed;
            p.vel.z = (-mx * sin + mz * cos) * speed;
            if (p.onGround) this.walkCycle += delta * 10;
        } else {
            p.vel.x *= 0.7;
            p.vel.z *= 0.7;
        }

        p.vel.y = Math.max(-24, p.vel.y - 22.0 * delta);
        if (p.onGround && this.keys['Space']) {
            p.vel.y = p.jumpStrength;
            p.onGround = false;
            if (window.AudioManager) window.AudioManager.playJump();
        }

        let stepped = false;
        p.pos.x += p.vel.x * delta;
        if (this.checkCollision(p.pos.x, p.pos.y, p.pos.z)) {
            if (!stepped && p.onGround && !this.checkCollision(p.pos.x, p.pos.y + 1.0, p.pos.z)) {
                p.pos.y += 1.0;
                stepped = true;
            } else {
                p.pos.x -= p.vel.x * delta; p.vel.x = 0;
            }
        }

        p.pos.z += p.vel.z * delta;
        if (this.checkCollision(p.pos.x, p.pos.y, p.pos.z)) {
            if (!stepped && p.onGround && !this.checkCollision(p.pos.x, p.pos.y + 1.0, p.pos.z)) {
                p.pos.y += 1.0;
                stepped = true;
            } else {
                p.pos.z -= p.vel.z * delta; p.vel.z = 0;
            }
        }

        p.pos.y += p.vel.y * delta;
        p.onGround = false;
        if (this.checkCollision(p.pos.x, p.pos.y, p.pos.z)) {
            if (p.vel.y < 0) {
                p.onGround = true;
                const footBlockY = Math.floor(p.pos.y - p.height + 0.001);
                p.pos.y = footBlockY + 1 + p.height;
            } else if (p.vel.y > 0) {
                const headBlockY = Math.floor(p.pos.y - 0.001);
                p.pos.y = headBlockY - 0.001;
            }
            p.vel.y = 0;
        }

        if (p.pos.y < -15) {
            p.pos.x = 0.5; p.pos.y = this.spawnY || 14; p.pos.z = 0.5;
            p.vel = { x: 0, y: 0, z: 0 };
        }

        this.camera.position.set(p.pos.x, p.pos.y, p.pos.z);
        this.camera.rotation.set(p.pitch, p.yaw, 0, 'YXZ');

        // Animate held 3D voxel pickaxe (walk bob + swing)
        if (this.handGroup && this.handPick) {
            this.swingT = Math.max(0, this.swingT - delta * 5.2);
            const swing = Math.sin(this.swingT * Math.PI);
            const bobX = Math.cos(this.walkCycle) * 0.018 * (len > 0 ? 1 : 0.15);
            const bobY = Math.abs(Math.sin(this.walkCycle)) * 0.022 * (len > 0 ? 1 : 0.15);
            this.handGroup.position.set(0.42 + bobX - swing * 0.12, -0.34 - bobY - swing * 0.08, -0.62 - swing * 0.08);
            this.handPick.rotation.set(-0.35 - swing * 0.95, -0.55 + swing * 0.35, 0.25 + swing * 0.2);
        }

        const target = this.getTargetBlock();
        if (target.hit) {
            this.highlightMesh.visible = true;
            this.highlightMesh.position.set(target.block.x + 0.5, target.block.y + 0.5, target.block.z + 0.5);
        } else {
            this.highlightMesh.visible = false;
        }
    }

    checkCollision(px, py, pz) {
        const r = this.player.radius;
        const h = this.player.height;
        for (let x = Math.floor(px - r); x <= Math.floor(px + r); x++) {
            for (let y = Math.floor(py - h + 0.001); y <= Math.floor(py - 0.001); y++) {
                for (let z = Math.floor(pz - r); z <= Math.floor(pz + r); z++) {
                    if (this.getBlock(x, y, z) !== 0) return true;
                }
            }
        }
        return false;
    }

    animate() {
        this.animId = requestAnimationFrame(this.animate);
        if (this.isPaused || !this.renderer) return;

        const delta = Math.min(this.clock.getDelta(), 0.1);
        this.updatePhysics(delta);
        this.updateAtmosphere(delta);
        this.updateParticles(delta);

        this.renderer.render(this.scene, this.camera);
    }

    pause() { this.isPaused = true; }
    resume() {
        this.isPaused = false;
        if (this.clock) this.clock.getDelta();
    }

    destroy() {
        if (this.animId) cancelAnimationFrame(this.animId);
        if (this.onResize) window.removeEventListener('resize', this.onResize);
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        if (this.canvas) {
            this.canvas.removeEventListener('mousedown', this.onMouseDown);
            this.canvas.removeEventListener('contextmenu', this.onContextMenu);
        }
        window.removeEventListener('mouseup', this.onMouseUp);
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('pointerlockchange', this.onLockChange);
        this.disposables.forEach(d => { try { d.dispose(); } catch (e) {} });
        this.disposables = [];
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }
        if (this.container) this.container.innerHTML = '';
    }
};
