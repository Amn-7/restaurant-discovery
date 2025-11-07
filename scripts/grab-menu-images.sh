#!/usr/bin/env bash
set -euo pipefail

# Where to save
OUT_DIR="public/menu"
mkdir -p "$OUT_DIR"

if command -v sips >/dev/null 2>&1; then
  REENCODE_TOOL="sips"
elif command -v magick >/dev/null 2>&1; then
  REENCODE_TOOL="magick"
elif command -v convert >/dev/null 2>&1; then
  REENCODE_TOOL="convert"
else
  REENCODE_TOOL=""
  echo "Info: no image re-encode tool detected; downloads kept as-is." >&2
fi

reencode_jpeg() {
  local file="$1"
  case "$REENCODE_TOOL" in
    sips)
      sips -s format jpeg "$file" --out "$file" >/dev/null 2>&1 || true
      ;;
    magick)
      magick "$file" -quality 92 "$file" >/dev/null 2>&1 || true
      ;;
    convert)
      convert "$file" -quality 92 "$file" >/dev/null 2>&1 || true
      ;;
    *)
      return 0
      ;;
  esac
}

# name|search-query  (left is the exact file name you want, right is what to search)
items=(
  "Truffle-Mushroom-Risotto.jpg|truffle mushroom risotto"
  "Margherita-Pizza.jpg|margherita pizza"
  "Spicy-Pad-Thai.jpg|spicy pad thai"
  "Slow-Braised-Short-Ribs.jpg|short ribs plated"
  "Coconut-Curry-Ramen.jpg|coconut curry ramen"
  "Citrus-Herb-Salmon.jpg|citrus herb salmon"
  "Smoky-BBQ-Jackfruit-Burger.jpg|jackfruit burger"
  "Burrata-Caprese-Salad.jpg|burrata caprese salad"
  "Fire-Grilled-Prawns.jpg|grilled prawns plate"
  "Hand-cut-Parmesan-Fries.jpg|parmesan fries"
  "Charred-Broccolini.jpg|charred broccolini"
  "Chili-Lime-Street-Corn.jpg|elote street corn"
  "Berry-Cheesecake.jpg|berry cheesecake slice"
  "Dark-Chocolate-Mousse.jpg|dark chocolate mousse dessert"
  "Creme-Brulee.jpg|creme brulee dessert"
  "Mango-Lassi.jpg|mango lassi glass"
  "Sparkling-Hibiscus-Tea.jpg|hibiscus tea sparkling"
  "Cold-Brew-Tonic.jpg|cold brew tonic"
  "Sunrise-Smoothie-Bowl.jpg|smoothie bowl tropical"
  "Lobster-Bisque.jpg|lobster bisque"
)

download_one () {
  local filename="$1"
  local query="$2"
  local out="$OUT_DIR/$filename"

  # Skip if already exists
  if [[ -f "$out" ]]; then
    echo "✔ Exists: $out"
    return 0
  fi

  # Use Unsplash Source (redirects to a JPEG). Quote the URL so zsh doesn’t treat & as a job.
  local url="https://source.unsplash.com/1600x1200/?$(python - <<'PY'
import sys, urllib.parse
print(urllib.parse.quote(sys.argv[1]))
PY
"$query")"

  echo "→ $filename  ←  $query"
  # Try up to 5 times, follow redirects, treat 503/connection as retryable
  if curl -L --fail --retry 5 --retry-all-errors --max-time 30 \
      -A "Mozilla/5.0" \
      -o "$out" "$url"; then
    # Re-encode as JPEG just in case (some images may not be jpg)
    reencode_jpeg "$out"
    echo "✔ Saved: $out"
  else
    echo "⚠ Download failed, using placeholder: $filename"
    curl -L --fail -o "$out" "https://placehold.co/1600x1200?text=$(python - <<'PY'
import sys, urllib.parse
print(urllib.parse.quote(sys.argv[1]))
PY
"$filename")" || true
  fi
}

for entry in "${items[@]}"; do
  IFS='|' read -r name query <<<"$entry"
  download_one "$name" "$query"
done

echo "Done."
