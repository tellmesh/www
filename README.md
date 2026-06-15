# TellMesh WWW

Product site and chat UI for the hypervisor dashboard (`hypervisor-dashboard-agent`).

Polish overview: [`README.pl.md`](./README.pl.md)

## Pages

| URL | File | Description |
|-----|------|-------------|
| `/www/` | `index.html` | Landing — presentation, integrations, office, offer |
| `/www/chat.html` | `chat.html` | Live chat — NL → URI plan, API calls |
| `/www/przyklady.html` | `przyklady.html` | Integration lab — PASS cards + filters |
| `/www/docs/examples.html` | `docs/examples.html` | Docs examples — full `examples/*/*` content |
| `/www/demo.html` | `demo.html` | Technical URI demo (static) |

## Source of truth

Static assets live in this repository. The hypervisor monorepo keeps:

- `scripts/www/*` — generators reading `examples/` and writing into this checkout
- `www/Dockerfile`, `www/docker-compose.yml` — deploy glue

Sync from hypervisor when needed:

```bash
python3 scripts/tellmesh/sync_www.py
python3 scripts/tellmesh/sync_www.py --check
```

## Run (with hypervisor)

From `wronai/hypervisor`:

```bash
make start          # Docker :8788
make www-smoke
```

Landing: http://localhost:8788/www/  
Chat: http://localhost:8788/www/chat.html

`HYPERVISOR_WWW_DIR` overrides the mounted www path (default: sibling `../../tellmesh/www` when present).

## Regenerate docs

From hypervisor repo root:

```bash
make www-docs
make www-docs-check
```

Outputs land in this repo (`docs/examples.html`, `generated/*`, `#integracje` in `index.html`).
