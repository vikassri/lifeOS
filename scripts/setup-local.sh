#!/bin/bash
set -euo pipefail

echo "=== lifeOS — Local Setup ==="

if [ ! -f .env.local ]; then
  cp .env.local.example .env.local
  echo "✓ Created .env.local"
fi

# Auto-generate SESSION_SECRET if still placeholder
if grep -q "change-me-to-a-random-string" .env.local; then
  SESSION_SECRET=$(openssl rand -base64 48)
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|change-me-to-a-random-string-of-at-least-32-chars|$SESSION_SECRET|" .env.local
  else
    sed -i "s|change-me-to-a-random-string-of-at-least-32-chars|$SESSION_SECRET|" .env.local
  fi
  echo "✓ Generated SESSION_SECRET"
fi

# Auto-generate ENCRYPTION_KEY if still placeholder
if grep -q "000000000000000000000000000000000000000000000000000000000000000" .env.local; then
  ENCRYPTION_KEY=$(openssl rand -hex 32)
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|0000000000000000000000000000000000000000000000000000000000000000|$ENCRYPTION_KEY|" .env.local
  else
    sed -i "s|0000000000000000000000000000000000000000000000000000000000000000|$ENCRYPTION_KEY|" .env.local
  fi
  echo "✓ Generated ENCRYPTION_KEY"
fi

mkdir -p .data
npm install

# Store the password hash where local authentication reads it.
if [ ! -f .data/password.hash ]; then
  echo ""
  read -r -s -p "Set the login password for onlyricks: " RAW_PASS
  echo ""
  if [ -z "$RAW_PASS" ] || [[ ! "$RAW_PASS" =~ [^[:space:]] ]]; then
    unset RAW_PASS
    echo "❌ Password cannot be empty"
    exit 1
  fi
  printf '%s' "$RAW_PASS" | node -e '
    const bcrypt = require("bcryptjs");
    const fs = require("fs");
    let password = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", chunk => password += chunk);
    process.stdin.on("end", async () => {
      try {
        const hash = await bcrypt.hash(password, 12);
        fs.writeFileSync(".data/password.hash", hash, { mode: 0o600 });
        fs.chmodSync(".data/password.hash", 0o600);
      } catch (error) {
        console.error(error);
        process.exitCode = 1;
      }
    });
  '
  unset RAW_PASS
  echo "✓ Password set"
fi

echo ""
echo "=== Setup complete ==="
echo "Run: npm run dev"
echo "Open: http://localhost:3000"
