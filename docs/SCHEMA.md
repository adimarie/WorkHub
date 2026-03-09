# Database Schema Reference

> This file is loaded on-demand. Referenced from CLAUDE.md.
> Updated by the setup wizard and as tables are added/modified.

## Core Tables

### `clients`
Primary record for each person who works with the practitioner.
```
id               UUID PK
created_at       TIMESTAMPTZ
updated_at       TIMESTAMPTZ
full_name        TEXT NOT NULL
email            TEXT
phone            TEXT
pronouns         TEXT
emergency_contact TEXT
notes            TEXT
tags             TEXT[]
is_archived      BOOLEAN DEFAULT FALSE
```

### `services`
Offerings catalog — somatic sessions, ceremonial containers, mentorship packages, etc.
```
id               UUID PK
created_at       TIMESTAMPTZ
name             TEXT NOT NULL
description      TEXT
category         TEXT  -- 'somatic' | 'ceremonial' | 'mentorship' | 'offering'
duration_minutes INTEGER
price_cents      INTEGER
is_active        BOOLEAN DEFAULT TRUE
is_archived      BOOLEAN DEFAULT FALSE
```

### `appointments`
Individual sessions scheduled with a client.
```
id               UUID PK
created_at       TIMESTAMPTZ
updated_at       TIMESTAMPTZ
client_id        UUID FK → clients.id
service_id       UUID FK → services.id
scheduled_at     TIMESTAMPTZ NOT NULL
duration_minutes INTEGER
status           TEXT DEFAULT 'scheduled'  -- 'scheduled' | 'completed' | 'cancelled' | 'no_show'
location         TEXT
notes            TEXT
is_archived      BOOLEAN DEFAULT FALSE
```

### `intake_forms`
Intake and consent forms submitted by clients.
```
id               UUID PK
created_at       TIMESTAMPTZ
updated_at       TIMESTAMPTZ
client_id        UUID FK → clients.id
form_type        TEXT  -- 'initial' | 'somatic' | 'ceremonial' | 'mentorship'
responses        JSONB
submitted_at     TIMESTAMPTZ
is_archived      BOOLEAN DEFAULT FALSE
```

### `mentorship_containers`
Ongoing mentorship packages / multi-session containers.
```
id               UUID PK
created_at       TIMESTAMPTZ
updated_at       TIMESTAMPTZ
client_id        UUID FK → clients.id
service_id       UUID FK → services.id
name             TEXT NOT NULL
description      TEXT
start_date       DATE
end_date         DATE
total_sessions   INTEGER
sessions_used    INTEGER DEFAULT 0
status           TEXT DEFAULT 'active'  -- 'active' | 'paused' | 'completed' | 'cancelled'
notes            TEXT
is_archived      BOOLEAN DEFAULT FALSE
```

### `payments`
Payment records linked to appointments or mentorship containers.
```
id                       UUID PK
created_at               TIMESTAMPTZ
client_id                UUID FK → clients.id
appointment_id           UUID FK → appointments.id
mentorship_container_id  UUID FK → mentorship_containers.id
amount_cents             INTEGER NOT NULL
currency                 TEXT DEFAULT 'USD'
status                   TEXT DEFAULT 'pending'  -- 'pending' | 'completed' | 'failed' | 'refunded'
payment_method           TEXT  -- 'square' | 'stripe' | 'cash' | 'venmo' | 'trade'
external_id              TEXT  -- processor payment ID
notes                    TEXT
is_archived              BOOLEAN DEFAULT FALSE
```

## Service Config Tables

Created when optional services are enabled:
```
telnyx_config    - SMS configuration (single row, id=1)
resend_config    - Email configuration (single row, id=1)
square_config    - Square payment configuration (single row, id=1)
stripe_config    - Stripe payment configuration (single row, id=1)
signwell_config  - E-signature configuration (single row, id=1)
```

## Common Patterns

- All tables use UUID primary keys (`gen_random_uuid()`)
- All tables have `created_at` timestamp; mutable tables have `updated_at`
- RLS is enabled on all tables
- `is_archived` flag for soft deletes — always filter with `.filter(s => !s.is_archived)` client-side
- Services: public read, authenticated write
- All other tables: authenticated access only
