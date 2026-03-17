/**
 * app.js — Frontend logic for Boring Detector CEP panel
 */

(function () {
    "use strict";

    var cs = new CSInterface();

    // ── Marker colors (Premiere Pro colorByIndex mapping) ─────────────────
    var MARKER_COLORS = [
        { label: "Green",  index: 0, hex: "#4aaa5a" },
        { label: "Red",    index: 1, hex: "#e05252" },
        { label: "Purple", index: 2, hex: "#9a4ae0" },
        { label: "Orange", index: 3, hex: "#e08c3a" },
        { label: "Yellow", index: 4, hex: "#d4c43a" },
        { label: "White",  index: 5, hex: "#d0d0d0" },
        { label: "Blue",   index: 6, hex: "#4a7ae0" },
        { label: "Cyan",   index: 7, hex: "#4ac4d4" }
    ];

    // ── DOM refs ──────────────────────────────────────────────────────────
    var sensitivitySlider = document.getElementById("sensitivity");
    var sensitivityDisplay = document.getElementById("sensitivity-display");
    var colorSwatches = document.getElementById("color-swatches");
    var trackList = document.getElementById("track-list");
    var btnAnalyze = document.getElementById("btn-analyze");
    var btnClear = document.getElementById("btn-clear");
    var statusMsg = document.getElementById("status-msg");
    var resultCount = document.getElementById("result-count");
    var resultsList = document.getElementById("results-list");

    // ── Helpers ───────────────────────────────────────────────────────────

    function setStatus(msg, type) {
        statusMsg.textContent = msg;
        statusMsg.className = type || "";
    }

    /**
     * Converts seconds to HH:MM:SS timecode string.
     */
    function secondsToTimecode(secs) {
        var h = Math.floor(secs / 3600);
        var m = Math.floor((secs % 3600) / 60);
        var s = Math.floor(secs % 60);
        return (
            (h > 0 ? String(h).padStart(2, "0") + ":" : "") +
            String(m).padStart(2, "0") + ":" +
            String(s).padStart(2, "0")
        );
    }

    /**
     * Returns array of track names whose checkboxes are UNCHECKED (i.e., ignored).
     */
    function getIgnoredTracks() {
        var ignored = [];
        var checkboxes = trackList.querySelectorAll("input[type='checkbox']");
        checkboxes.forEach(function (cb) {
            if (!cb.checked) {
                ignored.push(cb.dataset.trackName);
            }
        });
        return ignored;
    }

    /**
     * Saves unchecked track indices to localStorage.
     */
    function saveIgnoredTracks() {
        var ignored = Array.from(trackList.querySelectorAll("input:not(:checked)")).map(function (cb) { return cb.value; });
        localStorage.setItem("boringDetector.ignoredTrackIndices", JSON.stringify(ignored));
    }

    // ── Color picker ──────────────────────────────────────────────────────

    function getSelectedColorIndex() {
        var saved = localStorage.getItem("boringDetector.markerColor");
        return saved !== null ? parseInt(saved, 10) : 1; // default: Red
    }

    function renderColorSwatches() {
        colorSwatches.innerHTML = "";
        var selected = getSelectedColorIndex();
        MARKER_COLORS.forEach(function (color) {
            var swatch = document.createElement("button");
            swatch.type = "button";
            swatch.className = "color-swatch" + (color.index === selected ? " selected" : "");
            swatch.title = color.label;
            swatch.style.backgroundColor = color.hex;
            swatch.dataset.colorIndex = color.index;
            swatch.addEventListener("click", function () {
                localStorage.setItem("boringDetector.markerColor", color.index);
                document.querySelectorAll(".color-swatch").forEach(function (s) {
                    s.classList.toggle("selected", parseInt(s.dataset.colorIndex, 10) === color.index);
                });
            });
            colorSwatches.appendChild(swatch);
        });
    }

    // ── Track rendering ───────────────────────────────────────────────────

    function renderTrackCheckboxes(tracks) {
        trackList.innerHTML = "";

        if (!tracks || tracks.length === 0) {
            trackList.innerHTML = '<span class="track-placeholder">No tracks found.</span>';
            return;
        }

        tracks.forEach(function (track) {
            var item = document.createElement("div");
            item.className = "track-item " + track.type;

            var cb = document.createElement("input");
            cb.type = "checkbox";
            cb.id = "track-" + track.type + "-" + track.index;
            cb.value = track.type + "_" + track.index;
            cb.dataset.trackName = track.name;
            cb.checked = true; // checked = NOT ignored

            var label = document.createElement("label");
            label.htmlFor = cb.id;
            label.textContent = track.name;

            item.appendChild(cb);
            item.appendChild(label);
            trackList.appendChild(item);
        });
    }

    // ── Results rendering ─────────────────────────────────────────────────

    function renderResults(sections) {
        resultsList.innerHTML = "";

        if (!sections || sections.length === 0) {
            resultsList.innerHTML = '<li class="empty-state">No boring sections found.</li>';
            resultCount.textContent = "";
            return;
        }

        resultCount.textContent = sections.length + " section" + (sections.length !== 1 ? "s" : "");

        sections.forEach(function (section) {
            var li = document.createElement("li");
            li.className = "result-item";

            var info = document.createElement("div");
            info.className = "result-info";

            var timecode = document.createElement("span");
            timecode.className = "result-timecode";
            timecode.textContent = secondsToTimecode(section.start);

            var duration = document.createElement("span");
            duration.className = "result-duration";
            duration.textContent = section.duration.toFixed(1) + "s gap";

            info.appendChild(timecode);
            info.appendChild(duration);

            var jumpBtn = document.createElement("button");
            jumpBtn.className = "btn-jump";
            jumpBtn.textContent = "Jump";
            jumpBtn.addEventListener("click", function () {
                cs.evalScript("jumpToTime(" + section.start + ")");
            });

            li.appendChild(info);
            li.appendChild(jumpBtn);
            resultsList.appendChild(li);
        });
    }

    function clearResults() {
        resultsList.innerHTML = '<li class="empty-state">No analysis run yet.</li>';
        resultCount.textContent = "";
    }

    // ── Initialization ────────────────────────────────────────────────────

    function loadTracks() {
        cs.evalScript("getSequenceInfo()", function (result) {
            try {
                var data = JSON.parse(result);
                if (data && data.error) {
                    setStatus(data.error, "error");
                    trackList.innerHTML = '<span class="track-placeholder">' + data.error + '</span>';
                    return;
                }
                renderTrackCheckboxes(data);

                var ignoredIndices = JSON.parse(localStorage.getItem("boringDetector.ignoredTrackIndices") || "[]");
                trackList.querySelectorAll("input").forEach(function (cb) {
                    if (ignoredIndices.indexOf(cb.value) !== -1) cb.checked = false;
                    cb.addEventListener("change", saveIgnoredTracks);
                });

                setStatus("Sequence loaded. " + data.length + " tracks found.");

                cs.evalScript("getBoringMarkers()", function (markersResult) {
                    try {
                        var existing = JSON.parse(markersResult);
                        if (existing && !existing.error && existing.length > 0) {
                            renderResults(existing);
                            resultCount.textContent = existing.length + " section" + (existing.length !== 1 ? "s" : "");
                        }
                    } catch (e) { /* no existing markers, leave default state */ }
                });
            } catch (e) {
                setStatus("Failed to load sequence info.", "error");
                trackList.innerHTML = '<span class="track-placeholder">Error loading tracks.</span>';
            }
        });
    }

    // ── Event Listeners ───────────────────────────────────────────────────

    sensitivitySlider.addEventListener("input", function () {
        sensitivityDisplay.textContent = this.value;
        localStorage.setItem("boringDetector.sensitivity", this.value);
    });

    document.getElementById("btn-refresh-tracks").addEventListener("click", loadTracks);

    document.getElementById("select-all-tracks").addEventListener("click", function () {
        trackList.querySelectorAll("input").forEach(function (cb) { cb.checked = true; });
        saveIgnoredTracks();
    });

    document.getElementById("deselect-all-tracks").addEventListener("click", function () {
        trackList.querySelectorAll("input").forEach(function (cb) { cb.checked = false; });
        saveIgnoredTracks();
    });

    btnAnalyze.addEventListener("click", function () {
        var sensitivity = parseFloat(sensitivitySlider.value);
        var ignoredTracksArg = JSON.stringify(JSON.stringify(getIgnoredTracks()));

        btnAnalyze.disabled = true;
        setStatus("Analyzing timeline…");

        var script = "analyzeTimeline(" + sensitivity + ", " + ignoredTracksArg + ")";

        cs.evalScript(script, function (result) {
            btnAnalyze.disabled = false;
            try {
                var data = JSON.parse(result);
                if (data && data.error) {
                    setStatus(data.error, "error");
                    return;
                }
                renderResults(data);

                if (data.length > 0) {
                    setStatus("Found " + data.length + " boring section(s). Markers added.", "success");
                    var markersArg = JSON.stringify(JSON.stringify(data));
                    cs.evalScript("addBoringMarkers(" + markersArg + ", " + getSelectedColorIndex() + ")", function (markersResult) {
                        try {
                            var mr = JSON.parse(markersResult);
                            var dbg = "color set=" + mr.colorUsed + " readback=" + mr.colorReadback + " | end readback=" + mr.endReadback;
                            if (mr && mr.errors && mr.errors.length > 0) {
                                setStatus(dbg + " | Warnings: " + mr.errors.join("; "), "");
                            } else {
                                setStatus(dbg, "");
                            }
                        } catch (e) {
                            setStatus("addBoringMarkers error: " + markersResult, "error");
                        }
                    });
                } else {
                    setStatus("No boring sections found with current settings.", "");
                }
            } catch (e) {
                setStatus("Analysis error: " + (result || e.message), "error");
            }
        });
    });

    btnClear.addEventListener("click", function () {
        cs.evalScript("clearBoringMarkers()", function () {
            clearResults();
            setStatus("Markers cleared.");
        });
    });

    // ── Boot ──────────────────────────────────────────────────────────────

    renderColorSwatches();

    var savedSensitivity = localStorage.getItem("boringDetector.sensitivity");
    if (savedSensitivity !== null) {
        sensitivitySlider.value = savedSensitivity;
        sensitivityDisplay.textContent = savedSensitivity;
    }

    loadTracks();

}());
