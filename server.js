import express from 'express';
import { spawn } from 'child_process';
import cors from 'cors';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Determine the executable name based on OS
const isWindows = process.platform === 'win32';
// Check for local binary first, then global
import fs from 'fs';
const localBin = path.join(path.dirname(process.argv[1]), isWindows ? 'yt-dlp.exe' : 'yt-dlp');
const YTDLP_BIN = fs.existsSync(localBin) ? localBin : (isWindows ? 'yt-dlp.exe' : 'yt-dlp');

console.log(`Using yt-dlp binary at: ${YTDLP_BIN}`);

// Serve static files from the React frontend app
// Serve static files from the React frontend app
const distPath = path.join(path.dirname(process.argv[1]), 'dist');
app.use(express.static(distPath));

// Handle Cookies from Environment Variable (for Render/Deployment)
// Handle Cookies from Environment Variable (for Render/Deployment)
// We will write to 'cookies.txt' in the current working directory to be safe
const COOKIES_PATH = path.join(process.cwd(), 'cookies.txt');
console.log(`Expected cookies path: ${COOKIES_PATH}`);

if (process.env.YOUTUBE_COOKIES) {
  try {
    // Write just the value, ensure it's a string
    const cookiesContent = String(process.env.YOUTUBE_COOKIES).trim();
    if (cookiesContent.length > 0) {
      fs.writeFileSync(COOKIES_PATH, cookiesContent);
      console.log(`Cookies file created successfully. Size: ${cookiesContent.length} bytes`);
    } else {
      console.warn('YOUTUBE_COOKIES env var was empty.');
    }
  } catch (err) {
    console.error('Failed to create cookies file:', err);
  }
} else {
  console.warn('YOUTUBE_COOKIES environment variable is NOT set.');
}

// Common yt-dlp options
const commonArgs = [
  '--no-check-certificates',
  '--user-agent',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  '--ignore-errors',
  '--no-warnings',
  '--restrict-filenames',
];

// Add runtime arguments only if on Windows using local binary that might need it, 
// or if we know the environment supports it.
// For Linux deployment (like Render), usually we install yt-dlp via pip or curl 
// and it runs with python automatically.
if (isWindows) {
  commonArgs.push('--js-runtime', 'node');
}

// Add cookies if file exists
if (fs.existsSync(COOKIES_PATH)) {
  commonArgs.push('--cookies', COOKIES_PATH);
  console.log('Using cookies for authentication.');
}

