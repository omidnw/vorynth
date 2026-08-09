# Connector Sourcing Policy

How Vorynth decides which sources get an **official / built-in** connector —
and where the line is drawn.

## The principle

Vorynth only builds official or built-in connectors for sources that have a
**legitimate public mode**: RSS feeds, open APIs, published sitemaps, public
JSON listings, and similar endpoints the publisher intends the public to use.
If a service publishes content in a way anyone can subscribe to, a connector
for it is fair game.

## The decision table

One table to settle future proposals. If a source doesn't land on **Yes**, it
either ships as a community connector or doesn't ship at all — the debate does
not restart from zero with every "why not LinkedIn?" request.

| Source capability                                         | Official / built-in connector |
| --------------------------------------------------------- | ----------------------------- |
| Public RSS feed                                           | Yes                           |
| Public API (publisher intends public use)                 | Yes                           |
| Public sitemap                                            | Yes                           |
| Public JSON feed / listing                                | Yes                           |
| Requires authentication                                   | Case by case                  |
| Requires bypassing restrictions (paywalls, geo, anti-bot) | No                            |
| Private user data                                         | No                            |
| Paid API with no public mode                              | No                            |

"Requires authentication" is only _case by case_ when the publisher openly
offers the access to anyone — free registration, a public app key, or similar.
The moment a connector would depend on bypassing restrictions or scraping
around auth, it is a **No**, regardless of how easy the bypass is.

## No silent policy exceptions

A source that does not meet the official criteria cannot become official
through popularity, demand, or convenience — "everyone wants Reddit" is not a
policy argument. The trust model applies equally to every source; the path for
an excluded source is the community route, never a quiet carve-out.

## What is explicitly out of scope for official / built-in

Sites that **sell their API and have no public mode** — Reddit is the concrete
case. Reasons:

- **Legal risk exists even where the company's terms do not explicitly cover
  it.** "Their policy doesn't say we can't" is not a license. A service whose
  business model is charging for programmatic access is precisely the kind of
  party that pursues scraping of its free endpoints, and the cost of being
  wrong is far higher than the value of one connector.
- **We do not probe such services from our own infrastructure.** This is why
  Reddit is excluded from the connector health check
  (`apps/core-engine/src/health/reference-sources.ts`): a nightly automated
  probe from datacenter IPs would provoke a company that sells its API. Legal
  right is not the same as wise to poke.
- **Users are not served by a connector that 403s.** Such endpoints are
  frequently blocked from non-browser clients anyway, so an official connector
  would silently fail for a large share of users.

## The future path for such sources: community connectors

We do not want to ban the _capability_ — only our responsibility for it. When
the community connector system lands, a user can add a Reddit-style source
**themselves**:

- the connector is user-installed, at the user's responsibility;
- it goes through the standard install path, including the static security
  scan and the per-plugin enable confirmation;
- it is clearly not a Vorynth-supported connector, and may break at any time.

Official Vorynth connectors, by contrast, must always be on the legitimate
side of the line above.

## Trust tiers

Connectors carry a trust tier, shown on the Plugins page. Built-in core
adapters (RSS, GitHub Releases, HTML, sitemap, API) ship compiled in the
engine and carry no tier — they are part of Vorynth itself. The tier system
governs connectors that are distributed or installed beyond that core:

- **official** — connectors whose code Vorynth has **verified**: code-reviewed
  and security-scanned, whether written by the Vorynth team or contributed by
  the community — the bar is what was checked, not who wrote it. Their
  definitions are distributed through the registry while their implementations
  stay compiled into Vorynth. Each has a reference source in the connector
  health check (`apps/core-engine/src/health/reference-sources.ts`), so it
  demonstrably collects against the real internet. The first connector
  registered through this registry trust flow, and currently the only one, is
  arXiv.
- **community** — third-party, installed by the user. A community plugin that
  becomes genuinely popular may later be _promoted_ by Vorynth, but it keeps
  its community tag — promotion is trust, not a rebrand.

## Quality bar

The official tier is earned against a bar, not granted by a label. An
official connector must have:

- **at least one reference source** in the connector health check
  (`apps/core-engine/src/health/reference-sources.ts`), live-tested against
  the real internet;
- **passing health checks** — a connector that stops collecting is reported
  loudly, never silently absorbed as "No new articles found";
- **documented configuration fields** — the same `configFields` a user sees
  in Add Source, with placeholders and hints;
- **stable ownership** — a single accountable maintainer (Vorynth for
  official, the author for community);
- **a clear failure mode** — when a connector breaks, the user is told why,
  not left with a silent nothing.

## Maintenance responsibility

Official connectors are maintained by Vorynth — and that maintenance is a
commitment, not a one-time publish. A connector may be removed, replaced, or
deprecated when its source no longer meets reliability or policy requirements:
the health check is the canary, and the decision table above is the standard.
This is the other side of "official": Vorynth owns the consequence of the
integration.

Community connectors remain maintained by their authors. Vorynth's support
does not extend to them, and they may break at any time — the user installs
them at their own responsibility, exactly as the community path above says.

## Where this lives in code

- The health-check catalog documents the Reddit exclusion inline
  (`apps/core-engine/src/health/reference-sources.ts`).
- The `knownFlaky` catalog flag is the _mechanism_ for environmentally flaky
  sources — it is **not** a backdoor for policy-excluded services.
- Official connectors are distributed through the **Vorynth connector
  registry**, hosted in the Vorynth GitHub repository
  (`connectors/registry.json`, fetched by `ConnectorRegistryService`) — their
  DEFINITIONS (source mapping, configFields, icon, tier) are live-updatable
  from the repo, while their adapter implementations stay compiled in the
  engine (trusted, no bundle execution — R-A13). The registry is definitions-
  only by construction: `tier` is explicit per entry, and `implementation` is
  implicit — always the compiled built-in, enforced by the compiled-adapter
  gate that skips any entry whose adapter is not in this app build. A future
  community path with packaged implementations will be a separate channel,
  never a field that starts meaning "download and execute code". When a source
  references an available official connector definition, Vorynth resolves it
  automatically during source creation and Test — the definition is fetched
  from the registry and the existing compiled adapter is enabled; no new
  resource is installed. The Plugins page offers "Check GitHub for connectors"
  for the same refresh on demand.
