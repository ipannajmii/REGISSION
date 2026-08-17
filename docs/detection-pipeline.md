# REGISSION Detection Pipeline

## Overview

REGISSION converts physical chess moves into digital notation using a hybrid computer-vision and chess-rule-validation pipeline.

## Processing Pipeline

```text
Camera
  |
  v
YOLOv8 Board Segmentation
  |
  v
Board Locking
  |
  v
OpenCV Perspective Warp
  |
  v
8 x 8 Board
  |
  +--> YOLOv8 Piece Detection
  |
  +--> OpenCV Visual Difference
  |
  v
Square-Level Evidence
  |
  v
python-chess Legal Candidates
  |
  v
FEN + Side-to-Move Verification
  |
  v
SAN Generation
  |
  v
Laravel REST API
```

## Board Detection and Locking

The board-segmentation YOLO model identifies the chessboard region. Board corners are stabilized so temporary model fluctuations do not constantly alter the perspective transform.

## Perspective Transformation

OpenCV converts the camera view into a normalized top-down board and divides the result into 64 consistent chess squares.

## Piece Detection

The second YOLO model detects chess pieces and provides occupancy, colour and piece-class evidence.

## Frame / Image Difference

The current warped board is compared with the previous accepted reference. Per-square visual-change scores indicate where a physical transition occurred.

## Legal Move Matching

python-chess maintains the authoritative digital position and generates legal candidates. Visual evidence is compared against the expected square transitions of those candidates.

## Side-to-Move Protection

The expected player is restored from the authoritative game state. A visually plausible white move cannot be committed while the game expects Black, and vice versa.

## AUTO Detection

AUTO Detection is the primary workflow and continuously evaluates the board.

## Resume Detect

Resume Detect remains available as a backup/manual trigger for a controlled additional detection attempt.