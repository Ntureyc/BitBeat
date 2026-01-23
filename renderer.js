const { openDirectory, readDirectory, readFile, convertFileSrc, joinPath, checkPathExists, minimize, maximize, close } = window.electronAPI;

// State
let currentView = 'home';
let playlist = [];
let folderName = 'Local Playlist';
let currentTrackIndex = -1;
let isPlaying = false;
let progress = 0;
let duration = 0;
let volume = 0.7;
let searchQuery = '';
let durationsMap = {};
let blobUrl = null;
let error = null;
let likedSongs = JSON.parse(localStorage.getItem('likedSongs') || '[]');
let addedFolders = JSON.parse(localStorage.getItem('addedFolders') || '[]');
let playlists = JSON.parse(localStorage.getItem('playlists') || '{}');
let trackToAddToPlaylist = null;
let lastPlaylistContext = localStorage.getItem('lastPlaylistContext') || 'library'; // 'library', 'liked', or playlist name
let lastPlayedTrackPath = localStorage.getItem('lastPlayedTrackPath');

// DOM Elements
const audio = new Audio();
const viewHome = document.getElementById('view-home');
const viewPlaylist = document.getElementById('view-playlist');
const sidebarHomeBtn = document.getElementById('sidebar-home-btn');
const sidebarLibraryBtn = document.getElementById('sidebar-library-btn');
const addFolderBtn = document.getElementById('add-folder-btn');
const playBtnHero = document.getElementById('play-btn-hero');
const footerPlayBtn = document.getElementById('footer-play-btn');
const playlistPlayBtn = document.getElementById('playlist-play-btn');
const nextBtn = document.getElementById('next-btn');
const prevBtn = document.getElementById('prev-btn');
const progressBar = document.getElementById('progress-bar');
const volumeBar = document.getElementById('volume-bar');
const currentTimeDisplay = document.getElementById('current-time');
const durationDisplay = document.getElementById('total-duration');
const trackTitleDisplay = document.getElementById('track-title');
const errorDisplay = document.getElementById('error-display');
const playlistTitle = document.getElementById('playlist-title');
const playlistCount = document.getElementById('playlist-count');
const trackTableBody = document.getElementById('track-table-body');
const searchInput = document.getElementById('search-input');
const recentGrid = document.getElementById('recent-grid');
const emptyState = document.getElementById('empty-state');
const viewLibrary = document.getElementById('view-library');
const libraryGrid = document.getElementById('library-grid');
const libraryEmptyState = document.getElementById('library-empty-state');
const minBtn = document.getElementById('min-btn');
const maxBtn = document.getElementById('max-btn');
const closeBtn = document.getElementById('close-btn');
const likedSongsBtn = document.getElementById('sidebar-liked-songs-btn');
const playlistsContainer = document.getElementById('playlists-container');
const addToPlaylistModal = document.getElementById('add-to-playlist-modal');
const closePlaylistModal = document.getElementById('close-playlist-modal');
const createPlaylistBtn = document.getElementById('create-playlist-btn');
const newPlaylistInput = document.getElementById('new-playlist-input');
const playlistOptions = document.getElementById('playlist-options');

// Initialization
audio.volume = volume;
init();

async function init() {
    // Validate folders on startup
    const validFolders = [];
    for (const folderPath of addedFolders) {
        if (await checkPathExists(folderPath)) {
            validFolders.push(folderPath);
        }
    }

    if (validFolders.length !== addedFolders.length) {
        addedFolders = validFolders;
        localStorage.setItem('addedFolders', JSON.stringify(addedFolders));
    }

    if (addedFolders.length > 0) {
        // Find which folder/playlist to load
        const ctx = lastPlaylistContext;
        if (ctx === 'liked') {
            playlist = likedSongs;
            currentView = 'liked';
        } else if (playlists[ctx]) {
            playlist = playlists[ctx];
            currentPlaylistName = ctx;
            currentView = 'custom-playlist';
        } else {
            // Default to library/first folder
            await loadFolder(addedFolders[0]);
            currentView = 'home';
        }

        // Restore last track index if path matches
        if (lastPlayedTrackPath && playlist.length > 0) {
            const idx = playlist.findIndex(t => t.path === lastPlayedTrackPath);
            if (idx !== -1) {
                currentTrackIndex = idx;
            } else {
                currentTrackIndex = 0;
            }
        } else if (playlist.length > 0) {
            currentTrackIndex = 0;
        }
    }

    renderSidebarPlaylists();
    renderLibrary();
    renderHome();
    updateFooterUI();
    if (currentView === 'liked') renderLikedSongs();
    if (currentView === 'custom-playlist') renderCustomPlaylist(currentPlaylistName);
}

