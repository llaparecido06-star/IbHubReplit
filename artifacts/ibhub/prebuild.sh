#!/bin/bash
set -e

if [ -n "$GOOGLE_SERVICES_JSON" ]; then
  echo "$GOOGLE_SERVICES_JSON" > ./google-services.json
fi

exec pnpm exec expo prebuild "$@"
