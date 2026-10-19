# Implementation Plan: Measure 0 Beat 0 Absolute Playback & Metronome Alignment

We are updating Staff Composer to ensure that clicking "Play" always starts playback squarely from **Measure 0, Beat 0**, rendering metronome click beats during empty leading rests so audio and cursor progress together in 100% sync.

---

## 1. Proposed Changes

### Playback Start Position & Selection Decoupling
- **Always Start at Measure 0, Beat 0**:
  - Remove all measure-skipping logic (`startMeasureIndex` jumping over empty rests) in `soundEngine.ts`.
  - Remove `selection?.measureIndex` overriding playback start in `App.tsx`.
  - Every time Play is clicked, playback and the visual cursor line start at **Measure 0, Beat 0**.

### Metronome Click Track & Rest Audibility
- **Metronome Clicks Across All Measures**:
  - Ensure the metronome click track generates clicks for all measures (including empty rest measures at the beginning of the score).
  - During empty rest measures (such as a whole rest in Measure 0), students hear 4 audible metronome clicks while the playhead line moves smoothly across Measure 0 from Beat 0 to Beat 4.
- **Offline Audio Pre-Rendering Alignment**:
  - Include Measure 0 through the end of the score in the `OfflineAudioContext` pre-rendered buffer so sample accuracy and hardware latency compensation start at sample index 0.

---

## 2. Verification Plan

1. **Compilation & Linting**:
   - Run `compile_applet` and `lint_applet` to verify clean build without TypeScript errors.
2. **Playback Start Verification**:
   - Select Measure 1, Measure 2, or Measure 3 and click "Play". Confirm the red cursor line and metronome click always start at Measure 0 Beat 0.
3. **Empty Rest Measure Verification**:
   - Leave Measure 0 empty (whole rest) and add notes in Measure 1. Click "Play" and confirm 4 metronome clicks sound in Measure 0 as the red line traverses Measure 0, followed by the notes in Measure 1.
