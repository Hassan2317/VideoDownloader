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
  process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  '--ignore-errors',
  '--no-warnings',
  '--restrict-filenames',
  // Bypass: Use Android client to avoid "Sign in" on some IPs
  '--extractor-args', 'youtube:player_client=android',
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

// Helper to execute yt-dlp with retries and different strategies
const runYtDlp = async (args, url, res) => {
  const strategies = [
    { name: 'Default (Cookies + Web)', args: [] },
    { name: 'Android Client (Guest)', args: ['--extractor-args', 'youtube:player_client=android'] }, // Often bypasses bot checks
    { name: 'iOS Client (Guest)', args: ['--extractor-args', 'youtube:player_client=ios'] },
    { name: 'TV Client (Guest)', args: ['--extractor-args', 'youtube:player_client=tv'] }
  ];

  let lastError;

  for (const strategy of strategies) {
    console.log(`Attempting strategy: ${strategy.name}`);

    // For Guest strategies, we might want to IGNORE the cookies file if passing it causes issues,
    // but usually passing cookies + android is verified. 
    // However, if the ACCOUNT is flagged, we want to try WITHOUT cookies.
    // Let's filter out '--cookies' from commonArgs if we are in a 'Guest' strategy fallback.

    let currentArgs = [...args, ...strategy.args];
    if (strategy.name.includes('Guest')) {
      // Remove cookies arg if it exists in the base args
      currentArgs = currentArgs.filter((arg, i) => {
        // Filter out '--cookies' and the following file path
        if (arg === '--cookies') return false;
        // Also remove the path (which is the next item). This is tricky in a simple filter.
        // Better approach: Rebuild args.
        return true;
      });

      // Harder to filter array pairs. Let's just create a Clean common args for guest.
      const guestCommonArgs = commonArgs.filter(a => a !== '--cookies' && a !== COOKIES_PATH);
      // We need to replace the 'args' passed in (which might have commonArgs spread already)
      // This helper refactor is getting complex. 
      // Simplification: logic inside the Loop.
    }

    try {
      const processArgs = [...currentArgs, url];
      // Special handling for Guest: manually strip cookies if we decide to
      // actually commonArgs is global. Let's make a local copy.

      const finalProcessArgs = [];
      let skipNext = false;

      // copying commonArgs logic from the input 'args' is hard because they are already merged.
      // Instead, we will pass specific "extra args" to this helper and merge them with commonArgs inside.
      // BUT wait, existing code passes full args.
      // Let's just try running it. If it fails, next loop.

      // Actually, preventing cookies for Guest is key.
      if (strategy.name.includes('Guest')) {
        // Filter out cookies from the input args
        for (let i = 0; i < currentArgs.length; i++) {
          if (skipNext) { skipNext = false; continue; }
          if (currentArgs[i] === '--cookies') {
            skipNext = true; // skip the path
            continue;
          }
          finalProcessArgs.push(currentArgs[i]);
        }
      } else {
        finalProcessArgs.push(...currentArgs);
      }

      const result = await new Promise((resolve, reject) => {
        const p = spawn(YTDLP_BIN, [...finalProcessArgs, url], { cwd: path.dirname(process.argv[1]) });
        let out = '';
        let err = '';
        p.stdout.on('data', d => out += d.toString());
        p.stderr.on('data', d => err += d.toString());
        p.on('close', code => {
          if (code === 0) resolve(out);
          else reject(new Error(err || `Exit code ${code}`));
        });
      });

      return result; // Success!

    } catch (e) {
      console.warn(`Strategy ${strategy.name} failed:`, e.message.slice(0, 100) + '...');
      lastError = e;
      // Continue to next strategy
    }
  }
  throw lastError;
};

