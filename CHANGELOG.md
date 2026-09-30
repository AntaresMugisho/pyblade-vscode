# Changelog

All notable changes to tthe "pyblade-intellisense" extension will be documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

## [0.2.1] - 2026-09-30

### Added
- New pyblade directives highlighting


## [0.1.0] - 2024-12-07

### Added
- **Snippets** for almost all PyBlade directives (e.g., `if`, `for`, `csrf`, `translate`) to enhance development speed.
- **Syntax highlighting** for PyBlade template files, improving readability.
- **Language server** is now included using TypeScript, resolving previous crashing issues.

### Changed
- Language server is now stable, but error checking and diagnostics are not yet functional. This will be addressed in the next release.

### Fixed
- Initial bugs leading to crashes when starting the language server.


## [0.0.1] - 2024-12-26

### Added
- Initial release of PyBlade VS Code extension.
- Basic prototype of the language server with syntax highlighting.
- Early support for directive snippets, with partial syntax checking.