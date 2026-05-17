let currentFile = null;
let currentFilepath = null;
let textLabels = [];
let selectedLabelId = null;
let currentMediaType = 'image';
let videoElement = null;
let videoDuration = 0;
let currentVideoTime = 0;

const COLORS = ['#FF0000', '#00FF00', '#0066FF', '#FF6600', '#9900FF', '#00FFFF', '#FF0099', '#99FF00'];

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const processBtn = document.getElementById('processBtn');

    dropZone.addEventListener('click', () => fileInput.click());
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    processBtn.addEventListener('click', processMeme);
    
    initControls();
    
    document.getElementById('formatSelect').addEventListener('change', () => {
        if (currentFile) {
            const format = document.getElementById('formatSelect').value;
            updatePreviewSize(format);
        }
    });
});

function handleFile(file) {
    const validImageTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/bmp', 'image/webp'];
    const validVideoTypes = ['video/mp4', 'video/avi', 'video/quicktime', 'video/x-matroska', 'video/webm'];
    
    const isImage = validImageTypes.includes(file.type);
    const isVideo = file.type.startsWith('video/');
    
    if (!isImage && !isVideo) {
        alert('Please upload a valid image or video file.');
        return;
    }

    currentFile = file;
    currentFilepath = null;
    textLabels = [];
    selectedLabelId = null;
    currentMediaType = isImage ? 'image' : 'video';
    
    const mediaPreview = document.getElementById('mediaPreview');
    const videoControls = document.getElementById('videoControls');
    const videoLabelSection = document.getElementById('videoLabelSection');
    
    if (isVideo) {
        videoControls.style.display = 'block';
        videoLabelSection.style.display = 'block';
        const reader = new FileReader();
        reader.onload = (e) => {
            mediaPreview.innerHTML = `<video id="videoPlayerPreview" src="${e.target.result}" style="width:100%;height:100%;object-fit:contain;border-radius:8px;"></video>`;
            videoElement = document.getElementById('videoPlayerPreview');
            setupVideoControls();
            document.getElementById('processBtn').disabled = false;
            updateLabelsList();
        };
        reader.readAsDataURL(file);
    } else {
        videoControls.style.display = 'none';
        videoLabelSection.style.display = 'none';
        const reader = new FileReader();
        reader.onload = (e) => {
            const format = document.getElementById('formatSelect').value;
            updatePreviewSize(format);
            mediaPreview.innerHTML = `
                <div class="image-wrapper" id="imageWrapper">
                    <img src="${e.target.result}" alt="Preview" id="previewImage" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">
                </div>
            `;
            document.getElementById('processBtn').disabled = false;
            updateLabelsList();
            addTextOverlayPreviews();
        };
        reader.readAsDataURL(file);
    }
}

function updatePreviewSize(format) {
    const previewContainer = document.getElementById('previewContainer');
    const dims = getPreviewDimensions(format);
    previewContainer.style.width = dims.width + 'px';
    previewContainer.style.height = dims.height + 'px';
}

function getPreviewDimensions(format) {
    const aspectRatios = {
        'original': { width: 500, height: 400 },
        'square': { width: 400, height: 400 },
        'portrait': { width: 400, height: 500 },
        'landscape': { width: 500, height: 278 }
    };
    return aspectRatios[format] || aspectRatios['portrait'];
}

