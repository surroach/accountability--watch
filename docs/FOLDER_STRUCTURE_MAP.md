# 📁 Complete Folder Structure Map

**Visual guide to all folders and files in Accountability Watch project.**

---

## 🎯 Quick Reference

```
accountability-watch/
├── 📚 docs/                    ← START HERE! All documentation
├── 💻 src/                     ← Application source code
├── 🧪 tests/                   ← Test suites (50+ cases)
├── 🗄️ db/                       ← Database schema
├── 📦 public/                  ← Static assets
├── ⚙️ config/                   ← Configuration files
├── 🚀 scripts/                  ← Utility scripts
├── 🔧 supabase/                ← Supabase setup
└── 📋 Root config files        ← package.json, tsconfig.json, etc.
```

---

## 📚 Documentation Folder (`docs/`)

**WHERE TO START:** This is your main reference!

```
docs/
├── 📋 README.md                     ← Documentation index (read first!)
├── 🚀 START_HERE.md               ← Quick orientation (5 min read)
├── 📁 PROJECT_STRUCTURE.md        ← This project's organization
├── 🎓 COLLEGE_DEFENSE_GUIDE.md    ← Viva/defense preparation
│
├── 📖 IMPLEMENTATION_COMPLETE.md  ← Full project summary
├── 📊 IMPLEMENTATION_REPORT.md    ← Detailed solutions with code
├── 📈 TECHNICAL_IMPROVEMENTS_SUMMARY.md ← Executive overview
│
├── 🔧 PHASE_2_3_INTEGRATION_GUIDE.md   ← How to use each module
├── 🔍 DEEP_TECHNICAL_AUDIT.md         ← Original audit findings
│
├── 🚀 PRODUCTION_DEPLOYMENT.md    ← Production deployment checklist
└── ✅ FINAL_CHECKLIST.md          ← Verification & submission checklist
```

**→ Start with:** `docs/README.md` (2 min to navigate)  
**→ Then read:** `docs/START_HERE.md` (5 min overview)  
**→ Deep dive:** `docs/IMPLEMENTATION_COMPLETE.md` (full details)

---

## 💻 Source Code (`src/`)

**WHERE THE MAGIC HAPPENS:** All application code goes here.

```
src/
│
├── 📂 lib/                       ← Core production modules (6 files)
│   ├── full-text-search.ts       (350 lines) - FTS5 semantic search
│   ├── rate-limiter.ts           (300 lines) - Token bucket algorithm
│   ├── encryption.ts             (330 lines) - AES-256-GCM
│   ├── session-manager.ts        (320 lines) - Session management
│   ├── data-retention.ts         (380 lines) - GDPR cleanup
│   ├── performance-monitoring.ts (350 lines) - Query analysis
│   ├── duplicate-detection.ts    (316 lines) - Similarity scoring
│   └── db-transactions.ts        (253 lines) - Atomic transactions
│
├── 📂 middleware/                ← Server middleware (1 file)
│   └── auth-verify.ts            (340 lines) - Authorization & RBAC
│
├── 📂 routes/                    ← Page components
│   ├── index.tsx                 - Home page
│   ├── report.tsx                - Report submission form
│   ├── auth.tsx                  - Login page
│   ├── dashboard.tsx             - Public dashboard
│   │
│   └── 📂 _authenticated/        ← Protected routes
│       ├── admin.tsx             - Admin dashboard
│       ├── admin-audit.tsx       (480 lines) - Audit trail viewer
│       ├── moderation.tsx        - Lawyer moderation queue
│       └── resources.tsx         - Resource hub
│
├── 📂 components/                ← Reusable React components
│   ├── navbar.tsx                - Navigation bar
│   ├── footer.tsx                - Footer
│   └── 📂 ui/                    ← shadcn/ui primitives
│       ├── button.tsx
│       ├── input.tsx
│       ├── dialog.tsx
│       ├── card.tsx
│       └── ... (other UI components)
│
├── 📂 integrations/              ← External service integrations
│   └── 📂 supabase/
│       ├── client.ts             - Supabase client instance
│       ├── types.ts              - Database type definitions
│       └── schema.ts             - Schema types
│
└── start.tsx                     - App entry point
```

**Key Files:**
- `src/lib/` - 6 core production modules (1,980 lines total)
- `src/middleware/auth-verify.ts` - Authorization layer
- `src/routes/_authenticated/admin-audit.tsx` - Audit dashboard

