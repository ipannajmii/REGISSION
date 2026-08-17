# REGISSION Testing Results

## Move Detection Accuracy

The documented final move-detection evaluation used 10 test scenarios.

```text
Correct detections = 9
Total scenarios    = 10

Accuracy = 9 / 10 x 100
Accuracy = 90%
```

Nine scenarios were successfully detected.

The failed scenario was black king-side castling under strong direct lamp glare, which visually interfered with detection of the king and rook movement.

## Tested Functions

Testing included normal pawn movement, knight movement, bishop movement, captures, castling, checkmate notation, illegal move rejection, board/hand stability handling and dashboard updates.

## Latency

Average measured processing latency:

**549.03 ms**

The latency represents processing and communication after a usable stable board state is available.

## Detection Limitations

Performance can be affected by lighting, direct glare, camera angle, board movement, camera movement, hand obstruction and unstable board calibration.