function setupVideoControls() {
    const video = videoElement;
    const timeline = document.getElementById('videoTimeline');
    const timeDisplay = document.getElementById('videoTime');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const prevFrameBtn = document.getElementById('prevFrameBtn');
    const nextFrameBtn = document.getElementById('nextFrameBtn');
    const jumpBtn = document.getElementById('jumpBtn');
    const jumpToSecond = document.getElementById('jumpToSecond');
    
    video.addEventListener('loadedmetadata', () => {
        videoDuration = video.duration;
        timeline.max = videoDuration;
        jumpToSecond.max = videoDuration;
        updateTimeDisplay();
    });
    
    video.addEventListener('timeupdate', () => {
        currentVideoTime = video.currentTime;
        timeline.value = video.currentTime;
        updateTimeDisplay();
        updateVideoLabels();
    });
    
    video.addEventListener('ended', () => {
        playPauseBtn.textContent = '▶ Play';
    });
    
    timeline.addEventListener('input', () => {
        video.currentTime = parseFloat(timeline.value);
        currentVideoTime = video.currentTime;
        updateTimeDisplay();
        updateVideoLabels();
    });
    
    playPauseBtn.addEventListener('click', () => {
        if (video.paused) {
            video.play();
            playPauseBtn.textContent = '⏸ Pause';
        } else {
            video.pause();
            playPauseBtn.textContent = '▶ Play';
        }
    });
    
    prevFrameBtn.addEventListener('click', () => {
        video.pause();
        video.currentTime = Math.max(0, video.currentTime - 1/30);
        playPauseBtn.textContent = '▶ Play';
    });
    
    nextFrameBtn.addEventListener('click', () => {
        video.pause();
        video.currentTime = Math.min(videoDuration, video.currentTime + 1/30);
        playPauseBtn.textContent = '▶ Play';
    });
    
    jumpBtn.addEventListener('click', () => {
        const sec = parseFloat(jumpToSecond.value) || 0;
        video.currentTime = Math.max(0, Math.min(videoDuration, sec));
        currentVideoTime = video.currentTime;
        updateTimeDisplay();
        updateVideoLabels();
    });
}

