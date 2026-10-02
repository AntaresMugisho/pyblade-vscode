# Changelog

All notable changes to the "pyblade-intellisense" extension will be documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

## [0.3.0] - 2026-10-02

### Added
- **`pyblade.toml` support**: `[paths] templates`, `components` and `settings`, and `[i18n] directory`, with defaults when a key is missing. Language server features only start in workspaces that contain a `pyblade.toml`.
- **Hover documentation** for directives and closing tags.
- **Completion**:
  - template names for `@extends` / `@include`, in dot notation (`layouts.base`);
  - component names for `@component` and `<pb-...>` tags, plus a `pb-` shorthand that inserts the whole tag;
  - URL names for `@url`, including `app_name:` namespaces;
  - static files for `@static`.
- **Go to definition** (Ctrl/Cmd+Click or F12) for components (Python and live components open the `.py` file), templates, `@url` names (jumps to the `name=` entry in `urls.py`) and `@static` files.
- **Diagnostics**:
  - errors for unclosed block directives, unexpected or misordered closing tags and unclosed argument lists;
  - warnings for misspelled directives (with a suggestion), `@else`-style directives outside a block, and templates, components, URL names or static files that cannot be found.
- **Django support**: `templates/`, `components/` and `static/` folders in apps (up to 6 levels deep), URL names from every `urls.py`, and `STATICFILES_DIRS` read from the settings, including split settings files and `from .base import *` chains.
- **Snippets** for the remaining directives (`unless`, `match`, `with`, `ifchanged`, `cycle`, `firstof`, `now`, `push`, `stack`, `slot`, `component`, `comment`, `verbatim`, `spaceless`, `lang`, `languages`, `regroup`, `querystring`, and others).
- **Highlighting** for `@lorem`, `@debug`, `@widthratio` and `@ratio`, and for `@with`, `@unless`, `@match`, `@switch`, `@case`, `@ifchanged` and `@active` arguments.

### Changed
- **Snippet prefixes now start with `@`** (`@if`, `@for`, `@url`, ...) instead of the bare word, so plain HTML words no longer trigger PyBlade snippets. Type `@` then the directive name.
- The language server is now fully functional (the error checking announced as pending in 0.1.0).
- The package is smaller: sources, tests and development files are no longer shipped.

### Fixed
- Directives and `{{ }}` expressions inside HTML tags and attribute values were not highlighted (for example `href="@url('home')"`).
- `@if (x)` with a space before the parenthesis was not highlighted like `@if(x)`.
- Names such as `@format` or `@iffy` partially highlighted as `@for` / `@if`.
- Snippet tab stops in `@forempty`, `@authelse` and `@guestelse` ended in the wrong place; the `@auth` and `@guest` "else" variants shared a prefix with the plain snippets and are now `@authelse` and `@guestelse`.
- `@default` snippet no longer inserts parentheses.

### Removed
- The `@method` snippet.

## [0.2.2] - 2026-09-30

### Changed
- Updated the extension description.

## [0.2.1] - 2026-09-30

### Added
- New PyBlade directives highlighting.

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