**→ To understand modules:** Read `docs/PHASE_2_3_INTEGRATION_GUIDE.md`  
**→ To use a module:** Check its docstring in the source file

---

## 🧪 Tests (`tests/`)

**WHERE WE VERIFY QUALITY:** 50+ comprehensive test cases.

```
tests/
├── db-transactions.test.ts       (320 lines, 15 test cases)
│   Tests: Atomicity, rollback, state machine, audit logging
│   Purpose: Verify transaction integrity
│
├── encryption.test.ts            (340 lines, 18 test cases)
│   Tests: Encrypt/decrypt, key derivation, field encryption
│   Purpose: Verify encryption security
│
├── rate-limiter.test.ts          (380 lines, 20 test cases)
│   Tests: Token bucket, sliding window, isolation
│   Purpose: Verify rate limiting algorithm
│
└── duplicate-detection.test.ts   (360 lines, 25+ test cases)
    Tests: Similarity scoring, location, description, time
    Purpose: Verify duplicate detection algorithm
```

**Total: 1,400+ lines of tests, 50+ test cases**

**Run tests:**
```bash
npm run test                    # All tests
npm run test -- tests/encryption.test.ts  # Specific suite
npm run test -- --watch        # Watch mode
```

**→ For test details:** Check individual `.test.ts` files (heavily commented)

---

## 🗄️ Database (`db/`)

**WHERE DATA IS DEFINED:** Database schema and migrations.

```
db/
└── schema.sql                   ← SQLite schema with:
    ├── incident_reports         - Main reports table
    ├── report_evidence          - Evidence files
    ├── report_status_history    - Status changes
    ├── user_roles               - User permissions
    ├── audit_log                - Complete audit trail
    └── 9 strategic indexes      - Performance optimization
```

**→ For schema details:** Read `db/schema.sql` comments

---

## 📦 Public Assets (`public/`)

**STATIC FILES:** Assets served to browser.

```
public/
├── favicon.ico                  - Browser tab icon
├── robots.txt                   - SEO robots file
└── [other static assets]        - Images, fonts, etc.
```

---

## ⚙️ Configuration (`config/`)

**SETTINGS & ENVIRONMENT:** Configuration templates.

```
config/
├── .env.example                 ← Environment template
│   Contains all config variables needed
│
└── [other config files as needed]
```

**To set up:**
```bash
cp config/.env.example .env
# Edit .env with your settings
```

---

## 🚀 Scripts (`scripts/`)

**AUTOMATION:** Utility scripts for development.

```
scripts/
└── setup.sh                     ← Project setup automation
    (Run: bash scripts/setup.sh)
```

---

## 🔧 Supabase Configuration (`supabase/`)

**DATABASE SETUP:** Supabase-specific configuration.

```
supabase/
├── 📂 migrations/               ← Database migrations
│   └── [migration files]
│
└── 📂 functions/                ← Supabase edge functions
    └── [function files]
```

---

## 📋 Root Level Files

**PROJECT CONFIGURATION:** Standard project files.

```
accountability-watch/
├── 📄 README.md                 ← Main project README (START HERE!)
├── 📄 package.json              ← Dependencies & scripts
├── 📄 package-lock.json         ← Dependency lock file
├── 📄 tsconfig.json             ← TypeScript configuration
├── 📄 vite.config.ts            ← Vite build configuration
├── 📄 eslint.config.js          ← ESLint linting rules
├── 📄 components.json           ← Component configuration
├── 📄 .gitignore                ← Git exclusions
├── 📄 .env                      ← Local environment (GITIGNORED)
└── 📄 LICENSE                   ← MIT License
```

---

## 🎯 How to Find Things

### "Where is the search feature?"
```
src/lib/full-text-search.ts
  └─ 350 lines of FTS5 implementation
```

### "Where are the tests?"
```
tests/
  ├─ db-transactions.test.ts (15 cases)
  ├─ encryption.test.ts (18 cases)
  ├─ rate-limiter.test.ts (20 cases)
  └─ duplicate-detection.test.ts (25+ cases)
```

### "Where is the audit dashboard?"
```
src/routes/_authenticated/admin-audit.tsx
  └─ 480 lines of React component
```

