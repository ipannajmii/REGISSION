# REGISSION System Architecture

REGISSION uses a distributed edge-and-cloud architecture.

## Raspberry Pi Edge Layer

The Raspberry Pi handles:

- camera acquisition
- YOLOv8 chessboard segmentation
- YOLOv8 chess-piece detection
- OpenCV perspective transformation
- frame/image difference analysis
- square-level visual evidence
- python-chess legal move matching
- SAN generation
- AUTO detection
- device heartbeat

A Flask service on the Raspberry Pi also exposes status and monitoring endpoints used by the hosted interface.

## Laravel Backend

Laravel provides:

- registration and login
- Laravel Sanctum authentication
- user and profile management
- game management
- move storage
- device registration
- device assignment
- heartbeat processing
- latency information
- game completion
- administrator functions

## MySQL

MySQL stores users, games, moves, devices and authentication-related records.

## Next.js Frontend

The Next.js application provides the landing page, authentication, dashboard, active games, board state, move history, Raspberry Pi management, monitoring, profiles, history, administrator functions and game analysis.

## Stockfish 18

Stockfish 18 runs through a browser Web Worker and WebAssembly for chess evaluation.

## OpenAI

A server-side OpenAI integration generates human-readable move explanations. The API key is stored in server environment configuration and is not committed to the repository.

## Deployment

Laravel and Next.js are hosted on DigitalOcean.

Live website:

https://regission-143-198-196-49.sslip.io/

The Raspberry Pi remains the physical edge-computing device beside the chessboard.