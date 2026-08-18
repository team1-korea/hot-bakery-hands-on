#!/usr/bin/env bash

set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
artifact="$project_dir/out/AvalancheBakeryCertificate.sol/AvalancheBakeryCertificate.json"
destination="$project_dir/abi/AvalancheBakeryCertificate.json"
temporary_file="$(mktemp)"

trap 'rm -f "$temporary_file"' EXIT

cd "$project_dir"
forge build
jq '.abi' "$artifact" > "$temporary_file"
mv "$temporary_file" "$destination"
trap - EXIT

echo "Exported ABI to $destination"
