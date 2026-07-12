# Nidhi - Internal DBaaS Control Plane

Nidhi is our proprietary internal Database-as-a-Service (DBaaS) Control Plane. It acts as the central nervous system for our infrastructure, autonomously provisioning, tracking, and managing databases across our fleet of Data Plane nodes.

> **Multi-engine:** Nidhi is engine-agnostic. It currently supports **PostgreSQL** and
> **Cassandra** (used by the Nexus OMS PRO mode for the audit/activity store), behind a
> common driver interface (`backend/api/engine_drivers/`). Adding MySQL/MongoDB/SQL Server
> later means dropping in a new driver — no changes to the API, tasks, or UI.

## Architecture Overview

Nidhi is strictly an **internal-only** application. It operates entirely within our secure, encrypted **Tailscale Mesh Network**. It is never exposed to the public internet.

*   **Frontend:** React (Vite) + Tailwind CSS, delivering a sleek "God Mode" administrative interface and Employee Dashboards.
*   **Backend:** Django REST Framework (DRF), backed by PostgreSQL.
*   **Identity & Auth:** Centralized SSO powered by Rubix (OAuth2 with custom Role-Based Access Control validators).
*   **Asynchronous Workers:** Celery + Redis orchestrate long-running background tasks.

## Core Capabilities

1.  **Autonomous Provisioning (The Nidhi Wrapper):**
    Future startup products use our lightweight `nidhi-init.sh` Docker entrypoint. When a product boots, it pings Nidhi's `auto-provision` endpoint over the Tailscale mesh (optionally passing `engine`). Nidhi dynamically locates an active server of the requested engine, spins up a database/keyspace and role via the matching driver, and injects the connection string back into the container instantly.
2.  **Autonomous Node Registration:**
    New VPS machines running our `install-nidhi-node.sh` script automatically ping Nidhi, lock down their firewalls (UFW to `tailscale0`), spin up a Dockerized PostgreSQL Master, and register themselves securely via the `auto-register` endpoint.
3.  **Role-Based Access Control (RBAC):**
    SSO JWT introspection dictates whether a user is an Employee (assigned to specific products) or a Founding Engineer (Global God-Mode access).
4.  **Disaster Recovery & WAL Replication:**
    Celery workers periodically reach out to Data Plane nodes to pull `pg_dump` backups, maintaining a secure, read-only backup replica layer inside the Control Plane.

## Getting Started (Local Dev Server)

Nidhi runs via Docker Compose on the internal Ubuntu Dev Server:

```bash
docker compose up --build -d
```

*   **Frontend:** `http://localhost:3000` (or the Tailscale IP)
*   **Backend API:** `http://localhost:8001`
*   **SSO Integration:** Configured to point to the Rubix Identity Provider at `http://172.21.0.1:8000`.

## Security

*   **Endpoints:** Nidhi's provisioning endpoints are protected by `NIDHI_APP_API_KEY` and `NIDHI_REGISTRATION_TOKEN`.
*   **Network:** All inter-node communication occurs exclusively over Tailscale IPs.