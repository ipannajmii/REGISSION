import json
import time
import cv2
import numpy as np
from picamera2 import Picamera2
from config import CORNERS_FILE


def order_points(pts):
    pts = np.array(pts, dtype="float32")

    s = pts.sum(axis=1)
    diff = np.diff(pts, axis=1).reshape(-1)

    ordered = np.zeros((4, 2), dtype="float32")
    ordered[0] = pts[np.argmin(s)]      # top-left
    ordered[2] = pts[np.argmax(s)]      # bottom-right
    ordered[1] = pts[np.argmin(diff)]   # top-right
    ordered[3] = pts[np.argmax(diff)]   # bottom-left

    return ordered

def find_board(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)

    edges = cv2.Canny(blur, 50, 150)
    edges = cv2.dilate(edges, None, iterations=2)
    edges = cv2.erode(edges, None, iterations=1)

    contours, _ = cv2.findContours(
        edges,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    h, w = frame.shape[:2]
    frame_area = h * w

    candidates = []

    for c in contours:
        area = cv2.contourArea(c)

        if area < frame_area * 0.08:
            continue

        if area > frame_area * 0.95:
            continue

        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.03 * peri, True)

        if len(approx) != 4:
            continue

        if not cv2.isContourConvex(approx):
            continue

        pts = approx.reshape(4, 2)

        rect = cv2.minAreaRect(pts)
        rw, rh = rect[1]

        if rw == 0 or rh == 0:
            continue

        ratio = max(rw, rh) / min(rw, rh)

        if ratio > 1.6:
            continue

        candidates.append((area, pts))

    if not candidates:
        return None

    candidates.sort(key=lambda x: x[0], reverse=True)
    return order_points(candidates[0][1])


def main():
    picam2 = Picamera2()
    picam2.configure(
        picam2.create_video_configuration(
            main={"size": (1280, 720), "format": "RGB888"}
        )
    )
    picam2.start()
    time.sleep(1)

    print("Automatic board detection started.")
    print("Make sure full chessboard is visible.")
    print("Press S to save manually.")
    print("Press Q to quit.")

    last_pts = None
    stable_count = 0

    cv2.namedWindow("Auto Calibrate", cv2.WINDOW_NORMAL)
    cv2.resizeWindow("Auto Calibrate", 1000, 650)

    while True:
        frame = picam2.capture_array()
        frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)

        pts = find_board(frame)
        display = frame.copy()

        if pts is not None:
            pts_int = pts.astype(int)

            cv2.polylines(display, [pts_int], True, (0, 255, 0), 4)

            labels = ["TL", "TR", "BR", "BL"]

            for i, p in enumerate(pts_int):
                cv2.circle(display, tuple(p), 8, (0, 255, 0), -1)
                cv2.putText(
                    display,
                    labels[i],
                    (p[0] + 10, p[1] - 10),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.8,
                    (0, 255, 0),
                    2,
                )

            if last_pts is not None:
                movement = np.mean(np.abs(pts - last_pts))

                if movement < 3:
                    stable_count += 1
                else:
                    stable_count = 0

            last_pts = pts.copy()

            cv2.putText(
                display,
                f"BOARD DETECTED | Stable {stable_count}/20 | Press S to save",
                (30, 45),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 255, 0),
                2,
            )

            if stable_count >= 20:
                with open(CORNERS_FILE, "w") as f:
                    json.dump(pts.tolist(), f)

                print("Saved automatically:", CORNERS_FILE)
                print(pts.tolist())
                break

        else:
            stable_count = 0
            last_pts = None

            cv2.putText(
                display,
                "BOARD NOT DETECTED - show full board clearly",
                (30, 45),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 0, 255),
                2,
            )

        cv2.imshow("Auto Calibrate", display)

        key = cv2.waitKey(1) & 0xFF

        if key == ord("q"):
            break

        if key == ord("s") and pts is not None:
            with open(CORNERS_FILE, "w") as f:
                json.dump(pts.tolist(), f)

            print("Saved manually:", CORNERS_FILE)
            print(pts.tolist())
            break

    picam2.stop()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()