// Event Listeners
let lastUIUpdate = 0;
audio.addEventListener('timeupdate', () => {
    const now = Date.now();
    if (now - lastUIUpdate > 100) { // Update UI at most 10 times per second
        progress = audio.currentTime;
        updateProgressUI();
        lastUIUpdate = now;
    }
});

audio.addEventListener('loadedmetadata', () => {
    if (audio.duration && !isNaN(audio.duration)) {
        duration = audio.duration;
        if (currentTrackIndex !== -1 && playlist[currentTrackIndex]) {
            durationsMap[playlist[currentTrackIndex].path] = audio.duration;
            renderPlaylist();
        }
        updateDurationUI();
    }
});

audio.addEventListener('ended', handleNext);

audio.addEventListener('error', () => {
    const err = audio.error;
    let msg = "Unknown audio error";
    if (err) {
        switch (err.code) {
            case 1: msg = "Playback aborted"; break;
            case 2: msg = "Network error"; break;
            case 3: msg = "Audio decoding failed"; break;
            case 4: msg = "Source not supported or access denied"; break;
        }
    }
    showError(msg);
});

sidebarHomeBtn.addEventListener('click', () => switchView('home'));
sidebarLibraryBtn.addEventListener('click', () => switchView('library'));
addFolderBtn.addEventListener('click', handlePickFolder);
[playBtnHero, footerPlayBtn, playlistPlayBtn].forEach(btn => {
    if (btn) btn.addEventListener('click', togglePlay);
});
nextBtn.addEventListener('click', handleNext);
prevBtn.addEventListener('click', handlePrevious);
progressBar.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    audio.currentTime = val;
    updateProgressUI();
});
volumeBar.addEventListener('input', (e) => {
    volume = parseFloat(e.target.value);
    audio.volume = volume;
});
searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderPlaylist();
});

minBtn.addEventListener('click', () => window.electronAPI.minimize());
maxBtn.addEventListener('click', () => window.electronAPI.maximize());
closeBtn.addEventListener('click', () => window.electronAPI.close());
likedSongsBtn.addEventListener('click', () => {
    currentView = 'liked';
    renderLikedSongs();
    switchView('liked');
});

closePlaylistModal.addEventListener('click', () => {
    addToPlaylistModal.classList.add('hidden');
});

createPlaylistBtn.addEventListener('click', () => {
    const name = newPlaylistInput.value.trim();
    if (name && trackToAddToPlaylist) {
        if (!playlists[name]) {
            playlists[name] = [];
        }
        if (!playlists[name].some(s => s.path === trackToAddToPlaylist.path)) {
            playlists[name].push(trackToAddToPlaylist);
            localStorage.setItem('playlists', JSON.stringify(playlists));
            renderSidebarPlaylists();
        }
        newPlaylistInput.value = '';
        addToPlaylistModal.classList.add('hidden');
    }
});

// Functions
function switchView(view) {
    currentView = view;
    viewHome.classList.add('hidden');
    viewPlaylist.classList.add('hidden');
    viewLibrary.classList.add('hidden');
    sidebarHomeBtn.classList.remove('bg-[#302839]', 'text-white');
    sidebarLibraryBtn.classList.remove('bg-[#302839]', 'text-white');
    likedSongsBtn.classList.remove('bg-[#302839]', 'text-white');

    if (view === 'home') {
        viewHome.classList.remove('hidden');
        sidebarHomeBtn.classList.add('bg-[#302839]', 'text-white');
        renderHome();
    } else if (view === 'playlist') {
        viewPlaylist.classList.remove('hidden');
        renderPlaylist();
    } else if (view === 'library') {
        viewLibrary.classList.remove('hidden');
        sidebarLibraryBtn.classList.add('bg-[#302839]', 'text-white');
        renderLibrary();
    } else if (view === 'liked') {
        viewPlaylist.classList.remove('hidden');
        likedSongsBtn.classList.add('bg-[#302839]', 'text-white');
    } else {
        // Generic playlist view
        viewPlaylist.classList.remove('hidden');
    }
}

