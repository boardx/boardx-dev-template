# Local runtime persistence and restart recovery

## Browser finding

After a successful AI Store acceptance run, stopping the worktree Compose stack
and starting it again produced `relation "sessions" does not exist`. The
PostgreSQL image had created an anonymous volume because the Compose file did
not declare a service volume. A recreated container therefore attached a fresh
empty volume while the migrated database and seeded AI Store data remained in
an unattached anonymous volume.

## Requirements

- PostgreSQL, Redis, and MinIO must use project-scoped named Compose volumes so
  each Harness worktree keeps isolated state across `docker compose down` and
  `docker compose up`.
- Restarting the same worktree stack must retain migrations, authentication
  sessions, Teams, AI Store resources, subscriptions, and Template source
  Boards.
- A fresh named PostgreSQL volume must still be initialized through the
  repository migration command before the Web service is considered usable.
- Local recovery must not attach or delete another worktree's volumes.
- Verification must prove the Compose model uses named volumes and that the
  recovered database contains `sessions`, all recorded migrations, and the
  seeded AI Store fixture.
