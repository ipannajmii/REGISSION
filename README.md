# REGISSION â™Ÿï¸

## Smart IoT Chessboard with Camera-Based Move Detection

**REGISSION** is a vision-based smart IoT chessboard that automatically detects moves made on a conventional physical chessboard and records them digitally.

The final system combines **Raspberry Pi 5, YOLOv8, OpenCV, python-chess, Laravel, MySQL, Next.js, Stockfish 18 and OpenAI integration** using an edge-and-cloud architecture.

> **VISION BEYOND THE BOARD.**

## ðŸ† Recognition

**Best Project Award â€” UiTM C2PI Final Year Project Exhibition**  
Bachelor of Computer Science (Hons.) Data Communication and Networking  
**CS255 â€” Universiti Teknologi MARA (UiTM)**

REGISSION was developed progressively from **Semester 3** before becoming the final-year project implementation. The journey involved repeated machine-learning training, dataset preparation, computer-vision tuning, Raspberry Pi integration, networking, backend/frontend development, testing and cloud deployment.

## Project Overview

REGISSION observes a normal chessboard through a Raspberry Pi camera and converts verified physical board changes into digital notation. The final implementation combines YOLOv8 board segmentation and piece detection with OpenCV perspective transformation and visual/frame differencing, then verifies candidate transitions using python-chess, FEN and side-to-move state before generating SAN and submitting the move to Laravel.

## Final Detection Pipeline

```text
Physical Chessboard
        â†“
Raspberry Pi Camera
        â†“
YOLOv8 Board Segmentation
        â†“
Board Corner Locking
        â†“
OpenCV Perspective Transformation
        â†“
Normalized 8 Ã— 8 Board
        â†“
YOLOv8 Piece Detection + OpenCV Visual Difference
        â†“
Square-Level Evidence
        â†“
python-chess Legal Moves
        â†“
FEN + Side-to-Move Validation
        â†“
SAN Generation
        â†“
Laravel REST API â†’ MySQL â†’ Next.js Dashboard
```

## Main Features

- AUTO physical move detection
- Resume Detect backup/manual trigger
- YOLOv8 chessboard segmentation and piece detection
- OpenCV perspective correction and frame/image differencing
- 8 Ã— 8 square mapping and board locking
- python-chess legal candidate matching
- FEN and side-to-move protection
- SAN, captures, checks, checkmates and castling notation
- Illegal-move and duplicate-move protection
- Raspberry Pi heartbeat and device-to-game assignment
- Authentication, profiles, admin dashboard, game/move history
- Live camera, warped-board and latency monitoring
- Stockfish 18 analysis and OpenAI move explanation
- DigitalOcean deployment

## Technology Stack

**Edge / Computer Vision:** Raspberry Pi 5, Raspberry Pi Camera Module, Python, YOLOv8, Ultralytics, OpenCV, NumPy, python-chess, Flask  
**Backend:** Laravel, PHP, Sanctum, REST API, MySQL  
**Frontend:** Next.js, React, TypeScript, Tailwind CSS  
**Analysis:** Stockfish 18, WebAssembly, Web Worker, OpenAI API

## Machine Learning

Final deployed models:

```text
chess_board_seg_yolov8_813_test.pt
chess_piece_yolov8_813_test.pt
```

Roboflow project:  
https://app.roboflow.com/irfans-workspace-rnsjw/regission-chess-pieces/

The same REGISSION dataset project was used during development of the board-segmentation and chess-piece detection components.

## Detection Modes

**AUTO Detection** is the primary workflow. The Pi continuously evaluates the board and commits only a usable legal final state.  
**Resume Detect** is retained as a backup/manual workflow for a controlled additional detection attempt. Both modes use the same YOLOv8, OpenCV and python-chess pipeline.

## Testing Results

- **Move-detection accuracy:** 90% (9/10 documented scenarios)
- **Failed scenario:** black king-side castling under strong direct lamp glare
- **Average processing latency:** 549.03 ms

## Networking and Data Communication

The Raspberry Pi acts as an edge device and communicates with the hosted Laravel backend through HTTP REST requests. The architecture supports authenticated move transmission, game synchronization, heartbeat, online/offline state, device assignment, latency monitoring, remote access and Pi monitoring through proxy routes. Computer vision remains at the edge, reducing unnecessary raw-image transmission.

## Repository Structure

```text
REGISSION/
â”œâ”€â”€ backend/          Laravel REST API
â”œâ”€â”€ frontend/         Next.js web application
â”œâ”€â”€ raspberry-pi/     Final detector, models and env example
â”œâ”€â”€ machine-learning/ Dataset/model documentation
â”œâ”€â”€ docs/             Technical documentation
â””â”€â”€ assets/           Screenshots and diagrams
```

## Security

Production credentials are not included. Use the supplied `.env.example` files and never commit real `.env`, API tokens, device tokens, database passwords or OpenAI keys.

## Documentation

- [System Architecture](docs/architecture.md)
- [Detection Pipeline](docs/detection-pipeline.md)
- [Networking and Data Communication](docs/networking.md)
- [Testing Results](docs/testing.md)
- [Machine Learning](machine-learning/README.md)

## Author

**Irfan Nazmi bin Mohd Salikhin**  
Bachelor of Computer Science (Hons.) Data Communication and Networking â€” CS255  
Universiti Teknologi MARA (UiTM)

## Disclaimer

REGISSION was developed as an academic Final Year Project. Detection performance can be influenced by lighting, glare, camera position, board movement, obstruction and camera stability.
