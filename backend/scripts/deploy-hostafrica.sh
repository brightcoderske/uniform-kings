#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p uploads tmp
npm install --omit=dev
touch tmp/restart.txt
echo "Uniform Kings API dependencies installed and Passenger restart requested."
