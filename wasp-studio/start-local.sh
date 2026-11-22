#!/bin/sh
set -eu
cd "$(dirname "$0")"
if [ -d "$HOME/.nvm/versions/node/v24.22.3/bin" ]; then PATH="$HOME/.nvm/versions/node/v24.22.3/bin:$PATH"; export PATH; fi
export npm_config_cache="${TMPDIR:-/tmp}/second-cursor-wasp-npm"
if [ -n "${WASP_CLI_JS:-}" ]; then exec node "$WASP_CLI_JS" start --client-port 3003 --server-port 3002 --client-url http://127.0.0.1:3003 --server-url http://127.0.0.1:3002; fi
if [ -f /tmp/second-cursor-wasp-cli-archive/bin.js ]; then exec node /tmp/second-cursor-wasp-cli-archive/bin.js start --client-port 3003 --server-port 3002 --client-url http://127.0.0.1:3003 --server-url http://127.0.0.1:3002; fi
exec wasp start --client-port 3003 --server-port 3002 --client-url http://127.0.0.1:3003 --server-url http://127.0.0.1:3002