function updateTimeDisplay() {
    const time = formatTime(currentVideoTime) + ' / ' + formatTime(videoDuration);
    document.getElementById('videoTime').textContent = time;
    document.getElementById('jumpToSecond').value = currentVideoTime.toFixed(2);
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateVideoLabels() {
    textLabels.forEach(label => {
        const overlay = document.getElementById(`overlay-${label.id}`);
        if (overlay && currentMediaType === 'video') {
            const pos = getLabelPositionAtTime(label, currentVideoTime);
            overlay.style.left = pos.x + '%';
            overlay.style.top = pos.y + '%';
        }
    });
}

function getLabelPositionAtTime(label, time) {
    const keyframes = label.keyframes || [];
    if (keyframes.length === 0) {
        return { x: label.x, y: label.y };
    }
    
    const sorted = [...keyframes].sort((a, b) => a.time - b.time);
    
    if (time <= sorted[0].time) {
        return { x: sorted[0].x, y: sorted[0].y };
    }
    
    if (time >= sorted[sorted.length - 1].time) {
        return { x: sorted[sorted.length - 1].x, y: sorted[sorted.length - 1].y };
    }
    
    let prev = sorted[0];
    let next = sorted[sorted.length - 1];
    
    for (let i = 0; i < sorted.length - 1; i++) {
        if (time >= sorted[i].time && time <= sorted[i + 1].time) {
            prev = sorted[i];
            next = sorted[i + 1];
            break;
        }
    }
    
    const t = (time - prev.time) / (next.time - prev.time);
    const x = Math.round(prev.x + (next.x - prev.x) * t);
    const y = Math.round(prev.y + (next.y - prev.y) * t);
    
    return { x, y };
}

function addTextOverlayPreviews() {
    const mediaPreview = document.getElementById('mediaPreview');
    
    const existingOverlays = mediaPreview.querySelectorAll('.text-overlay-preview, .bottom-text-preview');
    existingOverlays.forEach(o => o.remove());
    
    textLabels.forEach(label => {
        const overlay = document.createElement('div');
        overlay.id = `overlay-${label.id}`;
        overlay.className = 'text-overlay-preview';
        overlay.textContent = label.text;
        overlay.style.left = label.x + '%';
        overlay.style.top = label.y + '%';
        overlay.style.fontSize = label.fontSize + 'px';
        overlay.style.color = label.color;
        overlay.style.fontFamily = 'Arial, sans-serif';
        overlay.style.transform = 'translate(-50%, -50%)';
        overlay.style.fontWeight = 'bold';
        overlay.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
        
        if (label.bgEnabled) {
            overlay.style.background = 'rgba(0, 0, 0, 0.6)';
        }
        
        const wrapper = mediaPreview.querySelector('.image-wrapper') || mediaPreview;
        wrapper.style.position = 'relative';
        wrapper.appendChild(overlay);
    });
    
    if (currentMediaType === 'image') {
        const bottomText = document.getElementById('bottomText')?.value;
        if (bottomText) {
            const bottomOverlay = document.createElement('div');
            bottomOverlay.className = 'bottom-text-preview';
            bottomOverlay.textContent = bottomText;
            mediaPreview.appendChild(bottomOverlay);
        }
    }
}

function updateLabelsList() {
    const container = document.getElementById('labelsList');
    container.innerHTML = '';
    
    if (textLabels.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span>🏷️</span>
                <p>No labels yet. Add labels to place on media.</p>
            </div>
        `;
        return;
    }
    
    textLabels.forEach(label => {
        const div = document.createElement('div');
        div.className = `label-item ${selectedLabelId === label.id ? 'selected' : ''}`;
        div.innerHTML = `
            <div class="label-color-dot" style="background: ${label.color}"></div>
            <div class="label-info">
                <span>${label.text || 'Empty'}</span>
                <small>X: ${label.x}%, Y: ${label.y}%${label.keyframes?.length ? ' • ' + label.keyframes.length + ' keyframes' : ''}</small>
            </div>
            <button class="label-delete" onclick="deleteLabel('${label.id}')">×</button>
        `;
        div.addEventListener('click', (e) => {
            if (!e.target.classList.contains('label-delete')) {
                selectLabel(label.id);
            }
        });
        container.appendChild(div);
    });
}

function selectLabel(labelId) {
    selectedLabelId = labelId;
    const label = textLabels.find(l => l.id === labelId);
    
    if (label) {
        document.getElementById('selectedLabelPanel').style.display = 'block';
        document.getElementById('labelName').value = label.text;
        document.getElementById('labelFontSize').value = label.fontSize;
        document.getElementById('labelFontSizeValue').textContent = label.fontSize;
        document.getElementById('labelPosX').value = label.x;
        document.getElementById('labelPosXValue').textContent = label.x;
        document.getElementById('labelPosY').value = label.y;
        document.getElementById('labelPosYValue').textContent = label.y;
        document.getElementById('labelColor').value = label.color;
        document.getElementById('labelBgEnabled').checked = label.bgEnabled;
        updateKeyframesList(label);
    }
    
    updateLabelsList();
}

function updateKeyframesList(label) {
    const container = document.getElementById('keyframesList');
    container.innerHTML = '';
    
    if (!label.keyframes || label.keyframes.length === 0) {
        container.innerHTML = '<p class="help-text">No keyframes. Add keyframes at different times to track movement.</p>';
        return;
    }
    
    label.keyframes.sort((a, b) => a.time - b.time).forEach((kf, i) => {
        const div = document.createElement('div');
        div.className = 'keyframe-item';
        div.innerHTML = `
            <span>${formatTime(kf.time)}</span>
            <span>X: ${kf.x}% Y: ${kf.y}%</span>
            <button class="label-delete" onclick="deleteKeyframe('${label.id}', ${i})">×</button>
        `;
        container.appendChild(div);
    });
}

function deleteKeyframe(labelId, index) {
    const label = textLabels.find(l => l.id === labelId);
    if (label && label.keyframes) {
        label.keyframes.splice(index, 1);
        updateKeyframesList(label);
    }
}

function deleteLabel(labelId) {
    textLabels = textLabels.filter(l => l.id !== labelId);
    
    const overlay = document.getElementById(`overlay-${labelId}`);
    if (overlay) overlay.remove();
    
    if (selectedLabelId === labelId) {
        selectedLabelId = null;
        document.getElementById('selectedLabelPanel').style.display = 'none';
    }
    
    updateLabelsList();
    addTextOverlayPreviews();
}

function addNewLabel(x = 50, y = 40, text = '') {
    const label = {
        id: 'label_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        text: text || 'Label',
        x: x,
        y: y,
        fontSize: 28,
        color: COLORS[textLabels.length % COLORS.length],
        bgEnabled: true,
        keyframes: []
    };
    
    textLabels.push(label);
    selectLabel(label.id);
    updateLabelsList();
    addTextOverlayPreviews();
    
    return label;
}

function initControls() {
    document.getElementById('addLabelBtn').addEventListener('click', () => {
        addNewLabel();
    });
    
    document.getElementById('deleteLabelBtn').addEventListener('click', () => {
        if (selectedLabelId) {
            deleteLabel(selectedLabelId);
        }
    });
    
    document.getElementById('resetBtn').addEventListener('click', resetEditor);
    
    document.getElementById('bottomText').addEventListener('input', () => {
        if (currentMediaType === 'image') {
            addTextOverlayPreviews();
        }
    });
    
    document.getElementById('addKeyframeBtn').addEventListener('click', () => {
        if (!selectedLabelId) return;
        const label = textLabels.find(l => l.id === selectedLabelId);
        if (label) {
            if (!label.keyframes) label.keyframes = [];
            label.keyframes.push({
                time: currentVideoTime,
                x: label.x,
                y: label.y
            });
            updateKeyframesList(label);
            updateLabelsList();
        }
    });
    
    const labelControls = ['labelName', 'labelFontSize', 'labelPosX', 'labelPosY', 'labelColor', 'labelBgEnabled'];
    
    labelControls.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                updateLabelFromControls();
            });
            if (el.type === 'checkbox') {
                el.addEventListener('change', () => {
                    updateLabelFromControls();
                });
            }
        }
    });
}

function updateLabelFromControls() {
    if (!selectedLabelId) return;
    
    const label = textLabels.find(l => l.id === selectedLabelId);
    if (!label) return;
    
    label.text = document.getElementById('labelName').value;
    label.fontSize = parseInt(document.getElementById('labelFontSize').value);
    label.x = parseInt(document.getElementById('labelPosX').value);
    label.y = parseInt(document.getElementById('labelPosY').value);
    label.color = document.getElementById('labelColor').value;
    label.bgEnabled = document.getElementById('labelBgEnabled').checked;
    
    document.getElementById('labelFontSizeValue').textContent = label.fontSize;
    document.getElementById('labelPosXValue').textContent = label.x;
    document.getElementById('labelPosYValue').textContent = label.y;
    
    updateOverlayStyle(label);
    updateLabelsList();
    if (currentMediaType === 'video') {
        updateVideoLabels();
    }
}

function updateOverlayStyle(label) {
    const overlay = document.getElementById(`overlay-${label.id}`);
    if (!overlay) return;
    
    overlay.textContent = label.text;
    overlay.style.left = label.x + '%';
    overlay.style.top = label.y + '%';
    overlay.style.fontSize = label.fontSize + 'px';
    overlay.style.color = label.color;
    overlay.style.background = label.bgEnabled ? 'rgba(0, 0, 0, 0.6)' : 'transparent';
}

function resetEditor() {
    textLabels = [];
    selectedLabelId = null;
    currentFilepath = null;
    if (videoElement) {
        videoElement.pause();
        videoElement = null;
    }
    videoDuration = 0;
    currentVideoTime = 0;
    document.getElementById('selectedLabelPanel').style.display = 'none';
    document.getElementById('videoControls').style.display = 'none';
    document.getElementById('bottomText').value = '';
    updateLabelsList();
    addTextOverlayPreviews();
}

async function uploadFile() {
    const formData = new FormData();
    formData.append('file', currentFile);
    
    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Upload failed');
        }
        
        return data;
    } catch (error) {
        throw error;
    }
}

async function processMeme() {
    if (!currentFile) {
        alert('Please upload a file first.');
        return;
    }
    
    const processBtn = document.getElementById('processBtn');
    const btnText = processBtn.querySelector('.btn-text');
    const btnLoading = processBtn.querySelector('.btn-loading');
    
    processBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';
    showLoading('Processing...');
    
    try {
        if (!currentFilepath) {
            const uploadResult = await uploadFile();
            currentFilepath = uploadResult.filepath;
        }
        
        const textConfig = textLabels.map(label => ({
            text: label.text,
            x: label.x,
            y: label.y,
            fontSize: label.fontSize,
            color: label.color,
            bgEnabled: label.bgEnabled,
            keyframes: label.keyframes || []
        }));
        
        const response = await fetch('/process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filepath: currentFilepath,
                filename: currentFile.name,
                textLabels: textConfig,
                bottomText: document.getElementById('bottomText').value,
                format: document.getElementById('formatSelect').value,
                mediaType: currentMediaType
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Processing failed');
        }
        
        const result = await response.json();
        
        const link = document.createElement('a');
        link.href = '/download/' + result.filename;
        link.download = result.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    } finally {
        processBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
        hideLoading();
    }
}

function showLoading(text) {
    document.getElementById('loadingText').textContent = text || 'Processing...';
    document.getElementById('loadingOverlay').classList.add('active');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('active');
}