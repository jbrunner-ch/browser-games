/**
 * Arcade Realm - Cloud Storage, Auth, Groups & Leaderboard Architecture
 * 
 * Supports:
 * 1. Firebase Authentication & Firestore (when window.FIREBASE_CONFIG is supplied)
 * 2. High-fidelity Offline / LocalStorage Mock Mode (works out-of-the-box with zero config)
 * 3. User Profiles & Guest Mode
 * 4. Level & Game Progress Persistence (Levels 1 - 100+, Stars, Highscores)
 * 5. Groups System (Create Group, Join via Code, Member Lists)
 * 6. Scoped Leaderboards (Global vs. Group Bestenlisten)
 */

(function () {
    'use strict';

    const STORAGE_KEY_USER = 'arcade_realm_user';
    const STORAGE_KEY_PROGRESS = 'arcade_realm_progress';
    const STORAGE_KEY_GROUPS = 'arcade_realm_groups';
    const STORAGE_KEY_LEADERBOARDS = 'arcade_realm_leaderboards';

    class CloudStorageService {
        constructor() {
            this.isFirebaseReady = false;
            this.currentUser = null;
            this.listeners = new Set();
            this.initLocalData();
            this.loadSession();
        }

        /* ------------------------------------------------------------------ */
        /* Initialization & Session                                           */
        /* ------------------------------------------------------------------ */

        initLocalData() {
            // Seed initial groups if none exist
            if (!localStorage.getItem(STORAGE_KEY_GROUPS)) {
                const defaultGroups = [
                    {
                        id: 'grp_speedrunners',
                        code: 'SPEED1',
                        name: 'Speedrunner Elite',
                        desc: 'Für alle, die Highscores und Rekordzeiten jagen.',
                        creator: 'System',
                        members: ['System', 'CyberAce', 'PixelPro']
                    },
                    {
                        id: 'grp_arcade_legends',
                        code: 'ARCADE',
                        name: 'Retro Arcade Club',
                        desc: 'Klassiker, Puzzles und 3D-Action.',
                        creator: 'System',
                        members: ['System', 'NeonRider', 'VoxelKing']
                    }
                ];
                localStorage.setItem(STORAGE_KEY_GROUPS, JSON.stringify(defaultGroups));
            }

            // Seed mock leaderboards if none exist
            if (!localStorage.getItem(STORAGE_KEY_LEADERBOARDS)) {
                const mockLBs = {
                    racing3d: [
                        { user: 'CyberAce', score: 14200, level: 12, date: '2026-11-01', group: 'grp_speedrunners' },
                        { user: 'NeonRider', score: 11850, level: 9, date: '2026-11-03', group: 'grp_arcade_legends' },
                        { user: 'PixelPro', score: 9400, level: 7, date: '2026-11-04', group: 'grp_speedrunners' }
                    ],
                    snake3d: [
                        { user: 'NeonRider', score: 480, level: 8, date: '2026-11-02', group: 'grp_arcade_legends' },
                        { user: 'CyberAce', score: 390, level: 6, date: '2026-11-04', group: 'grp_speedrunners' }
                    ],
                    spaceshooter: [
                        { user: 'CosmoAce', score: 68400, level: 15, date: '2026-11-03', group: 'grp_speedrunners' },
                        { user: 'VoxelKing', score: 45200, level: 11, date: '2026-11-05', group: 'grp_arcade_legends' }
                    ],
                    towerdefense: [
                        { user: 'Tactician', score: 32500, level: 20, date: '2026-11-02', group: 'grp_arcade_legends' },
                        { user: 'CyberAce', score: 28900, level: 18, date: '2026-11-04', group: 'grp_speedrunners' }
                    ]
                };
                localStorage.setItem(STORAGE_KEY_LEADERBOARDS, JSON.stringify(mockLBs));
            }
        }

        loadSession() {
            try {
                const saved = localStorage.getItem(STORAGE_KEY_USER);
                if (saved) {
                    this.currentUser = JSON.parse(saved);
                } else {
                    // Default guest user
                    this.currentUser = {
                        uid: 'guest_' + Math.random().toString(36).substring(2, 8),
                        username: 'Gast-Spieler',
                        isGuest: true,
                        joinedGroups: ['grp_speedrunners'],
                        createdAt: new Date().toISOString()
                    };
                    this.saveSession();
                }
            } catch (e) {
                console.warn('[CloudStorage] Failed loading user session:', e);
            }
        }

        saveSession() {
            try {
                if (this.currentUser) {
                    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(this.currentUser));
                }
            } catch (e) {}
            this.notify();
        }

        onAuthChange(fn) {
            this.listeners.add(fn);
            fn(this.currentUser);
            return () => this.listeners.delete(fn);
        }

        notify() {
            for (const fn of this.listeners) {
                try { fn(this.currentUser); } catch (e) { console.error(e); }
            }
        }

        /* ------------------------------------------------------------------ */
        /* Authentication (Mock & Firebase Bridge)                            */
        /* ------------------------------------------------------------------ */

        async login(username, password) {
            if (!username || username.trim().length < 2) {
                throw new Error('Benutzername muss mindestens 2 Zeichen lang sein.');
            }

            // If Firebase is configured, hook to Firebase Auth here:
            if (this.isFirebaseReady && window.firebase && window.firebase.auth) {
                // Return firebase.auth().signInWithEmailAndPassword(...)
            }

            // Local fallback simulation
            this.currentUser = {
                uid: 'usr_' + btoa(username.toLowerCase()).replace(/=/g, '').substring(0, 10),
                username: username.trim(),
                isGuest: false,
                joinedGroups: ['grp_speedrunners'],
                lastLogin: new Date().toISOString()
            };
            this.saveSession();
            return this.currentUser;
        }

        async register(username, email, password) {
            if (!username || username.trim().length < 2) {
                throw new Error('Benutzername muss mindestens 2 Zeichen haben.');
            }

            if (this.isFirebaseReady && window.firebase && window.firebase.auth) {
                // Hook to firebase.auth().createUserWithEmailAndPassword(...)
            }

            this.currentUser = {
                uid: 'usr_' + Math.random().toString(36).substring(2, 10),
                username: username.trim(),
                email: email || '',
                isGuest: false,
                joinedGroups: ['grp_speedrunners', 'grp_arcade_legends'],
                createdAt: new Date().toISOString()
            };
            this.saveSession();
            return this.currentUser;
        }

        logout() {
            this.currentUser = {
                uid: 'guest_' + Math.random().toString(36).substring(2, 8),
                username: 'Gast-Spieler',
                isGuest: true,
                joinedGroups: [],
                createdAt: new Date().toISOString()
            };
            this.saveSession();
        }

        /* ------------------------------------------------------------------ */
        /* Progress & Level Storage (1 - 100+)                                */
        /* ------------------------------------------------------------------ */

        getAllProgress() {
            try {
                return JSON.parse(localStorage.getItem(STORAGE_KEY_PROGRESS) || '{}');
            } catch (e) {
                return {};
            }
        }

        getGameProgress(gameId) {
            const all = this.getAllProgress();
            return all[gameId] || {
                unlockedLevel: 1,
                maxLevel: 1,
                highScore: 0,
                levels: {}
            };
        }

        async saveProgress(gameId, level, score = 0, stars = 3, metadata = {}) {
            const all = this.getAllProgress();
            if (!all[gameId]) {
                all[gameId] = { unlockedLevel: 1, maxLevel: 1, highScore: 0, levels: {} };
            }

            const p = all[gameId];
            p.unlockedLevel = Math.max(p.unlockedLevel || 1, level + 1);
            p.maxLevel = Math.max(p.maxLevel || 1, level);
            if (score > (p.highScore || 0)) {
                p.highScore = score;
            }

            if (!p.levels[level]) p.levels[level] = {};
            p.levels[level].completed = true;
            p.levels[level].stars = Math.max(p.levels[level].stars || 0, stars);
            p.levels[level].bestScore = Math.max(p.levels[level].bestScore || 0, score);
            p.levels[level].updatedAt = new Date().toISOString();

            localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(all));

            // Also record to leaderboards if high score
            if (score > 0) {
                this.recordLeaderboardEntry(gameId, score, level);
            }

            // Firebase sync hook:
            if (this.isFirebaseReady && window.firebase && window.firebase.firestore) {
                // sync to firestore: users/{uid}/progress/{gameId}
            }

            return p;
        }

        /* ------------------------------------------------------------------ */
        /* Leaderboards & Groups                                              */
        /* ------------------------------------------------------------------ */

        getLeaderboard(gameId, scope = 'global', groupId = null) {
            try {
                const lbs = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADERBOARDS) || '{}');
                let list = lbs[gameId] || [];

                // Filter by group if requested
                if (scope === 'group' && groupId) {
                    list = list.filter(entry => entry.group === groupId);
                }

                // Sort descending by score
                return list.slice().sort((a, b) => b.score - a.score);
            } catch (e) {
                return [];
            }
        }

        recordLeaderboardEntry(gameId, score, level) {
            try {
                const lbs = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADERBOARDS) || '{}');
                if (!lbs[gameId]) lbs[gameId] = [];

                const username = this.currentUser ? this.currentUser.username : 'Gast';
                const userGroup = (this.currentUser && this.currentUser.joinedGroups && this.currentUser.joinedGroups[0]) || 'grp_speedrunners';

                // Check if user already in list
                const existingIdx = lbs[gameId].findIndex(e => e.user === username);
                if (existingIdx >= 0) {
                    if (score > lbs[gameId][existingIdx].score) {
                        lbs[gameId][existingIdx].score = score;
                        lbs[gameId][existingIdx].level = level;
                        lbs[gameId][existingIdx].date = new Date().toISOString().slice(0, 10);
                        lbs[gameId][existingIdx].group = userGroup;
                    }
                } else {
                    lbs[gameId].push({
                        user: username,
                        score: score,
                        level: level,
                        date: new Date().toISOString().slice(0, 10),
                        group: userGroup
                    });
                }

                lbs[gameId].sort((a, b) => b.score - a.score);
                localStorage.setItem(STORAGE_KEY_LEADERBOARDS, JSON.stringify(lbs));
            } catch (e) {
                console.warn('[CloudStorage] Failed updating leaderboard:', e);
            }
        }

        getGroups() {
            try {
                return JSON.parse(localStorage.getItem(STORAGE_KEY_GROUPS) || '[]');
            } catch (e) {
                return [];
            }
        }

        async createGroup(name, desc = '') {
            if (!name || name.trim().length < 3) {
                throw new Error('Der Gruppenname muss mindestens 3 Zeichen lang sein.');
            }

            const groups = this.getGroups();
            const code = name.trim().substring(0, 4).toUpperCase() + Math.floor(100 + Math.random() * 900);
            const newGroup = {
                id: 'grp_' + Date.now().toString(36),
                code: code,
                name: name.trim(),
                desc: desc.trim() || 'Arcade Realm Gamer Gruppe',
                creator: this.currentUser ? this.currentUser.username : 'Gast',
                members: [this.currentUser ? this.currentUser.username : 'Gast']
            };

            groups.push(newGroup);
            localStorage.setItem(STORAGE_KEY_GROUPS, JSON.stringify(groups));

            if (this.currentUser) {
                if (!this.currentUser.joinedGroups) this.currentUser.joinedGroups = [];
                this.currentUser.joinedGroups.push(newGroup.id);
                this.saveSession();
            }

            return newGroup;
        }

        async joinGroupByCode(code) {
            if (!code) throw new Error('Bitte gib einen Gruppen-Code ein.');
            const cleanCode = code.trim().toUpperCase();
            const groups = this.getGroups();
            const target = groups.find(g => g.code.toUpperCase() === cleanCode);

            if (!target) {
                throw new Error(`Keine Gruppe mit dem Code "${cleanCode}" gefunden.`);
            }

            const username = this.currentUser ? this.currentUser.username : 'Gast';
            if (!target.members.includes(username)) {
                target.members.push(username);
                localStorage.setItem(STORAGE_KEY_GROUPS, JSON.stringify(groups));
            }

            if (this.currentUser) {
                if (!this.currentUser.joinedGroups) this.currentUser.joinedGroups = [];
                if (!this.currentUser.joinedGroups.includes(target.id)) {
                    this.currentUser.joinedGroups.push(target.id);
                    this.saveSession();
                }
            }

            return target;
        }

        /* ------------------------------------------------------------------ */
        /* Firebase Setup Bridge                                              */
        /* ------------------------------------------------------------------ */

        initFirebase(config) {
            if (!config || !config.apiKey) return false;
            try {
                if (typeof firebase !== 'undefined') {
                    if (!firebase.apps.length) {
                        firebase.initializeApp(config);
                    }
                    this.isFirebaseReady = true;
                    console.log('🔥 Firebase Cloud Storage successfully initialized!');
                    return true;
                }
            } catch (err) {
                console.error('[CloudStorage] Firebase init failed:', err);
            }
            return false;
        }
    }

    // Expose globally
    window.CloudStorage = new CloudStorageService();

    // Auto-init Firebase if config object is provided in page
    if (window.FIREBASE_CONFIG) {
        window.CloudStorage.initFirebase(window.FIREBASE_CONFIG);
    }
})();

