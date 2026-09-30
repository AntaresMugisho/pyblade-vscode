# PyBlade Intellisense for VS Code

PyBlade IntelliSense provides IntelliSense, syntax highlighting, snippets, and language support for PyBlade templates.

<!-- >**Note:** PyBlade IntelliSense has moved to the official `pyblade.intellisense` extension. Please install and use this version going forward. The `antares.pyblade-intellisense` extension is no longer maintained and will not receive further updates or support.
 -->

## Features

### 1. **IntelliSense for PyBlade Directives**
- **Auto-Completion**: Get real-time suggestions for PyBlade directives like `@if`, `@for`, `@csrf`, and more.
- **Context-Aware Suggestions**: IntelliSense adapts to your code context, ensuring relevant suggestions for logic, loops, and conditions.
- **Custom Directives**: Automatically detects custom directives defined in your project.

### 2. **Syntax Highlighting**
- Beautiful and precise syntax highlighting for all PyBlade-specific syntax.
- Supports nested directives and complex expressions, making your code more readable.

### 3. **Snippets for Rapid Development**
- Quick access to commonly used directives and structures:
  - `@ifelse` blocks
  - `@for` loops
  - `@component` declarations
- Editable snippet templates to suit your project’s needs.

### 4. **Error Highlighting**
- Real-time error detection for unclosed directives or invalid syntax.
- Inline error messages to ensure your templates work flawlessly.

### 5. **Live Preview Integration**
- Instantly preview your rendered templates in the browser (requires a configured Python project).
- Automatic reload on file changes for faster iteration.

### 6. **Code Navigation**
- Quickly jump to the definitions of components, directives, and included templates.
- Hover tooltips display useful documentation and examples.

### 7. **Customizable Configuration**
- Full control over the extension’s behavior, such as:
  - Toggling specific features (e.g., live preview, error highlighting).
  - Customizing themes for syntax highlighting.

## Getting Started

1. **Enable PyBlade in Your Project**: 
   Ensure your project is configured to use PyBlade.


2. **Start Writing Templates**: 
   Open any `.html` file and enjoy IntelliSense, syntax highlighting, and snippets.

3. **Customize the Extension**:
   Use the **PyBlade** section in the VS Code settings to adjust preferences.


## Keybindings

- **Insert Directive Snippet**: `Ctrl+Space` (or `Cmd+Space`) inside a PyBlade template.
- **Jump to Component**: `Ctrl+Click` (or `Cmd+Click`) on a component name.
- **Live Preview**: `Ctrl+Shift+P` → Search for "PyBlade: Preview Template".

## Future Enhancements

We are continually improving the PyBlade VS Code Extension! Planned updates include:
- **Advanced Debugging Tools** for templates.
- **Framework-Specific Enhancements** for Flask and others.
- **Community-Suggested Features**—share your ideas with us!

## Contributing

We welcome contributions to enhance the PyBlade VS Code Extension! Feel free to:
- Report bugs or suggest features via [GitHub Issues](https://github.com/AntaresMugisho/PyBladeIntelliSense-vscode/issues).
- Submit pull requests to our [GitHub Repository](https://github.com/AntaresMugisho/PyBladeIntelliSense-vscode).


## Support

For assistance, feedback, or feature requests, please visit [feedback.pyblade.com](https://feedback.pyblade.com).


We hope **PyBlade IntelliSense** makes your PyBlade projects a joy to work on!