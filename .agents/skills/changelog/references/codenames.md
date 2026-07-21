# Codename vocabulary

Vorynth release codenames draw from the project's own brand language (see `project-details.md` §2 Name & Meaning, and §9 Brand Principles). This file lists the canonical vocabulary, the composition rules, and which names are already in use.

## Canonical sources

The brand rests on four ideas in §9, plus the name's stated meaning in §2:

**From §9 — the four principles:**

1. **Signal Over Noise** — finding what matters in the flood; rejecting the irrelevant.
2. **Source Quality Over Quantity** — a few trusted sources beat many unreliable ones.
3. **Explain, Don't Just Summarize** — what happened + why it matters + what to do.
4. **Privacy First** — local-first, user-controlled, no mandatory cloud.

**From §2 — the name's meaning:**

5. **Navigate the Maze** — helping humans find paths through the endless information maze.
6. **Discovery** — surfacing what the user didn't know to look for.
7. **Knowledge Paths** — the routes from raw information to understanding.
8. **Intelligent Filtering** — ranking, dedup, importance scoring.

**From the product vision:**

9. **Minutes Not Hours** — time saved is the core promise.
10. **Local Engine** — the engine runs on the user's device.
11. **Trusted Sources** — curation as a feature, not a limitation.
12. **Understand Before You Read** — context-first reading.

## Composition rules

Codenames are **two to four words**, title case, drawn from the vocabulary above. They can be:

- **Direct quotes** — the principle verbatim: `Signal Over Noise`, `Privacy First`.
- **Compositions** — two vocabulary words joined to fit a release: `Local Filtering`, `Trusted Discovery`, `Explain The Signal`.
- **Verb forms** — turn a principle into an action the release performs: `Filter The Noise`, `Earn The Trust`, `Explain The Why`.

Stay in-brand. The codename should make a reader who's read `project-details.md` nod, not raise an eyebrow. Avoid:

- Animal names, season names, Greek letters, city names — none of these are in the brand language.
- Marketing adjectives ("Ultra", "Turbo", "Pro").
- Generic verbs with no brand link ("Faster Loading", "Better Search") — use the principle instead ("Minutes Not Hours", "Intelligent Filtering").

## How to pick

1. Read the `summary` you just wrote for the release. What's the _one idea_ a user would take away?
2. Map that idea to a principle above. If the release is about search, it's probably **Explain, Don't Just Summarize** or **Discovery**. If it's about the job system, **Signal Over Noise** (less waiting, more signal). If it's about backup/restore, **Privacy First** or **Local Engine**.
3. Check the "Already used" list below. If your first choice is taken, compose a variation from the same principle rather than switching to an unrelated one.
4. When two principles fit equally well, pick the one that matches the _biggest_ change in the release, not the most numerous one.

## Already used

Update this list when you add a codename to `RELEASES`. One codename per release — no reuse.

| Version | Codename                        | Principle       |
| ------- | ------------------------------- | --------------- |
| 1.3.0   | In Your Language                | composition     |
| 1.2.0   | Richer Briefing, Smarter Search | composition     |
| 1.1.0   | Understand Before You Read      | product vision  |
| 1.0.2   | Source Quality Over Quantity    | §9 principle #2 |
| 1.0.1   | Explain, Don't Just Summarize   | §9 principle #3 |
| 1.0.0   | Signal Over Noise               | §9 principle #1 |

## Suggested (not yet used)

These are good defaults when nothing more specific fits. Mark one as used (move it to the table above) the first time you assign it:

- **Privacy First** — backup/restore, data ownership, key handling, delete-all
- **Navigate the Maze** — navigation, IA, routing, sidebar/redesign
- **Minutes Not Hours** — performance, speed, automation, scheduling
- **Local Engine** — engine lifecycle, sidecar, ports, health checks
- **Intelligent Filtering** — ranking, fetch windows, sort modes, importance scoring
- **Discovery** — new sources, new domains, onboarding
- **Trusted Sources** — provider config, verify flow, source vetting
- **Knowledge Paths** — clusters, topic grouping, related-article features
- **Discovery** — new sources, new domains, onboarding
- **Trusted Sources** — provider config, verify flow, source vetting
- **Understand Before You Read** — context layering, Why-It-Matters, brief redesigns
- **Knowledge Paths** — clusters, topic grouping, related-article features