async function handlePickFolder() {
    try {
        const selected = await openDirectory();
        if (selected) {
            if (!addedFolders.includes(selected)) {
                addedFolders.push(selected);
                localStorage.setItem('addedFolders', JSON.stringify(addedFolders));
                await loadFolder(selected);
                switchView('library');
            } else {
                await loadFolder(selected);
                switchView('playlist');
            }
        }
    } catch (err) {
        console.error("Failed to pick folder:", err);
    }
}

async function validateFolders() {
    const validFolders = [];
    let changed = false;
    for (const folderPath of addedFolders) {
        if (await checkPathExists(folderPath)) {
            validFolders.push(folderPath);
        } else {
            changed = true;
        }
    }
    if (changed) {
        addedFolders = validFolders;
        localStorage.setItem('addedFolders', JSON.stringify(addedFolders));
        renderSidebarPlaylists();
    }
}

async function renderLibrary() {
    await validateFolders();
    if (addedFolders.length === 0) {
        libraryGrid.innerHTML = '';
        libraryEmptyState.classList.remove('hidden');
        libraryGrid.classList.add('hidden');
    } else {
        libraryEmptyState.classList.add('hidden');
        libraryGrid.classList.remove('hidden');

        let html = '';
        addedFolders.forEach((folderPath, idx) => {
            const name = folderPath.split(/[/\\]/).filter(Boolean).pop() || "Local Folder";
            html += `
                <div class="group cursor-pointer bg-[#302839]/20 hover:bg-[#302839]/40 p-5 rounded-3xl transition-all border border-white/5 hover:border-white/10" data-path="${folderPath}">
                    <div class="relative aspect-square mb-5 rounded-2xl overflow-hidden shadow-2xl bg-primary/10 flex items-center justify-center">
                        <span class="material-symbols-outlined text-primary text-6xl group-hover:scale-110 transition-transform duration-500">folder_open</span>
                        <div class="absolute bottom-3 right-3 w-12 h-12 bg-primary rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-xl translate-y-2 group-hover:translate-y-0">
                            <span class="material-symbols-outlined text-white text-2xl filled-icon">play_arrow</span>
                        </div>
                    </div>
                    <h3 class="font-bold text-lg leading-snug group-hover:text-primary transition-colors truncate">${name}</h3>
                    <p class="text-[#ab9db9] text-xs mt-2 uppercase tracking-widest font-bold">Local Playlist</p>
                </div>
            `;
        });
        libraryGrid.innerHTML = html;

        // Event delegation
        libraryGrid.onclick = async (e) => {
            const item = e.target.closest('.group');
            if (item) {
                const folderPath = item.dataset.path;
                await loadFolder(folderPath);
                switchView('playlist');
            }
        };
    }
}

async function loadFolder(selected) {
    if (!(await checkPathExists(selected))) {
        await validateFolders();
        switchView('library');
        return;
    }
    const name = selected.split(/[/\\]/).filter(Boolean).pop() || "Local Playlist";
    folderName = name;
    playlistTitle.textContent = name;

    const entries = await readDirectory(selected);
    const audioFiles = [];
    for (const entry of entries) {
        if (entry.isFile && /\.(mp3|wav|m4a|ogg|webm|flac|aac)$/i.test(entry.name)) {
            const fullPath = await joinPath(selected, entry.name);
            audioFiles.push({
                name: entry.name.replace(/\.[^/.]+$/, ""),
                path: fullPath,
                album: name,
            });
        }
    }

    if (audioFiles.length > 0) {
        playlist = audioFiles;
        playlistCount.textContent = `${playlist.length} songs`;
        if (currentTrackIndex === -1) {
            setCurrentTrack(0);
        }
        renderPlaylist();
        renderHome();
    }
}

