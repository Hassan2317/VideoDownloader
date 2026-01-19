# Video Downloader

A React-based web application for downloading videos from YouTube using yt-dlp.

## Supported Platforms

- **YouTube**: Fully supported with standard yt-dlp functionality.
- **Other Platforms** (TikTok, Facebook, Pinterest): Not currently supported. Will be added later.

## Key Features

- Clean, modern UI with responsive design
- URL validation and error handling
- Thumbnail preview for YouTube videos
- Video quality selection before download
- Two-step download process: Select quality → Confirm download
- Processing indicator during download
- Download completion confirmation with "Back to Home" option
- Mobile-friendly interface
- Info Retrieval: Fetches video title, thumbnail, and available qualities for preview.
- Download: Streams videos directly as MP4 files with sanitized filenames.
- Error Handling: Comprehensive logging and user-friendly error messages.
- Security: Includes --no-check-certificates and browser user-agent to handle various site restrictions.

## Getting Started

1. Install dependencies:
   ```
   npm install
   ```

2. Start the development server:
   ```
   npm run dev
   ```

3. Start the backend server:
   ```
   npm run server
   ```

4. Open your browser to `http://localhost:5173`

## How It Works

1. **Paste URL**: User enters a YouTube video URL
2. **Click Download**: App fetches video info and available qualities
3. **Select Quality**: User chooses desired video quality (720p, 1080p, etc.)
4. **Confirm Download**: User clicks "Confirm Download" to start the download
5. **Download Completes**: Video downloads to user's device
6. **Back to Home**: User can start another download

## Backend

The backend is a Node.js Express server that uses yt-dlp to download YouTube videos.

- API endpoints: `/api/info` (GET video info including qualities), `/api/download` (download video with selected quality)
- Streams videos directly for download
- Handles errors and logs yt-dlp output
- Only accepts YouTube URLs (youtube.com or youtu.be)

## Important Notes

- **Filename Sanitization**: Titles are cleaned to prevent header errors.
- Only YouTube URLs are accepted at this time.

## Technologies Used

- React 18
- Vite
- Express.js
- yt-dlp
- CSS3

## Deployment

Build the project for production:
```
npm run build
```

Then deploy the `dist` folder and run the server.

The built files will be in the `dist` directory, ready for hosting on any static web server.