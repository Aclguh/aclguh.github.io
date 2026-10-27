import js from '@eslint/js';
import globals from 'globals';

// 全站公共基础设施全局变量
const sharedGlobals = {
    escapeHtml: 'readonly',
    escapeAttr: 'readonly',
    escapeHTML: 'readonly',
    sanitizeUrl: 'readonly',
    SafeStorage: 'readonly',
    ThemeManager: 'readonly',
    UIKit: 'readonly',
    Toast: 'readonly',
    Modal: 'readonly'
};

export default [
    js.configs.recommended,
    {
        ignores: ['node_modules/**', 'shared/vendor/**', '**/*.min.js', '.git/**', 'coverage/**', '.claude/**']
    },
    // 全站基础规则
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.serviceworker,
                ...sharedGlobals
            }
        },
        rules: {
            // 启用严格变量检查：检查局部未声明、死变量与重复声明
            'no-undef': 'error',
            'no-redeclare': ['error', { builtinGlobals: false }],
            'no-unused-vars': [
                'error',
                {
                    vars: 'local',
                    args: 'after-used',
                    caughtErrors: 'none',
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_'
                }
            ],
            'no-useless-assignment': 'warn',
            'no-empty': ['warn', { allowEmptyCatch: true }],
            // 核心代码正确性检查（拦截真正的逻辑 Bug）
            'no-dupe-keys': 'error',
            'no-duplicate-case': 'error',
            'no-unreachable': 'error',
            'valid-typeof': 'error',
            'no-constant-condition': 'warn',
            'no-self-assign': 'error'
        }
    },
    // 看番记录子应用全局变量
    {
        files: ['anime-record/js/**/*.js'],
        languageOptions: {
            globals: {
                AnimeRecord: 'readonly',
                STATUS: 'readonly',
                STATUS_LABELS: 'readonly',
                STATUS_ORDER: 'readonly',
                STATUS_COLORS: 'readonly',
                WEEK: 'readonly',
                WEEK_ORDER: 'readonly',
                WEEK_LABELS: 'readonly',
                WEEK_LABELS_FULL: 'readonly',
                WEEK_COLORS: 'readonly',
                AIR_STATUS: 'readonly',
                AIR_STATUS_LABELS: 'readonly',
                AIR_STATUS_COLORS: 'readonly',
                SORT_OPTIONS: 'readonly',
                SORT_LABELS: 'readonly',
                generateId: 'readonly',
                createEmptyRecord: 'readonly',
                validateRecord: 'readonly',
                STORAGE_KEY: 'readonly',
                DEFAULT_RECORDS: 'readonly',
                DATA_VERSION: 'readonly',
                loadRecords: 'readonly',
                saveRecords: 'readonly',
                getRecord: 'readonly',
                addRecord: 'readonly',
                updateRecord: 'readonly',
                deleteRecord: 'readonly',
                getTombstones: 'readonly',
                saveTombstones: 'readonly',
                normalizeRecord: 'readonly',
                checkVersion: 'readonly',
                exportData: 'readonly',
                exportTemplate: 'readonly',
                triggerImport: 'readonly',
                handleImportFile: 'readonly',
                openAddForm: 'readonly',
                openEditForm: 'readonly',
                hideModal: 'readonly',
                showConfirm: 'readonly',
                saveFormRecord: 'readonly',
                deleteFormRecord: 'readonly',
                deleteRecordFromCard: 'readonly',
                episodePlusOne: 'readonly',
                refreshCards: 'readonly',
                renderStats: 'readonly',
                loadMoreCards: 'readonly',
                showToast: 'readonly',
                countRecordsByWeek: 'readonly',
                getStatusFilteredRecords: 'readonly',
                populateWeekOptions: 'readonly',
                populateAirOptions: 'readonly',
                applyDefaultStatusFilter: 'readonly',
                activeWeekFilter: 'writable',
                refreshUpdatedLabels: 'readonly',
                openSettingsModal: 'readonly',
                closeSettingsModal: 'readonly',
                setDefaultStatus: 'readonly',
                cleanGistId: 'readonly',
                SyncService: 'readonly',
                DragSort: 'readonly',
                createBadgesHTML: 'readonly',
                createEpisodeInfoHTML: 'readonly',
                ICONS: 'readonly',
                formatUpdatedAt: 'readonly',
                formatFullDateTime: 'readonly'
            }
        }
    },
    // 课程表子应用全局变量
    {
        files: ['class-schedule/js/**/*.js'],
        languageOptions: {
            globals: {
                ScheduleApp: 'readonly',
                XLSX: 'readonly',
                COURSE_COLORS: 'readonly',
                DAY_NAMES: 'readonly',
                MAX_SLOTS: 'readonly',
                MAX_WEEKS: 'readonly',
                DEFAULT_TIME_SLOTS: 'readonly',
                parseFile: 'readonly',
                parseCSVContent: 'readonly',
                parseCSVLine: 'readonly',
                parseWeeks: 'readonly',
                parseXLSContent: 'readonly',
                parseXLSFile: 'readonly',
                parseCSVFile: 'readonly',
                loadSchedule: 'readonly',
                saveSchedule: 'readonly',
                clearSchedule: 'readonly',
                loadCurrentWeek: 'readonly',
                saveCurrentWeek: 'readonly',
                loadViewMode: 'readonly',
                saveViewMode: 'readonly',
                loadTimeSlots: 'readonly',
                saveTimeSlots: 'readonly',
                loadStartDate: 'readonly',
                saveStartDate: 'readonly',
                loadSemesterStart: 'readonly',
                saveSemesterStart: 'readonly',
                renderPage: 'readonly',
                renderCurrentView: 'readonly',
                renderSchedule: 'readonly',
                renderDayView: 'readonly',
                renderStats: 'readonly',
                renderSemesterInfo: 'readonly',
                renderWeekNavigator: 'readonly',
                renderToolbar: 'readonly',
                showEmptyState: 'readonly',
                getRenderSlots: 'readonly',
                formatSlotTime: 'readonly',
                formatWeeks: 'readonly',
                getTodayWeekAndDay: 'readonly',
                showImportConfirmModal: 'readonly',
                showErrorModal: 'readonly',
                showTimeSlotModal: 'readonly',
                showStartDateModal: 'readonly',
                showToast: 'readonly',
                setSelectedDay: 'readonly',
                downloadCSVTemplate: 'readonly',
                showImportDialog: 'readonly',
                generateId: 'readonly',
                expandTimeSlotsTo: 'readonly',
                renderSlotEditor: 'readonly',
                createSlotRow: 'readonly',
                makeDefaultSlot: 'readonly',
                updateSlotIndexes: 'readonly'
            }
        }
    },
    // 体重记录子应用全局变量
    {
        files: ['weightRecord/js/**/*.js'],
        languageOptions: {
            globals: {
                Chart: 'readonly',
                WeightCalc: 'readonly',
                WeightStorage: 'readonly',
                WeightChartConfig: 'readonly',
                WeightTableView: 'readonly'
            }
        }
    },
    // 天国骰子子应用全局变量
    {
        files: ['farkle/js/**/*.js'],
        languageOptions: {
            globals: {
                DICE_DATA: 'readonly',
                DICE_LIST: 'readonly',
                getDieDef: 'readonly',
                rollDieDef: 'readonly',
                formatProbText: 'readonly',
                calcProbs: 'readonly',
                BADGES: 'readonly',
                getBadgeDef: 'readonly',
                makeBadge: 'readonly',
                randomAiBadge: 'readonly',
                TARGET_TIERS: 'readonly',
                TIER_CN: 'readonly',
                TIER_RANK: 'readonly',
                scoreDice: 'readonly',
                checkFarkle: 'readonly',
                canBank: 'readonly',
                scoreValues: 'readonly',
                scoreDetail: 'readonly',
                hasAnyScore: 'readonly',
                takeGroups: 'readonly',
                fxFor: 'readonly',
                state: 'writable',
                pendingReset: 'writable',
                initRound: 'readonly',
                chooseDice: 'readonly',
                bankPoints: 'readonly',
                endTurn: 'readonly',
                aiTakeTurn: 'readonly',
                generateAiDice: 'readonly',
                renderBoard: 'readonly',
                shown: 'readonly',
                onTargetClick: 'readonly',
                toggleSelect: 'readonly',
                FarkleUIBoard: 'readonly',
                FarkleModalManager: 'readonly',
                openDiceSelectModal: 'readonly',
                openSettingsModal: 'readonly',
                openBadgeModal: 'readonly',
                saveStoredDefaultDice: 'readonly',
                loadStoredDefaultDice: 'readonly',
                loadStoredUseDefault: 'readonly',
                saveStoredUseDefault: 'readonly'
            }
        }
    },
    // 斗地主子应用全局变量
    {
        files: ['doudizhu/js/**/*.js'],
        languageOptions: {
            globals: {
                JOKER_S: 'readonly',
                JOKER_B: 'readonly',
                SUITS: 'readonly',
                RANKS: 'readonly',
                TYPES: 'readonly',
                makeDeck: 'readonly',
                buildDeck: 'readonly',
                shuffle: 'readonly',
                sortCards: 'readonly',
                deal: 'readonly',
                rankText: 'readonly',
                suitColor: 'readonly',
                cardText: 'readonly',
                typeText: 'readonly',
                identify: 'readonly',
                canBeat: 'readonly',
                beats: 'readonly',
                countsOf: 'readonly',
                mainRanks: 'readonly',
                makeIndex: 'readonly',
                indexSize: 'readonly',
                listLeads: 'readonly',
                listBeats: 'readonly',
                hintOptions: 'readonly',
                aiBid: 'readonly',
                aiPlay: 'readonly',
                aiDecide: 'readonly',
                aiBestLead: 'readonly',
                allSubsets: 'readonly',
                findHands: 'readonly'
            }
        }
    },
    // 将棋子应用全局变量
    {
        files: ['shogi/js/**/*.js'],
        languageOptions: {
            globals: {
                PIECES: 'readonly',
                PROMOTIONS: 'readonly',
                DEMOTIONS: 'readonly',
                INITIAL_BOARD: 'readonly',
                PROMOTED_NAME: 'readonly',
                FULL_NAME: 'readonly',
                HAND_TYPES: 'readonly',
                createInitialState: 'readonly',
                cloneState: 'readonly',
                deserializeState: 'readonly',
                serializeState: 'readonly',
                generateLegalMoves: 'readonly',
                makeMove: 'readonly',
                unmakeMove: 'readonly',
                isCheck: 'readonly',
                isInCheck: 'readonly',
                movePattern: 'readonly',
                stateKey: 'readonly',
                initialState: 'readonly',
                GameState: 'readonly',
                game: 'writable',
                render: 'readonly',
                renderLog: 'readonly',
                recordKey: 'readonly',
                refreshTurn: 'readonly',
                toast: 'readonly',
                newGame: 'readonly',
                restoreSnapshot: 'readonly',
                aiChooseMove: 'readonly',
                evaluateState: 'readonly',
                ShogiTutorial: 'readonly',
                tutorialAfterMove: 'readonly',
                tut: 'writable',
                dropRejectionReason: 'readonly',
                loadTutorialStep: 'readonly',
                startTutorial: 'readonly',
                exitTutorial: 'readonly',
                TSTEPS: 'readonly',
                updateTutorialPanel: 'readonly',
                setTutSub: 'readonly'
            }
        }
    },
    // 图片混淆子应用全局变量
    {
        files: ['imageObfuscation/js/**/*.js'],
        languageOptions: {
            globals: {
                GilbertObfuscation: 'readonly'
            }
        }
    },
    // 舒尔特方格子应用全局变量
    {
        files: ['schulte-grid/js/**/*.js'],
        languageOptions: {
            globals: {
                SchulteGame: 'readonly'
            }
        }
    },
    // 终末地子应用全局变量
    {
        files: ['ark_end/**/*.js'],
        languageOptions: {
            globals: {
                weaponsData: 'readonly',
                filterWeapons: 'readonly',
                findBestRecommendation: 'readonly'
            }
        }
    },
    // 测试文件专用规则
    {
        files: ['tests/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.node
            }
        },
        rules: {
            'no-undef': 'error',
            'no-redeclare': 'error',
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
        }
    }
];
