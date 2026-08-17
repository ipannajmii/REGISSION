# REGISSION 👑👁️

## Smart IoT Chessboard with Camera-Based Move Detection ♟️

**REGISSION** is a vision-based Smart IoT chessboard that automatically detects moves made on a conventional physical chessboard and records them digitally.

The final system combines **Raspberry Pi 5, YOLOv8, OpenCV, python-chess, Laravel, MySQL, Next.js, Stockfish 18 and OpenAI integration** using an edge-and-cloud architecture.

> **VISION BEYOND THE BOARD.**

## Live System 🌐

**Hosted REGISSION website:**  
https://regission-143-198-196-49.sslip.io/

The public web application is hosted on DigitalOcean. The Raspberry Pi remains the physical edge-computing device responsible for camera processing and move detection.

## Recognition 🏆

**Best Project Award - UiTM C2PI Final Year Project Exhibition**

Bachelor of Computer Science (Hons.) Data Communication and Networking  
**CS255 - Universiti Teknologi MARA (UiTM)**

REGISSION was developed progressively from **Semester 3** before becoming the final-year project implementation.

The project involved repeated machine-learning training, dataset preparation, computer-vision tuning, Raspberry Pi integration, networking, backend and frontend development, testing, troubleshooting and cloud deployment.

## Project Overview 📖

Manual chess notation can be time-consuming and prone to human error.

REGISSION observes a normal physical chessboard through a Raspberry Pi camera and converts verified physical board changes into digital chess notation.

The final implementation does not rely on YOLO alone. It combines:

- YOLOv8 chessboard segmentation
- YOLOv8 chess-piece detection
- OpenCV perspective transformation
- OpenCV image and frame differencing
- square-level board evidence
- python-chess legal move generation
- FEN verification
- side-to-move enforcement
- SAN notation generation
- Laravel REST API communication

## Final Detection Pipeline 🔄

```text
Physical Chessboard
        |
        v
Raspberry Pi Camera
        |
        v
YOLOv8 Board Segmentation
        |
        v
Board Corner Locking
        |
        v
OpenCV Perspective Transformation
        |
        v
Normalized 8 x 8 Board
        |
        +---------------------------+
        |                           |
        v                           v
YOLOv8 Piece Detection      OpenCV Visual Difference
        |                           |
        +-------------+-------------+
                      |
                      v
             Square-Level Evidence
                      |
                      v
          python-chess Legal Moves
                      |
                      v
        FEN + Side-to-Move Validation
                      |
                      v
              SAN Generation
                      |
                      v
               Laravel REST API
                      |
                      v
                    MySQL
                      |
                      v
              Next.js Dashboard
```

## Main Features ✨

- AUTO physical move detection
- Resume Detect backup/manual trigger
- YOLOv8 chessboard segmentation and piece detection
- OpenCV perspective correction and frame/image differencing
- 8 x 8 square mapping and board locking
- python-chess legal candidate matching
- FEN and side-to-move protection
- SAN, captures, checks, checkmates and castling notation
- illegal-move and duplicate-move protection
- Raspberry Pi heartbeat and device-to-game assignment
- authentication, profiles, admin dashboard and game/move history
- live camera, warped-board and latency monitoring
- Stockfish 18 analysis
- OpenAI move explanation
- DigitalOcean deployment

## Technology Stack 🛠️

### Edge / Computer Vision 📷

- Raspberry Pi 5
- Raspberry Pi Camera Module
- Python
- YOLOv8 / Ultralytics
- OpenCV
- NumPy
- python-chess
- Flask

### Backend ⚙️

- Laravel
- PHP
- Laravel Sanctum
- REST API
- MySQL

### Frontend 💻

- Next.js
- React
- TypeScript
- Tailwind CSS

### Chess Analysis ♜

- Stockfish 18
- WebAssembly
- Web Worker
- OpenAI API

## Machine Learning Models 🤖

The final Raspberry Pi detector loads:

```text
chess_board_seg_yolov8_813_test.pt
chess_piece_yolov8_813_test.pt
```

The board model is used for chessboard segmentation and board-region locking.

The piece model is used for chess-piece detection and square-level visual evidence.

Dataset development and management were performed using Roboflow:

