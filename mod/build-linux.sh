#!/usr/bin/env bash
# Builds the VS Cheatsheet Bridge plugin on Linux, for example on a Steam Deck, and copies it
# into the game. No Windows PC needed.
#
#   bash mod/build-linux.sh                          finds the game in your Steam libraries
#   bash mod/build-linux.sh "/path/to/Vampire Survivors"
#
# Before that, BepInEx has to be installed in the game folder and the game started once with
# it: mod/README.md, "Steam Deck and Linux with Proton", steps 1 to 4.
#
# The build needs the .NET SDK and Node.js. If they are not installed, the script downloads
# them into ~/.cache/vs-cheatsheet-build: the .NET SDK with Microsoft's install script, Node.js
# from nodejs.org, checked against its published checksum. The build's caches go there too.
# Delete that folder to remove all of it. DOTNET_CHANNEL=... picks another .NET SDK version.
if [ -z "${BASH_VERSION:-}" ]; then
  echo "Please start the script with bash: bash mod/build-linux.sh" >&2
  exit 1
fi
set -euo pipefail

APP_ID=1794680                          # Vampire Survivors on Steam
DOTNET_CHANNEL=${DOTNET_CHANNEL:-10.0}  # .NET SDK to download (current LTS)
NODE_MAJOR=24                           # Node.js line to download (the same as the app's CI)
TOOLS=${XDG_CACHE_HOME:-$HOME/.cache}/vs-cheatsheet-build
REPO=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
PROJECT=$REPO/mod/VSCheatsheetBridge

say() { printf '\n==> %s\n' "$*"; }

