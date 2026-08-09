# Vorynth Runtime UI Plugins — authoring guide

A runtime UI plugin extends the Vorynth app itself: a sidebar entry with its own
page, a Settings section, a guide on the Documentation page, a theme — or any
combination. The built-in **Reference Plugin** (`plugins/reference/`) is a
complete working example; read it alongside this guide.

Everything a plugin needs comes from the SDK, `@vorynth/plugin-host`
(`useTranslation`, `usePluginConfig`, `<Icon>`, icon/font registries, …) — never
from Vorynth's app internals.

## 1. The plugin folder

```
plugins/<id>/
├── plugin.json      # manifest: id, name, version (required)
├── src/
│   └── index.tsx    # source — exports the contributions
└── assets/          # optional: fonts, images, JSON — anything you want shipped
```

### plugin.json

```json
{
	"id": "my-plugin",
	"name": "My Plugin",
	"description": "What it does.",
	"version": "1.0.0",
	"contributions": ["theme", "icons", "fonts"]
}
```

- `id` — stable, lowercase, unique; must **not** collide with a built-in
  plugin id (rss, html, sitemap, api, github-releases, arxiv, reference,
  icons).
- `version` — your plugin's own version (shown on the Plugins page).
- `contributions` — optional tags that surface as badges on the Plugins page.

### src/index.tsx — what a plugin can export

| Export            | Effect                                                                  |
| ----------------- | ----------------------------------------------------------------------- |
| `default`         | The page rendered at `/plugin/<id>` (requires `navItems` to reach it)   |
| `navItems`        | Sidebar entries — `{ id, label, icon }[]`                               |
| `SettingsSection` | A section on the Settings page; persists via `usePluginConfig`          |
| `docsSection`     | A guide on the Documentation page (`DocsSection` from `@vorynth/types`) |
| `themes`          | `PluginTheme[]` — pickable in Settings → Appearance                     |

## 2. Build the bundle

```bash
node scripts/build-plugin-bundles.mjs
```

Compiles every `plugins/<id>/src/index.tsx` → `public/plugins/<id>/bundle.js`
(esbuild; React and the SDK are aliased to the host so the plugin shares the
app's single React instance).

## 3. Package it as a `.vorynth-plugin` file

Put the built `bundle.js` next to `plugin.json` (either copy it from
`public/plugins/<id>/bundle.js`, or build into the folder), then:

```bash
node scripts/package-plugin.mjs plugins/my-plugin -o dist/my-plugin.vorynth-plugin
```

The `.vorynth-plugin` file is a ZIP containing `plugin.json`, `bundle.js`, and
any other files in the folder. This is the file non-technical users install.

## 4. Install

- **End users:** Plugins page → **Install plugin** → pick the `.vorynth-plugin`
  file. The engine validates the archive, extracts it into `data/plugins/<id>/`,
  and registers it under **Installed**.
- **Developers:** drop the folder into the engine's `data/plugins/` directory
  and press **Scan for plugins** (or restart).
- Reinstalling an updated package refreshes the manifest and bundle while
  keeping the user's enabled/configuration state. **Remove** (on an Installed
  row) deletes the plugin and its folder; built-ins can only be switched off.

## Validation the engine enforces

- The archive must unzip and contain `plugin.json` (with `id`, `name`,
  `version`) and `bundle.js` at the root.
- The `id` must not belong to a built-in plugin.
- Archive entry names are sanitized (no `..`, no absolute paths), and the
  unzipped size is capped — so a package can never escape its own folder.