https://app.roboflow.com/irfans-workspace-rnsjw/regission-chess-pieces/

The same REGISSION dataset project was used during development of the board-segmentation and chess-piece detection components.

## Detection Modes 🎯

### AUTO Detection ⚡

AUTO Detection is the primary final workflow.

The Raspberry Pi continuously evaluates the board and attempts to commit a move after the physical board reaches a usable stable state and the visual evidence agrees with a legal transition.

### Resume Detect 🔁

Resume Detect remains available as a **backup/manual workflow**.

It allows the user to explicitly request another detection attempt when AUTO is stopped or when controlled manual verification is required.

Both workflows use the same underlying YOLOv8, OpenCV and python-chess detection pipeline.

## Testing Results 🧪

### Move Detection Accuracy 🎯

The documented final move-detection evaluation used **10 scenarios**.

- Successful detections: **9**
- Failed detections: **1**
- Accuracy: **90%**

The failed scenario involved **black king-side castling** under strong direct lamp glare, which visually interfered with detection of the king and rook movement.

### Average Processing Latency ⏱️

**549.03 ms**

This timing represents the processing and communication period after a usable stable board state is available.

## Networking and Data Communication 🌐

The Raspberry Pi operates as an edge device and communicates with the hosted Laravel backend using HTTP REST APIs.

The network architecture supports:

- authenticated move transmission
- game synchronization
- Raspberry Pi heartbeat
- online/offline device state
- device assignment
- latency information
- hosted user access
- frontend-to-backend API communication
- Raspberry Pi monitoring through proxy routes

Computer-vision processing remains at the edge, reducing unnecessary raw-image transmission to the cloud.

## System Architecture 🏗️

```text
Physical Chessboard
        |
        v
Raspberry Pi 5
YOLOv8 + OpenCV + python-chess
        |
        | HTTP / REST
        v
Laravel API on DigitalOcean
        |
        +----------> MySQL
        |
        v
Next.js Dashboard
        |
        +----------> Stockfish 18
        |
        +----------> OpenAI Move Explanation
```

## Repository Structure 📁

```text
REGISSION/
|-- backend/             Laravel REST API and MySQL application
|-- frontend/            Next.js web application
|-- raspberry-pi/
|   |-- source/          Final Raspberry Pi detector source
|   |-- models/          Final YOLOv8 models
|   `-- .env.example
|-- machine-learning/    Dataset and model documentation
|-- docs/                Technical documentation
`-- assets/              Project screenshots and diagrams
```

## Security 🔐

Production credentials are **not included** in this repository.

Sensitive values are configured through environment variables, including:

- Laravel application keys
- database credentials
- REGISSION API token
- Raspberry Pi device token
- OpenAI API key
- EmailJS configuration

Use the provided `.env.example` files and never commit production `.env` files.

## Documentation 📚

- [System Architecture](https://github.com/ipannajmii/REGISSION/blob/main/docs/architecture.md?plain=1)
- [Detection Pipeline](https://github.com/ipannajmii/REGISSION/blob/main/docs/detection-pipeline.md?plain=1)
- [Networking and Data Communication](https://github.com/ipannajmii/REGISSION/blob/main/docs/networking.md?plain=1)
- [Testing Results](https://github.com/ipannajmii/REGISSION/blob/main/docs/testing.md?plain=1)
- [Machine Learning](https://github.com/ipannajmii/REGISSION/blob/main/machine-learning/README.md?plain=1)

## Project Journey 🚀

REGISSION began during **Semester 3** and evolved through repeated machine-learning training, dataset annotation, Raspberry Pi experimentation, camera calibration, computer vision, automatic detection development, REST API integration, networking, database design, frontend development, cloud hosting, testing and optimization.

The final implementation received the **Best Project Award at the UiTM CS255 C2PI Final Year Project Exhibition**.

## Author 👨‍💻

**Irfan Nazmi bin Mohd Salikhin**

Bachelor of Computer Science (Hons.) Data Communication and Networking  
CS255  
Universiti Teknologi MARA (UiTM)

## Disclaimer ℹ️

REGISSION was developed as an academic Final Year Project.

Detection performance can be influenced by lighting, direct glare, camera position, board movement, hand obstruction and camera stability.
