import React, { useState } from 'react';
import './App.css';

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [thumbnail, setThumbnail] = useState('');
  const [qualities, setQualities] = useState([]);
  const [audioQualities, setAudioQualities] = useState([]); // New state for audio
  const [selectedQuality, setSelectedQuality] = useState('');
  const [downloadType, setDownloadType] = useState('video'); // 'video' | 'audio'
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState('input'); // 'input', 'select', 'downloading', 'done'
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  const showToast = (message, type = 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setUrl(text);
    } catch (err) {
      showToast('Failed to read clipboard permissions.', 'error');
    }
  };

  const handleDownload = async () => {
    if (!url) {
      showToast('Please enter a valid URL.');
      return;
    }
    try {
      new URL(url); // Validate URL
    } catch {
      showToast('Please enter a valid URL.');
      return;
    }

    setLoading(true);
    setThumbnail('');
    setQualities([]);
    setAudioQualities([]);

    try {
      const infoResponse = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!infoResponse.ok) {
        const errorData = await infoResponse.json().catch(() => ({ error: 'Failed' }));
        throw new Error(errorData.error || 'Failed to get video info.');
      }

      const info = await infoResponse.json();
      setThumbnail(info.thumbnail);
      setQualities(info.qualities || []);
      setAudioQualities(info.audioQualities || []);
      setStep('select');
      setDownloadType('video'); // Default to video
      setSelectedQuality(''); // Reset selection
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStartDownload = async () => {
    if (!selectedQuality) return;

    setStep('downloading');
    setLoading(true);

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, quality: selectedQuality, type: downloadType }),
      });

      if (!response.ok) {
        throw new Error('Failed to download media.');
      }

      const contentLength = +response.headers.get('Content-Length');
      const reader = response.body.getReader();

      let receivedLength = 0;
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedLength += value.length;
        if (contentLength) setProgress(Math.round((receivedLength / contentLength) * 100));
      }

      const blob = new Blob(chunks);
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || `download.${downloadType === 'audio' ? 'mp3' : 'mp4'}`
        : `download.${downloadType === 'audio' ? 'mp3' : 'mp4'}`;

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setStep('done');
      setProgress(0);
    } catch (err) {
      showToast(err.message, 'error');
      setStep('select');
    } finally {
      setLoading(false);
    }
  };

  const currentQualities = downloadType === 'video' ? qualities : audioQualities;

  const handleBackToHome = () => {
    setStep('input');
    setUrl('');
    setThumbnail('');
    setQualities([]);
    setAudioQualities([]);
    setSelectedQuality('');
    setDownloadType('video');
  };

  return (
    <div className="app">
      <div className="background-mesh"></div>

      {toast.show && (
        <div className={`toast ${toast.type}`}>
          <span className="material-symbols-rounded">
            {toast.type === 'error' ? 'error' : 'check_circle'}
          </span>
          {toast.message}
        </div>
      )}

      <div className="container glass-card">
        {step === 'input' && (
          <div className="step-content fade-in">
            <div className="header-logo-container">
              <img src="/favicon.png" alt="Logo" className="header-logo" />
              <h1 className="gradient-text">Video Downloader</h1>
            </div>
            <p className="subtitle">Download content from your Youtube platform in seconds.</p>

            <div className="input-group">
              <input
                type="text"
                placeholder="Paste video URL here..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="url-input"
              />
              <button onClick={handlePaste} className="paste-btn" title="Paste from Clipboard">
                <span className="material-symbols-rounded">content_paste</span>
              </button>
            </div>

            <button onClick={handleDownload} disabled={loading} className="download-btn hero-btn">
              {loading ? (
                <span className="btn-content"><div className="spinner-sm"></div> Processing</span>
              ) : (
                <span className="btn-content">Download Video <span className="material-symbols-rounded">download</span></span>
              )}
            </button>
          </div>
        )}

        {step === 'select' && (
          <div className="step-content slide-up">
            <h2>Select Format</h2>

            {/* Format Toggle */}
            <div className="format-toggle">
              <button
                className={`format-btn ${downloadType === 'audio' ? 'active' : ''}`}
                onClick={() => { setDownloadType('audio'); setSelectedQuality(''); }}
              >
                <span className="material-symbols-rounded">headphones</span> MP3 (Audio)
              </button>
              <button
                className={`format-btn ${downloadType === 'video' ? 'active' : ''}`}
                onClick={() => { setDownloadType('video'); setSelectedQuality(''); }}
              >
                <span className="material-symbols-rounded">movie</span> MP4 (Video)
              </button>
            </div>

            {thumbnail && (
              <div className="thumbnail-wrapper">
                <img src={thumbnail} alt="Video Thumbnail" className="thumbnail-img" />
              </div>
            )}

            <div className="qualities-list custom-scrollbar">
              {currentQualities.length > 0 ? (
                currentQualities.map((q, index) => (
                  <label key={index} className={`quality-option ${selectedQuality === q.value ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="quality"
                      value={q.value}
                      checked={selectedQuality === q.value}
                      onChange={(e) => setSelectedQuality(e.target.value)}
                    />
                    <div className="quality-info">
                      <span className="quality-label">{q.label}</span>
                      <span className="quality-format">{downloadType === 'audio' ? 'MP3' : 'MP4'}</span>
                    </div>
                    <div className="radio-indicator"></div>
                  </label>
                ))
              ) : (
                <p>No options available for this format.</p>
              )}
            </div>

            <button
              onClick={handleStartDownload}
              disabled={loading || !selectedQuality}
              className="confirm-btn"
            >
              {loading ? 'Starting...' : 'Confirm Download'}
            </button>

            <button onClick={handleBackToHome} className="back-btn">Back</button>
          </div>
        )}

        {step === 'downloading' && (
          <div className="step-content fade-in">
            <h2>Downloading...</h2>
            <div className="loader-container">
              <svg className="progress-ring" width="120" height="120">
                <circle className="progress-ring__circle" stroke="white" strokeWidth="8" fill="transparent" r="52" cx="60" cy="60" />
              </svg>
              <div className="progress-text">{progress}%</div>
            </div>
            <p className="processing">Please wait, converting your video...</p>
          </div>
        )}

        {step === 'done' && (
          <div className="step-content bounce-in">
            <div className="success-icon-lg">
              <span className="material-symbols-rounded">check_circle</span>
            </div>
            <h2>Download Complete!</h2>
            <p className="subtitle">Your video has been saved.</p>
            <button onClick={handleBackToHome} className="back-btn primary">Download Another</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;