async function playTrack(track, index) {
    if (!track) return;
    currentTrackIndex = index;
    localStorage.setItem('lastPlayedTrackPath', track.path);
    localStorage.setItem('lastPlaylistContext', currentView === 'custom-playlist' ? currentPlaylistName : currentView);
    showError(null);

    if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        blobUrl = null;
    }

    const ext = track.path.toLowerCase().split('.').pop();
    const isWebm = ext === 'webm';

    if (!isWebm) {
        try {
            const assetUrl = convertFileSrc(track.path);
            audio.src = assetUrl;
            await audio.play();
            setPlaying(true);
            updateFooterUI();
            renderPlaylist();
            return;
        } catch (e) {
            console.warn("Local Protocol failed, falling back to Blob:", e);
        }
    }

    try {
        showError(isWebm ? "Optimizing webm..." : "Loading...");
        const fileData = await readFile(track.path);
        const mimeType = getMimeType(track.path);
        const blob = new Blob([fileData], { type: mimeType });
        blobUrl = URL.createObjectURL(blob);
        audio.src = blobUrl;
        await audio.play();
        setPlaying(true);
        showError(null);
    } catch (err) {
        showError(`Failed: ${err.message}`);
    }
    updateFooterUI();
    renderPlaylist();
}

function togglePlay() {
    if (playlist.length === 0) return;
    if (isPlaying) {
        audio.pause();
        setPlaying(false);
    } else {
        if (currentTrackIndex === -1) {
            playTrack(playlist[0], 0);
        } else if (!audio.src || audio.src === '') {
            // Fix for startup: if index is set but audio source isn't, initialize it
            playTrack(playlist[currentTrackIndex], currentTrackIndex);
        } else {
            audio.play();
            setPlaying(true);
        }
    }
}

function handleNext() {
    if (playlist.length === 0) return;
    const nextIndex = (currentTrackIndex + 1) % playlist.length;
    playTrack(playlist[nextIndex], nextIndex);
}

function handlePrevious() {
    if (playlist.length === 0) return;
    const prevIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length;
    playTrack(playlist[prevIndex], prevIndex);
}

function setPlaying(val) {
    isPlaying = val;
    const icon = val ? 'pause' : 'play_arrow';
    [playBtnHero, footerPlayBtn, playlistPlayBtn].forEach(btn => {
        if (btn) {
            const span = btn.querySelector('span');
            if (span) span.textContent = icon;
        }
    });
}

function updateProgressUI() {
    progressBar.value = progress;
    progressBar.max = duration || 0;
    currentTimeDisplay.textContent = formatTime(progress);
}

function updateDurationUI() {
    durationDisplay.textContent = formatTime(duration);
}

function updateFooterUI() {
    const currentTrack = playlist[currentTrackIndex];
    trackTitleDisplay.textContent = currentTrack ? currentTrack.name : 'Not playing';
    const icon = document.getElementById('footer-track-icon');
    icon.textContent = currentTrack ? 'music_note' : 'music_off';

    // Update like icon in footer
    const footerLikeBtn = document.getElementById('footer-like-btn');
    if (footerLikeBtn) {
        if (currentTrack) {
            footerLikeBtn.classList.remove('hidden');
            const isLiked = likedSongs.some(s => s.path === currentTrack.path);
            const span = footerLikeBtn.querySelector('span');
            if (isLiked) {
                span.classList.add('text-primary', 'filled-icon');
                span.classList.remove('text-[#ab9db9]');
            } else {
                span.classList.remove('text-primary', 'filled-icon');
                span.classList.add('text-[#ab9db9]');
            }
            footerLikeBtn.onclick = () => toggleLike(currentTrack);
        } else {
            footerLikeBtn.classList.add('hidden');
        }
    }
}

