# REGISSION Machine Learning

REGISSION deploys two YOLOv8 models on the Raspberry Pi edge device.

## Final Models

### Chessboard Segmentation

`chess_board_seg_yolov8_813_test.pt`

This model detects and segments the physical chessboard region. Its output is used for board locking and OpenCV perspective transformation.

### Chess-Piece Detection

`chess_piece_yolov8_813_test.pt`

This model detects chess pieces from the perspective-normalized chessboard and provides square-level visual evidence during move verification.

## Dataset

Dataset preparation, annotation and management were performed using Roboflow:

https://app.roboflow.com/irfans-workspace-rnsjw/regission-chess-pieces/

The same REGISSION dataset project was used during development of the board and chess-piece detection components.

## Hybrid Detection

The final system combines YOLOv8, OpenCV and python-chess rather than relying on raw object detection alone.

## Model Location

```text
raspberry-pi/models/
|-- chess_board_seg_yolov8_813_test.pt
`-- chess_piece_yolov8_813_test.pt
```