# Security policy

## Supported version

Security fixes are made on the latest release.

## Report a vulnerability

Email security@henrywallace.io with a description, reproduction steps, and
potential impact. Please do not open a public issue for a suspected
vulnerability.

## Using the package safely

- Keep provider API keys in environment variables or an untracked `.env` file.
- Treat prompts, screenshots, and provider responses as untrusted input.
- Pin the provider and model when reproducibility matters.
- Run `npm run check:secrets` before sharing changes, and keep dependencies
  current.

This package is a library and CLI; it does not provide an HTTP endpoint or
host credentials for you.
