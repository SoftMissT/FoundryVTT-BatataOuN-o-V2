# Changelog

All notable changes to this project will be documented in this file.

This project follows the spirit of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and uses semantic versioning for release tags.

---

## [Unreleased]

### Added

- Placeholder for the next development cycle.

---

## [1.0.13] - 2026-08-29

### Fixed
- Fixed benchmark Journal pages rendering raw Markdown in Foundry by generating HTML Journal content.
- Fixed Markdown and JSON exports to prefer Foundry's file save helper instead of opening blob URLs.
- Fixed misleading live graph labels by marking FPS as live and frame/stutter graphs as benchmark snapshots.
- Added runtime fallback for missing protocol images.
- Improved protocol card visibility and compact HUD spacing.

### Changed
- The HUD now starts the FPS monitor when opened without applying automatic quality changes.
- The main FPS graph now updates from live monitor history while the HUD is open.


## [1.0.11] - 2026-08-29

### Fixed
- Improved HUD readability with clearer contrast, spacing, and typography.
- Added Orbitron and Rajdhani typography styling for the performance HUD.
- Fixed benchmark Journal output formatting to avoid broken empty Markdown tables.
- Added Markdown and JSON export actions for benchmark reports.
- Updated the HUD template to use dynamic quality protocols.
- Improved accessibility semantics for benchmark status, protocol cards, graphs, and action buttons.

### Changed
- Refactored the benchmark dialog layout for the new HUD v2 structure.
- Updated localization keys for English, Portuguese, Spanish, Chinese, and Russian.
- Prepared the release for `v1.0.11` as a patch over `v1.0.10`.


## [1.0.10] - 2026-08-29

### Added

- New dark diagnostic HUD for the benchmark dialog.
- SVG performance graphs for FPS, frametime and quality/stutter diagnostics.
- Short benchmark sample history for graph rendering.
- Journal report generation from benchmark results.
- Public API method for creating Journal reports.
- Spanish localization.
- Simplified Chinese localization.
- Russian localization.
- README banner support through `assets/banner.webp`.
- Public documentation split between README, CONTRIBUTING and CHANGELOG.

### Changed

- README rewritten as a cleaner bilingual public page.
- Module language manifest expanded to five languages.
- Benchmark data expanded with graph-ready samples.
- Dialog image paths prepared for the new asset structure.
- HUD styling updated for the dark/manhwa visual direction.

### Fixed

- Removed README sections that were internal development/release noise.
- Moved validation and release rules into `CONTRIBUTING.md`.

---

## [1.0.9] and earlier

No curated changelog was maintained before 1.0.10.
