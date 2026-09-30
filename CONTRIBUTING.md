# Contributing to Accountability Watch

Thank you for your interest in contributing to Accountability Watch!

This document provides guidelines for participating in the project.

## Code of Conduct

We are committed to maintaining a respectful and inclusive community. All contributors are expected to treat each other with courtesy and professionalism.

## How to Contribute

### Reporting Issues

If you find a bug or have a suggestion:

1. Check the existing issues to avoid duplicates
2. Open an issue with a clear description
3. Include steps to reproduce (for bugs)
4. Include expected vs. actual behavior

### Development Workflow

1. **Fork the repository**

   ```bash
   git clone https://github.com/your-username/accountability-watch.git
   ```

2. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Install dependencies**

   ```bash
   npm install
   ```

4. **Make your changes**
   - Follow the code style (see below)
   - Ensure TypeScript has no errors
   - Write tests for new functionality

5. **Run quality checks**

   ```bash
   npm run lint
   npm run format
   npm run test
   ```

6. **Commit with clear messages**

   ```bash
   git commit -m "Brief description of changes"
   ```

7. **Push to your fork**

   ```bash
   git push origin feature/your-feature-name
   ```

8. **Open a pull request**
   - Describe what your PR does
   - Reference any related issues
   - Ensure all checks pass

## Code Style

### TypeScript

- Use explicit types (no `any` types)
- Interfaces for object shapes
- Enums for constants
- JSDoc comments for public functions

Example:

```typescript
/**
 * Validates an incident report
 * @param report - The report to validate
 * @returns Validation result with errors if invalid
 */
function validateReport(report: IncidentReport): ValidationResult {
  // Implementation
}
```

### React Components

- Functional components with hooks
- Props interfaces using TypeScript
- Descriptive component names
- Extract reusable components

### Database Queries

- Use parameterized queries (prevent SQL injection)
- Transactions for multi-step operations
- Add comments for complex queries
- Test with edge cases

### Security

- Treat all user input as untrusted
- Use encryption for sensitive data
- Follow OWASP guidelines
- Never commit secrets or credentials
- Document security assumptions

## Testing

### Writing Tests

- Use Vitest for all unit tests
- Test happy paths and error cases
- Aim for meaningful coverage (not just lines)
- Include edge cases

### Running Tests

```bash
# Run all tests
npm run test

# Run specific suite
npm run test -- tests/encryption.test.ts

# Watch mode
npm run test -- --watch

# Coverage report
npm run test -- --coverage
```

### Security-Sensitive Tests

For encryption, authentication, or authorization code:

- Include tests for invalid inputs
- Test failure modes
- Document assumptions
- Include comments explaining why each case matters

## Documentation

### README Updates

Update `README.md` if your change:

- Adds a new feature
- Changes how to set up the project
- Modifies the technology stack
- Affects database schema

### Code Documentation

- Keep JSDoc comments current
- Update inline comments if logic changes
- Document "why" not just "what"
- Include examples for complex functions

### Database Schema Changes

1. Update `db/schema.sql`
2. Document the change in `docs/DATABASE.md`
3. Include migration instructions if needed
4. Update related test fixtures

## Submitting Changes

### Before You Submit

- [ ] Code follows project style
- [ ] All tests pass (`npm run test`)
- [ ] Linter passes (`npm run lint`)
- [ ] TypeScript has no errors
- [ ] No secrets or credentials in code
- [ ] Documentation is updated
- [ ] Commit messages are clear

### Pull Request Process

1. **One feature per PR** - Keep PRs focused
2. **Test your changes** - Include tests for new code
3. **Update docs** - Keep README and docs current
4. **Be responsive** - Reply to review feedback promptly
5. **Don't force-push** - After initial review, avoid rebasing

## Project Philosophy

Accountability Watch is designed as an educational tool demonstrating:

- **Security best practices** - Not just functional, but secure
- **Clean architecture** - Clear separation of concerns
- **Type safety** - TypeScript without `any` types
- **Comprehensive testing** - Especially for security-sensitive code
- **Professional documentation** - For college projects and beyond

When contributing, please keep these values in mind.

## Areas for Contribution

- **Documentation** - Improve guides, add examples
- **Tests** - Increase coverage, add edge cases
- **Bug fixes** - Report and fix issues
- **Performance** - Optimize queries, improve response times
- **Security** - Report responsibly (see SECURITY.md)
- **Accessibility** - Improve WCAG compliance
- **User experience** - Small UI/UX improvements

## Questions?

- Check `docs/` folder for project documentation
- See `docs/ARCHITECTURE.md` for system design
- Review `docs/DATABASE.md` for schema details
- Read `docs/COLLEGE_DEFENSE_GUIDE.md` for project context

## License

By contributing to Accountability Watch, you agree that your contributions will be licensed under its MIT License.

---

**Thank you for contributing to Accountability Watch!**
