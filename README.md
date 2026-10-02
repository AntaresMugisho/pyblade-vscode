# PyBlade IntelliSense for VS Code

IntelliSense, syntax highlighting, snippets and code navigation for PyBlade templates, with first-class support for Django projects.

## Features

### Syntax highlighting
- Highlighting for every PyBlade directive, `{{ }}` / `{!! !!}` expressions (as Python) and `{# #}` comments.
- Works inside HTML tags and attribute values too, so `href="@url('home')"` and `<input @checked(user.ok)>` are highlighted.

### Snippets
- Type `@` followed by a directive name (`@if`, `@ifelse`, `@for`, `@forempty`, `@switch`, `@component`, `@push`, ...) to insert a complete block with tab stops.
- Snippets use the `@` prefix on purpose, so ordinary HTML words like `for` or `class` never trigger them.

### Hover documentation
- Hover a directive to see what it does and which closing tag it needs.
- Hover a closing tag (`@endif`) to see which directive it closes.

### Smart completion
| Where you type | What you get |
| --- | --- |
| `@extends("` / `@include("` | Template names in dot notation (`layouts.base` for `layouts/base.html`) |
| `@component("` or `<pb-` | Components, labelled Python, Live or UI component, with the file they resolve to |
| `pb-` (without `<`) | Components, inserting the whole `<pb-name />` tag |
| `@url('` | URL names from your `urls.py` files, including `app_name:` namespaces (`blog:post_detail`) |
| `@static('` | Static files from `static/` folders and `STATICFILES_DIRS` |

### Go to definition
Hold `Ctrl` (`Cmd` on macOS) and click, or press `F12`, on:
- a component name, in `@component('...')` or a `<pb-...>` tag (Python and live components open their `.py` file; simple components open the `.html`);
- a template name in `@extends` / `@include`;
- a URL name in `@url`, which opens `urls.py` at the `name=` entry;
- a file in `@static`.

### Diagnostics
Problems are shown as you type, in the editor and in the Problems panel:

| Problem | Severity |
| --- | --- |
| Block directive that is never closed (`@if` without `@endif`) | Error |
| Closing tag without an opener, or closed in the wrong order | Error |
| Unclosed argument list (`@if(x`, missing quote) | Error |
| Misspelled directive, with a suggestion (`@inlcude`, did you mean `@include`?) | Warning |
| `@else`, `@elif`, `@empty`, `@case`, `@default`, `@plural` outside any block | Warning |
| Template, component, URL name or static file that cannot be found | Warning |

Content inside `@verbatim`, `@comment` and `{# #}` is never analysed. CSS at-rules (`@media`), framework attributes (`@click`) and email addresses are left alone.

## Getting started

1. Install the extension.
2. Add a `pyblade.toml` file at the root of your project (see below). Completion, hover, navigation and diagnostics only run in workspaces that contain one. Highlighting and snippets work in any `.html` file.
3. Open a template and start typing.

## Configuration: `pyblade.toml`

```toml
[paths]
templates  = "templates"          # default
components = "components"         # default
settings   = "config/settings.py" # optional, Django settings (file, module or folder)

[i18n]
directory = "locale"              # default, reserved for upcoming translation support
```

Every key is optional; the values above are the defaults. Paths are relative to the folder that contains `pyblade.toml`.

### Django projects
- `templates/`, `components/` and `static/` folders inside your Django apps are found automatically, up to 6 levels below `pyblade.toml`.
- `@url` names are read from every `urls.py`, with the `app_name` namespace added.
- `@static` also covers the folders listed in `STATICFILES_DIRS`. Set `settings` in `pyblade.toml` when your settings are split (for example `config/settings/dev.py`); `from .base import *` chains are followed.

### How components are resolved
`<pb-nav.menu />` and `@component('nav.menu')` look for, in this order:

1. `nav/menu.py` or `nav/menu/menu.py`, a Live component
2. `nav/menu.html`, a simple reusable UI component

Dots in a name are folder separators. `<pb-slot>` is built in and is never reported as missing.

## Known limitations
- `@url` works better in django projects only.
- Django files are scanned as text, not executed. `STATICFILES_DIRS` must be string literals relative to `BASE_DIR`, and URL names must be string literals in `urls.py`. Names added at runtime, by third-party packages or by `include(..., namespace=...)` are not discovered, so you may see a "not found" warning for them. Warnings never block anything.
- References are checked only when they are plain quoted strings on one line.
- The extension registers `.html` as the PyBlade language. If that conflicts with a non-PyBlade project, change the mode for that workspace with `files.associations`.

## Requirements

VS Code 1.91 or newer.

## Contributing

Contributions are welcome:
- Report bugs or suggest features through [GitHub Issues](https://github.com/AntaresMugisho/pyblade-vscode/issues).
- Submit pull requests to the [GitHub repository](https://github.com/AntaresMugisho/pyblade-vscode).

## Support

For assistance, feedback or feature requests, visit [feedback.pyblade.com](https://feedback.pyblade.com).