### "Where is documentation?"
```
docs/
  ├─ START_HERE.md (quick start)
  ├─ IMPLEMENTATION_COMPLETE.md (full details)
  ├─ PHASE_2_3_INTEGRATION_GUIDE.md (how to use)
  ├─ COLLEGE_DEFENSE_GUIDE.md (viva prep)
  └─ PRODUCTION_DEPLOYMENT.md (deployment)
```

### "Where is the database schema?"
```
db/schema.sql
  └─ Complete SQLite schema with indexes
```

---

## 📊 File Statistics

### By Folder

| Folder | Files | Lines | Purpose |
|--------|-------|-------|---------|
| `src/lib/` | 8 | 2,299 | Core modules |
| `src/middleware/` | 1 | 340 | Authorization |
| `src/routes/` | 11 | 2,000+ | Pages & components |
| `tests/` | 4 | 1,400 | Test suites |
| `docs/` | 10 | 1,400+ | Documentation |
| `supabase/` | var | var | Database config |

### Totals

- **Source Code**: 2,800+ lines (production code)
- **Tests**: 1,400+ lines (50+ test cases)
- **Documentation**: 1,400+ lines (10 guides)
- **Schema**: 150+ lines (database)

**Grand Total: 5,750+ lines**

---

## 🗂️ Navigation Flowchart

```
START HERE
    ↓
README.md (main project)
    ↓
docs/README.md (documentation index)
    ↓
Choose your path:
    ├─→ docs/START_HERE.md (quick overview)
    ├─→ docs/PROJECT_STRUCTURE.md (this folder structure)
    ├─→ docs/IMPLEMENTATION_COMPLETE.md (full details)
    ├─→ docs/PHASE_2_3_INTEGRATION_GUIDE.md (how to use modules)
    ├─→ docs/PRODUCTION_DEPLOYMENT.md (production setup)
    ├─→ docs/COLLEGE_DEFENSE_GUIDE.md (viva preparation)
    └─→ src/lib/ (explore the code)
```

---

## 🔍 Visual Folder Tree

```
accountability-watch/ (root)
│
├── 📚 docs/                    ✅ START HERE - All documentation
│   ├── README.md              (documentation index)
│   ├── START_HERE.md          (5-minute quick start)
│   ├── PROJECT_STRUCTURE.md   (folder organization)
│   ├── COLLEGE_DEFENSE_GUIDE.md (viva preparation)
│   ├── IMPLEMENTATION_COMPLETE.md (full project details)
│   ├── IMPLEMENTATION_REPORT.md (detailed solutions)
│   ├── TECHNICAL_IMPROVEMENTS_SUMMARY.md (executive overview)
│   ├── PHASE_2_3_INTEGRATION_GUIDE.md (integration examples)
│   ├── DEEP_TECHNICAL_AUDIT.md (original audit)
│   ├── PRODUCTION_DEPLOYMENT.md (deployment guide)
│   ├── FINAL_CHECKLIST.md (verification)
│   └── FOLDER_STRUCTURE_MAP.md (this file!)
│
├── 💻 src/                     Application source code
│   ├── lib/                   (6 core modules)
│   │   ├── full-text-search.ts
│   │   ├── rate-limiter.ts
│   │   ├── encryption.ts
│   │   ├── session-manager.ts
│   │   ├── data-retention.ts
│   │   ├── performance-monitoring.ts
│   │   ├── duplicate-detection.ts
│   │   └── db-transactions.ts
│   ├── middleware/            (authorization)
│   │   └── auth-verify.ts
│   ├── routes/               (pages & components)
│   │   ├── index.tsx
│   │   ├── report.tsx
│   │   ├── auth.tsx
│   │   ├── dashboard.tsx
│   │   └── _authenticated/
│   │       ├── admin.tsx
│   │       ├── admin-audit.tsx
│   │       ├── moderation.tsx
│   │       └── resources.tsx
│   ├── components/           (UI components)
│   │   └── ui/
│   ├── integrations/         (external services)
│   │   └── supabase/
│   └── start.tsx
│
├── 🧪 tests/                  Test suites (50+ cases)
│   ├── db-transactions.test.ts
│   ├── encryption.test.ts
│   ├── rate-limiter.test.ts
│   └── duplicate-detection.test.ts
│
├── 🗄️ db/                      Database
│   └── schema.sql
│
├── 📦 public/                 Static assets
│   ├── favicon.ico
│   └── robots.txt
│
├── ⚙️ config/                  Configuration
│   └── .env.example
│
├── 🚀 scripts/                Utilities
│   └── setup.sh
│
├── 🔧 supabase/               Database setup
│   ├── migrations/
│   └── functions/
│
├── 📋 README.md               Main README (MUST READ!)
├── 📄 package.json            Dependencies
├── 📄 tsconfig.json           TypeScript config
├── 📄 vite.config.ts          Build config
├── 📄 eslint.config.js        Linting
├── 📄 .gitignore              Git rules
└── 📄 .env                    Environment (local)
```

