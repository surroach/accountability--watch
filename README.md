# 🛡️ Accountability Watch

A civic tech platform for documenting alleged police misconduct at protests. Anonymous. Timestamped. Shared with legal aid.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-5.0+-blue)](https://www.typescriptlang.org/)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account (for production)

### Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/accountability-watch.git
   cd accountability-watch
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp config/.env.example .env
   # Edit .env with your Supabase credentials
   ```

4. **Start development server:**
   ```bash
   npm run dev
   # Opens at http://localhost:8080
   ```

---

## 📋 Project Structure

```
accountability-watch/
├── src/
│   ├── routes/              # Page components & routes
│   │   ├── index.tsx       # Home page
│   │   ├── report.tsx      # Report submission form
│   │   ├── auth.tsx        # Login for lawyers/admins
│   │   ├── dashboard.tsx   # Public statistics
│   │   └── _authenticated/ # Protected routes
│   │       ├── admin.tsx   # Admin dashboard
│   │       └── moderation.tsx # Lawyer queue
│   │
│   ├── components/          # Reusable React components
│   │   └── ui/             # UI primitives (buttons, inputs, etc)
│   │
│   ├── integrations/        # External services
│   │   └── supabase/       # Database client
│   │
│   └── lib/                # Utilities & helpers
│
├── docs/                   # Documentation
│   ├── START_HERE.md      # Quick orientation
│   ├── guides/            # How-to guides
│   ├── audit/             # Audit reports
│   └── deployment/        # Deployment guides
│
├── supabase/              # Database schema
│   └── migrations/        # SQL migrations
│
├── config/                # Configuration files
│   └── .env.example      # Environment template
│
├── tests/                 # Test files
├── scripts/              # Utility scripts
├── public/               # Static assets
└── .env                  # Local env (GITIGNORED)
```

---

## 💻 Development

### Available Commands

```bash
# Start development server (port 8080)
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Code quality
npm run lint              # Check for linting errors
npm run format            # Auto-format code with Prettier

# View reports (dev)
npm run reports:view     # View submitted reports
```

---

## 🏛️ Technology Stack

| Technology | Purpose |
|-----------|---------|
| **TanStack Start** | React SSR framework |
| **React** | UI library |
| **TypeScript** | Type safety |
| **Tailwind CSS** | Styling |
| **Supabase** | Backend & database |
| **PostgreSQL** | Data storage |
| **Vite** | Build tool |

---

## 🔐 Authentication & Authorization

### User Roles
- **Anonymous**: Submit reports without login
- **Legal Partner**: Access moderation queue, approve/reject reports
- **Admin**: Full dashboard, view all reports with evidence
- **User**: Account creation, basic access

### Auth Methods
- Email/Password login
- Google OAuth
- Session-based authentication

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| `docs/START_HERE.md` | 5-minute project orientation |
| `docs/guides/AUDIT_OVERVIEW.md` | What was audited & fixed |
| `docs/guides/TESTING.md` | Testing procedures |
| `docs/guides/TEST_PLAN.md` | 100+ test cases |
| `docs/audit/BUG_AUDIT_REPORT.md` | Complete bug audit |
| `docs/audit/SECURITY_AUDIT.md` | Security analysis |
| `docs/deployment/` | Deployment guides |

**Start here:** `docs/START_HERE.md`

---

## ✅ Features

### For Citizens
- 📝 Anonymous incident reporting
- 📸 Upload photos, videos, documents
- ⏰ Automatic timestamping
- 🔍 Report status tracking

### For Legal Partners
- ✔️ Moderation queue review
- 🔍 Approve/reject reports
- 📋 Detailed incident information
- 🔒 Lawyer-only access

### For Admins
- 📊 Full dashboard with all reports
- 👥 User management
- 📈 Statistics & analytics
- 🔧 System configuration

### Security Features
- 🔐 Row-level security (RLS)
- 🔒 SHA-256 file hashing
- 🔑 Encrypted sensitive data
- ✅ CORS protection
- 🛡️ SQL injection prevention

---

## 🚀 Deployment

### Production Checklist
- [ ] Configure Supabase credentials in `.env`
- [ ] Run database migrations
- [ ] Configure CORS in Supabase
- [ ] Build project: `npm run build`
- [ ] Deploy `.output` to serverless platform
- [ ] Configure domain & SSL
- [ ] Test all features in production

### Deployment Platforms Supported
- Cloudflare Workers (recommended)
- Vercel
- Netlify
- AWS Lambda
- Any serverless platform

**Full guide:** `docs/deployment/DEPLOYMENT.md`

---

## 🧪 Testing

### Manual Testing
Follow the test plan in `docs/guides/TEST_PLAN.md` with 100+ test cases covering:
- Report submission
- Authentication flows
- Admin dashboard
- Moderation queue
- Security features

### Running Tests
```bash
npm run dev    # Start dev server
# Then use browser to test at http://localhost:8080
```

---

## 🐛 Bug Reports & Issues

Found a bug? Have a feature request?

1. Check existing issues
2. Create a new issue with:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable

---

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes in `/src`
4. Test thoroughly
5. Update documentation if needed
6. Commit with clear messages: `git commit -m "Add feature: description"`
7. Push to your fork
8. Submit a pull request

### Code Style
- TypeScript for all files
- Prettier for formatting
- ESLint for linting
- Tailwind CSS for styling

---

## 📊 Project Status

| Item | Status |
|------|--------|
| Core Features | ✅ Complete |
| Authentication | ✅ Complete |
| Database | ✅ Configured |
| Security | ✅ Audited |
| Documentation | ✅ Complete |
| Testing | ✅ 100+ cases |
| Production Ready | ✅ Yes |

---

## 🔒 Security

This project implements multiple security layers:

- **Database Security**: Row-level security (RLS) policies
- **File Security**: SHA-256 hashing on all uploads
- **Data Privacy**: Encrypted sensitive contact info
- **Access Control**: Role-based authorization
- **API Security**: CORS, rate limiting
- **Input Validation**: Sanitization on all inputs

**See:** `docs/audit/SECURITY_AUDIT.md`

---

## 📞 Support & Resources

- 📖 Full Documentation: `docs/`
- 🚀 Getting Started: `docs/START_HERE.md`
- 🧪 Testing Guide: `docs/guides/TESTING.md`
- 🔧 Troubleshooting: `docs/guides/TROUBLESHOOTING.md`
- 📋 Architecture: `docs/architecture/`

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built with [TanStack Start](https://tanstack.com/start)
- Database powered by [Supabase](https://supabase.com)
- UI components from [shadcn/ui](https://ui.shadcn.com)
- Icons from [Lucide](https://lucide.dev)

---

## 👥 Maintainers

- Project Team

---

**Ready to protect civil rights?** Start with `docs/START_HERE.md` →

**Questions?** Check `docs/guides/FAQ.md` or open an issue.
