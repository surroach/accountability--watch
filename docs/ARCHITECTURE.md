# System Architecture

This document describes the design and structure of Accountability Watch.

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ Client Browser (React + TypeScript)                             │
│ • Home page (hero, features)                                    │
│ • Report form (anonymous submission)                            │
│ • Public dashboard (aggregate statistics)                       │
│ • Admin panel (legal partners, admins)                          │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────────────────────────┐
│ Application Server (TanStack Start / Node.js)                   │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ HTTP Routes                                              │   │
│ │ GET  /                    Home page                       │   │
│ │ POST /api/reports         Submit incident report          │   │
│ │ GET  /api/reports/:id     Get report details             │   │
│ │ GET  /api/dashboard       Public statistics              │   │
│ │ GET  /admin/*             Admin interface (protected)    │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ Middleware Layer                                         │   │
│ │ • Authentication (verify user credentials)               │   │
│ │ • Authorization (check permissions)                      │   │
│ │ • Rate Limiting (prevent abuse)                          │   │
│ │ • Session Management (track user sessions)               │   │
│ │ • Audit Logging (record all actions)                     │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ Business Logic (src/lib/)                                │   │
│ │ • Encryption/Decryption (protect PII)                    │   │
│ │ • Validation (ensure data quality)                       │   │
│ │ • Search (find reports)                                  │   │
│ │ • Duplicate Detection (identify similar reports)         │   │
│ │ • Performance Monitoring (optimize queries)              │   │
│ │ • Data Retention (GDPR compliance)                       │   │
│ │ • Transactions (ensure consistency)                      │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ Database Access Layer                                    │   │
│ │ • Query builders                                         │   │
│ │ • Connection pooling                                     │   │
│ │ • Migration management                                   │   │
│ └──────────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────────┘
                     │ SQL
┌────────────────────▼────────────────────────────────────────────┐
│ SQLite Database (Single File)                                    │
│ • incident_reports          (submitted incidents)               │
│ • report_evidence           (uploaded files)                     │
│ • report_status_history     (audit trail)                        │
│ • user_roles                (permissions)                        │
│ • audit_log                 (compliance trail)                   │
└─────────────────────────────────────────────────────────────────┘
```

## Layer Descriptions

### Frontend Layer (Browser)

**Technology**: React 19 + TanStack Start + TypeScript

**Responsibilities**:
- Render pages and components
- Handle user interactions
- Submit forms to API
- Display data and results
- Client-side validation (before sending to server)

**Pages**:
- `/` - Homepage with features
- `/report` - Anonymous incident report form
- `/about` - Project explanation
- `/resources` - Legal aid resources
- `/dashboard` - Public aggregate statistics
- `/admin/*` - Admin panel (protected)

**Key Components**:
- `ReportForm` - Input validation and submission
- `Dashboard` - Metrics and charts
- `AdminPanel` - Moderation interface
- `Navigation` - Header and footer

### Application Server Layer

**Technology**: TanStack Start (Node.js + React SSR)

**Responsibilities**:
- Handle HTTP requests
- Authenticate and authorize users
- Execute business logic
- Query database
- Return responses

**Key Features**:
- Server-Side Rendering (SSR) for better performance/SEO
- Full-stack TypeScript type safety
- File-based routing
- API endpoints and pages in same framework

### Middleware Layer

**Purpose**: Cross-cutting concerns (used on every request)

**Components**:

1. **Authentication** (`src/middleware/auth-verify.ts`)
   - Verify user identity
   - Check valid session/token
   - Extract user context
   - Return 401 if unauthorized

2. **Authorization** (RBAC)
   - Check user role (admin, legal_partner, moderator)
   - Verify permission for specific action
   - Return 403 if forbidden
   - Audit log the attempt

3. **Rate Limiting**
   - Token bucket algorithm
   - 5 login attempts per 15 minutes
   - Prevents brute-force attacks
   - Returns 429 if rate limit exceeded

4. **Session Management**
   - Track logged-in users
   - 15-minute inactivity timeout
   - Auto-refresh on activity
   - Prevent session hijacking

5. **Audit Logging**
   - Log every action
   - Record user, timestamp, changes
   - Enable compliance audits
   - Detect suspicious activity

### Business Logic Layer (`src/lib/`)

**Purpose**: Core functionality independent of HTTP

**Modules**:

1. **encryption.ts** - Data Protection
   - AES-256-GCM encryption/decryption
   - PBKDF2 key derivation
   - Random IV generation
   - Encrypt/decrypt sensitive fields

2. **full-text-search.ts** - Report Discovery
   - SQLite FTS5 semantic search
   - Find reports by keywords
   - Rank results by relevance
   - Support complex queries

3. **rate-limiter.ts** - Attack Prevention
   - Token bucket algorithm
   - Per-user rate limits
   - Configurable thresholds
   - Timeout after limit exceeded

4. **session-manager.ts** - User Sessions
   - Create and validate sessions
   - 15-minute timeout
   - Auto-refresh on activity
   - Revoke on logout

5. **data-retention.ts** - Data Governance
   - Anonymize old reports
   - Delete expired data
   - GDPR compliance
   - Scheduled cleanup

6. **duplicate-detection.ts** - Quality Assurance
   - 4-factor similarity scoring
   - Location + description + time + category
   - Levenshtein distance for text
   - Identify potential duplicates

7. **performance-monitoring.ts** - Optimization
   - Track query execution time
   - Analyze query plans
   - Identify slow operations
   - Suggest optimizations

8. **db-transactions.ts** - Consistency
   - Multi-table atomic operations
   - Rollback on error
   - Ensure referential integrity
   - Prevent partial writes

### Database Access Layer

**Purpose**: SQL query execution and connection management

**Components**:
- Query builders (type-safe SQL)
- Connection pooling
- Transaction management
- Error handling

**Direct Database Access**:
```typescript
// Example from route handler
const reports = await db.query(
  'SELECT * FROM incident_reports WHERE status = ?',
  ['pending_moderation']
);
```

### Database Layer (SQLite)

**Purpose**: Persistent data storage

**Tables**:
- `incident_reports` - Core incident data
- `report_evidence` - Uploaded file metadata
- `report_status_history` - Audit trail
- `user_roles` - Permission assignments
- `audit_log` - System-wide audit trail

**Features**:
- ACID transactions
- Referential integrity
- Full-text search (FTS5)
- Cryptographic hashing for verification

See [`docs/DATABASE.md`](./DATABASE.md) for complete schema.

## Data Flow

### Creating a Report (Anonymous)

```
User
  ↓
Frontend: ReportForm Component
  ↓ (form validation)
POST /api/reports
  ↓
Server: Receive request
  ↓ (basic validation)
Business Logic: validateReport()
  ↓ (check for duplicates)
Business Logic: findDuplicateReports()
  ↓ (encrypt sensitive fields)
Business Logic: encrypt(reporter_contact)
  ↓ (compute SHA-256 for evidence)
Business Logic: hashFile(evidence)
  ↓ (start transaction)
Database: BEGIN
  ↓
Database: INSERT incident_reports
  ↓
Database: INSERT report_evidence
  ↓
Database: INSERT report_status_history (status: pending_moderation)
  ↓
Middleware: auditLog(action: CREATE_REPORT)
  ↓
Database: INSERT audit_log
  ↓ (commit if all successful)
Database: COMMIT
  ↓
Return: { report_code: "AW-12345", status: "pending_moderation" }
  ↓
Frontend: Display report code to user
```

### Legal Partner Reviews Report (Authenticated)

```
Legal Partner Login
  ↓
Frontend: Login Form
  ↓ (submit credentials)
POST /auth/login
  ↓
Middleware: Authentication (verify credentials)
  ↓
Middleware: Session Creation (issue session token)
  ↓
Return: { session_token: "...", user_role: "legal_partner" }
  ↓
Frontend: Store token in secure cookie
  ↓
Legal Partner: Views Admin Dashboard
  ↓
GET /admin/moderation-queue
  ↓
Middleware: Verify session
  ↓
Middleware: Authorization (check role = legal_partner)
  ↓
Middleware: Rate Limiting (allow, within limit)
  ↓
Business Logic: searchReports(filter: status = pending_moderation)
  ↓
Database: SELECT * FROM incident_reports WHERE status = 'pending_moderation'
  ↓
Business Logic: decrypt(reporter_contact) [if authorized to see]
  ↓
Middleware: auditLog(action: VIEW_REPORT_LIST)
  ↓
Return: List of pending reports
  ↓
Frontend: Display moderation queue
```

### Approving a Report (Authenticated)

```
Legal Partner: Clicks "Approve"
  ↓
POST /admin/reports/{id}/approve
  ↓
Middleware: Verify session + Rate limit
  ↓
Middleware: Authorization (role must be admin OR legal_partner)
  ↓
Business Logic: Validate report exists
  ↓
Database: BEGIN TRANSACTION
  ↓
Database: UPDATE incident_reports SET status = 'moderation_approved'
  ↓
Database: INSERT report_status_history (to_status: moderation_approved, changed_by: user_id)
  ↓
Middleware: auditLog(action: APPROVE_REPORT, changed_by: user_id)
  ↓
Database: INSERT audit_log
  ↓ (commit if all successful)
Database: COMMIT
  ↓
Return: { status: "success" }
  ↓
Frontend: Update UI, show confirmation
```

## Security Design

### Authentication

- Session-based (token stored in secure HTTP-only cookie)
- 15-minute timeout for inactivity
- Auto-refresh on user activity
- Revoke on logout

### Authorization

- Role-based access control (RBAC)
- Three roles: admin, legal_partner, moderator
- Checked on every protected route
- Granular permissions per action

### Encryption

- **At Rest**: Sensitive fields (reporter contact, witness info) encrypted with AES-256-GCM
- **In Transit**: HTTPS required
- **In Memory**: Encrypted data loaded only when needed

### Input Validation

- Frontend: Zod schemas for client-side validation
- Server: Same schemas for server-side validation
- Never trust client input
- SQL injection prevention via parameterized queries

### Audit Trail

- Every action logged with user and timestamp
- Essential for GDPR compliance
- Enables security investigations
- Data retention policies for cleanup

## Scalability Considerations

### Current Design

Suitable for:
- College projects
- Research use
- Prototype systems
- Up to ~100k reports

### For Production at Scale

Would need:
- PostgreSQL (replicated)
- Connection pooling (PgBouncer, pgpool)
- Load balancing
- Caching layer (Redis)
- Event streaming (Kafka)
- Separate search service (Elasticsearch)
- File storage (S3, etc.)
- CDN for static assets

## Development Workflow

### Local Development

1. **Setup**: `npm install`
2. **Configuration**: Copy `.env.example` to `.env`
3. **Database**: SQLite file created automatically
4. **Run**: `npm run dev` (dev server + hot reload)
5. **Test**: `npm run test` (watch mode available)
6. **Build**: `npm run build` (production build)

### Testing

- Unit tests: `npm run test`
- Integration tests: Database operations tested
- Security tests: Encryption, rate limiting, authorization
- 85+ test cases total

### Code Quality

- TypeScript: 100% type coverage
- ESLint: Strict rules enforced
- Prettier: Consistent formatting
- All must pass before commit

## Deployment

For college project submission:

1. Ensure all tests pass
2. Build with `npm run build`
3. Generated `dist/` folder contains app
4. Database file included in repo (or created on first run)
5. Ready for demo/presentation

See [`docs/PRODUCTION_DEPLOYMENT.md`](./docs/PRODUCTION_DEPLOYMENT.md) if deploying publicly.

---

**Architecture Version**: 1.0  
**Last Updated**: 2026