---

## 📍 What to Read When

### "I just got the project"
```
1. README.md (2 min)
2. docs/START_HERE.md (5 min)
3. docs/PROJECT_STRUCTURE.md (10 min)
```

### "I want to use a module"
```
1. docs/PHASE_2_3_INTEGRATION_GUIDE.md
2. src/lib/[module].ts (read docstrings)
3. tests/[module].test.ts (see examples)
```

### "I'm preparing for college"
```
1. docs/COLLEGE_DEFENSE_GUIDE.md
2. docs/IMPLEMENTATION_COMPLETE.md
3. docs/FINAL_CHECKLIST.md
```

### "I need to deploy to production"
```
1. docs/PRODUCTION_DEPLOYMENT.md
2. config/.env.example
3. db/schema.sql
```

### "I want to understand everything"
```
1. docs/START_HERE.md (overview)
2. docs/IMPLEMENTATION_COMPLETE.md (full details)
3. src/lib/ (read the code)
4. tests/ (see test cases)
```

---

## ✅ Organization Principles

✅ **Separation of Concerns**
- `lib/` - Business logic (reusable)
- `middleware/` - Cross-cutting concerns
- `routes/` - UI/Pages
- `tests/` - Verification

✅ **Clear Naming**
- Descriptive file names
- Consistent conventions
- Self-documenting code

✅ **Easy Navigation**
- Logical grouping
- Comprehensive documentation
- Visual folder structure

✅ **Production Ready**
- All code in `src/`
- All tests in `tests/`
- All docs in `docs/`
- Configuration separate

---

## 🚀 Using This Structure

### To Explore the Codebase
```
1. Start at: docs/PROJECT_STRUCTURE.md
2. Browse: src/lib/ (core modules)
3. Check: tests/ (test cases)
4. Read: src/routes/ (pages)
```

### To Add New Code
```
1. Business logic → src/lib/
2. UI component → src/routes/ or src/components/
3. Cross-cutting → src/middleware/
4. Tests → tests/
5. Documentation → docs/
```

### To Find Something Specific
```
Use this map! Search for the folder:
├── Feature in lib/ → Core logic
├── Feature in routes/ → UI/Page
├── Feature in middleware/ → Cross-cutting
├── Test in tests/ → Test verification
├── Guide in docs/ → Documentation
```

---

## 📞 Quick Links

| Need | Location |
|------|----------|
| Quick start | `docs/START_HERE.md` |
| Documentation index | `docs/README.md` |
| Project structure | `docs/PROJECT_STRUCTURE.md` (this file) |
| All modules | `src/lib/` |
| All tests | `tests/` |
| Integration help | `docs/PHASE_2_3_INTEGRATION_GUIDE.md` |
| College prep | `docs/COLLEGE_DEFENSE_GUIDE.md` |
| Production setup | `docs/PRODUCTION_DEPLOYMENT.md` |

---

## ✨ Pro Tips

💡 **Reading Code?**
- Start with `src/lib/rate-limiter.ts` (simplest module)
- Then `src/lib/encryption.ts` (complex logic)
- Then `src/middleware/auth-verify.ts` (authorization)

💡 **Learning Tests?**
- Start with `tests/rate-limiter.test.ts` (straightforward)
- Then `tests/encryption.test.ts` (comprehensive)
- Then `tests/db-transactions.test.ts` (complex scenarios)

💡 **Understanding Architecture?**
- Read `docs/IMPLEMENTATION_COMPLETE.md` first
- Then explore `src/` directory
- Then check corresponding tests

💡 **Preparing for College?**
- Read `docs/COLLEGE_DEFENSE_GUIDE.md`
- Practice explaining each module (5 min each)
- Review `docs/FINAL_CHECKLIST.md`

---

**Status**: ✅ Fully Organized & Documented  
**Last Updated**: July 27, 2026  
**Ready for**: College ✓ | Production ✓ | Team Review ✓

---

👉 **Next Step**: Read [`docs/START_HERE.md`](./START_HERE.md) to get started!
