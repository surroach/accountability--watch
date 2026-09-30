# Security Policy

## Responsible Disclosure

If you discover a security vulnerability in Accountability Watch, please report it responsibly.

### How to Report

**Do NOT open a public issue.**

Instead, please email security concerns to the project maintainer with:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)

The maintainer will:

1. Confirm receipt within 48 hours
2. Investigate and assess severity
3. Develop and test a fix
4. Prepare a security advisory
5. Coordinate disclosure timing

### What to Include

✅ **DO include:**

- Clear vulnerability description
- Reproduction steps
- Affected versions
- Your contact information

❌ **DON'T include:**

- Proof-of-concept exploits that could cause harm
- Passwords, API keys, or credentials
- Personal information about users/organizations

## Security Features

### Implemented Controls

- **Encryption**: AES-256-GCM for sensitive data at rest
- **Hashing**: SHA-256 for file integrity verification
- **Authentication**: Role-based access control (RBAC)
- **Rate Limiting**: Token bucket algorithm prevents brute-force attacks
- **Audit Logging**: Complete record of system actions
- **Input Validation**: Zod schemas for all user inputs
- **Session Management**: 15-minute inactivity timeout
- **Database Security**: Parameterized queries, transactions, foreign key constraints

### Limitations

This is a **college Computer Science project**, not a production system. Understand:

- Designed for research and academic use
- Not deployed in production environments
- SQLite (not designed for multi-server deployments)
- No built-in DDoS protection
- No automatic security updates
- Manual moderation only

If you are building a production incident reporting system, consider:

- Adding Web Application Firewall (WAF)
- Implementing DDoS protection
- Using managed database services
- Adding comprehensive monitoring
- Establishing incident response procedures

## Best Practices

### For Users

- Keep credentials secure
- Use strong passwords
- Don't share account access
- Report suspicious activity

### For Developers

- Never commit secrets to git
- Use `.env.example` instead of `.env`
- Validate and sanitize all inputs
- Use parameterized queries
- Keep dependencies updated
- Review security-sensitive code carefully
- Write tests for security features

### For Deployers (if deployed)

- Use HTTPS only
- Enable security headers
- Keep Node.js updated
- Monitor application logs
- Regular backups
- Access control for admin panel
- Rate limit public endpoints

## Known Vulnerabilities

None currently known. If you find one, please report it using the process above.

## Security Audit

This project includes several security features designed and tested for an academic environment:

- Encryption module with comprehensive test coverage
- Rate limiting with concurrent request isolation
- Transaction management for data consistency
- Authorization middleware for access control
- Audit logging for compliance

See `tests/` for security-focused test suites and `docs/` for architecture details.

## Questions?

If you have security questions:

1. Check `docs/` for existing documentation
2. Review test cases in `tests/` for examples
3. Examine source code in `src/` with comments

---

**Last updated**: 2026  
**Maintained by**: Aryan Surroach
