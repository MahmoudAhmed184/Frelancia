# Changelog

## v1.0.1 - 2026-08-07

Maintenance release with rebranding updates and monitoring stability improvements.

### Release Artifacts

- Chrome MV3 extension package: `rasid-v1.0.1-chrome-mv3.zip`.
- Firefox MV3 extension package: `rasid-v1.0.1-firefox-mv3.zip`.
- Firefox review source package: `rasid-v1.0.1-firefox-sources.zip`.
- SHA-256 checksum manifest: `SHA256SUMS.txt`.
- Build and manifest evidence: `release-evidence.json`.

### Fixed & Improved

- Rebranded extension name, documentation, tests, and configuration from Freelancia (فريلانسيا) to Rasid (راصد).
- Implemented per-platform rate limiting for job hydration to prevent request bursts and rate limits during monitoring.

## v1.0.0 - 2026-06-05

Initial GitHub release for Rasid.

### Release Artifacts

- Chrome MV3 extension package: `rasid-v1.0.0-chrome-mv3.zip`.
- Firefox MV3 extension package: `rasid-v1.0.0-firefox-mv3.zip`.
- Firefox review source package: `rasid-v1.0.0-firefox-sources.zip`.
- SHA-256 checksum manifest: `SHA256SUMS.txt`.
- Build and manifest evidence: `release-evidence.json`.

### Included

- Monitoring, filtering, notifications, project tracking, and proposal drafting for Mostaql, Khamsat, and Nafezly.
- User-mediated ChatGPT bridge mode through optional ChatGPT host permissions.
- Chrome offscreen support for local audio, DOM parsing, and ZIP Blob URL tasks.
- Firefox MV3 build without Chrome-only offscreen permission.
- Manual GitHub-only draft release workflow for maintainer approval.

### Out Of Scope

- Chrome Web Store submission.
- Firefox AMO signing or submission.
- Automated browser-store publishing credentials.
- Backend release artifacts.
