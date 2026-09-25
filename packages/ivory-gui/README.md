# Ivory GUI prototype

`@theia/ivory-gui` is a private, browser-only Theia frontend extension for the Ivory Poteto prototype.

It adds a reversible evidence dashboard and a package-local visual foundation. The extension uses Theia's existing view, widget, command, and application-contribution APIs. It does not replace Theia's shell DOM or core theme files.

The prototype is intentionally not wired into the Electron or browser-only example applications. It is loaded by `examples/browser` through the package dependency graph and generated frontend entrypoint.

Run the focused checks from the repository root:

```text
npm run compile --workspace @theia/ivory-gui
npx lerna run test --scope @theia/ivory-gui
npm run lint --workspace @theia/ivory-gui
```
