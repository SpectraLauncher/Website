#!/bin/sh
set -eu

LATEST_JSON='https://github.com/SpectraLauncher/Launcher/releases/latest/download/latest.json'
ICON_URL='https://usespectra.app/logo-transparent.png'

say() { printf '%s\n' "$*"; }
die() { printf 'Error: %s\n' "$*" >&2; exit 1; }

as_root() {
  if [ "$(id -u)" = 0 ]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    die "installing a package needs root, and sudo is not available"
  fi
}

download() {
  url=$(printf '%s' "$manifest" | tr -d ' \n\r' | sed "s/.*\"linux-x86_64-$1\":{[^}]*\"url\":\"\([^\"]*\)\".*/\1/")
  case "$url" in
    https://*) ;;
    *) die "the latest release has no $1 build" ;;
  esac
  file="$tmp/${url##*/}"
  say "Downloading ${url##*/}..."
  curl -fL --progress-bar "$url" -o "$file" || die "could not download $url"
}

install_appimage() {
  download appimage

  data="${XDG_DATA_HOME:-$HOME/.local/share}"
  bin="$HOME/.local/bin/spectra-launcher.AppImage"
  icon="$data/icons/spectra-launcher.png"
  entry="$data/applications/spectra-launcher.desktop"
  mkdir -p "$HOME/.local/bin" "$data/icons" "$data/applications"

  chmod 755 "$file"
  mv -f "$file" "$bin"
  curl -fsSL "$ICON_URL" -o "$icon" || true

  cat > "$entry" <<EOF
[Desktop Entry]
Type=Application
Name=Spectra Launcher
Exec="$bin" %u
Icon=$icon
Categories=Game;
Terminal=false
MimeType=x-scheme-handler/spectra;
EOF

  update-desktop-database "$data/applications" >/dev/null 2>&1 || true
  xdg-mime default spectra-launcher.desktop x-scheme-handler/spectra >/dev/null 2>&1 || true

  if ! command -v fusermount >/dev/null 2>&1 && ! command -v fusermount3 >/dev/null 2>&1; then
    say "Note: AppImages need FUSE. If the launcher does not start, install the fuse package for your system."
  fi
}

main() {
  [ "$(uname -s)" = Linux ] || die "this installer is for Linux. Other systems: https://usespectra.app/launcher"
  [ "$(uname -m)" = x86_64 ] || die "Spectra Launcher is only built for x86_64 on Linux, not $(uname -m)"
  command -v curl >/dev/null 2>&1 || die "curl is required"

  manifest=$(curl -fsSL "$LATEST_JSON") || die "could not read the latest release from GitHub"

  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT
  chmod 755 "$tmp"

  if [ -e /run/ostree-booted ]; then
    install_appimage
  elif command -v apt-get >/dev/null 2>&1; then
    download deb
    chmod 644 "$file"
    as_root apt-get install -y "$file"
  elif command -v dnf >/dev/null 2>&1; then
    download rpm
    as_root dnf install -y "$file"
  else
    install_appimage
  fi

  say ""
  say "Spectra Launcher is installed. You will find it in your applications menu."
}

main "$@"
