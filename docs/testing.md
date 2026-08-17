# REGISSION Testing Results

## Move Detection Accuracy

Documented final result: **9/10 = 90%**. The failed scenario was black king-side castling under strong direct lamp glare, which visually interfered with king/rook movement detection.

## Average Processing Latency

**549.03 ms** after a usable stable board state is available.

## Coverage

Testing covered normal moves, knight/bishop movement, captures, castling, checkmate notation, illegal-move rejection, hand/board stability, API storage and dashboard updates.

## Limitations

Lighting, direct glare, camera angle, board/camera movement, obstruction and unstable calibration can affect detection.
