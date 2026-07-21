---
name: backup
description: Create a timestamped backup of the Vorynth SQLite database. Use BEFORE any destructive operation — migration, refactor, schema change, or data manipulation on the database. Also usable on demand when the user says "backup", "take a backup", "save my data", "before we continue", or any variant asking to preserve database state.
---

# Backup — Vorynth

Create a timestamped copy of the SQLite database before any operation that could lose data.

## When to use

- **Always** before: running `rm`, `drop`, `delete` on database files or data
- **Always** before: schema migrations, data migrations, refactors that touch the DB layer
- **Always** before: changes to the crawler, search, or FTS sync code
- On user request: "/backup", "take a backup", "save my data", "before we do this"

## How to run

```bash
cd /Users/omidrezakeshtkar/Documents/WorkSpaces/PersonalWorkSpaces/Vorynth/apps/core-engine

# Ensure the backup directory exists
mkdir -p data/backups

# Copy the database with a UTC timestamp
cp data/vorynth.sqlite "data/backups/vorynth-$(date -u +%Y-%m-%dT%H-%M-%SZ).sqlite"
```

## Verify

After creating the backup, confirm it's a valid SQLite file:

```bash
sqlite3 "data/backups/vorynth-<TIMESTAMP>.sqlite" "SELECT COUNT(*) FROM articles; SELECT COUNT(*) FROM sources;"
```

## What NOT to do

- Don't try to use the engine's BackupService while the engine is running — it manages its own connections. This skill operates on the file level.
- Don't overwrite an existing backup — each one gets a unique timestamp.
- Don't skip the backup even for "small" changes. A typo in a migration can wipe days of data.
