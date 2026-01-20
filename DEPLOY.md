# Deployment Guide for Render

This guide will help you deploy your Video Downloader application to [Render.com](https://render.com).

## Prerequisites
1.  **GitHub Account**: You need a GitHub account to host your code.
2.  **Render Account**: Sign up at [render.com](https://render.com) (free tier is sufficient).

## Step 1: Push Code to GitHub

If you haven't already, push your project to a new GitHub repository.

1.  Initialize git (if not done):
    ```bash
    git init
    # We just created a .gitignore, so it will prevent committing heavy files
    git add .
    git commit -m "Initial commit for deployment"
    ```
2.  Create a new repository on GitHub.
3.  Link and push:
    ```bash
    git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
    git branch -M main
    git push -u origin main
    ```

## Step 2: Create a Web Service on Render

1.  Log in to your Render Dashboard.
2.  Click **"New +"** and select **"Web Service"**.
3.  Connect your GitHub account if asked, then select your new repository.

## Step 3: Configure the Service

Fill in the content as follows:

-   **Name**: `video-downloader` (or any name you like)
-   **Region**: Closest to you (e.g., Frankfurt, Oregon)
-   **Branch**: `main`
-   **Root Directory**: `.` (leave empty to use root)
-   **Runtime**: **Node**
-   **Build Command**: `./render-build.sh`
    -   *Crucial*: This script installs `yt-dlp` (via Python/Pip) and then builds your Node/React app.
-   **Start Command**: `npm run server`
    -   This runs `node server.js` which serves both the API and the React frontend.

## Step 4: Environment Variables (Optional)

If you had any secret keys (like API keys), adds them in the "Environment" tab. For this app, you mostly likely don't need any unless you added custom logic.

-   **PORT**: Render sets this automatically (usually 10000), and your `server.js` is already set up to read `process.env.PORT`.

## Step 5: Deploy

Click **"Create Web Service"**.

Render will now:
1.  Clone your repo.
2.  Run `./render-build.sh` (installing python dependencies and building the site).
3.  Start the server with `npm run server`.

You can watch the logs in the "Events" or "Logs" tab. Once it says "Server running on port...", click the URL at the top left to visit your live app!

## Troubleshooting

-   **Build failed?**: Check the logs. If `render-build.sh` permission denied, you might need to run `git update-index --chmod=+x render-build.sh` locally and push again.
-   **yt-dlp error?**: The build script installs `yt-dlp` via pip. If the server logs say "yt-dlp not found", verification might be needed to ensure the pip install location is in the PATH, but Render usually handles this well for Python/Node mixed environments.

## Common Fixes

### "Permission denied" or Build Fails immediately
If you see `sh: 1: vite: Permission denied`, it means `node_modules` was accidentally uploaded to GitHub. Windows permissions don't work on Linux.
**Fix**:
1. Run these commands in your terminal:
   ```bash
   git rm -r --cached node_modules
   git commit -m "Remove node_modules from git"
   git push
   ```
2. Render will automatically redeploy and clean up the permissions.
