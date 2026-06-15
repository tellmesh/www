#!/usr/bin/env bash
# Resolve paths for tellmesh/www scripts.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
TELLMESH_WWW_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TELLMESH_ROOT="$(cd "$TELLMESH_WWW_ROOT/.." && pwd)"
export TELLMESH_ROOT
# shellcheck source=/dev/null
source "$TELLMESH_ROOT/resource-agent-hypervisor/scripts/hypervisor_root.sh"
