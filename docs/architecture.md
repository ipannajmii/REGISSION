# REGISSION System Architecture

REGISSION uses a distributed edge-and-cloud architecture.

## Raspberry Pi Edge Layer
Camera acquisition, YOLOv8 board segmentation, chess-piece detection, OpenCV perspective transformation, visual difference analysis, legal move matching, SAN generation, AUTO detection and heartbeat run on the Raspberry Pi. A Flask service exposes monitoring/status endpoints.

## Laravel Backend
Laravel handles authentication, Sanctum, users/profiles, games, moves, devices, assignment, heartbeat, latency, completion and administrator functions.

## MySQL
MySQL stores users, games, moves, devices and related persistent application records.

## Next.js Frontend
Next.js provides the public site, authentication, dashboard, active games, board state, move history, device page, monitoring, profiles, history, admin dashboard and game analysis.

## Analysis
Stockfish 18 runs through a browser Web Worker and WebAssembly. OpenAI is used server-side for human-readable move explanations.

## Deployment
Laravel and Next.js are hosted on DigitalOcean while Raspberry Pi remains the physical edge device.
