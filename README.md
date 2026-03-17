# Boring Detector

A CEP panel plugin for Adobe Premiere Pro that analyzes your timeline and flags "boring" sections — gaps where no new clips or transitions are introduced for longer than a configurable threshold.

## Features

- Configurable sensitivity slider (1–30 seconds)
- Per-track ignore list (exclude music, ambient audio, etc.)
- Adds red sequence markers at each boring section
- Results list with one-click jump to each section
- Clear all markers with one click

## Requirements

- Adobe Premiere Pro 2020 (v14.0) or later
- Windows (setup script is Windows-only; Mac users can set up manually)

## Installation

### 1. Enable unsigned extensions

Run `setup.ps1` as Administrator — this sets the `PlayerDebugMode` registry key for CSXS and creates a directory junction in your CEP extensions folder.

```powershell
Start-Process powershell -Verb RunAs -ArgumentList "-File `"$PWD\setup.ps1`""
```

### 2. Restart Premiere Pro

Open `Window > Extensions > Boring Detector`.

## Manual Setup (Mac or no script)

**Mac** — set the plist key:
```bash
defaults write com.adobe.CSXS.10 PlayerDebugMode 1
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
defaults write com.adobe.CSXS.12 PlayerDebugMode 1
```

Then symlink or copy the project folder to:
```
~/Library/Application Support/Adobe/CEP/extensions/BoringDetector/
```

**Windows (manual)** — add registry value:
- Key: `HKEY_CURRENT_USER\Software\Adobe\CSXS.11`
- Name: `PlayerDebugMode` | Type: `REG_SZ` | Value: `1`

Then symlink or copy to:
```
%APPDATA%\Adobe\CEP\extensions\BoringDetector\
```

## Usage

1. Open a project and select a sequence
2. Open **Window > Extensions > Boring Detector**
3. Adjust the **sensitivity** slider (minimum gap length to flag as boring)
4. Uncheck any tracks to exclude from analysis
5. Click **Analyze** — red markers appear on the timeline
6. Click **Jump** next to any result to move the playhead there
7. Click **Clear Markers** to remove all boring markers

## File Structure

```
premiere_boring_detector/
├── CSXS/
│   └── manifest.xml        # CEP extension manifest
├── css/
│   └── style.css           # Dark theme UI
├── js/
│   ├── app.js              # Frontend logic
│   └── CSInterface.js      # Adobe CEP bridge library
├── jsx/
│   └── hostscript.jsx      # ExtendScript: timeline analysis & markers
├── index.html              # Panel UI
└── setup.ps1               # Windows dev setup script
```

## How It Works

The analyzer collects the start time of every clip on every non-ignored track, sorts them, then finds consecutive timestamps with a gap longer than the sensitivity threshold. Each gap becomes a red sequence marker labeled `BORING` with the gap duration in its comment field.

## License

MIT
