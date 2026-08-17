# REGISSION Machine Learning

REGISSION deploys two YOLOv8 models on the Raspberry Pi edge device.

## Final Models

- `chess_board_seg_yolov8_813_test.pt` â€” chessboard segmentation and board-region locking.
- `chess_piece_yolov8_813_test.pt` â€” chess-piece observations and square-level visual evidence.

## Dataset

Dataset preparation, annotation and management were performed using Roboflow:

https://app.roboflow.com/irfans-workspace-rnsjw/regission-chess-pieces/

The same REGISSION dataset project was used during development of both detection components.

## Hybrid Detection

The final move is not taken directly from YOLO. REGISSION combines board segmentation, perspective transformation, piece detection, OpenCV visual/frame differences, square-level evidence, python-chess legal move generation, FEN verification, side-to-move validation, SAN generation and Laravel API submission.

## Edge Processing

The computer-vision pipeline runs primarily on Raspberry Pi 5 so the cloud receives verified game/device information instead of every raw camera frame.