// Get video info
app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
    return res.status(400).json({ error: 'Only YouTube URLs are supported right now.' });
  }

  let output = '';
  let errorOutput = '';

  try {
    // Use --dump-json (or -j) to get all info in one go. reliably.
    // This includes title, thumbnail, and formats.
    const infoArgs = [
      ...commonArgs,
      '-j', // dump json
    ];

    const infoProcess = spawn(YTDLP_BIN, [...infoArgs, url], { cwd: path.dirname(process.argv[1]) });

    // Increase buffer limit if needed, but usually chunks work fine.
    infoProcess.stdout.on('data', (data) => (output += data.toString()));
    infoProcess.stderr.on('data', (data) => (errorOutput += data.toString()));

    await new Promise((resolve, reject) => {
      infoProcess.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Exit code: ${code}`))));
    });

    const videoData = JSON.parse(output);
    const title = videoData.title || 'Video';
    const thumbnail = videoData.thumbnail || null;
    const rawFormats = videoData.formats || [];

    const qualities = [];
    const audioQualities = [];
    const seenQualities = new Set();
    const seenAudio = new Set();

    // Process formats from JSON
    for (const f of rawFormats) {
      // Logic for Video: Look for 'mp4' container, with video, usually 'video only' or 'best'
      // We interpret 'video only' formats (vcodec!=none, acodec=none) or just filter by resolution
      // Actually standard youtube formats are adaptive (video only) + audio only.

      // Filter for MP4 Video (Video Only)
      if (f.vcodec !== 'none' && (f.acodec === 'none' || f.container === 'mp4_dash') && f.ext === 'mp4') {
        const height = f.height;
        if (height) {
          const label = `${height}p`;
          if (!seenQualities.has(label)) {
            seenQualities.add(label);
            qualities.push({
              label: label,
              value: f.format_id
            });
          }
        }
      }

      // Logic for Audio: Look for 'audio only' (vcodec=none)
      if (f.vcodec === 'none' && f.acodec !== 'none') {
        // Use ABR (Average Bitrate) for quality label
        const bitrate = f.abr ? Math.round(f.abr) : null;
        if (bitrate) {
          const label = `${bitrate}k`;
          if (!seenAudio.has(label)) {
            seenAudio.add(label);
            audioQualities.push({
              label: `${label} (MP3)`,
              value: f.format_id
            });
          }
        }
      }
    }

    // Sort qualities
    qualities.sort((a, b) => parseInt(b.label) - parseInt(a.label));

    // Sort audio by bitrate (descending)
    audioQualities.sort((a, b) => parseInt(b.label) - parseInt(a.label));

    // Add "Best Available" as the first option always
    audioQualities.unshift({ label: 'Best Quality (Auto)', value: 'bestaudio' });

    res.json({
      title,
      thumbnail,
      qualities: qualities.length > 0 ? qualities : [
        { label: '720p', value: '22' },
        { label: '360p', value: '18' }
      ],
      audioQualities
    });
  } catch (err) {
    console.error('Info error details:', errorOutput);
    console.error('Full Error Object:', err);
    res.status(500).json({ error: 'Failed to get video info. Check server logs for details.' });
  }
});

// Download video/audio
app.post('/api/download', async (req, res) => {
  const { url, quality, type } = req.body; // type: 'video' | 'audio'
  if (!url) return res.status(400).json({ error: 'URL is required' });

  if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
    return res.status(400).json({ error: 'Only YouTube URLs are supported right now.' });
  }

  try {
    // Get video title for filename
    const titleProcess = spawn(YTDLP_BIN, [...commonArgs, '--print', '%(title)s', url], {
      cwd: path.dirname(process.argv[1]),
    });

    let title = '';
    titleProcess.stdout.on('data', (data) => (title += data.toString()));
    await new Promise((resolve) => titleProcess.on('close', resolve));

    const safeTitle = (title || 'media').replace(/[^a-zA-Z0-9\-_\.]/g, '_').slice(0, 80);
    const ext = type === 'audio' ? 'mp3' : 'mp4';

    res.header('Content-Disposition', `attachment; filename="${safeTitle}.${ext}"`);
    res.header('Content-Type', type === 'audio' ? 'audio/mpeg' : 'video/mp4');

    // Build Arguments
    let formatArgs = [];

    if (type === 'audio') {
      // Audio Logic
      // If user selected 'bestaudio', we let yt-dlp choose.
      // If they selected a specific ID (e.g. '140'), we use that input format 
      // BUT we still want to convert to MP3 for compatibility if possible.

      const formatSelection = quality === 'bestaudio' ? 'bestaudio' : quality;

      formatArgs = [
        '-x', // Extract audio
        '--audio-format', 'mp3',
        '--audio-quality', '0', // Best conversion quality
        '-f', formatSelection
      ];
    } else {
      // Video Logic
      const fArg = quality ? `-f ${quality}+bestaudio[ext=m4a]/best[ext=mp4]/best` : '-f best[ext=mp4]/best';
      formatArgs = fArg.split(' ');
    }

    // 1. Get approximate file size for progress bar
    const sizeArgs = [
      ...commonArgs,
      ...formatArgs,
      '--print', 'filesize_approx',
      url
    ];

    try {
      const sizeProcess = spawn(YTDLP_BIN, sizeArgs, { cwd: path.dirname(process.argv[1]) });
      let sizeOutput = '';
      sizeProcess.stdout.on('data', (data) => (sizeOutput += data.toString()));
      await new Promise((resolve) => sizeProcess.on('close', resolve));

      const size = parseInt(sizeOutput.trim());
      if (!isNaN(size) && size > 0) {
        res.setHeader('Content-Length', size);
      }
    } catch (e) {
      // Ignore size error
    }

    const downloadArgs = [
      ...commonArgs,
      ...formatArgs,
      '-o', '-',
    ];

    const downloadProcess = spawn(YTDLP_BIN, [...downloadArgs, url], {
      cwd: path.dirname(process.argv[1]),
    });

    downloadProcess.stdout.pipe(res);
    downloadProcess.stderr.on('data', (data) => console.error('yt-dlp stderr:', data.toString()));

    req.on('close', () => downloadProcess.kill('SIGKILL'));
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'Failed to download media.' });
  }
});


app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
