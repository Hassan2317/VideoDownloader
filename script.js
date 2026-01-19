const downloadBtn = document.getElementById('download-btn');
const qualityModal = document.getElementById('quality-modal');
const qualitySelect = document.getElementById('quality-select');
const confirmQualityBtn = document.getElementById('confirm-quality-btn');
const backHomeDiv = document.getElementById('back-home');
const backHomeBtn = document.getElementById('back-home-btn');

let videoUrl = '';

// Show the quality selection modal when "Download" is clicked
downloadBtn.addEventListener('click', () => {
    videoUrl = document.getElementById('video-url').value;
    if (!videoUrl) {
        alert('Please paste a YouTube URL.');
        return;
    }
    qualityModal.classList.remove('hidden');
});

// Start the download process after selecting quality
confirmQualityBtn.addEventListener('click', () => {
    const selectedQuality = qualitySelect.value;
    qualityModal.classList.add('hidden');

    // Simulate the download process
    alert(`Downloading video in ${selectedQuality} quality...`);
    setTimeout(() => {
        alert('Download complete!');
        backHomeDiv.classList.remove('hidden');
    }, 3000); // Simulate a 3-second download
});

// Return to the home screen
backHomeBtn.addEventListener('click', () => {
    document.getElementById('video-url').value = '';
    backHomeDiv.classList.add('hidden');
});