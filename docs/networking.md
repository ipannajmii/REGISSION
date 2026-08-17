# Networking and Data Communication

REGISSION uses HTTP REST communication between the Raspberry Pi edge device, Laravel backend and Next.js frontend.

The Pi performs computer vision locally and transmits compact verified information such as moves, heartbeat, assignment/status and latency information. Laravel Sanctum protects authenticated application requests, while device-specific authentication is used for Pi heartbeat/device communication.

```text
Raspberry Pi 5 --HTTP/REST--> Laravel API --> MySQL
Next.js Web Client <--------> Laravel API
Next.js Monitoring --proxy--> Raspberry Pi Flask Service
```

The hosted Laravel and Next.js services run on DigitalOcean while Raspberry Pi remains the physical edge device.
