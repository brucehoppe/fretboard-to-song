# Security policy

Please report security problems privately using GitHub's
[private vulnerability reporting](https://github.com/brucehoppe/fretboard-to-song/security/advisories/new)
rather than opening a public issue. I'll acknowledge reports within a week.

## Access model

This is a single-owner app: everyone who signs in shares one repertoire, there is no
per-user data separation. Access to `/api/practice` (read and write, including delete) is
gated by a single shared passphrase — see "Passphrase sign-in" in the README for setup.
Without `PRACTICE_PASSPHRASE` and `AUTH_SECRET` configured, the API fails closed (every
request is rejected with 401) rather than falling open.

`app/chatgpt-auth.ts` is an unused starter-template helper, not part of the current auth
model — see the warning comment at the top of that file before wiring it into anything.