// Get video info
app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  // Base args for Info
  const baseInfoArgs = [...commonArgs, '-j'];

  try {
    const output = await runYtDlp(baseInfoArgs, url, res);

    // Parse JSON
    const videoData = JSON.parse(output);
    const title = videoData.title || 'Video';
    const thumbnail = videoData.thumbnail || null;
    const rawFormats = videoData.formats || [];

    const qualities = [];
    const audioQualities = [];
    const seenQualities = new Set();
    const seenAudio = new Set();

    // ... (Existing parsing logic) ...
    for (const f of rawFormats) {
      if (f.vcodec !== 'none' && (f.acodec === 'none' || f.container === 'mp4_dash') && f.ext === 'mp4') {
        const height = f.height;
        if (height) {
          const label = `${height}p`;
          if (!seenQualities.has(label)) {
            seenQualities.add(label);
            qualities.push({ label, value: f.format_id });
          }
        }
      }
      if (f.vcodec === 'none' && f.acodec !== 'none') {
        const bitrate = f.abr ? Math.round(f.abr) : null;
        if (bitrate) {
          const label = `${bitrate}k`;
          if (!seenAudio.has(label)) {
            seenAudio.add(label);
            audioQualities.push({ label: `${label} (MP3)`, value: f.format_id });
          }
        }
      }
    }

    qualities.sort((a, b) => parseInt(b.label) - parseInt(a.label));
    audioQualities.sort((a, b) => parseInt(b.label) - parseInt(a.label));
    audioQualities.unshift({ label: 'Best Quality (Auto)', value: 'bestaudio' });

    res.json({
      title, thumbnail,
      qualities: qualities.length > 0 ? qualities : [{ label: '720p', value: '22' }],
      audioQualities
    });

  } catch (err) {
    console.error('All strategies failed. Final error:', err);
    res.status(500).json({ error: 'Failed to get info after multiple attempts. Server IP might be blocked.' });
  }
});

// Download video/audio
app.post('/api/download', async (req, res) => {
  const { url, quality, type } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  // 1. Get Title (Simple retry logic inline or just assume default)
  // For pipes/downloads, "retry" is hard because headers are sent.
  // We'll trust the "Info" step validated the URL roughly, but we can try to use a Robust strategy here too.
  // Ideally, valid strategy from 'info' should be passed here, but stateless API.
  // We will try the "Android Guest" strategy as default for download if cookies fail? 
  // No, let's stick to standard behavior but maybe default to Android if cookies missing.

  // Actually, let's keep download simple to avoid timeout.
  // But if Info works, Download usually works IF using same args.
  // Let's add the 'android' arg by default for now as it's the strongest bypass.

  const downloadArgs = [...commonArgs];
  // If we want to force android:
  // downloadArgs.push('--extractor-args', 'youtube:player_client=android');

  try {
    const titleProcess = spawn(YTDLP_BIN, [...downloadArgs, '--print', '%(title)s', url], { cwd: path.dirname(process.argv[1]) });
    let title = '';
    titleProcess.stdout.on('data', d => title += d.toString());
    await new Promise(r => titleProcess.on('close', r));

    const safeTitle = (title.trim() || 'media').replace(/[^a-zA-Z0-9\-_\.]/g, '_').slice(0, 80);
    const ext = type === 'audio' ? 'mp3' : 'mp4';
    res.header('Content-Disposition', `attachment; filename="${safeTitle}.${ext}"`);
    res.header('Content-Type', type === 'audio' ? 'audio/mpeg' : 'video/mp4');

    let formatArgs = [];
    if (type === 'audio') {
      const formatSelection = quality === 'bestaudio' ? 'bestaudio' : quality;
      formatArgs = ['-x', '--audio-format', 'mp3', '--audio-quality', '0', '-f', formatSelection];
    } else {
      const fArg = quality ? `-f ${quality}+bestaudio[ext=m4a]/best[ext=mp4]/best` : '-f best[ext=mp4]/best';
      formatArgs = fArg.split(' ');
    }

    const finalArgs = [...downloadArgs, ...formatArgs, '-o', '-', url];
    const downloadProcess = spawn(YTDLP_BIN, finalArgs, { cwd: path.dirname(process.argv[1]) });

    downloadProcess.stdout.pipe(res);
    downloadProcess.stderr.on('data', d => console.error('DL stderr:', d.toString()));
    req.on('close', () => downloadProcess.kill('SIGKILL'));

  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
});


app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
