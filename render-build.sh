#!/usr/bin/env bash
# Exit on error
set -o errexit
# Install python3 and pip if missing (usually pre-installed)
# Install yt-dlp via pip (easiest way on linux)
pip3 install yt-dlp
# Install Node.js dependencies
npm install
# Build the React Frontend
npm run build