# Smart Client backend v2

## Security and scope

- Mobile routes require a client JWT and derive the user ID from that token.
- Administration routes require a staff JWT and the `admin` or `manager` role.
- Rules, state definitions, activation and analytics form one global Smart Client scope.
- Smart Client does not read, store or segment by restaurant.
- Offers are displayed only inside the mobile application; there are no SMS, email or push delivery channels.
- Telemetry payloads are size-limited, stripped of common sensitive fields and retained for 180 days.

## Runtime flow

1. `GET /api/smart-client/session-bundle?sessionId=...`
2. The client captures signals and calls `POST /api/smart-client/evaluate`.
3. The server evaluates the configured state and rule conditions, then applies dates, frequency caps, refusal delay, trigger rate, control group, budget and priority.
4. An immutable exposure is created for both exposed and control users.
5. The client records `displayed`, `accepted`, `refused` or `converted` through `PATCH /api/smart-client/exposures/:id`.
6. Telemetry is sent in batches to `POST /api/smart-client/log` with a unique `eventId`.

## Administration endpoints

- Rules: `GET/POST /`, `GET/PUT/DELETE /:id`, `PATCH /:id/toggle`
- History: `GET /:id/versions`, `POST /:id/versions/:version/restore`
- States: `GET/PUT /states/definitions`, `POST /states/definitions/reset`
- Analytics: `GET /analytics/summary`, `GET /analytics/sessions`
- System: `GET /system-status`, `POST /toggle-system`

## Migration

Run against the intended database before deploying v2:

```sh
npm run smart-client:migrate-v2
```

The migration carries over the legacy global activation setting and backfills event IDs. State definitions remain global.
