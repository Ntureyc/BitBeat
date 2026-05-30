# BitBeat

BitBeat is a premium, minimalist desktop music player built with **Tauri**, **Tailwind CSS**, and modern web technologies. Designed for a sleek and distraction-free listening experience, it lets you enjoy your local music library with style.

<p align="center">
  <img src="logo.png" alt="BitBeat Logo" width="200">
</p>

## Features

-   **Local Library Management**: Easy access to your local music folders.
-   **Seamless Playback**: High-quality audio playback for various formats (MP3, WAV, M4A, OGG, FLAC, etc.).
-   **Custom Playlists**: Create and manage your own music collections.
-   **Liked Songs**: Quick access to your favorite tracks with one-click liking.
-   **Modern UI**: Beautiful, dark-themed interface with smooth animations and responsive design.
-   **Cross-Platform**: Built for Windows and Linux with Tauri (small binary size, native performance).

## Getting Started

### Prerequisites

-   [Node.js](https://nodejs.org/) (v20 or higher recommended)
-   [Rust](https://www.rust-lang.org/tools/install) (latest stable)
-   [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/ntureyc/BitBeat.git
    cd BitBeat
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```

### Development

To start the application in development mode:
```bash
npm run dev
```

### Building for Production

To package the application for your platform:
```bash
npm run build
```

The built binary will be in `src-tauri/target/release/bundle/`.

## Tech Stack

-   **Runtime**: [Tauri v2](https://v2.tauri.app/) (Rust backend, webview frontend)
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/) v3
-   **Font**: Spline Sans (Google Fonts)
-   **Icons**: Material Symbols Outlined

## To-Do List (Future Features)

-   [ ] **Filters**: Filter songs by genre, artist, or album.
-   [ ] **Shuffle**: Randomized playback for your tracks.
-   [ ] **Loop**: Repeat your favorite songs or playlists.
-   [ ] **Theme Support**: Customizable color schemes.
-   [ ] **Audio Visualizers**: Real-time visual feedback for your music.
-   [ ] **Last.fm Scrobbling**: Sync your listening habits.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Made by Ntureyc**
