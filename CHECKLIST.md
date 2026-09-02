# Pre-Commit Checklist

- [ ] Review the diff.
  - [ ] Run `git diff`.
  - [ ] Run `git diff --staged`.

- [ ] Check staged files with `git status`.

- [ ] Remove debug and temporary code.
  - [ ] `console.log` statements
  - [ ] Temporary prints
  - [ ] Commented-out experiments
  - [ ] Hardcoded test values
  - [ ] TODOs that should not ship

- [ ] Check for secrets and sensitive files.
  - [ ] API keys
  - [ ] Passwords
  - [ ] Tokens
  - [ ] `.env` files
  - [ ] Private certificates
  - [ ] Database credentials

- [ ] Run lint checks.

- [ ] Run `npx tsc --noEmit`.

- [ ] Check edge cases.
  - [ ] `null` and `undefined`
  - [ ] Empty inputs
  - [ ] Invalid inputs
  - [ ] Network or API failures
  - [ ] Loading states
  - [ ] Duplicate submissions
  - [ ] Permission or authentication failures

- [ ] Check error handling.
  - [ ] Exceptions are not silently swallowed.

- [ ] Check security boundaries.
  - [ ] Authentication
  - [ ] Authorization
  - [ ] Input validation
  - [ ] File validation
  - [ ] Rate limits where appropriate

- [ ] Check database changes.
  - [ ] Migrations
  - [ ] Constraints
  - [ ] Indexes
  - [ ] Backward compatibility
  - [ ] No accidental destructive queries

- [ ] Check API contracts.

- [ ] Confirm there are no unrelated changes.