function renderTrackTable(tracks, contextPlaylist, isLikedView = false, isCustomView = false) {
    if (tracks.length === 0) {
        trackTableBody.innerHTML = `<tr><td colspan="5" class="py-10 text-center text-[#ab9db9]">No tracks found.</td></tr>`;
        return;
    }

    let html = '';
    tracks.forEach((track, idx) => {
        const isCurrent = currentTrackIndex !== -1 && playlist[currentTrackIndex] && playlist[currentTrackIndex].path === track.path;
        const isLiked = isLikedView || likedSongs.some(s => s.path === track.path);
        const durationStr = durationsMap[track.path] ? formatTime(durationsMap[track.path]) : "--:--";

        html += `
            <tr class="group hover:bg-white/5 transition-colors cursor-pointer" data-path="${track.path}" data-idx="${idx}">
                <td class="py-4 px-4 text-center font-bold ${isCurrent ? 'text-primary' : 'text-[#ab9db9] group-hover:text-white'}">
                    ${isCurrent && isPlaying ? '<span class="material-symbols-outlined text-lg animate-pulse">equalizer</span>' : idx + 1}
                </td>
                <td class="py-4 px-4">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded bg-primary/20 flex items-center justify-center">
                            <span class="material-symbols-outlined text-primary">music_note</span>
                        </div>
                        <div>
                            <p class="text-sm font-bold ${isCurrent ? 'text-primary' : 'text-white'}">${track.name}</p>
                        </div>
                    </div>
                </td>
                <td class="py-4 px-4 text-sm text-[#ab9db9] hidden md:table-cell">${track.album}</td>
                <td class="py-4 px-4 text-right text-sm text-[#ab9db9]">
                    ${durationStr}
                </td>
                <td class="py-4 px-4 text-right">
                    <div class="flex items-center justify-end gap-2">
                        ${isCustomView ?
                '<span class="material-symbols-outlined remove-playlist-btn text-[#ab9db9] hover:text-red-400 text-lg cursor-pointer" title="Remove from playlist">delete</span>' :
                '<span class="material-symbols-outlined add-playlist-btn text-[#ab9db9] hover:text-white text-lg cursor-pointer">add</span>'
            }
                        <span class="material-symbols-outlined like-btn ${isLiked ? 'text-primary filled-icon' : 'text-[#ab9db9] hover:text-white'} text-lg cursor-pointer">
                            favorite
                        </span>
                    </div>
                </td>
            </tr>
        `;
    });
    trackTableBody.innerHTML = html;

    trackTableBody.onclick = (e) => {
        const tr = e.target.closest('tr');
        if (!tr) return;

        const idx = parseInt(tr.dataset.idx);
        const track = tracks[idx];

        if (e.target.closest('.like-btn')) {
            e.stopPropagation();
            toggleLike(track);
            if (isLikedView) renderLikedSongs();
            else if (isCustomView) renderCustomPlaylist(currentPlaylistName);
            else renderPlaylist();
        } else if (e.target.closest('.add-playlist-btn')) {
            e.stopPropagation();
            showAddToPlaylistModal(track);
        } else if (e.target.closest('.remove-playlist-btn')) {
            e.stopPropagation();
            playlists[currentPlaylistName] = playlists[currentPlaylistName].filter(s => s.path !== track.path);
            localStorage.setItem('playlists', JSON.stringify(playlists));
            renderCustomPlaylist(currentPlaylistName);
        } else {
            playlist = contextPlaylist;
            playTrack(track, idx);
        }
    };
}