# First line: what went wrong. Further lines: what to do about it.
fail() {
  printf '\nError: %s\n' "$1" >&2
  shift
  if [ $# -gt 0 ]; then printf '       %s\n' "$@" >&2; fi
  exit 1
}

download() { # url target
  curl --fail --location --proto '=https' --proto-redir '=https' --tlsv1.2 --retry 3 --progress-bar \
    --output "$2" "$1" \
    || fail "Download failed: $1" "Check the internet connection and run the script again."
}

check_space() {
  local free
  mkdir -p "$TOOLS"
  free=$(df -Pm "$TOOLS" | awk 'NR == 2 { print $4 }')
  if ! [ "${free:-0}" -ge 1500 ] 2>/dev/null; then
    fail "Not enough free disk space for the build tools: ${free:-?} MB free, about 1500 MB needed." \
         "They go to $TOOLS."
  fi
}

# Values of one key in Steam's .vdf and .acf files, one per line.
vdf_get() { # key file
  local re="^[[:space:]]*\"$1\"[[:space:]]+\"(.*)\"[[:space:]]*\$" line
  while IFS= read -r line || [ -n "$line" ]; do
    line=${line%$'\r'}
    if [[ $line =~ $re ]]; then printf '%s\n' "${BASH_REMATCH[1]}"; fi
  done < "$2"
}

# The game folder from Steam's list of libraries (internal storage and SD card), or nothing.
# Only libraries with the game's app manifest count: Steam keeps no manifest for removed games,
# but a folder with BepInEx in it may be left behind. The Steam folder itself is checked too,
# because Flatpak's Steam lists its libraries with paths from inside its sandbox.
find_game() {
  local root lib name
  for root in "$HOME/.local/share/Steam" "$HOME/.steam/steam" \
              "$HOME/.var/app/com.valvesoftware.Steam/.local/share/Steam"; do
    [ -f "$root/steamapps/libraryfolders.vdf" ] || continue
    while IFS= read -r lib; do
      [ -f "$lib/steamapps/appmanifest_$APP_ID.acf" ] || continue
      name=$(vdf_get installdir "$lib/steamapps/appmanifest_$APP_ID.acf")
      name=${name%%$'\n'*}
      if [ -n "$name" ] && [ -d "$lib/steamapps/common/$name" ]; then
        printf '%s\n' "$lib/steamapps/common/$name"
        return 0
      fi
    done < <(printf '%s\n' "$root"; vdf_get path "$root/steamapps/libraryfolders.vdf")
  done
  return 0
}

check_game() { # folder
  [ -f "$1/VampireSurvivors.exe" ] || fail "VampireSurvivors.exe is missing in the game folder." \
    "The mod needs the Windows version of the game, which Steam runs through Proton." \
    "In Steam: right-click the game > Properties > Compatibility > \"Force the use of a" \
    "specific Steam Play compatibility tool\", pick Proton, let Steam download the game," \
    "then run this script again."
  [ -f "$1/BepInEx/core/BepInEx.Unity.IL2CPP.dll" ] || fail "BepInEx is not installed in the game folder." \
    "Extract BepInEx-Unity.IL2CPP-win-x64 6.0.0-be.788 into it, see mod/README.md."
  [ -f "$1/BepInEx/interop/VampireSurvivors.Runtime.dll" ] || fail "BepInEx has not prepared the game yet." \
    "In Steam: right-click the game > Properties > General > Launch Options, and enter" \
    "WINEDLLOVERRIDES=\"winhttp=n,b\" %command%" \
    "Then start the game once and wait for the main menu (the first start takes a few" \
    "minutes), close it and run this script again."
}

# Puts a .NET SDK on PATH: the installed one, or one downloaded into $TOOLS/dotnet.
use_dotnet() {
  local version dir=$TOOLS/dotnet
  version=$(dotnet --version 2>/dev/null || true)
  if [ "${version%%.*}" -ge 6 ] 2>/dev/null; then
    say "Using the installed .NET SDK $version"
    return
  fi
  if ! [ -x "$dir/dotnet" ] || [ -z "$("$dir/dotnet" --list-sdks 2>/dev/null)" ]; then
    say "Downloading the .NET SDK $DOTNET_CHANNEL with Microsoft's install script ..."
    check_space
    download https://dot.net/v1/dotnet-install.sh "$TOOLS/dotnet-install.sh"
    rm -rf "${dir:?}.tmp"
    bash "$TOOLS/dotnet-install.sh" --channel "$DOTNET_CHANNEL" --install-dir "$dir.tmp" --no-path \
      || fail "Installing the .NET SDK failed, see the messages above." \
              "Check the internet connection and run the script again."
    rm -rf "${dir:?}"
    rm -f "$TOOLS/dotnet-install.sh"
    mv "$dir.tmp" "$dir"
  fi
  export DOTNET_ROOT=$dir PATH=$dir:$PATH
  say "Using the .NET SDK $(dotnet --version) from $dir"
}

# Puts Node.js on PATH: the installed one (18 or newer), or one downloaded into $TOOLS/node.
use_node() {
  local major dir=$TOOLS/node
  major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || true)
  if [ "$major" -ge 18 ] 2>/dev/null; then
    say "Using the installed Node.js $(node --version)"
    return
  fi
  if ! [ -x "$dir/bin/node" ]; then
    [ "$(uname -m)" = x86_64 ] || fail "Node.js is only downloaded for x86_64 here." \
      "Install Node.js 18 or newer yourself and run the script again."
    say "Downloading Node.js $NODE_MAJOR from nodejs.org (about 55 MB) ..."
    check_space
    local base=https://nodejs.org/dist/latest-v$NODE_MAJOR.x sums=$TOOLS/node-SHASUMS256.txt line file
    download "$base/SHASUMS256.txt" "$sums"
    line=$(grep -m 1 -E '  node-v[0-9.]+-linux-x64\.tar\.gz$' "$sums") \
      || fail "nodejs.org lists no Node.js $NODE_MAJOR for Linux x64."
    file=${line##* }
    download "$base/$file" "$TOOLS/$file"
    if ! (cd "$TOOLS" && printf '%s\n' "$line" | sha256sum --check --status); then
      rm -f "$TOOLS/$file"
      fail "The Node.js download is damaged: its checksum does not match." "Run the script again."
    fi
    rm -rf "${dir:?}.tmp"
    mkdir -p "$dir.tmp"
    tar -xzf "$TOOLS/$file" -C "$dir.tmp" --strip-components=1
    rm -rf "${dir:?}"
    rm -f "$TOOLS/$file" "$sums"
    mv "$dir.tmp" "$dir"
  fi
  export PATH=$dir/bin:$PATH
  say "Using Node.js $(node --version) from $dir"
}

project_version() {
  local line re='<Version>([^<]+)</Version>'
  while IFS= read -r line; do
    if [[ $line =~ $re ]]; then printf '%s\n' "${BASH_REMATCH[1]}"; return 0; fi
  done < "$PROJECT/VSCheatsheetBridge.csproj"
  return 0
}

main() {
  [ "$(uname -s)" = Linux ] || fail "This script is for Linux, for example the Steam Deck." \
    "On Windows, build as described in mod/README.md."
  [ -f "$PROJECT/VSCheatsheetBridge.csproj" ] || fail "The mod's project is not next to this script." \
    "Run it from the extracted project folder: bash mod/build-linux.sh"

  local game=${1:-${VS_GAME_DIR:-}}
  say "Looking for Vampire Survivors ..."
  if [ -z "$game" ]; then
    game=$(find_game)
    [ -n "$game" ] || fail "Vampire Survivors was not found in your Steam libraries." \
      "Pass the game folder: bash mod/build-linux.sh \"/path/to/Vampire Survivors\"" \
      "Steam shows it via right-click on the game > Manage > Browse local files."
  fi
  [ -d "$game" ] || fail "This folder does not exist: $game"
  game=$(cd "$game" && pwd)
  printf '    %s\n' "$game"
  check_game "$game"

  # Everything the build writes outside the project goes to $TOOLS: .NET and NuGet keep their
  # settings and caches in the home folder, so the build gets its own. The build needs no
  # language data, so .NET does not need ICU. No telemetry, no ASP.NET development certificate.
  export HOME=$TOOLS/home DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1 DOTNET_CLI_TELEMETRY_OPTOUT=1 \
         DOTNET_NOLOGO=1 DOTNET_GENERATE_ASPNET_CERTIFICATE=false
  unset XDG_CONFIG_HOME XDG_DATA_HOME XDG_CACHE_HOME
  mkdir -p "$HOME"
  use_dotnet
  use_node

  say "Building the plugin ..."
  mkdir -p "$game/BepInEx/plugins"
  dotnet build "$PROJECT" -c Release -nodeReuse:false -p:UseSharedCompilation=false "-p:GameDir=$game" \
    || fail "The build failed, see the messages above."

  local version built installed zip
  version=$(project_version)
  built=$PROJECT/bin/Release/VSCheatsheetBridge.dll
  installed=$game/BepInEx/plugins/VSCheatsheetBridge/VSCheatsheetBridge.dll
  zip=$REPO/mod/release/VSCheatsheetBridge-$version.zip
  if ! [ -f "$installed" ] || [ "$(sha256sum < "$built")" != "$(sha256sum < "$installed")" ]; then
    fail "The plugin was built, but not copied into the game." \
      "Copy VSCheatsheetBridge.dll and cheatsheet-data.json from $PROJECT/bin/Release" \
      "to $game/BepInEx/plugins/VSCheatsheetBridge/ yourself."
  fi

  say "Done: VS Cheatsheet Bridge $version is installed in the game."
  printf '    Plugin:      %s\n' "${installed%/*}"
  if [ -f "$zip" ]; then printf '    Release ZIP: %s\n' "$zip"; fi
  printf '    Build tools and caches: %s (%s).\n' "$TOOLS" "$(du -sh "$TOOLS" | cut -f 1)"
  printf '    Delete that folder if you no longer need them.\n'
  if pgrep -f 'VampireSurvivors\.exe' >/dev/null 2>&1; then
    printf '\n    The game is running: restart it to load the new plugin.\n'
  else
    printf '\n    Start the game and begin a run.\n'
  fi
}

# Runs only when started, not when sourced (lets tests call single functions).
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
