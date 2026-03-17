A boring detector for premiere pro.

# Core Feature
- Detect boring scenes in a video and mark them with a red border.
- A feature to ignore certain tracks for the boring detection.
- A feature to adjust the sensitivity of the boring detection (time before next element is introduced).

# Implementation Details
- A simple interface to adjust the sensitivity and select tracks to ignore.
- Able to list the boring parts and jump to them in the timeline.
- The boring detection algorithm will analyze the timeline and identify sections where there is a lack of new elements (e.g., no new clips, effects, or transitions) for a specified duration.