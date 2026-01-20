#!/usr/bin/env bash
# Exit on error
set -o errexit
# Install python3 and pip if missing (usually pre-installed)
# Install yt-dlp via pip (easiest way on linux)
pip3 install yt-dlp

# Find where yt-dlp was installed and copy it to current directory to be sure
# Try common locations
if [ -f "$HOME/.local/bin/yt-dlp" ]; then
    cp "$HOME/.local/bin/yt-dlp" ./yt-dlp
elif [ -f "/opt/render/project/.local/bin/yt-dlp" ]; then
    cp "/opt/render/project/.local/bin/yt-dlp" ./yt-dlp
else
    # Fallback to which
    LOC=$(which yt-dlp)
    if [ ! -z "$LOC" ]; then
        cp "$LOC" ./yt-dlp
    fi
fi

# Ensure it works
./yt-dlp --version || echo "yt-dlp copy failed or not found"
# Install Node.js dependencies
npm install
# Build the React Frontend
npm run build