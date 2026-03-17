/**
 * hostscript.jsx — ExtendScript host-side functions for Boring Detector
 * Runs inside Adobe Premiere Pro's ExtendScript engine.
 */

/** ES3-safe array contains check (ExtendScript has no Array.prototype.indexOf). */
function arrayContains(arr, val) {
    for (var k = 0; k < arr.length; k++) {
        if (arr[k] === val) return true;
    }
    return false;
}

/**
 * Returns a display name for a track, substituting Premiere's generic
 * "Output N" default audio names with "A{n}".
 */
function trackDisplayName(track, type, index) {
    if (type === "audio") {
        var n = track.name;
        if (!n || /^Output\s+\d+$/i.test(n)) return "Audio " + (index + 1);
        return n;
    }
    return track.name || ("V" + (index + 1));
}

/**
 * Returns JSON array of all tracks in the active sequence.
 * Each item: { name, type, index }
 */
function getSequenceInfo() {
    var seq = app.project.activeSequence;
    if (!seq) {
        return JSON.stringify({ error: "No active sequence." });
    }

    var tracks = [];
    var i;

    for (i = 0; i < seq.videoTracks.numTracks; i++) {
        tracks.push({
            name: trackDisplayName(seq.videoTracks[i], "video", i),
            type: "video",
            index: i
        });
    }

    for (i = 0; i < seq.audioTracks.numTracks; i++) {
        tracks.push({
            name: trackDisplayName(seq.audioTracks[i], "audio", i),
            type: "audio",
            index: i
        });
    }

    return JSON.stringify(tracks);
}

/**
 * Analyzes the timeline and finds boring sections.
 * @param {Number} sensitivitySeconds - Minimum gap duration to flag as boring
 * @param {String} ignoredTracksJSON  - JSON array of track names to ignore
 * @returns {String} JSON array of { start, end, duration } objects
 */
function analyzeTimeline(sensitivitySeconds, ignoredTracksJSON) {
    clearBoringMarkers();
    try {
    var seq = app.project.activeSequence;
    if (!seq) {
        return JSON.stringify({ error: "No active sequence." });
    }

    var ignoredTracks = [];
    try {
        ignoredTracks = JSON.parse(ignoredTracksJSON) || [];
    } catch (e) {
        ignoredTracks = [];
    }

    var sensitivity = parseFloat(sensitivitySeconds) || 5;
    var intervals = []; // all [start, end] clip intervals across non-ignored tracks
    var i, j, track, clip;

    // Collect clip intervals from video tracks
    for (i = 0; i < seq.videoTracks.numTracks; i++) {
        track = seq.videoTracks[i];
        if (arrayContains(ignoredTracks, trackDisplayName(track, "video", i))) continue;

        for (j = 0; j < track.clips.numItems; j++) {
            clip = track.clips[j];
            intervals.push([clip.start.seconds, clip.end.seconds]);
        }
    }

    // Collect clip intervals from audio tracks
    for (i = 0; i < seq.audioTracks.numTracks; i++) {
        track = seq.audioTracks[i];
        if (arrayContains(ignoredTracks, trackDisplayName(track, "audio", i))) continue;

        for (j = 0; j < track.clips.numItems; j++) {
            clip = track.clips[j];
            intervals.push([clip.start.seconds, clip.end.seconds]);
        }
    }

    if (intervals.length === 0) {
        return JSON.stringify([]);
    }

    // Sort intervals by start time, then merge overlapping/adjacent ones.
    // This correctly handles connected clips on the same track.
    intervals.sort(function(a, b) { return a[0] - b[0]; });
    var merged = [intervals[0].slice()];
    for (i = 1; i < intervals.length; i++) {
        var last = merged[merged.length - 1];
        if (intervals[i][0] <= last[1] + 0.01) {
            // Overlapping or touching — extend the merged interval
            if (intervals[i][1] > last[1]) {
                last[1] = intervals[i][1];
            }
        } else {
            merged.push(intervals[i].slice());
        }
    }

    // Gaps between merged intervals are the boring sections
    var boringSections = [];
    for (i = 0; i < merged.length - 1; i++) {
        var gapStart = merged[i][1];
        var gapEnd   = merged[i + 1][0];
        var gap = gapEnd - gapStart;
        if (gap > sensitivity) {
            boringSections.push({
                start: gapStart,
                end: gapEnd,
                duration: gap
            });
        }
    }

    return JSON.stringify(boringSections);
    } catch (e) {
        return JSON.stringify({ error: "analyzeTimeline exception: " + e.message });
    }
}

/**
 * Adds red sequence markers for each boring section.
 * @param {String} boringSectionsJSON - JSON array of { start, end, duration }
 */
function addBoringMarkers(boringSectionsJSON, colorIndex) {
    var seq = app.project.activeSequence;
    if (!seq) return JSON.stringify({ error: "No active sequence." });

    var color = (typeof colorIndex === "number") ? colorIndex : 1;
    var created = 0;
    var errors = [];
    var colorReadback = null;
    var endReadback = null;

    var sections = [];
    try {
        sections = JSON.parse(boringSectionsJSON) || [];
    } catch (e) {
        return JSON.stringify({ error: "JSON parse failed: " + e.message });
    }

    for (var i = 0; i < sections.length; i++) {
        try {
            var section = sections[i];
            var marker = seq.markers.createMarker(section.start);
            marker.name = "BORING";
            marker.comments = "Gap: " + Math.round(section.duration * 10) / 10 + "s";

            marker.setColorByIndex(color);

            marker.end = marker.start.seconds + section.duration;

            created++;
        } catch (markerErr) {
            errors.push("marker[" + i + "]: " + markerErr.message);
        }
    }

    return JSON.stringify({ created: created, colorUsed: color, colorReadback: colorReadback, endReadback: endReadback, errors: errors });
}

/**
 * Returns JSON array of existing BORING markers as { start, end, duration }.
 */
function getBoringMarkers() {
    var seq = app.project.activeSequence;
    if (!seq) return JSON.stringify({ error: "No active sequence." });

    var result = [];
    var marker = seq.markers.getFirstMarker();
    while (marker) {
        if (marker.name === "BORING") {
            var s = marker.start.seconds;
            var e = marker.end.seconds;
            result.push({ start: s, end: e, duration: e - s });
        }
        marker = seq.markers.getNextMarker(marker);
    }
    return JSON.stringify(result);
}

/**
 * Removes all markers named "BORING" from the active sequence.
 */
function clearBoringMarkers() {
    var seq = app.project.activeSequence;
    if (!seq) return;

    var toDelete = [];
    var marker = seq.markers.getFirstMarker();

    while (marker) {
        if (marker.name === "BORING") {
            toDelete.push(marker);
        }
        marker = seq.markers.getNextMarker(marker);
    }

    for (var i = 0; i < toDelete.length; i++) {
        seq.markers.deleteMarker(toDelete[i]);
    }
}

/**
 * Moves the playhead to the given time in seconds.
 * @param {Number} seconds
 */
function jumpToTime(seconds) {
    var seq = app.project.activeSequence;
    if (!seq) return;

    var t = new Time();
    t.seconds = parseFloat(seconds);
    seq.setPlayerPosition(t.ticks);
}
