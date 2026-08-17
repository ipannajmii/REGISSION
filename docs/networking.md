# Networking and Data Communication

Networking and data communication are core elements of REGISSION.

## Edge-to-Cloud Communication

The Raspberry Pi processes camera images locally and transmits verified application information to Laravel through HTTP REST requests.

## REST API

Implemented API communication supports authentication, game creation, move submission and retrieval, game completion, device assignment, device heartbeat and device status.

## Authentication

Laravel Sanctum protects authenticated web/API requests. Raspberry Pi device communication also uses device-specific authentication.

## Heartbeat

The Raspberry Pi periodically contacts the backend. This supports online/offline status, last-seen information, communication latency and active-game assignment.

## Communication Architecture

```text
Raspberry Pi 5
    |
    | HTTP / REST
    v
Laravel API
    |
    +---------> MySQL
    |
    <--------> Next.js Web Application

Next.js Monitoring / Proxy
    |
    | HTTP
    v
Raspberry Pi Flask Service
```

## Edge Computing

YOLOv8, OpenCV and chess-state processing run on the Raspberry Pi. This avoids continuously uploading every raw camera frame to the cloud.

## Cloud Deployment

The Laravel backend and Next.js frontend are hosted on DigitalOcean.

Live website:

https://regission-143-198-196-49.sslip.io/