function renderPlaylist() {
    const filtered = playlist.filter(track =>
        track.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    renderTrackTable(filtered, playlist);
}

function renderLikedSongs() {
    playlistTitle.textContent = "Liked Songs";
    playlistCount.textContent = `${likedSongs.length} songs`;

    const filtered = likedSongs.filter(track =>
        track.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    renderTrackTable(filtered, likedSongs, true);
}

function showAddToPlaylistModal(track) {
    trackToAddToPlaylist = track;
    playlistOptions.innerHTML = '';
    const playlistNames = Object.keys(playlists);

    if (playlistNames.length === 0) {
        playlistOptions.innerHTML = '<p class="text-sm text-[#ab9db9] text-center py-4">No playlists yet.</p>';
    } else {
        playlistNames.forEach(name => {
            const btn = document.createElement('button');
            btn.className = 'w-full text-left px-3 py-2 rounded-lg text-sm text-white hover:bg-[#302839] transition-colors flex items-center justify-between';
            const inPlaylist = playlists[name].some(s => s.path === track.path);
            btn.innerHTML = `
                <span>${name}</span>
                ${inPlaylist ? '<span class="material-symbols-outlined text-primary text-sm">check</span>' : ''}
            `;
            btn.onclick = () => {
                if (!inPlaylist) {
                    playlists[name].push(track);
                    localStorage.setItem('playlists', JSON.stringify(playlists));
                } else {
                    playlists[name] = playlists[name].filter(s => s.path !== track.path);
                    localStorage.setItem('playlists', JSON.stringify(playlists));
                }
                addToPlaylistModal.classList.add('hidden');
                if (currentView === 'playlist') renderPlaylist();
                if (currentView === 'liked') renderLikedSongs();
                if (currentView === 'custom-playlist') renderCustomPlaylist(currentPlaylistName);
            };
            playlistOptions.appendChild(btn);
        });
    }
    addToPlaylistModal.classList.remove('hidden');
}

function renderSidebarPlaylists() {
    playlistsContainer.innerHTML = '';
    Object.keys(playlists).forEach(name => {
        const btn = document.createElement('button');
        btn.className = 'flex items-center gap-4 px-3 py-2 rounded-lg text-[#ab9db9] hover:bg-[#302839] hover:text-white transition-colors w-full text-left';
        btn.innerHTML = `
            <span class="material-symbols-outlined">queue_music</span>
            <span class="text-sm font-medium truncate">${name}</span>
        `;
        btn.onclick = () => {
            currentView = 'custom-playlist';
            currentPlaylistName = name;
            renderCustomPlaylist(name);
            switchView('custom-playlist');

            // UI state update for sidebar buttons
            document.querySelectorAll('aside nav button').forEach(b => b.classList.remove('bg-[#302839]', 'text-white'));
            btn.classList.add('bg-[#302839]', 'text-white');
        };
        playlistsContainer.appendChild(btn);
    });
}

let currentPlaylistName = '';

function renderCustomPlaylist(name) {
    if (!playlists[name]) return;
    playlistTitle.textContent = name;
    playlistCount.textContent = `${playlists[name].length} songs`;

    const filtered = playlists[name].filter(track =>
        track.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    renderTrackTable(filtered, playlists[name], false, true);
}

function toggleLike(track) {
    const index = likedSongs.findIndex(s => s.path === track.path);
    if (index === -1) {
        likedSongs.push(track);
    } else {
        likedSongs.splice(index, 1);
    }
    localStorage.setItem('likedSongs', JSON.stringify(likedSongs));
    if (currentView === 'playlist') renderPlaylist();
    if (currentView === 'liked') renderLikedSongs();
    updateFooterUI();
}

function renderHome() {
    if (!playlist || playlist.length === 0) {
        recentGrid.innerHTML = '';
        emptyState.classList.remove('hidden');
        recentGrid.classList.add('hidden');
    } else {
        emptyState.classList.add('hidden');
        recentGrid.classList.remove('hidden');

        let html = '';
        playlist.slice(0, 10).forEach((track, index) => {
            const isPlayingThis = currentTrackIndex === index && isPlaying;
            html += `
                <div class="group cursor-pointer" data-idx="${index}">
                    <div class="relative aspect-square mb-4 rounded-2xl overflow-hidden shadow-lg shadow-black/20 bg-primary/20 flex items-center justify-center border border-white/5">
                        <span class="material-symbols-outlined text-primary text-6xl opacity-40">music_note</span>
                        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div class="w-14 h-14 bg-primary rounded-full flex items-center justify-center translate-y-4 group-hover:translate-y-0 transition-transform duration-300 shadow-xl">
                                <span class="material-symbols-outlined text-white text-3xl filled-icon">
                                    ${isPlayingThis ? "pause" : "play_arrow"}
                                </span>
                            </div>
                        </div>
                    </div>
                    <h3 class="font-bold text-lg leading-snug group-hover:text-primary transition-colors truncate">${track.name}</h3>
                </div>
            `;
        });
        recentGrid.innerHTML = html;

        // Event delegation
        recentGrid.onclick = (e) => {
            const item = e.target.closest('.group');
            if (item) {
                const idx = parseInt(item.dataset.idx);
                playTrack(playlist[idx], idx);
            }
        };
    }
}

function showError(msg) {
    error = msg;
    errorDisplay.textContent = msg || '';
    errorDisplay.classList.toggle('hidden', !msg);
}

function formatTime(time) {
    if (!time || isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getMimeType(path) {
    const ext = path.toLowerCase().split('.').pop();
    const map = {
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'ogg': 'audio/ogg',
        'webm': 'audio/webm',
        'flac': 'audio/flac',
        'm4a': 'audio/mp4',
        'aac': 'audio/aac',
        'opus': 'audio/opus'
    };
    return map[ext] || 'audio/mpeg';
}

function setCurrentTrack(index) {
    currentTrackIndex = index;
    updateFooterUI();
}
