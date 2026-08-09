# Vorynth Community Source Lists

Curated source lists contributed by the community. Anyone can add a list here —
pull requests are welcome. The Vorynth app discovers every `*.json` file under
this folder via the GitHub trees API, so the layout is flexible:

```
sources/
  security.json            ← a flat, general-purpose list (no author folder)
  devops/
    kubernetes.json        ← a list inside an author/curator folder
  jane.doe/
    ml-news.json           ← another curator's folder
```

A curator is the top-level folder name (`devops`, `jane.doe`, …). Files placed
directly in `sources/` are general lists with no curator.

## List file format

```json
{
	"id": "security-news",
	"name": "Security News",
	"description": "Stable infosec feeds — advisories, analysis, and threat research.",
	"nsfw": false,
	"version": "1.0.0",
	"sources": [
		{
			"id": "src-example-blog",
			"name": "Example Blog",
			"url": "https://example.com/feed.xml",
			"type": "rss",
			"category": "security",
			"adapter": "rss",
			"configuration": { "feedUrl": "https://example.com/feed.xml" },
			"fetchWindowDays": 7
		}
	]
}
```

### Rules

- **`id`**: URL-safe lowercase slug (`[a-z0-9][a-z0-9-]*`). Stable — Vorynth
  uses it to preserve user state (toggles, fetch windows) across refreshes.
  **Never rename an id**: it would be treated as a brand-new list and users
  would lose nothing, but their per-source edits would detach.
- **`sources[].adapter`** must be an adapter Vorynth ships (today: `rss`,
  `github-releases`, `arxiv`, `html`, `sitemap`, `api`, `reddit`) and
  `configuration` must pass that adapter's required fields (e.g. `feedUrl` for
  `rss`). Invalid sources are skipped on refresh, with the whole list skipped
  if nothing validates.
- **`sources[].id`**: also stable and unique per list.
- **`nsfw`**: set `true` for lists whose content is adult-only (18+). The app
  hides them by default and asks for explicit confirmation before enabling.
- **`version`**: bump it when the list's definitions change meaningfully — the
  app reports it as an "updated" list.

## How it reaches users

1. A list lands in this folder on the `master` branch.
2. The Vorynth app refreshes the catalog (daily, or via "Check GitHub for
   lists" on the Sources page).
3. The list appears under "Browse community lists" — the user enables it and
   it is downloaded once and cached, so it keeps working offline.

See the in-app Documentation page → Sources for the full user-facing story.
