# 🛡️ Accountability Watch

**A civic technology platform for documenting alleged police misconduct at protests.**

Accountability Watch enables anonymous incident reporting with role-based moderation and secure evidence storage. Built for legal aid organizations, civil-rights researchers, and journalists.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-5.0+-blue)](https://www.typescriptlang.org/)

---

## 📖 Contents

- [What is Accountability Watch?](#what-is-accountability-watch)
- [Features](#features)
- [How it works](#how-it-works)
- [Getting started](#getting-started)
- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [Database](#database)
- [Security](#security)
- [Testing](#testing)
- [Documentation](#documentation)
- [Limitations](#limitations)
- [Development](#development)
- [License](#license)

---

## What is Accountability Watch?

Accountability Watch is a web-based platform designed to collect and securely store documentation of alleged police misconduct during protests. 

**The problem it addresses:**
- Incidents at protests often go undocumented, making it difficult for legal aid organizations to investigate allegations
- Evidence can be lost, photos deleted, or details forgotten
- Individuals reporting misconduct face safety and privacy concerns
- There is no centralized, anonymous way for civil-rights researchers and journalists to track patterns

**Who it's for:**
- **Citizens & Witnesses**: Document incidents privately without identification
- **Legal Aid Partners**: Access vetted reports for investigation and legal referral
- **Civil-Rights Researchers**: Analyze aggregate incident data (anonymized)
- **Journalists**: Track patterns of misconduct across time and location
- **Administrators**: Moderate reports and manage the platform

**What it does:**
1. Accepts anonymous incident reports with evidence (photos, videos)
2. Stores reports privately in a secure database with cryptographic integrity verification
3. Provides role-based access for moderation and review
4. Allows legal partners to export cases for referral
5. Publishes aggregate, anonymized statistics

---

## Features

### For Reporters
- 📝 **Anonymous Submission** - No account or login required
- 📸 **Evidence Upload** - Attach photos, videos, documents (SHA-256 verification)
- 🕐 **Automatic Timestamping** - Records exact incident time and date
- 🔒 **Privacy by Default** - Personal information encrypted and not exposed
- 🔍 **Report Tracking** - Check report status without account

### For Legal Partners
- ✅ **Moderation Queue** - Review pending reports
- 📋 **Case Details** - Full incident information, evidence, timelines
- 🔐 **Secure Access** - Role-based authorization
- 📤 **Export & Referral** - Download cases for legal action
- 📊 **Incident Analytics** - View trends and patterns

### For Administrators
- 🎛️ **Dashboard** - System overview and metrics
- 👥 **User Management** - Role assignment and access control
- 🔧 **Configuration** - System settings and moderation rules
- 📋 **Audit Log** - Complete record of all platform actions
- 📈 **Performance Monitoring** - Query optimization and system health

### Technical Features
- 🔍 **Full-Text Search** - SQLite FTS5 for finding reports by keywords
- 🛡️ **Rate Limiting** - Protection against brute-force attacks
- 🔐 **Encryption** - AES-256-GCM for sensitive personal data
- ⏱️ **Session Management** - 15-minute timeout with auto-refresh
- 📊 **Query Performance Monitoring** - Database optimization insights
- 🔄 **Duplicate Detection** - Identifies potential duplicate reports
- 📅 **Automated Data Retention** - GDPR-compliant cleanup policies
- 💾 **Atomic Transactions** - Ensures data consistency

---

## How It Works

```
┌─────────────────┐
│  Citizen/Witness│
└────────┬────────┘
         │
         ▼ Anonymous report + evidence
┌──────────────────────────┐
│  Report Submission Form  │
│ (No login required)      │
└────────┬─────────────────┘
         │
         ▼ Validate & store
┌──────────────────────────┐
│  SQLite Database         │
│  (Encrypted fields)      │
└────────┬─────────────────┘
         │
         ├──────────────────────┐
         │                      │
         ▼ (if claimed)         ▼ (public access)
   ┌──────────────┐        ┌─────────────────┐
   │ Legal Partner│        │ Dashboard       │
   │ (Moderation) │        │ (Aggregate data)│
   └──────────────┘        └─────────────────┘
```

**Report lifecycle:**
1. **Submission**: User files anonymous report (3 min, no account)
2. **Storage**: Report encrypted, timestamped, hashed for integrity
3. **Moderation**: Legal partners review and approve/reject
4. **Tracking**: User can check status via report code
5. **Referral**: Legal team exports approved cases
6. **Analytics**: Aggregate statistics published publicly (anonymized)

---

## Getting Started

### Prerequisites
- **Node.js** 18 or later
- **npm** or **yarn**

### Installation

```bash
# Clone the repository
git clone https://github.com/surroach/accountability-watch.git
cd accountability-watch

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev
```

The application opens at `http://localhost:5173`

### Environment Setup

See `.env.example` for required variables. Key configuration:
- `VITE_SUPABASE_URL` - Backend service URL (optional - for legal partner access)
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Frontend authentication key (optional)
- `VITE_QUICK_EXIT_URL` - Quick exit button destination

All environment variables are optional for local development with SQLite.

---

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Frontend** | React 19 + TanStack Start | SSR UI framework |
| **Styling** | Tailwind CSS | Responsive design |
| **Language** | TypeScript 5+ | Type-safe code |
| **Database** | SQLite | Local persistent storage |
| **Authentication** | Role-based (Admin, Legal, Moderator) | Access control |
| **UI Components** | Radix UI | Accessible component library |
| **Forms** | React Hook Form + Zod | Form validation |
| **Testing** | Vitest | Unit test framework |
| **Build** | Vite | Fast development & production build |

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────┐
│ Client Browser                                       │
│ (React SPA - TanStack Start)                         │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼ HTTP/HTTPS
┌─────────────────────────────────────────────────────┐
│ Application Server (TanStack Start)                  │
│                                                      │
│ ┌──────────────────────────────────────────────┐   │
│ │ Routes                                       │   │
│ │ • / - Home                                   │   │
│ │ • /report - Anonymous submission             │   │
│ │ • /dashboard - Public statistics             │   │
│ │ • /admin/* - Admin & legal partner tools    │   │
│ └──────────────────────────────────────────────┘   │
│                                                      │
│ ┌──────────────────────────────────────────────┐   │
│ │ Middleware Layer                             │   │
│ │ • Authentication & Authorization (RBAC)      │   │
│ │ • Rate limiting                              │   │
│ │ • Session management                         │   │
│ │ • Audit logging                              │   │
│ └──────────────────────────────────────────────┘   │
│                                                      │
│ ┌──────────────────────────────────────────────┐   │
│ │ Business Logic (src/lib/)                    │   │
│ │ • Encryption/Decryption                      │   │
│ │ • Full-text search                           │   │
│ │ • Duplicate detection                        │   │
│ │ • Performance monitoring                      │   │
│ │ • Data retention policies                     │   │
│ │ • Transaction management                      │   │
│ └──────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼ SQL/SQLite
┌─────────────────────────────────────────────────────┐
│ SQLite Database                                      │
│ (Local file-based storage)                           │
│                                                      │
│ Tables:                                              │
│ • incident_reports                                   │
│ • report_evidence                                    │
│ • report_status_history                              │
│ • user_roles                                         │
│ • audit_log                                          │
└─────────────────────────────────────────────────────┘
```

### Key Components

- **Routes** (`src/routes/`) - Page components and endpoints
- **Middleware** (`src/middleware/`) - Authentication, authorization, rate limiting
- **Libraries** (`src/lib/`) - Business logic and security functions
- **Hooks** (`src/hooks/`) - React hooks for state management
- **Components** (`src/components/`) - Reusable UI components

---

## Database

Accountability Watch uses **SQLite** for persistent storage. This provides:
- ✅ No external database infrastructure required
- ✅ ACID transactions for data consistency
- ✅ Full-text search (FTS5) for semantic queries
- ✅ Simple file-based backups

### Schema Overview

**incident_reports**
- Core table for incident documentation
- Fields: location, description, injury details, timestamp, status
- Foreign key relationships to evidence and history

**report_evidence**
- Stores metadata about uploaded files
- Fields: filename, content type, SHA-256 hash, GPS data
- Maintains referential integrity to incident_reports

**report_status_history**
- Audit trail of status changes
- Tracks moderation decisions and timestamps
- Links to user roles for accountability

**user_roles**
- Permission assignments (admin, legal_partner, moderator)
- Maps users to access levels

**audit_log**
- Complete record of all system actions
- Tracks who did what and when
- Essential for compliance

See [`docs/DATABASE.md`](./docs/DATABASE.md) for complete schema documentation with ER diagram.

---

## Security

### Data Protection

- **AES-256-GCM Encryption**: Sensitive fields (reporter contact, witness info) encrypted at rest
- **Cryptographic Hashing**: SHA-256 for evidence file integrity verification
- **PBKDF2 Key Derivation**: 100,000 iterations for password-based encryption

### Access Control

- **Role-Based Authorization**: Admin, Legal Partner, Moderator roles with granular permissions
- **Session Management**: 15-minute inactivity timeout with auto-refresh
- **Rate Limiting**: Token bucket algorithm prevents brute-force attacks (5 attempts per 15 min)
- **Audit Logging**: Every action recorded with user and timestamp

### Data Privacy

- **Anonymous by Default**: Reports can be submitted without identification
- **Encrypted Personal Data**: Contact information not stored in plaintext
- **Data Retention Policies**: Automatic anonymization and deletion per GDPR principles
- **No Public Exposure**: Individual reporter details never exposed publicly

### Input Validation

- Form validation using Zod schemas
- SQL injection prevention via parameterized queries
- File upload validation (type, size, metadata)

---

## Testing

### Test Suites

```bash
# Run all tests
npm run test

# Run specific suite
npm run test -- tests/encryption.test.ts
npm run test -- tests/rate-limiter.test.ts
npm run test -- tests/db-transactions.test.ts
npm run test -- tests/duplicate-detection.test.ts
npm run test -- tests/auth-flow.test.ts

# Watch mode
npm run test -- --watch

# Coverage
npm run test -- --coverage
```

### Test Coverage

- **Encryption** (18 cases) - AES-256-GCM, key derivation, tampering detection
- **Rate Limiting** (20 cases) - Token bucket, concurrent requests, isolation
- **Database Transactions** (15 cases) - Atomicity, rollback, multi-table consistency
- **Duplicate Detection** (25+ cases) - Similarity scoring, edge cases
- **Auth Flow** (8 cases) - Authorization, permission checks

Total: **85+ test cases** covering core functionality

---

## Documentation

| Document | Purpose |
|----------|---------|
| [`docs/START_HERE.md`](./docs/START_HERE.md) | 5-minute quick start |
| [`docs/PROJECT_STRUCTURE.md`](./docs/PROJECT_STRUCTURE.md) | Folder organization |
| [`docs/DATABASE.md`](./docs/DATABASE.md) | Schema, relationships, queries |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | System design and data flow |
| [`docs/COLLEGE_DEFENSE_GUIDE.md`](./docs/COLLEGE_DEFENSE_GUIDE.md) | Viva/defense preparation |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Development guidelines |
| [`SECURITY.md`](./SECURITY.md) | Vulnerability reporting |

---

## Limitations

### By Design

This is a **college Computer Science project**, not a production civic infrastructure system. Important limitations:

- **No Deployed Instance**: This is local/research software, not a live public service
- **SQLite Only**: Single-file database suitable for research, not distributed deployments
- **Manual Moderation**: No automated machine learning for report classification
- **Limited Scale**: Not designed for millions of concurrent users
- **Research Use**: Designed for academic study, not real-world incident collection

### Known Constraints

- Evidence storage is filesystem-based (no cloud integration)
- No built-in notification system for legal partners
- Moderation workflow is basic (approve/reject only)
- Analytics are retrospective, not real-time
- No mobile-optimized interface (responsive web only)

### This is Appropriate For

✅ College submissions and defense  
✅ Research and academic study  
✅ Prototype and proof-of-concept  
✅ Understanding civic tech design  
✅ Learning security patterns  
✅ Demonstrating TypeScript best practices  

This is **NOT** meant to replace actual incident reporting systems used by real civil-rights organizations.

---

## Development

### Available Scripts

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run preview   # Preview production build
npm run lint      # Check code quality
npm run format    # Auto-format code
npm run test      # Run tests
```

### Code Quality

- **TypeScript**: 100% type coverage, zero `any` types
- **ESLint**: Configured with strict rules
- **Prettier**: Consistent formatting
- **Tests**: 85+ test cases

### Project Structure

```
src/
├── routes/           # Page components
├── components/       # Reusable UI components
├── lib/             # Business logic
├── middleware/      # Auth, rate limiting
├── hooks/           # React hooks
└── integrations/    # Third-party integrations

docs/
├── DATABASE.md      # Schema documentation
├── ARCHITECTURE.md  # System design
├── COLLEGE_DEFENSE_GUIDE.md
└── ...

tests/
├── encryption.test.ts
├── rate-limiter.test.ts
├── db-transactions.test.ts
├── duplicate-detection.test.ts
└── auth-flow.test.ts

db/
└── schema.sql       # SQLite schema
```

---

## Troubleshooting

### Dependencies Won't Install

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Tests Fail

Ensure Node.js 18+ is installed:
```bash
node --version
```

###Port Already in Use

Development server defaults to port 5173. To change:
```bash
npm run dev -- --port 3000
```

---

## College Project Information

**Project Type**: BSc Computer Science  
**Focus**: Civic technology, security, data protection  
**Duration**: Multi-phase implementation  
**Key Concepts Demonstrated**:
- Full-stack TypeScript application
- Cryptographic security (encryption, hashing)
- Database design and optimization
- Role-based authorization patterns
- Comprehensive testing practices
- Professional documentation

**Defense Topics**:
- Why SQLite for this use case
- Security design decisions (AES-256-GCM, rate limiting)
- Database optimization (indexes, transactions)
- Testing strategy for security-sensitive code
- Limitations and future improvements

See [`docs/COLLEGE_DEFENSE_GUIDE.md`](./docs/COLLEGE_DEFENSE_GUIDE.md) for detailed viva preparation.

---

## License

MIT License - See [`LICENSE`](./LICENSE) file for details.

This project is provided as-is for educational and research purposes.
