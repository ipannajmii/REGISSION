import os
import time
import json
import csv
import hashlib
import threading
import socket
from collections import Counter, deque
from pathlib import Path

import cv2
import numpy as np
import requests
import chess
from flask import Flask, Response, render_template_string, jsonify, request
from picamera2 import Picamera2
from ultralytics import YOLO

# =========================================================
# REGISSION AUTO v6 - EDGE-TRIGGERED, IDEMPOTENT VISUAL MOVE ENGINE
# Board: YOLOv8 segmentation model
# Pieces: YOLOv8 object detection model
# Move validation: python-chess
# Backend: Laravel API + MySQL
# Dashboard: Next.js can read these Flask routes
# =========================================================

# ---------- MODEL PATHS ----------
BOARD_MODEL_PATH = "models/chess_board_seg_yolov8_813_test.pt"
PIECE_MODEL_PATH = "models/chess_piece_yolov8_813_test.pt"

# ---------- NETWORK / API ----------
PORT = 5051
API_BASE = os.environ.get("REGISSION_API_BASE", "http://192.168.8.139:8000/api")
_initial_game_id = os.environ.get("REGISSION_GAME_ID")
active_game_id = int(_initial_game_id) if _initial_game_id else None
API_TOKEN = os.environ.get("REGISSION_API_TOKEN", "").strip()
DEVICE_TOKEN = os.environ.get("REGISSION_DEVICE_TOKEN", "").strip()
HEARTBEAT_INTERVAL_SECONDS = max(5.0, float(os.environ.get("REGISSION_HEARTBEAT_INTERVAL", "10")))
HEARTBEAT_TIMEOUT_SECONDS = max(2.0, float(os.environ.get("REGISSION_HEARTBEAT_TIMEOUT", "8")))

# ---------- CAMERA ----------
FRAME_WIDTH = 1280
FRAME_HEIGHT = 720

# ---------- DETECTION SETTINGS ----------
BOARD_CONF = float(os.environ.get("REGISSION_BOARD_CONF", "0.60"))
PIECE_CONF = float(os.environ.get("REGISSION_PIECE_CONF", "0.50"))
IMG_SIZE = int(os.environ.get("REGISSION_IMG_SIZE", "640"))
WARP_SIZE = int(os.environ.get("REGISSION_WARP_SIZE", "800"))
DETECT_EVERY_SECONDS = float(os.environ.get("REGISSION_DETECT_INTERVAL", "0.80"))

# Manual mode is safest. Auto can be enabled from /auto_on.
# Automatic mode uses a visual occupancy baseline, waits for the board to
# become stable after a move, and then asks python-chess to validate the move.
AUTO_ENABLED = False
AUTO_SCAN_SECONDS = max(0.15, float(os.environ.get("REGISSION_AUTO_SCAN_SECONDS", "0.25")))
AUTO_BASELINE_STABLE_SECONDS = max(
    0.80, float(os.environ.get("REGISSION_AUTO_BASELINE_STABLE_SECONDS", "1.50"))
)
AUTO_STABLE_SECONDS = max(
    0.80, float(os.environ.get("REGISSION_AUTO_STABLE_SECONDS", "1.50"))
)
# Castling moves two pieces. Wait longer so the king and rook can both be
# placed before validating a partial position as an ordinary king move.
AUTO_CASTLING_STABLE_SECONDS = max(
    AUTO_STABLE_SECONDS,
    float(os.environ.get("REGISSION_AUTO_CASTLING_STABLE_SECONDS", "5.00")),
)
AUTO_COOLDOWN_SECONDS = max(
    2.00, float(os.environ.get("REGISSION_AUTO_COOLDOWN_SECONDS", "4.00"))
)
AUTO_RETRY_SECONDS = max(
    1.50, float(os.environ.get("REGISSION_AUTO_RETRY_SECONDS", "3.00"))
)
AUTO_MAX_EXTRA_CHANGED_SQUARES = max(
    0, int(os.environ.get("REGISSION_AUTO_MAX_EXTRA_CHANGED_SQUARES", "2"))
)
AUTO_MAX_CHANGED_SQUARES = max(
    4, int(os.environ.get("REGISSION_AUTO_MAX_CHANGED_SQUARES", "6"))
)
AUTO_OBSERVATION_MAX_AGE_SECONDS = max(
    1.0, float(os.environ.get("REGISSION_AUTO_OBSERVATION_MAX_AGE_SECONDS", "2.5"))
)

# Temporal consensus reduces intermittent missed pieces and one-frame false
# detections, especially bishops and queens under glare.
OBSERVATION_HISTORY_SIZE = max(
    3, int(os.environ.get("REGISSION_OBSERVATION_HISTORY_SIZE", "7"))
)
OBSERVATION_HISTORY_MAX_AGE_SECONDS = max(
    2.0, float(os.environ.get("REGISSION_OBSERVATION_HISTORY_MAX_AGE_SECONDS", "4.0"))
)
OBSERVATION_MIN_RATIO = min(
    0.80, max(0.25, float(os.environ.get("REGISSION_OBSERVATION_MIN_RATIO", "0.40")))
)

# A real move must create measurable camera motion before AUTO may save it.
# This prevents a flickering YOLO square from being accepted as a move such
# as Ke7 while the physical board has not been touched.
AUTO_MOTION_PIXEL_THRESHOLD = max(
    8, int(os.environ.get("REGISSION_AUTO_MOTION_PIXEL_THRESHOLD", "18"))
)
AUTO_MOTION_RATIO_THRESHOLD = min(
    0.25,
    max(
        0.002,
        float(os.environ.get("REGISSION_AUTO_MOTION_RATIO_THRESHOLD", "0.012")),
    ),
)
AUTO_MOTION_REQUIRED_FRAMES = max(
    1, int(os.environ.get("REGISSION_AUTO_MOTION_REQUIRED_FRAMES", "2"))
)
AUTO_MOTION_MAX_AGE_SECONDS = max(
    3.0, float(os.environ.get("REGISSION_AUTO_MOTION_MAX_AGE_SECONDS", "12.0"))
)
AUTO_MOTION_RESET_SECONDS = max(
    1.0, float(os.environ.get("REGISSION_AUTO_MOTION_RESET_SECONDS", "2.0"))
)

# Stable perspective transform. Pixel-based move inference is only reliable
# when the board warp does not jitter between frames.
BOARD_LOCK_MIN_CONF = min(
    0.99, max(0.50, float(os.environ.get("REGISSION_BOARD_LOCK_MIN_CONF", "0.80")))
)
BOARD_LOCK_FRAMES = max(
    3, int(os.environ.get("REGISSION_BOARD_LOCK_FRAMES", "3"))
)
BOARD_LOCK_MAX_SPREAD_PX = max(
    2.0, float(os.environ.get("REGISSION_BOARD_LOCK_MAX_SPREAD_PX", "10.0"))
)

# Visual legal-move engine. YOLO remains responsible for board/piece preview,
# while the actual move is selected from legal python-chess moves using direct
# per-square image change. This prevents a missed YOLO detection on b4 from
# being mistaken for Bxd2 when the player actually castles.
DIFF_SIZE = max(256, int(os.environ.get("REGISSION_DIFF_SIZE", "400")))
WARP_HISTORY_SIZE = max(
    4, int(os.environ.get("REGISSION_WARP_HISTORY_SIZE", "8"))
)
WARP_HISTORY_MAX_AGE_SECONDS = max(
    1.2, float(os.environ.get("REGISSION_WARP_HISTORY_MAX_AGE_SECONDS", "2.8"))
)
WARP_CAPTURE_INTERVAL_SECONDS = max(
    0.06, float(os.environ.get("REGISSION_WARP_CAPTURE_INTERVAL_SECONDS", "0.12"))
)
AUTO_POST_MOTION_STABLE_SECONDS = max(
    1.0, float(os.environ.get("REGISSION_AUTO_POST_MOTION_STABLE_SECONDS", "2.0"))
)
AUTO_IMAGE_SQUARE_THRESHOLD = min(
    0.80, max(0.10, float(os.environ.get("REGISSION_AUTO_IMAGE_SQUARE_THRESHOLD", "0.22")))
)
AUTO_IMAGE_MOVE_SCORE_MIN = min(
    1.50, max(0.20, float(os.environ.get("REGISSION_AUTO_IMAGE_MOVE_SCORE_MIN", "0.48")))
)
AUTO_IMAGE_MOVE_MARGIN = min(
    0.50, max(0.02, float(os.environ.get("REGISSION_AUTO_IMAGE_MOVE_MARGIN", "0.08")))
)
AUTO_IMAGE_CASTLE_MIN_COVERAGE = max(
    3, int(os.environ.get("REGISSION_AUTO_IMAGE_CASTLE_MIN_COVERAGE", "3"))
)

# Absolute visual evidence gates. The previous dynamic-only normalization could
# scale tiny lighting noise to a score near 1.0, allowing an unchanged board to
# look like a legal move. These floors require real per-square pixel change.
AUTO_IMAGE_RAW_GLOBAL_MIN = max(
    0.010, float(os.environ.get("REGISSION_AUTO_IMAGE_RAW_GLOBAL_MIN", "0.040"))
)
AUTO_IMAGE_RAW_SQUARE_MIN = max(
    0.008, float(os.environ.get("REGISSION_AUTO_IMAGE_RAW_SQUARE_MIN", "0.032"))
)
AUTO_IMAGE_PIXEL_RATIO_MIN = min(
    0.50,
    max(
        0.004,
        float(os.environ.get("REGISSION_AUTO_IMAGE_PIXEL_RATIO_MIN", "0.018")),
    ),
)

# If the same authoritative board position and legal UCI are encountered again,
# the deterministic event ID is identical. Laravel/MySQL therefore stores it once.
AUTO_SOURCE_NAME = "rpi_auto_v6_edge_guard"

# If your board is visually flipped, use /flip once while running.
BOARD_FLIPPED = False

LATENCY_DIR = Path("regission_latency")
LATENCY_DIR.mkdir(exist_ok=True)
LATENCY_CSV = LATENCY_DIR / "yolo_latency_log.csv"

app = Flask(__name__)

# ---------- GLOBAL STATE ----------
latest_frame_rgb = None
latest_frame_at = 0.0
latest_raw_bgr = None
latest_full_view_bgr = None
latest_warp_clean_bgr = None
latest_warp_plain_bgr = None
latest_warp_view_bgr = None
latest_warp_gray = None
latest_warp_at = 0.0
latest_detections = []
warp_gray_history = deque(maxlen=WARP_HISTORY_SIZE)

# Board-corner lock used by the perspective transform.
board_corner_history = deque(maxlen=BOARD_LOCK_FRAMES)
locked_board_corners = None
last_board_corner_spread = None

frame_lock = threading.Lock()
output_lock = threading.Lock()
state_lock = threading.Lock()
inference_lock = threading.Lock()
move_detection_lock = threading.Lock()

board = chess.Board()
reference_state = None
last_stable_state_key = None
last_stable_since = 0.0
last_auto_sent_time = 0.0
last_sent_uci = None
last_sent_san = None
last_latency = None

# Latest observed YOLO state is updated by the preview loop. Automatic mode
# reads this snapshot instead of running another full YOLO pass every 0.25 s.
latest_observed_state = {}
latest_observed_at = 0.0
latest_observed_history = deque(maxlen=OBSERVATION_HISTORY_SIZE)

# Automatic move-detection state machine.
auto_visual_baseline = None
auto_phase = "disabled"
auto_candidate_key = None
auto_candidate_state = None
auto_candidate_since = 0.0
auto_candidate_changed_squares = []
auto_last_attempt_at = None
auto_last_result = None
auto_retry_after = 0.0

# Image baseline tied to the authoritative Laravel/python-chess FEN.
reference_image_baseline = None
auto_last_square_scores = {}
auto_last_visual_candidates = []
auto_last_visual_top_squares = []

# Physical camera-motion gate for automatic detection.
auto_motion_armed = False
auto_motion_detected_at = 0.0
auto_motion_last_active_at = 0.0
auto_motion_peak_ratio = 0.0
auto_motion_streak = 0
latest_motion_ratio = 0.0
motion_previous_gray = None

# One physical motion event may be evaluated only once. A new event is created
# only after motion is seen again. This removes the old retry loop that could
# resubmit the same idle board every few seconds.
auto_motion_event_id = 0
auto_last_processed_motion_event_id = 0
last_committed_event_id = None

detection_enabled = False
last_message = "Starting REGISSION YOLO complete system. Assign a game, then sync the physical board."
last_board_conf = 0.0
last_board_detected = False
last_changed_squares = []
sync_required = True
last_assignment_source = "startup"
last_assignment_changed_at = None

# Device heartbeat state. The token itself is never returned by /status.
last_heartbeat_ok = False
last_heartbeat_at = None
last_heartbeat_latency_ms = None
last_heartbeat_error = "Heartbeat has not started."

# ---------- HELPERS ----------

def get_pi_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "192.168.1.22"



def get_active_game_id():
    with state_lock:
        return active_game_id


def require_active_game_id():
    game_id = get_active_game_id()
    if game_id is None:
        raise RuntimeError("No game is assigned to this Raspberry Pi.")
    return game_id


def apply_game_assignment(new_game_id, source="unknown", force_reset=False):
    """Apply one authoritative game assignment safely.

    When the assignment changes, the previous chess state is discarded and
    detection is paused until the user synchronizes the physical board.
    Repeated heartbeats for the same game do not interrupt an active session.
    """
    global active_game_id, board, reference_state, sync_required
    global detection_enabled, AUTO_ENABLED, last_message
    global last_sent_uci, last_sent_san, last_changed_squares
    global last_stable_state_key, last_stable_since, last_auto_sent_time
    global last_assignment_source, last_assignment_changed_at
    global reference_image_baseline

    normalized_game_id = None if new_game_id is None else int(new_game_id)

    with state_lock:
        previous_game_id = active_game_id
        changed = previous_game_id != normalized_game_id

        if not changed and not force_reset:
            return {
                "changed": False,
                "previous_game_id": previous_game_id,
                "active_game_id": previous_game_id,
                "source": source,
            }

        active_game_id = normalized_game_id
        board = chess.Board()
        reference_state = None

    sync_required = True
    detection_enabled = False
    AUTO_ENABLED = False
    last_sent_uci = None
    last_sent_san = None
    last_changed_squares = []
    last_stable_state_key = None
    last_stable_since = 0.0
    last_auto_sent_time = 0.0
    reference_image_baseline = None
    clear_warp_history()
    last_assignment_source = source
    last_assignment_changed_at = time.strftime(
        "%Y-%m-%dT%H:%M:%SZ", time.gmtime()
    )
    reset_auto_tracking("disabled")

    if normalized_game_id is None:
        last_message = (
            "Raspberry Pi game assignment cleared. Detection is paused."
        )
    elif source == "Laravel heartbeat":
        last_message = (
            f"Game {normalized_game_id} restored from Laravel assignment. "
            "Set the physical board to this game, then click Sync Pi Board."
        )
    else:
        last_message = (
            f"Game changed from {previous_game_id} to {normalized_game_id}. "
            "Set the physical board to this game, then click Sync Pi Board."
        )

    return {
        "changed": True,
        "previous_game_id": previous_game_id,
        "active_game_id": normalized_game_id,
        "source": source,
    }


def reconcile_assignment_from_heartbeat(data):
    """Keep the Pi's in-memory assignment aligned with Laravel/MySQL."""
    if not isinstance(data, dict):
        return None

    device = data.get("device")
    if not isinstance(device, dict) or "active_game" not in device:
        return None

    active_game = device.get("active_game")
    backend_game_id = None

    if isinstance(active_game, dict) and active_game.get("id") is not None:
        backend_game_id = int(active_game["id"])

    result = apply_game_assignment(
        backend_game_id,
        source="Laravel heartbeat",
        force_reset=False,
    )

    if result.get("changed"):
        print(
            "[ASSIGNMENT] Laravel/MySQL changed Raspberry Pi game from "
            f"{result.get('previous_game_id')} to {result.get('active_game_id')}. "
            "Sync is required."
        )

    return result


def check_file(path):
    if not os.path.exists(path):
        raise FileNotFoundError(f"Missing model file: {path}")


def api_headers():
    if not API_TOKEN:
        raise RuntimeError(
            "REGISSION_API_TOKEN is not configured. Export it before starting the Pi system."
        )

    return {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_TOKEN}",
    }


def device_api_headers():
    if not DEVICE_TOKEN:
        raise RuntimeError(
            "REGISSION_DEVICE_TOKEN is not configured. Export it before starting the Pi system."
        )

    return {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Device-Token": DEVICE_TOKEN,
    }


def send_device_heartbeat():
    """Send one heartbeat to Laravel and update local heartbeat status.

    The latency sent in the request is the previous heartbeat round-trip time.
    Laravel stores it together with the new last_seen_at timestamp.
    """
    global last_heartbeat_ok, last_heartbeat_at
    global last_heartbeat_latency_ms, last_heartbeat_error

    url = f"{API_BASE}/device-api/heartbeat"
    previous_latency = int(round(last_heartbeat_latency_ms or 0))
    payload = {"latency_ms": previous_latency}

    started = time.perf_counter()
    response = requests.post(
        url,
        headers=device_api_headers(),
        json=payload,
        timeout=HEARTBEAT_TIMEOUT_SECONDS,
    )
    measured_ms = (time.perf_counter() - started) * 1000
    response.raise_for_status()

    # utf-8-sig also accepts normal UTF-8 and safely ignores an accidental BOM.
    data = json.loads(response.content.decode("utf-8-sig"))

    # Laravel/MySQL is the persistent source of truth for the assigned game.
    # This restores the correct assignment automatically after Pi restarts.
    reconcile_assignment_from_heartbeat(data)

    last_heartbeat_ok = True
    last_heartbeat_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    last_heartbeat_latency_ms = round(measured_ms, 2)
    last_heartbeat_error = None
    return data


def heartbeat_loop():
    """Keep the Raspberry Pi online in Laravel while this program is running."""
    global last_heartbeat_ok, last_heartbeat_error

    warned_missing_token = False

    while True:
        if not DEVICE_TOKEN:
            last_heartbeat_ok = False
            last_heartbeat_error = (
                "REGISSION_DEVICE_TOKEN is not configured. "
                "Automatic heartbeat is disabled."
            )
            if not warned_missing_token:
                print(f"[HEARTBEAT WARNING] {last_heartbeat_error}")
                warned_missing_token = True
            time.sleep(HEARTBEAT_INTERVAL_SECONDS)
            continue

        try:
            was_online = last_heartbeat_ok
            result = send_device_heartbeat()
            if not was_online:
                device = result.get("device", {}) if isinstance(result, dict) else {}
                print(
                    "[HEARTBEAT] Connected to Laravel as "
                    f"{device.get('name', 'REGISSION Raspberry Pi')}."
                )
        except Exception as exc:
            if last_heartbeat_ok or last_heartbeat_error != str(exc):
                print(f"[HEARTBEAT ERROR] {exc}")
            last_heartbeat_ok = False
            last_heartbeat_error = str(exc)

        time.sleep(HEARTBEAT_INTERVAL_SECONDS)


def order_points(pts):
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]      # top-left
    rect[2] = pts[np.argmax(s)]      # bottom-right
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]   # top-right
    rect[3] = pts[np.argmax(diff)]   # bottom-left
    return rect


def corners_from_mask(mask_xy):
    contour = np.array(mask_xy, dtype=np.float32)
    rect = cv2.minAreaRect(contour)
    box = cv2.boxPoints(rect)
    return order_points(np.array(box, dtype=np.float32))


def unlock_board_corners():
    global locked_board_corners, last_board_corner_spread
    with output_lock:
        locked_board_corners = None
        last_board_corner_spread = None
        board_corner_history.clear()


def stabilize_board_corners(detected_corners, confidence):
    """Return a fixed board quadrilateral after several consistent masks."""
    global locked_board_corners, last_board_corner_spread

    detected = np.array(detected_corners, dtype=np.float32)

    with output_lock:
        if locked_board_corners is not None:
            return locked_board_corners.copy()

        if confidence >= BOARD_LOCK_MIN_CONF:
            board_corner_history.append(detected.copy())

        if not board_corner_history:
            return detected

        stack = np.stack(list(board_corner_history), axis=0)
        median_corners = np.median(stack, axis=0).astype(np.float32)
        spread = float(
            np.max(np.linalg.norm(stack - median_corners[None, :, :], axis=2))
        )
        last_board_corner_spread = round(spread, 2)

        if (
            len(board_corner_history) >= BOARD_LOCK_FRAMES
            and spread <= BOARD_LOCK_MAX_SPREAD_PX
        ):
            locked_board_corners = median_corners.copy()
            print(
                "[BOARD LOCK] Perspective corners locked with "
                f"spread {spread:.2f}px."
            )
            return locked_board_corners.copy()

        # Median smoothing is used while enough samples are collected.
        return median_corners


def clear_warp_history():
    with output_lock:
        warp_gray_history.clear()


def prepare_warp_gray(warp_bgr):
    """Normalize a clean warp for robust per-square visual comparison."""
    if warp_bgr is None:
        return None

    gray = cv2.cvtColor(warp_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.resize(gray, (DIFF_SIZE, DIFF_SIZE), interpolation=cv2.INTER_AREA)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)

    # CLAHE reduces the influence of the board's uneven glare while preserving
    # piece silhouettes and bases.
    clahe = cv2.createCLAHE(clipLimit=1.6, tileGridSize=(8, 8))
    return clahe.apply(gray)


def snapshot_warp_median(min_frames=1, max_age=None, after_timestamp=0.0):
    now = time.time()
    age_limit = WARP_HISTORY_MAX_AGE_SECONDS if max_age is None else max_age

    with output_lock:
        frames = [
            frame.copy()
            for ts, frame in list(warp_gray_history)
            if (now - ts) <= age_limit and ts >= after_timestamp
        ]
        fallback = None if latest_warp_gray is None else latest_warp_gray.copy()
        fallback_at = latest_warp_at

    if len(frames) < min_frames:
        if (
            fallback is None
            or fallback_at <= 0
            or (now - fallback_at) > age_limit
            or fallback_at < after_timestamp
        ):
            return None, len(frames)
        return fallback, len(frames)

    median = np.median(np.stack(frames, axis=0), axis=0).astype(np.uint8)
    return median, len(frames)


def image_cell_for_square(square_name):
    file_index = ord(square_name[0]) - ord("a")
    rank_index = 8 - int(square_name[1])

    if BOARD_FLIPPED:
        file_index = 7 - file_index
        rank_index = 7 - rank_index

    return rank_index, file_index


def calculate_square_difference_scores(baseline_gray, current_gray):
    """Return normalized and absolute visual-change evidence for all squares.

    Dynamic ranking is useful for selecting candidate squares, but it must never
    be the only acceptance signal: a tiny amount of lighting noise can otherwise
    become the strongest square after normalization. Absolute raw and changed-
    pixel-ratio evidence is therefore returned and checked by the legal matcher.
    """
    if baseline_gray is None or current_gray is None:
        return {}, {
            "threshold_raw": None,
            "absolute_floor": None,
            "median_raw": None,
            "mad_raw": None,
            "max_raw": None,
            "global_changed_pixel_ratio": 0.0,
            "raw_scores": {},
            "pixel_ratios": {},
            "top_squares": [],
        }

    baseline = baseline_gray.astype(np.float32)
    current = current_gray.astype(np.float32)

    # Remove one global brightness shift before absolute difference.
    signed = current - baseline
    signed -= float(np.median(signed))
    intensity_delta = np.abs(signed)

    base_edge = cv2.Laplacian(baseline, cv2.CV_32F, ksize=3)
    current_edge = cv2.Laplacian(current, cv2.CV_32F, ksize=3)
    edge_delta = np.abs(current_edge - base_edge)

    cell = DIFF_SIZE / 8.0
    raw_scores = {}
    pixel_ratios = {}

    for square_name in chess.SQUARE_NAMES:
        row, col = image_cell_for_square(square_name)
        x1 = int(col * cell)
        y1 = int(row * cell)
        x2 = int((col + 1) * cell)
        y2 = int((row + 1) * cell)

        # Ignore a narrow border where grid/corner jitter has the largest effect.
        margin = max(2, int(cell * 0.08))
        crop_i = intensity_delta[y1 + margin:y2 - margin, x1 + margin:x2 - margin]
        crop_e = edge_delta[y1 + margin:y2 - margin, x1 + margin:x2 - margin]

        if crop_i.size == 0:
            raw_scores[square_name] = 0.0
            pixel_ratios[square_name] = 0.0
            continue

        mean_change = float(np.mean(crop_i)) / 255.0
        upper_change = float(np.percentile(crop_i, 85)) / 255.0
        edge_change = min(1.0, float(np.mean(crop_e)) / 90.0)
        changed_ratio = float(
            np.count_nonzero(crop_i >= AUTO_MOTION_PIXEL_THRESHOLD)
        ) / float(crop_i.size)

        raw_scores[square_name] = (
            0.42 * mean_change
            + 0.38 * upper_change
            + 0.20 * edge_change
        )
        pixel_ratios[square_name] = changed_ratio

    values = np.array(list(raw_scores.values()), dtype=np.float32)
    median_raw = float(np.median(values))
    mad_raw = float(np.median(np.abs(values - median_raw)))
    threshold_raw = median_raw + max(0.012, 3.2 * mad_raw)
    absolute_floor = max(AUTO_IMAGE_RAW_SQUARE_MIN, threshold_raw + 0.006)
    upper_reference = float(np.percentile(values, 92))
    scale = max(0.025, upper_reference - threshold_raw)

    normalized = {
        square_name: float(
            np.clip((raw - threshold_raw) / scale, 0.0, 1.0)
        )
        for square_name, raw in raw_scores.items()
    }

    ordered = sorted(
        normalized,
        key=lambda square: (
            normalized[square],
            raw_scores[square],
            pixel_ratios[square],
        ),
        reverse=True,
    )
    global_changed_pixel_ratio = float(
        np.count_nonzero(intensity_delta >= AUTO_MOTION_PIXEL_THRESHOLD)
    ) / float(intensity_delta.size)

    return normalized, {
        "threshold_raw": round(threshold_raw, 5),
        "absolute_floor": round(absolute_floor, 5),
        "median_raw": round(median_raw, 5),
        "mad_raw": round(mad_raw, 5),
        "max_raw": round(float(np.max(values)), 5),
        "global_changed_pixel_ratio": round(global_changed_pixel_ratio, 5),
        "raw_scores": raw_scores,
        "pixel_ratios": pixel_ratios,
        "top_squares": [
            {
                "square": square,
                "score": round(normalized[square], 3),
                "raw": round(raw_scores[square], 4),
                "pixel_ratio": round(pixel_ratios[square], 4),
            }
            for square in ordered[:10]
        ],
    }


def visual_changed_squares_for_move(board_position, move):
    """Squares whose pixels should visibly change for one legal move."""
    squares = {
        chess.square_name(move.from_square),
        chess.square_name(move.to_square),
    }

    if board_position.is_castling(move):
        rank = "1" if board_position.turn == chess.WHITE else "8"
        kingside = chess.square_file(move.to_square) > chess.square_file(move.from_square)
        squares.add(("h" if kingside else "a") + rank)
        squares.add(("f" if kingside else "d") + rank)

    if board_position.is_en_passant(move):
        captured_square = (
            move.to_square - 8
            if board_position.turn == chess.WHITE
            else move.to_square + 8
        )
        squares.add(chess.square_name(captured_square))

    return sorted(squares)


def choose_best_legal_move_from_images(
    before_board,
    baseline_gray,
    current_gray,
    observed_state=None,
):
    """Select exactly one legal move from absolute and ranked image evidence."""
    square_scores, diff_meta = calculate_square_difference_scores(
        baseline_gray,
        current_gray,
    )

    if not square_scores:
        return None, [], diff_meta

    raw_scores = diff_meta.get("raw_scores", {})
    pixel_ratios = diff_meta.get("pixel_ratios", {})
    absolute_floor = max(
        AUTO_IMAGE_RAW_SQUARE_MIN,
        float(diff_meta.get("absolute_floor") or AUTO_IMAGE_RAW_SQUARE_MIN),
    )
    max_raw = float(diff_meta.get("max_raw") or 0.0)

    # Hard no-change gate. Dynamic normalization is intentionally ignored here.
    if max_raw < AUTO_IMAGE_RAW_GLOBAL_MIN:
        diff_meta["rejection"] = "absolute_board_change_below_minimum"
        return None, [], diff_meta

    ordered_squares = sorted(
        square_scores,
        key=lambda square: (
            square_scores[square],
            raw_scores.get(square, 0.0),
            pixel_ratios.get(square, 0.0),
        ),
        reverse=True,
    )
    ranks = {square: index for index, square in enumerate(ordered_squares)}
    observed_state = observed_state or {}
    candidates = []

    for move in list(before_board.legal_moves):
        temp = before_board.copy()
        san = temp.san(move)
        is_castling = temp.is_castling(move)
        is_en_passant = temp.is_en_passant(move)
        visual_squares = visual_changed_squares_for_move(temp, move)
        temp.push(move)
        expected_after = state_from_board(temp)

        values = [square_scores.get(square, 0.0) for square in visual_squares]
        raw_values = [raw_scores.get(square, 0.0) for square in visual_squares]
        pixel_values = [pixel_ratios.get(square, 0.0) for square in visual_squares]

        ranked_coverage = sum(
            value >= AUTO_IMAGE_SQUARE_THRESHOLD for value in values
        )
        absolute_coverage = sum(
            raw >= absolute_floor and pixels >= AUTO_IMAGE_PIXEL_RATIO_MIN
            for raw, pixels in zip(raw_values, pixel_values)
        )
        coverage = min(ranked_coverage, absolute_coverage)

        mean_expected = float(np.mean(values)) if values else 0.0
        min_expected = min(values) if values else 0.0
        raw_strength = (
            float(np.mean([
                min(1.0, raw / max(absolute_floor, 1e-6))
                for raw in raw_values
            ]))
            if raw_values
            else 0.0
        )
        pixel_strength = (
            float(np.mean([
                min(1.0, ratio / max(AUTO_IMAGE_PIXEL_RATIO_MIN, 1e-6))
                for ratio in pixel_values
            ]))
            if pixel_values
            else 0.0
        )

        rank_bonus_values = [
            max(0.0, (10.0 - float(ranks.get(square, 64))) / 10.0)
            for square in visual_squares
        ]
        rank_bonus = (
            float(np.mean(rank_bonus_values))
            if rank_bonus_values
            else 0.0
        )

        unexpected = [
            square_scores[square]
            for square in ordered_squares[:8]
            if square not in visual_squares
            and raw_scores.get(square, 0.0) >= absolute_floor
        ]
        unexpected_penalty = (
            float(np.mean([max(0.0, value - 0.40) for value in unexpected[:4]]))
            if unexpected
            else 0.0
        )

        occupancy_matches = 0
        occupancy_total = 0
        for square in visual_squares:
            observed_occupied = square in observed_state
            expected_occupied = square in expected_after
            occupancy_total += 1
            if observed_occupied == expected_occupied:
                occupancy_matches += 1

        occupancy_ratio = (
            occupancy_matches / occupancy_total
            if occupancy_total
            else 0.0
        )

        score = (
            0.38 * mean_expected
            + 0.14 * min_expected
            + 0.16 * rank_bonus
            + 0.14 * raw_strength
            + 0.10 * pixel_strength
            + 0.12 * occupancy_ratio
            - 0.18 * unexpected_penalty
        )

        top_six_overlap = len(set(visual_squares) & set(ordered_squares[:6]))
        if is_castling:
            # Castling is accepted only with three strong absolute square changes
            # and a legal python-chess castle in the authoritative FEN.
            if absolute_coverage >= AUTO_IMAGE_CASTLE_MIN_COVERAGE:
                score += 0.34
            if top_six_overlap >= 3:
                score += 0.18
            if occupancy_matches >= 3:
                score += 0.14

        if is_en_passant and absolute_coverage >= 2:
            score += 0.08

        required_coverage = 2
        if is_castling:
            required_coverage = AUTO_IMAGE_CASTLE_MIN_COVERAGE
        elif is_en_passant:
            required_coverage = 2

        candidates.append({
            "move": move,
            "san": san,
            "uci": move.uci(),
            "score": round(float(score), 4),
            "coverage": coverage,
            "ranked_coverage": ranked_coverage,
            "absolute_coverage": absolute_coverage,
            "required_coverage": required_coverage,
            "visual_squares": visual_squares,
            "visual_scores": {
                square: round(square_scores.get(square, 0.0), 3)
                for square in visual_squares
            },
            "raw_scores": {
                square: round(raw_scores.get(square, 0.0), 4)
                for square in visual_squares
            },
            "pixel_ratios": {
                square: round(pixel_ratios.get(square, 0.0), 4)
                for square in visual_squares
            },
            "top_six_overlap": top_six_overlap,
            "is_castling": is_castling,
            "is_en_passant": is_en_passant,
            "occupancy_matches": occupancy_matches,
            "occupancy_ratio": round(occupancy_ratio, 3),
        })

    candidates.sort(
        key=lambda item: (
            item["score"],
            item["absolute_coverage"],
            item["coverage"],
            1 if item["is_castling"] else 0,
        ),
        reverse=True,
    )

    if not candidates:
        return None, [], diff_meta

    # A legal castle with three strong absolute castle squares must beat a
    # two-square false candidate such as Bxd2+.
    castling_override = None
    for item in candidates:
        if (
            item["is_castling"]
            and item["absolute_coverage"] >= AUTO_IMAGE_CASTLE_MIN_COVERAGE
            and item["top_six_overlap"] >= 3
            and item["occupancy_matches"] >= 3
            and item["score"] >= (AUTO_IMAGE_MOVE_SCORE_MIN - 0.10)
            and item["score"] >= (candidates[0]["score"] - 0.14)
        ):
            castling_override = item
            break

    if castling_override is not None:
        candidates.remove(castling_override)
        candidates.insert(0, castling_override)
        castling_override["castling_override"] = True

    best = candidates[0]
    second_score = candidates[1]["score"] if len(candidates) > 1 else -1.0
    margin = float(best["score"] - second_score)
    best["margin"] = round(margin, 4)

    strong_castle = (
        best["is_castling"]
        and best["absolute_coverage"] >= AUTO_IMAGE_CASTLE_MIN_COVERAGE
        and best["top_six_overlap"] >= 3
        and best["occupancy_matches"] >= 3
        and best["score"] >= (AUTO_IMAGE_MOVE_SCORE_MIN - 0.10)
        and (margin >= 0.02 or bool(best.get("castling_override")))
    )

    accepted = (
        best["coverage"] >= best["required_coverage"]
        and best["absolute_coverage"] >= best["required_coverage"]
        and best["score"] >= AUTO_IMAGE_MOVE_SCORE_MIN
        and margin >= AUTO_IMAGE_MOVE_MARGIN
    ) or strong_castle

    if not accepted:
        diff_meta["rejection"] = "candidate_failed_absolute_or_margin_gate"
        return None, candidates[:6], diff_meta

    return best, candidates[:6], diff_meta


def flip_square(square):
    # rotate board 180 degrees if needed
    files = "abcdefgh"
    file_char = square[0]
    rank_char = square[1]
    f = files.index(file_char)
    r = int(rank_char) - 1
    return f"{files[7 - f]}{8 - r}"


def draw_grid(img):
    h, w = img.shape[:2]
    for i in range(9):
        x = int(i * w / 8)
        y = int(i * h / 8)
        cv2.line(img, (x, 0), (x, h), (0, 255, 0), 1)
        cv2.line(img, (0, y), (w, y), (0, 255, 0), 1)

    files = ["a", "b", "c", "d", "e", "f", "g", "h"]
    for r in range(8):
        for c in range(8):
            square = f"{files[c]}{8-r}"
            if BOARD_FLIPPED:
                square = flip_square(square)
            cv2.putText(
                img,
                square,
                (int(c*w/8)+5, int(r*h/8)+18),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45,
                (0, 255, 0),
                1,
                cv2.LINE_AA,
            )
    return img


def piece_label_from_chess_piece(piece):
    if piece is None:
        return None
    color = "w" if piece.color == chess.WHITE else "b"
    m = {
        chess.PAWN: "p",
        chess.KNIGHT: "n",
        chess.BISHOP: "b",
        chess.ROOK: "r",
        chess.QUEEN: "q",
        chess.KING: "k",
    }
    return color + m[piece.piece_type]


def state_from_board(chess_board):
    state = {}
    for sq in chess.SQUARES:
        piece = chess_board.piece_at(sq)
        if piece is not None:
            state[chess.square_name(sq)] = piece_label_from_chess_piece(piece)
    return state


def state_key(state):
    return json.dumps(sorted(state.items()))


def occupancy_key(state):
    """Stable key that ignores YOLO class-label mistakes and uses occupancy only."""
    return json.dumps(sorted(state.keys()))


def clear_observation_history():
    with output_lock:
        latest_observed_history.clear()


def reset_auto_motion():
    global auto_motion_armed, auto_motion_detected_at
    global auto_motion_last_active_at
    global auto_motion_peak_ratio, auto_motion_streak
    auto_motion_armed = False
    auto_motion_detected_at = 0.0
    auto_motion_last_active_at = 0.0
    auto_motion_peak_ratio = 0.0
    auto_motion_streak = 0


def snapshot_auto_motion():
    return {
        "armed": bool(auto_motion_armed),
        "detected_at": (
            time.strftime(
                "%Y-%m-%dT%H:%M:%SZ",
                time.gmtime(auto_motion_detected_at),
            )
            if auto_motion_detected_at > 0
            else None
        ),
        "age_seconds": (
            round(max(0.0, time.time() - auto_motion_detected_at), 2)
            if auto_motion_detected_at > 0
            else None
        ),
        "latest_ratio": round(float(latest_motion_ratio), 4),
        "last_active_age_seconds": (
            round(max(0.0, time.time() - auto_motion_last_active_at), 2)
            if auto_motion_last_active_at > 0
            else None
        ),
        "peak_ratio": round(float(auto_motion_peak_ratio), 4),
        "ratio_threshold": AUTO_MOTION_RATIO_THRESHOLD,
        "pixel_threshold": AUTO_MOTION_PIXEL_THRESHOLD,
        "required_frames": AUTO_MOTION_REQUIRED_FRAMES,
        "event_id": auto_motion_event_id,
        "last_processed_event_id": auto_last_processed_motion_event_id,
    }


def snapshot_latest_observed_state():
    with output_lock:
        return latest_observed_state.copy(), latest_observed_at


def snapshot_consensus_observed_state():
    """Return a multi-frame occupancy consensus.

    A square is occupied when it appears in enough recent YOLO frames. The
    label is selected by majority vote, but legal move validation still
    prioritizes occupied/empty state.
    """
    now = time.time()

    with output_lock:
        samples = [
            (ts, state.copy())
            for ts, state in list(latest_observed_history)
            if (now - ts) <= OBSERVATION_HISTORY_MAX_AGE_SECONDS
        ]
        fallback_state = latest_observed_state.copy()
        fallback_at = latest_observed_at

    if not samples:
        return fallback_state, fallback_at, 0

    sample_count = len(samples)
    required_votes = max(1, int(np.ceil(sample_count * OBSERVATION_MIN_RATIO)))
    square_votes = Counter()
    label_votes = {}

    for _, state in samples:
        for square, label in state.items():
            square_votes[square] += 1
            label_votes.setdefault(square, Counter())[label] += 1

    consensus = {}
    for square, votes in square_votes.items():
        if votes >= required_votes:
            consensus[square] = label_votes[square].most_common(1)[0][0]

    newest_at = max(ts for ts, _ in samples)
    return consensus, newest_at, sample_count


def reset_auto_tracking(phase="disabled"):
    global auto_visual_baseline, auto_phase
    global auto_candidate_key, auto_candidate_state, auto_candidate_since
    global auto_candidate_changed_squares, auto_last_attempt_at
    global auto_last_result, auto_retry_after
    global last_stable_state_key, last_stable_since
    global auto_last_square_scores, auto_last_visual_candidates
    global auto_last_visual_top_squares
    global auto_motion_event_id, auto_last_processed_motion_event_id
    global last_committed_event_id

    auto_visual_baseline = None
    auto_phase = phase
    auto_candidate_key = None
    auto_candidate_state = None
    auto_candidate_since = 0.0
    auto_candidate_changed_squares = []
    auto_last_attempt_at = None
    auto_last_result = None
    auto_retry_after = 0.0
    auto_last_square_scores = {}
    auto_last_visual_candidates = []
    auto_last_visual_top_squares = []
    last_stable_state_key = None
    last_stable_since = 0.0
    auto_motion_event_id = 0
    auto_last_processed_motion_event_id = 0
    last_committed_event_id = None
    clear_observation_history()
    reset_auto_motion()


def clear_auto_candidate():
    global auto_candidate_key, auto_candidate_state, auto_candidate_since
    global auto_candidate_changed_squares
    auto_candidate_key = None
    auto_candidate_state = None
    auto_candidate_since = 0.0
    auto_candidate_changed_squares = []


def changed_squares_between(a, b):
    squares = sorted(set(a.keys()) | set(b.keys()))
    return [sq for sq in squares if a.get(sq) != b.get(sq)]


def changed_squares_by_occupancy(a, b):
    """Return squares where occupied/empty changed, ignoring wrong YOLO class labels.
    This prevents wp being mistaken as wr/wq, or bp being mistaken as bb, from breaking move detection.
    """
    squares = sorted(set(a.keys()) | set(b.keys()))
    return [sq for sq in squares if (sq in a) != (sq in b)]


def has_piece(state, sq):
    return sq in state and state.get(sq) is not None


def legal_castling_signatures(board_position=None):
    """Return legal castling moves and their four-square occupancy signatures."""
    if board_position is None:
        with state_lock:
            board_position = board.copy()
    else:
        board_position = board_position.copy()

    before_state = state_from_board(board_position)
    signatures = []

    for move in list(board_position.legal_moves):
        if not board_position.is_castling(move):
            continue

        san = board_position.san(move)
        temp = board_position.copy()
        temp.push(move)
        expected_after = state_from_board(temp)
        expected_changed = sorted(
            changed_squares_by_occupancy(before_state, expected_after)
        )

        rank = "1" if board_position.turn == chess.WHITE else "8"
        kingside = (
            chess.square_file(move.to_square)
            > chess.square_file(move.from_square)
        )
        rook_from = ("h" if kingside else "a") + rank
        rook_to = ("f" if kingside else "d") + rank

        signatures.append({
            "move": move,
            "san": san,
            "uci": move.uci(),
            "king_from": chess.square_name(move.from_square),
            "king_to": chess.square_name(move.to_square),
            "rook_from": rook_from,
            "rook_to": rook_to,
            "expected_changed": expected_changed,
            "expected_after": expected_after,
        })

    return signatures


def castling_change_context(changed_squares, observed_state):
    """Identify a possible in-progress castle.

    A player normally moves the king first and the rook second. Without this
    guard, the temporary position can be saved as an ordinary king move before
    the rook reaches its final square.
    """
    changed_set = set(changed_squares)
    if not changed_set:
        return None

    contexts = []
    for signature in legal_castling_signatures():
        zone = set(signature["expected_changed"])
        overlap = sorted(changed_set & zone)
        if not overlap:
            continue

        expected_after = signature["expected_after"]
        matched_after = sum(
            1
            for square in zone
            if has_piece(expected_after, square)
            == has_piece(observed_state, square)
        )

        contexts.append({
            **signature,
            "overlap": overlap,
            "matched_after": matched_after,
            "complete_visual_signature": matched_after == len(zone),
        })

    if not contexts:
        return None

    contexts.sort(
        key=lambda item: (
            item["complete_visual_signature"],
            item["matched_after"],
            len(item["overlap"]),
        ),
        reverse=True,
    )
    return contexts[0]


def find_legal_occupancy_match(changed_squares):
    """Check whether a stable visual change resembles at least one legal move.

    Normal moves usually change two occupied/empty squares, captures can change
    only one, en passant changes three, and castling changes four. A small number
    of extra squares is allowed because YOLO can temporarily miss an unchanged
    piece under glare.
    """
    with state_lock:
        current_board = board.copy()

    before_state = state_from_board(current_board)
    observed_set = set(changed_squares)
    candidates = []

    for move in current_board.legal_moves:
        temp = current_board.copy()
        san = temp.san(move)
        temp.push(move)
        expected_after = state_from_board(temp)
        expected_changed = set(
            changed_squares_by_occupancy(before_state, expected_after)
        )
        missing = sorted(expected_changed - observed_set)
        extras = sorted(observed_set - expected_changed)

        candidates.append({
            "san": san,
            "uci": move.uci(),
            "is_castling": current_board.is_castling(move),
            "expected_changed": sorted(expected_changed),
            "missing": missing,
            "extras": extras,
            "distance": len(missing) + len(extras),
        })

    candidates.sort(
        key=lambda item: (
            len(item["missing"]),
            len(item["extras"]),
            item["distance"],
            0 if item["is_castling"] else 1,
        )
    )

    if not candidates:
        return False, None

    best = candidates[0]
    accepted = (
        len(best["missing"]) <= 1
        and len(best["extras"]) <= AUTO_MAX_EXTRA_CHANGED_SQUARES
    )
    return accepted, best


def log_latency(record):
    exists = LATENCY_CSV.exists()
    with open(LATENCY_CSV, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(record.keys()))
        if not exists:
            writer.writeheader()
        writer.writerow(record)

# ---------- MODEL LOAD ----------
print("[INFO] Checking model files...")
check_file(BOARD_MODEL_PATH)
check_file(PIECE_MODEL_PATH)

print("[INFO] Loading board segmentation model...")
board_model = YOLO(BOARD_MODEL_PATH)

print("[INFO] Loading piece detection model...")
piece_model = YOLO(PIECE_MODEL_PATH)

# ---------- CAMERA ----------
print("[INFO] Starting Raspberry Pi camera...")
picam2 = Picamera2()
config = picam2.create_preview_configuration(
    main={"size": (FRAME_WIDTH, FRAME_HEIGHT), "format": "RGB888"}
)
picam2.configure(config)
picam2.start()
time.sleep(2)

# ---------- DETECTION CORE ----------

def detect_current_state(make_views=True):
    """Capture the latest frame, detect board mask, warp it, detect pieces, return state."""
    global latest_raw_bgr, latest_full_view_bgr, latest_warp_clean_bgr
    global latest_frame_at
    global latest_warp_plain_bgr, latest_warp_view_bgr
    global latest_warp_gray, latest_warp_at
    global latest_detections, latest_observed_state, latest_observed_at
    global last_board_conf, last_board_detected, last_message

    with frame_lock:
        if latest_frame_rgb is None:
            raise RuntimeError("No camera frame yet.")
        frame_rgb = latest_frame_rgb.copy()
        frame_timestamp = float(latest_frame_at or time.time())

    frame_bgr = cv2.cvtColor(frame_rgb, cv2.COLOR_RGB2BGR)
    full_view = frame_bgr.copy()

    with output_lock:
        locked_snapshot = (
            None
            if locked_board_corners is None
            else locked_board_corners.copy()
        )

    if locked_snapshot is None:
        with inference_lock:
            board_result = board_model.predict(
                source=frame_rgb,
                imgsz=IMG_SIZE,
                conf=BOARD_CONF,
                max_det=1,
                verbose=False,
            )[0]
    else:
        board_result = None

    mask_available = bool(
        board_result is not None
        and board_result.masks is not None
        and len(board_result.masks.xy) > 0
    )

    board_conf = float(last_board_conf or 0.0)
    if (
        board_result is not None
        and board_result.boxes is not None
        and len(board_result.boxes) > 0
    ):
        board_conf = float(board_result.boxes.conf[0])

    if mask_available:
        mask_xy = board_result.masks.xy[0]
        detected_corners = corners_from_mask(mask_xy)
        corners = stabilize_board_corners(detected_corners, board_conf)
    else:
        mask_xy = None
        with output_lock:
            fallback_corners = (
                None
                if locked_board_corners is None
                else locked_board_corners.copy()
            )

        if fallback_corners is None:
            if make_views:
                cv2.putText(full_view, "NO BOARD MASK DETECTED", (30, 40),
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
                blank = np.zeros((WARP_SIZE, WARP_SIZE, 3), dtype=np.uint8)
                cv2.putText(blank, "NO WARPED BOARD", (160, WARP_SIZE//2),
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
                with output_lock:
                    latest_raw_bgr = frame_bgr
                    latest_full_view_bgr = full_view
                    latest_warp_clean_bgr = blank.copy()
                    latest_warp_view_bgr = blank
                    latest_detections = []
            last_board_detected = False
            last_board_conf = 0.0
            last_message = "No board mask detected and no locked board perspective exists."
            return {}, []

        # Once the board is locked, a temporary segmentation miss must not move
        # or destroy the perspective transform used by the visual move engine.
        corners = fallback_corners
        board_conf = float(last_board_conf or 0.0)

    # Draw full view with original color + transparent mask and corner markers
    if make_views:
        if mask_xy is not None:
            polygon = np.array(mask_xy, dtype=np.int32)
            overlay = full_view.copy()
            cv2.fillPoly(overlay, [polygon], (255, 0, 0))
            full_view = cv2.addWeighted(overlay, 0.25, full_view, 0.75, 0)
        cv2.polylines(full_view, [corners.astype(int)], True, (0, 255, 255), 3)
        for label, point in zip(["TL", "TR", "BR", "BL"], corners):
            x, y = point.astype(int)
            cv2.circle(full_view, (x, y), 8, (0, 0, 255), -1)
            cv2.putText(full_view, label, (x+8, y-8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        cv2.putText(full_view, f"BOARD SEG LOCK {board_conf:.2f}", (30, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

    dst = np.array([
        [0, 0],
        [WARP_SIZE - 1, 0],
        [WARP_SIZE - 1, WARP_SIZE - 1],
        [0, WARP_SIZE - 1],
    ], dtype=np.float32)

    M = cv2.getPerspectiveTransform(corners, dst)
    warped_rgb = cv2.warpPerspective(frame_rgb, M, (WARP_SIZE, WARP_SIZE))
    warped_bgr_clean = cv2.cvtColor(warped_rgb, cv2.COLOR_RGB2BGR)
    warped_bgr = warped_bgr_clean.copy()
    prepared_warp_gray = prepare_warp_gray(warped_bgr_clean)

    with inference_lock:
        piece_result = piece_model.predict(
            source=warped_rgb,
            imgsz=IMG_SIZE,
            conf=PIECE_CONF,
            iou=0.30,
            agnostic_nms=True,
            max_det=32,
            verbose=False,
        )[0]

    files = ["a", "b", "c", "d", "e", "f", "g", "h"]
    raw_detections = []

    if piece_result.boxes is not None:
        for box in piece_result.boxes:
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            label = str(piece_model.names[cls_id])

            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
            x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)

            # Use the bottom-centre of the chess piece for square mapping.
            # This is more accurate than the box centre because the base of the piece sits on the square.
            cx = (x1 + x2) / 2
            piece_h = max(1, y2 - y1)
            cy = y2 - (0.08 * piece_h)

            file_idx = max(0, min(7, int(cx / (WARP_SIZE / 8))))
            rank_idx = max(0, min(7, int(cy / (WARP_SIZE / 8))))
            square = f"{files[file_idx]}{8-rank_idx}"
            if BOARD_FLIPPED:
                square = flip_square(square)

            raw_detections.append({
                "label": label,
                "confidence": round(conf, 3),
                "square": square,
                "box": [x1, y1, x2, y2],
                "base_point": [round(cx, 1), round(cy, 1)],
            })

    # Keep only one highest-confidence piece per square.
    # This removes duplicate labels on the same physical piece/square.
    best_by_square = {}
    for det in raw_detections:
        sq = det["square"]
        if sq not in best_by_square or det["confidence"] > best_by_square[sq]["confidence"]:
            best_by_square[sq] = det

    detections = list(best_by_square.values())

    # FEN-assisted display correction.
    # YOLO may confuse wp/wr/wq or bp/bb under glare, but the current chess board already
    # knows which piece should be on unchanged squares. We keep the raw YOLO label in
    # yolo_label, and show display_label for cleaner user display.
    with state_lock:
        expected_display_state = state_from_board(board)

    for det in detections:
        sq = det["square"]
        raw_label = det["label"]
        det["yolo_label"] = raw_label
        det["display_label"] = expected_display_state.get(sq, raw_label)

    # Keep observed YOLO labels for debugging, but the move validator below uses occupancy,
    # so wrong piece class labels do not block move detection.
    current_state = {det["square"]: det["label"] for det in detections}

    # Publish one lightweight snapshot for the automatic state machine.
    observed_timestamp = frame_timestamp
    with output_lock:
        # Never let a slow inference result move the shared camera timeline
        # backwards. The lightweight locked-warp loop may already have
        # published newer frames while YOLO was running.
        if observed_timestamp >= latest_observed_at:
            latest_observed_state = current_state.copy()
            latest_observed_at = observed_timestamp
            latest_observed_history.append(
                (observed_timestamp, current_state.copy())
            )

        if observed_timestamp > latest_warp_at:
            latest_warp_plain_bgr = warped_bgr_clean.copy()
            latest_warp_gray = prepared_warp_gray.copy()
            latest_warp_at = observed_timestamp
            warp_gray_history.append(
                (observed_timestamp, prepared_warp_gray.copy())
            )

    if make_views:
        # Draw only filtered detections, so duplicate labels on the same square are removed.
        for det in detections:
            label = det.get("display_label", det["label"])
            raw_label = det.get("yolo_label", det["label"])
            conf = det["confidence"]
            square = det["square"]
            x1, y1, x2, y2 = det["box"]
            cv2.rectangle(warped_bgr, (x1, y1), (x2, y2), (0, 255, 255), 2)
            # User display uses corrected FEN-assisted label.
            # Raw YOLO label is still available in /detections as yolo_label.
            text_label = f"{label} {conf:.2f} {square}"
            cv2.putText(warped_bgr, text_label,
                        (x1, max(20, y1-8)), cv2.FONT_HERSHEY_SIMPLEX,
                        0.55, (0, 255, 255), 2)

        warped_bgr = draw_grid(warped_bgr)
        clean_grid = draw_grid(warped_bgr_clean.copy())
        cv2.putText(warped_bgr, f"PIECES DETECTED: {len(current_state)}", (20, WARP_SIZE-20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
        with output_lock:
            latest_raw_bgr = frame_bgr
            latest_full_view_bgr = full_view
            latest_warp_clean_bgr = clean_grid
            latest_warp_view_bgr = warped_bgr
            latest_detections = detections

    last_board_detected = True
    last_board_conf = round(board_conf, 3)
    return current_state, detections


def choose_best_legal_move(before_board, observed_state, ref_state):
    """Compare observed YOLO state against every legal move using occupancy first.

    Important: YOLO sometimes confuses similar pieces under glare (wp vs wr/wq, bp vs bb).
    Move detection should therefore trust occupied/empty squares more than exact YOLO labels.
    python-chess still decides the actual legal piece and SAN, including castling and en passant.
    """
    before_state = state_from_board(before_board)
    reference = ref_state or before_state
    changed_obs = changed_squares_by_occupancy(reference, observed_state)

    candidates = []
    for move in before_board.legal_moves:
        is_castling = before_board.is_castling(move)
        temp = before_board.copy()
        san = temp.san(move)
        temp.push(move)
        expected_after = state_from_board(temp)
        expected_changed = changed_squares_by_occupancy(before_state, expected_after)

        score = 0.0
        matched = 0
        label_bonus = 0
        details = []

        # Main evidence: expected changed squares should have the correct occupied/empty status.
        for sq in expected_changed:
            exp_occ = has_piece(expected_after, sq)
            obs_occ = has_piece(observed_state, sq)
            exp_label = expected_after.get(sq)
            obs_label = observed_state.get(sq)

            if exp_occ == obs_occ:
                score += 5.0
                matched += 1
            else:
                score -= 6.0

            # Small bonus only. Do not depend strongly on class label because lighting can confuse pieces.
            if exp_label is not None and obs_label == exp_label:
                score += 1.0
                label_bonus += 1

            details.append((sq, exp_label, obs_label, exp_occ, obs_occ))

        # Extra occupancy differences can be caused by unstable YOLO detections on
        # unchanged pieces. Keep a small penalty, but do not let unrelated missed
        # pieces overpower the two squares that define a normal legal move.
        extras = [sq for sq in changed_obs if sq not in expected_changed]
        score -= len(extras) * 0.35

        # If observed changed count matches expected changed count, bonus.
        if len(changed_obs) == len(expected_changed):
            score += 2.0

        # A complete four-square castling signature is highly distinctive.
        # Prioritize it over transient king-only positions seen while the rook
        # is still being placed.
        if is_castling:
            exact_castle_match = all(
                has_piece(expected_after, sq)
                == has_piece(observed_state, sq)
                for sq in expected_changed
            )
            if exact_castle_match:
                score += 8.0
            else:
                score -= 1.0

        # Add a small whole-board occupancy consistency score, but keep it low so missing detections
        # do not dominate the actual move evidence.
        for sq in chess.SQUARE_NAMES:
            exp_occ = has_piece(expected_after, sq)
            obs_occ = has_piece(observed_state, sq)
            if exp_occ == obs_occ:
                score += 0.08
            else:
                score -= 0.05

        candidates.append({
            "move": move,
            "san": san,
            "uci": move.uci(),
            "is_castling": is_castling,
            "score": round(score, 3),
            "matched": matched,
            "label_bonus": label_bonus,
            "expected_changed": expected_changed,
            "observed_changed": changed_obs,
            "extras": extras,
            "details": details,
        })

    candidates.sort(key=lambda x: x["score"], reverse=True)
    if not candidates:
        return None, []

    best = candidates[0]

    # Safety gate based on the move's real occupancy signature.
    # A capture can change only one occupied/empty square because the destination
    # remains occupied. Normal moves use two, en passant three, and castling four.
    min_match = max(1, len(best["expected_changed"]))

    if best["matched"] < min_match or best["score"] < 7:
        return None, candidates[:5]

    return best, candidates[:5]


def fetch_laravel_moves():
    game_id = require_active_game_id()
    url = f"{API_BASE}/games/{game_id}/moves"
    r = requests.get(url, headers=api_headers(), timeout=8)
    r.raise_for_status()
    data = r.json()

    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ["moves", "data", "items"]:
            if key in data and isinstance(data[key], list):
                return data[key]
    return []


def move_notation_from_item(item):
    if isinstance(item, str):
        return item
    if not isinstance(item, dict):
        return None
    for key in ["notation", "san", "move", "chess_notation"]:
        val = item.get(key)
        if val:
            return str(val)
    uci = item.get("uci")
    if uci:
        return str(uci)
    return None



# REGISSION_AUTHORITATIVE_TURN_SYNC_V1
def _regission_move_order_key(item):
    if not isinstance(item, dict):
        return (3, 0, str(item))

    try:
        return (
            0,
            int(item.get("ply_before")),
            int(item.get("id") or 0),
        )
    except (TypeError, ValueError):
        pass

    try:
        return (1, int(item.get("id")), 0)
    except (TypeError, ValueError):
        pass

    created_at = item.get("created_at") or item.get("updated_at") or ""
    return (2, 0, str(created_at))


def _regission_board_from_fen(value):
    if not value:
        return None

    try:
        return chess.Board(str(value).strip())
    except Exception:
        return None


def _regission_side_name(chess_board=None):
    if chess_board is None:
        with state_lock:
            chess_board = board.copy()

    return "white" if chess_board.turn == chess.WHITE else "black"


def sync_board_from_laravel():
    global board, last_message

    moves = sorted(
        fetch_laravel_moves(),
        key=_regission_move_order_key,
    )

    replay_board = chess.Board()
    applied_count = 0
    replay_error = None
    latest_valid_fen_board = None
    latest_valid_fen_ply = -1

    for position, item in enumerate(moves):
        row_ply_int = None
        stored_after = None

        if isinstance(item, dict):
            try:
                row_ply_int = int(item.get("ply_before"))
            except (TypeError, ValueError):
                row_ply_int = None

            stored_after = _regission_board_from_fen(
                item.get("fen") or item.get("fen_after")
            )

            if stored_after is not None:
                candidate_ply = (
                    row_ply_int + 1
                    if row_ply_int is not None
                    else position + 1
                )

                if candidate_ply >= latest_valid_fen_ply:
                    latest_valid_fen_board = stored_after
                    latest_valid_fen_ply = candidate_ply

        if replay_error is not None:
            continue

        try:
            if (
                row_ply_int is not None
                and row_ply_int != replay_board.ply()
            ):
                raise ValueError(
                    "expected ply "
                    f"{replay_board.ply()} but row has "
                    f"ply_before={row_ply_int}"
                )

            if isinstance(item, dict):
                stored_before = _regission_board_from_fen(
                    item.get("fen_before")
                )

                if (
                    stored_before is not None
                    and stored_before.fen() != replay_board.fen()
                ):
                    raise ValueError(
                        "fen_before does not match the preceding move"
                    )

                uci = str(item.get("uci") or "").strip().lower()
            else:
                uci = ""

            move = None

            if uci:
                try:
                    uci_move = chess.Move.from_uci(uci)
                    if uci_move in replay_board.legal_moves:
                        move = uci_move
                except Exception:
                    move = None

            if move is None:
                notation = move_notation_from_item(item)
                if not notation:
                    raise ValueError("row contains no SAN or UCI")

                notation = notation.strip()

                if (
                    len(notation) in [4, 5]
                    and notation[0] in "abcdefgh"
                    and notation[2] in "abcdefgh"
                ):
                    uci_move = chess.Move.from_uci(notation.lower())
                    if uci_move not in replay_board.legal_moves:
                        raise ValueError(f"illegal UCI move {notation}")
                    move = uci_move
                else:
                    move = replay_board.parse_san(notation)

            replay_board.push(move)
            applied_count += 1

            if stored_after is not None:
                same_position = (
                    stored_after.board_fen() == replay_board.board_fen()
                    and stored_after.turn == replay_board.turn
                    and stored_after.castling_rights == replay_board.castling_rights
                    and stored_after.ep_square == replay_board.ep_square
                )

                if not same_position:
                    raise ValueError(
                        "stored final FEN disagrees with the legal replay"
                    )

                replay_board = stored_after

        except Exception as exc:
            replay_error = f"row {position + 1}: {exc}"

    if replay_error is None:
        new_board = replay_board
        source = "strict legal replay"
    elif latest_valid_fen_board is not None:
        new_board = latest_valid_fen_board
        source = "latest Laravel legal FEN"
    else:
        raise RuntimeError(
            "Move history could not be reconstructed and has no usable FEN. "
            + str(replay_error)
        )

    with state_lock:
        board = new_board

    side_label = _regission_side_name(new_board).upper()
    last_message = (
        f"Synced {len(moves)} Laravel rows using {source}. "
        f"{side_label} TO MOVE."
    )

    if replay_error is not None:
        last_message += f" Replay mismatch prevented: {replay_error}"

    return len(moves), new_board.fen()


def build_move_event_id(game_id, ply_before, fen_before, uci):
    material = f"{game_id}|{ply_before}|{fen_before}|{uci.lower()}"
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


def post_move_to_laravel(
    san,
    uci,
    fen_before,
    fen_after,
    ply_before,
    latency_ms,
):
    game_id = require_active_game_id()
    url = f"{API_BASE}/games/{game_id}/moves"
    event_id = build_move_event_id(game_id, ply_before, fen_before, uci)
    payload = {
        "notation": san,
        "san": san,
        "uci": uci,
        "fen_before": fen_before,
        "fen": fen_after,
        "ply_before": ply_before,
        "event_id": event_id,
        "source": AUTO_SOURCE_NAME,
        "latency_ms": max(0, int(round(latency_ms))),
    }
    r = requests.post(url, headers=api_headers(), json=payload, timeout=10)
    r.raise_for_status()
    try:
        data = r.json()
    except Exception:
        data = {"text": r.text}
    if isinstance(data, dict):
        data.setdefault("event_id", event_id)
    return data


def perform_move_detection(
    trigger="manual",
    observed_override=None,
    image_override=None,
):
    global reference_state, reference_image_baseline
    global board, last_sent_uci, last_sent_san, last_latency
    global last_message, last_changed_squares, last_auto_sent_time
    global last_committed_event_id
    global auto_last_square_scores, auto_last_visual_candidates
    global auto_last_visual_top_squares, last_committed_event_id

    if not move_detection_lock.acquire(blocking=False):
        return {
            "ok": False,
            "busy": True,
            "message": "Move detection is already running. Wait for it to finish.",
        }

    try:
        game_id = get_active_game_id()
        if game_id is None:
            last_message = "No game is assigned to this Raspberry Pi."
            return {"ok": False, "message": last_message}

        if sync_required:
            last_message = f"Game {game_id} requires Sync Pi Board before detection."
            return {"ok": False, "message": last_message}

        if not detection_enabled:
            last_message = "Detection is paused."
            return {"ok": False, "message": last_message}

        start_total = time.perf_counter()
        t0 = time.perf_counter()

        if observed_override is None:
            observed_state, _, _ = snapshot_consensus_observed_state()
            if not observed_state:
                observed_state, _ = detect_current_state(make_views=True)
        else:
            observed_state = observed_override.copy()

        if image_override is None:
            current_image, image_frames = snapshot_warp_median(
                min_frames=2,
                max_age=WARP_HISTORY_MAX_AGE_SECONDS,
            )
        else:
            current_image = image_override.copy()
            image_frames = 1

        detect_ms = (time.perf_counter() - t0) * 1000

        with state_lock:
            current_board = board.copy()

        if reference_image_baseline is None or current_image is None:
            last_message = (
                "Visual move baseline is unavailable. Click Sync Pi Moves again "
                "with the board still."
            )
            return {"ok": False, "message": last_message}

        t1 = time.perf_counter()
        best, top_candidates, diff_meta = choose_best_legal_move_from_images(
            current_board,
            reference_image_baseline,
            current_image,
            observed_state,
        )
        validate_ms = (time.perf_counter() - t1) * 1000

        auto_last_square_scores = {
            item["square"]: item["score"]
            for item in diff_meta.get("top_squares", [])
        }
        auto_last_visual_top_squares = diff_meta.get("top_squares", [])
        auto_last_visual_candidates = [
            {
                "san": item["san"],
                "uci": item["uci"],
                "score": item["score"],
                "coverage": item["coverage"],
                "ranked_coverage": item.get("ranked_coverage"),
                "absolute_coverage": item.get("absolute_coverage"),
                "required_coverage": item["required_coverage"],
                "visual_squares": item["visual_squares"],
                "visual_scores": item["visual_scores"],
                "raw_scores": item.get("raw_scores"),
                "pixel_ratios": item.get("pixel_ratios"),
                "margin": item.get("margin"),
                "is_castling": item["is_castling"],
            }
            for item in top_candidates
        ]

        changed_obs = [
            item["square"]
            for item in diff_meta.get("top_squares", [])
            if (
                item.get("score", 0.0) >= AUTO_IMAGE_SQUARE_THRESHOLD
                and item.get("raw", 0.0) >= AUTO_IMAGE_RAW_SQUARE_MIN
                and item.get("pixel_ratio", 0.0) >= AUTO_IMAGE_PIXEL_RATIO_MIN
            )
        ]
        last_changed_squares = changed_obs

        if best is None:
            top_name = top_candidates[0]["san"] if top_candidates else None
            if diff_meta.get("rejection") == "absolute_board_change_below_minimum":
                last_message = (
                    "AUTO ignored an unchanged/noise-only board. No move was sent."
                )
            else:
                last_message = (
                    "UNCLEAR. The board change does not identify exactly one legal "
                    "move with enough absolute evidence. Nothing was sent."
                )
            return {
                "ok": False,
                "message": last_message,
                "changed_squares": changed_obs,
                "visual_top_squares": diff_meta.get("top_squares", []),
                "closest_move": top_name,
                "top_candidates": auto_last_visual_candidates,
                "image_frames": image_frames,
                "rejection": diff_meta.get("rejection"),
                "max_raw": diff_meta.get("max_raw"),
                "absolute_floor": diff_meta.get("absolute_floor"),
            }

        fen_before = current_board.fen()
        ply_before = current_board.ply()
        event_id = build_move_event_id(
            game_id,
            ply_before,
            fen_before,
            best["uci"],
        )

        # This remains effective for the entire process lifetime, not only five
        # seconds. The deterministic Laravel event ID provides the persistent
        # database-level copy of the same protection.
        if event_id == last_committed_event_id:
            last_message = f"Duplicate physical move blocked: {best['san']}"
            return {
                "ok": False,
                "duplicate": True,
                "event_id": event_id,
                "message": last_message,
            }

        t2 = time.perf_counter()
        new_board = current_board.copy()
        new_board.push(best["move"])
        fen_after = new_board.fen()
        pre_api_ms = (time.perf_counter() - start_total) * 1000

        api_result = post_move_to_laravel(
            best["san"],
            best["uci"],
            fen_before,
            fen_after,
            ply_before,
            pre_api_ms,
        )
        api_ms = (time.perf_counter() - t2) * 1000
        total_ms = (time.perf_counter() - start_total) * 1000

        duplicate = bool(
            isinstance(api_result, dict) and api_result.get("duplicate")
        )

        # Even when Laravel reports a retry duplicate, advance the local board
        # exactly once to the authoritative post-move state.
        with state_lock:
            board = new_board
            reference_state = state_from_board(new_board)

        # The stable post-move image is the only baseline for the next move.
        reference_image_baseline = current_image.copy()

        last_sent_uci = best["uci"]
        last_sent_san = best["san"]
        last_auto_sent_time = time.time()
        last_latency = round(total_ms, 2)
        last_committed_event_id = event_id
        last_message = (
            f"Duplicate retry confirmed by Laravel: {best['san']}"
            if duplicate
            else f"Move saved: {best['san']}"
        )

        record = {
            "time": time.strftime("%Y-%m-%d %H:%M:%S"),
            "trigger": trigger,
            "event_id": event_id,
            "move_san": best["san"],
            "move_uci": best["uci"],
            "detect_ms": round(detect_ms, 2),
            "validate_ms": round(validate_ms, 2),
            "api_ms": round(api_ms, 2),
            "total_ms": round(total_ms, 2),
            "changed_squares": ",".join(changed_obs),
            "visual_score": best["score"],
            "visual_margin": best.get("margin"),
            "visual_coverage": best["coverage"],
            "absolute_coverage": best.get("absolute_coverage"),
            "duplicate": duplicate,
        }
        log_latency(record)

        return {
            "ok": True,
            "duplicate": duplicate,
            "event_id": event_id,
            "message": last_message,
            "move": best["san"],
            "uci": best["uci"],
            "fen": fen_after,
            "latency_ms": round(total_ms, 2),
            "visual_score": best["score"],
            "visual_margin": best.get("margin"),
            "visual_squares": best["visual_squares"],
            "visual_scores": best["visual_scores"],
            "raw_scores": best.get("raw_scores"),
            "pixel_ratios": best.get("pixel_ratios"),
            "is_castling": best["is_castling"],
            "api_result": api_result,
        }
    finally:
        move_detection_lock.release()

# ---------- THREADS ----------

def camera_loop():
    global latest_frame_rgb, latest_frame_at
    while True:
        frame = picam2.capture_array()
        captured_at = time.time()
        with frame_lock:
            latest_frame_rgb = frame.copy()
            latest_frame_at = captured_at
        time.sleep(0.03)


def locked_warp_capture_loop():
    """Create fresh clean board warps without rerunning YOLO.

    Once board corners are locked, this loop supplies high-frequency post-move
    images to the visual legal engine. The heavier YOLO preview may continue at
    its own rate without delaying move recognition.
    """
    global latest_warp_plain_bgr, latest_warp_clean_bgr
    global latest_warp_gray, latest_warp_at

    destination = np.array([
        [0, 0],
        [WARP_SIZE - 1, 0],
        [WARP_SIZE - 1, WARP_SIZE - 1],
        [0, WARP_SIZE - 1],
    ], dtype=np.float32)

    while True:
        with output_lock:
            corners = (
                None
                if locked_board_corners is None
                else locked_board_corners.copy()
            )

        with frame_lock:
            frame = None if latest_frame_rgb is None else latest_frame_rgb.copy()
            captured_at = float(latest_frame_at or 0.0)

        if corners is None or frame is None or captured_at <= 0:
            time.sleep(WARP_CAPTURE_INTERVAL_SECONDS)
            continue

        transform = cv2.getPerspectiveTransform(corners, destination)
        warped_rgb = cv2.warpPerspective(frame, transform, (WARP_SIZE, WARP_SIZE))
        plain_bgr = cv2.cvtColor(warped_rgb, cv2.COLOR_RGB2BGR)
        prepared = prepare_warp_gray(plain_bgr)
        grid_view = draw_grid(plain_bgr.copy())

        with output_lock:
            # Do not append the same camera frame more than once.
            if captured_at > latest_warp_at:
                latest_warp_plain_bgr = plain_bgr
                latest_warp_clean_bgr = grid_view
                latest_warp_gray = prepared
                latest_warp_at = captured_at
                warp_gray_history.append((captured_at, prepared.copy()))

        time.sleep(WARP_CAPTURE_INTERVAL_SECONDS)


def preview_loop():
    while True:
        try:
            detect_current_state(make_views=True)
        except Exception as e:
            print("[PREVIEW ERROR]", repr(e))
        time.sleep(DETECT_EVERY_SECONDS)


def motion_monitor_loop():
    """Create one motion event from the locked board area only.

    Monitoring the complete raw camera also sees the table, chair and people.
    This version watches only the perspective-corrected chessboard and assigns
    one monotonically increasing event ID when physical board motion begins.
    """
    global motion_previous_gray, latest_motion_ratio
    global auto_motion_armed, auto_motion_detected_at
    global auto_motion_last_active_at
    global auto_motion_peak_ratio, auto_motion_streak
    global auto_motion_event_id

    while True:
        with output_lock:
            board_frame = (
                None
                if latest_warp_plain_bgr is None
                else latest_warp_plain_bgr.copy()
            )

        if board_frame is None:
            time.sleep(0.06)
            continue

        gray = cv2.cvtColor(board_frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.resize(gray, (240, 240), interpolation=cv2.INTER_AREA)
        gray = cv2.GaussianBlur(gray, (5, 5), 0)

        previous = motion_previous_gray
        motion_previous_gray = gray

        if previous is None:
            time.sleep(0.06)
            continue

        delta = gray.astype(np.int16) - previous.astype(np.int16)
        delta = delta - int(np.median(delta))
        abs_delta = np.abs(delta)
        ratio = float(
            np.count_nonzero(abs_delta >= AUTO_MOTION_PIXEL_THRESHOLD)
        ) / float(abs_delta.size)

        latest_motion_ratio = ratio

        active_for_auto = (
            AUTO_ENABLED
            and detection_enabled
            and not sync_required
            and reference_image_baseline is not None
        )

        if not active_for_auto:
            auto_motion_streak = 0
            time.sleep(0.06)
            continue

        if ratio >= AUTO_MOTION_RATIO_THRESHOLD:
            auto_motion_streak += 1
            auto_motion_peak_ratio = max(auto_motion_peak_ratio, ratio)
            auto_motion_last_active_at = time.time()

            if auto_motion_streak >= AUTO_MOTION_REQUIRED_FRAMES:
                if not auto_motion_armed:
                    auto_motion_event_id += 1
                    auto_motion_detected_at = time.time()
                    print(f"[AUTO MOTION] event={auto_motion_event_id}")
                auto_motion_armed = True
        else:
            auto_motion_streak = 0

        time.sleep(0.06)


def auto_loop():
    """Evaluate each physical motion event once, then wait for new motion."""
    global auto_visual_baseline, auto_phase
    global auto_last_attempt_at, auto_last_result, auto_retry_after
    global last_auto_sent_time, last_message, reference_image_baseline
    global auto_candidate_since
    global auto_last_processed_motion_event_id

    while True:
        time.sleep(AUTO_SCAN_SECONDS)

        game_id = get_active_game_id()
        if (
            not AUTO_ENABLED
            or not detection_enabled
            or sync_required
            or game_id is None
        ):
            continue

        now = time.time()
        observed, observed_at, consensus_frames = snapshot_consensus_observed_state()
        current_image, image_frames = snapshot_warp_median(
            min_frames=2,
            max_age=WARP_HISTORY_MAX_AGE_SECONDS,
        )

        if current_image is None:
            auto_phase = "waiting_for_camera"
            continue

        if (
            observed_at <= 0
            or (now - observed_at) > AUTO_OBSERVATION_MAX_AGE_SECONDS
        ):
            observed = {}
            consensus_frames = 0

        if reference_image_baseline is None:
            auto_phase = "calibrating"
            if latest_motion_ratio >= AUTO_MOTION_RATIO_THRESHOLD:
                auto_candidate_since = 0.0
                continue

            if auto_candidate_since <= 0:
                auto_candidate_since = now
                continue

            if (now - auto_candidate_since) < AUTO_BASELINE_STABLE_SECONDS:
                continue

            reference_image_baseline = current_image.copy()
            auto_visual_baseline = observed.copy()
            reset_auto_motion()
            clear_auto_candidate()
            auto_phase = "ready"
            last_message = (
                f"AUTO ready for Game {game_id}. Move one legal piece and remove your hand."
            )
            continue

        auto_visual_baseline = observed.copy()

        if now < auto_retry_after:
            auto_phase = "cooldown"
            continue

        if not auto_motion_armed:
            auto_phase = "ready"
            continue

        current_event_id = auto_motion_event_id
        if current_event_id <= auto_last_processed_motion_event_id:
            # The event was already consumed. It cannot be retried while idle.
            reset_auto_motion()
            auto_phase = "ready"
            continue

        last_motion_at = auto_motion_last_active_at or auto_motion_detected_at
        stable_for = max(0.0, now - last_motion_at)
        if stable_for < AUTO_POST_MOTION_STABLE_SECONDS:
            auto_phase = "settling"
            last_message = (
                "AUTO saw physical movement. Remove your hand and keep the board "
                f"still ({AUTO_POST_MOTION_STABLE_SECONDS - stable_for:.1f}s)."
            )
            continue

        current_image, image_frames = snapshot_warp_median(
            min_frames=2,
            max_age=WARP_HISTORY_MAX_AGE_SECONDS,
            after_timestamp=last_motion_at + 0.35,
        )
        if current_image is None:
            auto_phase = "waiting_for_post_move_frame"
            last_message = "AUTO waiting for a fresh stable board image after the move."
            continue

        auto_phase = "validating"
        auto_last_attempt_at = time.strftime(
            "%Y-%m-%dT%H:%M:%SZ", time.gmtime()
        )

        try:
            result = perform_move_detection(
                trigger=f"auto_visual_event_{current_event_id}",
                observed_override=observed,
                image_override=current_image,
            )
        except Exception as exc:
            result = {"ok": False, "message": f"AUTO visual detection failed: {exc}"}
            print("[AUTO VISUAL ERROR]", repr(exc))

        # Consume the event whether accepted or unclear. A new physical motion
        # is required before the engine can evaluate again.
        auto_last_processed_motion_event_id = current_event_id

        auto_last_result = {
            "ok": bool(result.get("ok")),
            "duplicate": bool(result.get("duplicate")),
            "event_id": result.get("event_id"),
            "motion_event_id": current_event_id,
            "message": result.get("message"),
            "move": result.get("move"),
            "uci": result.get("uci"),
            "visual_score": result.get("visual_score"),
            "visual_margin": result.get("visual_margin"),
            "visual_squares": result.get("visual_squares"),
            "is_castling": result.get("is_castling"),
            "top_squares": auto_last_visual_top_squares,
            "top_candidates": auto_last_visual_candidates,
            "motion": snapshot_auto_motion(),
            "image_frames": image_frames,
            "consensus_frames": consensus_frames,
        }

        reset_auto_motion()
        clear_auto_candidate()

        if result.get("ok"):
            last_auto_sent_time = now
            auto_retry_after = now + AUTO_COOLDOWN_SECONDS
            auto_phase = "cooldown"
        else:
            auto_retry_after = 0.0
            auto_phase = "waiting_for_new_motion"
            last_message = (
                result.get("message")
                or "AUTO could not identify one legal move. Move/adjust a piece to try again."
            )


# ---------- STREAM ROUTES ----------

def display_colour_correct(frame_bgr):
    """
    DISPLAY ONLY.
    This tries to restore a more natural board colour for the website preview.
    It does NOT affect YOLO input, move detection, FEN, python-chess, or Laravel sending.
    """
    if frame_bgr is None:
        return None

    img = frame_bgr.astype(np.float32)

    # Gray-world white balance with safe clipping.
    # This reduces camera blue/green cast without forcing a fake brown filter.
    b_mean, g_mean, r_mean = cv2.mean(img)[:3]
    gray = (b_mean + g_mean + r_mean) / 3.0

    if b_mean > 1 and g_mean > 1 and r_mean > 1:
        b_gain = np.clip(gray / b_mean, 0.65, 1.25)
        g_gain = np.clip(gray / g_mean, 0.75, 1.20)
        r_gain = np.clip(gray / r_mean, 0.80, 1.35)

        img[:, :, 0] *= b_gain
        img[:, :, 1] *= g_gain
        img[:, :, 2] *= r_gain

    img = np.clip(img, 0, 255).astype(np.uint8)

    # Very mild contrast only for viewing.
    img = cv2.convertScaleAbs(img, alpha=1.04, beta=2)

    return img


def stream_display_image(getter):
    """
    Stream colour-corrected preview for website/user display only.
    Detection continues using the original camera frame stored by detect_current_state().
    """
    while True:
        with output_lock:
            frame = getter()

        if frame is None:
            frame = np.zeros((720, 1280, 3), dtype=np.uint8)
            cv2.putText(frame, "WAITING FOR DETECTION...", (350, 350),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 2)
        else:
            frame = display_colour_correct(frame)

        ret, buffer = cv2.imencode(".jpg", frame)
        if not ret:
            continue

        yield b"--frame\r\n" b"Content-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n"


def stream_image(getter):
    while True:
        with output_lock:
            frame = getter()
        if frame is None:
            frame = np.zeros((720, 1280, 3), dtype=np.uint8)
            cv2.putText(frame, "WAITING FOR DETECTION...", (350, 350),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 2)
        ret, buffer = cv2.imencode(".jpg", frame)
        if not ret:
            continue
        yield b"--frame\r\n" b"Content-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n"


@app.route("/")
def index():
    html = """
    <html>
    <head>
        <title>REGISSION Complete YOLO System</title>
        <style>
            body { font-family: Arial; background:#0b1020; color:white; padding:20px; text-align:center; }
            .grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
            .card { background:#111827; padding:15px; border-radius:14px; border:1px solid #374151; }
            img { width:100%; border-radius:10px; border:3px solid #22c55e; background:black; }
            a { color:#93c5fd; font-weight:bold; }
            button { padding:12px 18px; margin:6px; border-radius:10px; border:0; font-weight:bold; cursor:pointer; }
            .green { background:#bbf7d0; color:#065f46; }
            .blue { background:#bfdbfe; color:#1d4ed8; }
            .red { background:#fecaca; color:#991b1b; }
            .yellow { background:#fef3c7; color:#92400e; }
        </style>
    </head>
    <body>
        <h1>REGISSION Complete YOLO System</h1>
        <p>
            <a href="/status">Status</a> |
            <a href="/detections">Detections</a> |
            <a href="/latency">Latency CSV JSON</a>
        </p>
        <p>
            <button class="blue" onclick="fetch('/sync').then(r=>r.json()).then(alertJson)">Sync Pi Moves</button>
            <button class="green" onclick="fetch('/detect_now').then(r=>r.json()).then(alertJson)">Resume Detect</button>
            <button class="yellow" onclick="fetch('/auto_on').then(r=>r.json()).then(alertJson)">Auto ON</button>
            <button class="red" onclick="fetch('/auto_off').then(r=>r.json()).then(alertJson)">Auto OFF</button>
            <button class="blue" onclick="fetch('/flip').then(r=>r.json()).then(alertJson)">Flip Board</button>
            <button class="red" onclick="fetch('/pause').then(r=>r.json()).then(alertJson)">Pause</button>
            <button class="green" onclick="fetch('/resume').then(r=>r.json()).then(alertJson)">Resume</button>
        </p>
        <div class="grid">
            <div class="card">
                <h2>Original Camera</h2>
                <img src="/raw">
            </div>
            <div class="card">
                <h2>Board Segmentation</h2>
                <img src="/video">
            </div>
            <div class="card">
                <h2>Clean Warped Board</h2>
                <img src="/warped_clean">
            </div>
            <div class="card">
                <h2>Warped Board + Pieces</h2>
                <img src="/warped">
            </div>
        </div>
        <script>
        function alertJson(x){ alert(JSON.stringify(x, null, 2)); }
        </script>
    </body>
    </html>
    """
    return render_template_string(html)


@app.route("/raw")
def raw():
    return Response(stream_display_image(lambda: latest_raw_bgr), mimetype="multipart/x-mixed-replace; boundary=frame")


@app.route("/video")
def video():
    return Response(stream_display_image(lambda: latest_full_view_bgr), mimetype="multipart/x-mixed-replace; boundary=frame")


@app.route("/warped_clean")
def warped_clean():
    return Response(stream_display_image(lambda: latest_warp_clean_bgr), mimetype="multipart/x-mixed-replace; boundary=frame")


@app.route("/warped")
def warped():
    return Response(stream_display_image(lambda: latest_warp_view_bgr), mimetype="multipart/x-mixed-replace; boundary=frame")

# ---------- CONTROL/API ROUTES ----------



@app.route("/board")
def board_preview_alias():
    return Response(stream_display_image(lambda: latest_warp_clean_bgr), mimetype="multipart/x-mixed-replace; boundary=frame")


@app.route("/board_clean")
def board_clean_alias():
    return Response(stream_display_image(lambda: latest_warp_clean_bgr), mimetype="multipart/x-mixed-replace; boundary=frame")


@app.route("/camera")
def camera_alias():
    return Response(stream_display_image(lambda: latest_raw_bgr), mimetype="multipart/x-mixed-replace; boundary=frame")


@app.route("/status")
def status():
    with state_lock:
        status_board = board.copy()
        fen = status_board.fen()
        side_to_move = _regission_side_name(status_board)
        ply_count = status_board.ply()
        fullmove_number = status_board.fullmove_number
    return jsonify({
        "ok": True,
        "side_to_move": side_to_move,
        "turn": side_to_move,
        "expected_side": side_to_move,
        "ply_count": ply_count,
        "fullmove_number": fullmove_number,
        "active_game_id": get_active_game_id(),
        "game_assigned": get_active_game_id() is not None,
        "assignment": {
            "source": last_assignment_source,
            "changed_at": last_assignment_changed_at,
            "persistent_source": "Laravel/MySQL heartbeat",
        },
        "sync_required": sync_required,
        "detection_enabled": detection_enabled,
        "auto_enabled": AUTO_ENABLED,
        "auto": {
            "enabled": AUTO_ENABLED,
            "phase": auto_phase,
            "baseline_ready": auto_visual_baseline is not None,
            "candidate_changed_squares": auto_candidate_changed_squares,
            "candidate_stable_seconds": (
                round(max(0.0, time.time() - auto_candidate_since), 2)
                if auto_candidate_since > 0
                else 0.0
            ),
            "last_attempt_at": auto_last_attempt_at,
            "last_result": auto_last_result,
            "stable_required_seconds": AUTO_STABLE_SECONDS,
            "castling_stable_required_seconds": AUTO_CASTLING_STABLE_SECONDS,
            "cooldown_seconds": AUTO_COOLDOWN_SECONDS,
            "piece_confidence": PIECE_CONF,
            "consensus_history_size": OBSERVATION_HISTORY_SIZE,
            "consensus_min_ratio": OBSERVATION_MIN_RATIO,
            "physical_motion_required": True,
            "motion": snapshot_auto_motion(),
            "engine": "locked-warp visual legal move matcher",
            "image_baseline_ready": reference_image_baseline is not None,
            "image_square_threshold": AUTO_IMAGE_SQUARE_THRESHOLD,
            "image_move_score_min": AUTO_IMAGE_MOVE_SCORE_MIN,
            "image_move_margin": AUTO_IMAGE_MOVE_MARGIN,
            "image_raw_global_min": AUTO_IMAGE_RAW_GLOBAL_MIN,
            "image_raw_square_min": AUTO_IMAGE_RAW_SQUARE_MIN,
            "image_pixel_ratio_min": AUTO_IMAGE_PIXEL_RATIO_MIN,
            "visual_top_squares": auto_last_visual_top_squares,
            "visual_top_candidates": auto_last_visual_candidates,
        },
        "board_locked": locked_board_corners is not None,
        "board_detected": last_board_detected,
        "board_conf": last_board_conf,
        "board_corner_spread_px": last_board_corner_spread,
        "piece_count": len({d.get("square") for d in latest_detections}),
        "latest_warp_age_seconds": (
            round(max(0.0, time.time() - latest_warp_at), 2)
            if latest_warp_at > 0
            else None
        ),
        "last_detected_move": last_sent_san or "-",
        "last_move_uci": last_sent_uci or "-",
        "last_latency_ms": last_latency,
        "last_committed_event_id": last_committed_event_id,
        "changed_squares": last_changed_squares,
        "fen": fen,
        "message": (
            f"{side_to_move.upper()} TO MOVE. {last_message}"
        ),
        "heartbeat": {
            "configured": bool(DEVICE_TOKEN),
            "online": last_heartbeat_ok,
            "last_sent_at": last_heartbeat_at,
            "latency_ms": last_heartbeat_latency_ms,
            "error": last_heartbeat_error,
            "interval_seconds": HEARTBEAT_INTERVAL_SECONDS,
        },
        "routes": {
            "raw": "/raw",
            "video": "/video",
            "warped_clean": "/warped_clean",
            "warped": "/warped",
            "detect_now": "/detect_now",
            "sync": "/sync",
            "set_game": "/set_game?game_id=16",
            "auto_on": "/auto_on",
            "auto_off": "/auto_off",
            "clear_last_detection": "/clear_last_detection",
            "unlock_board": "/unlock_board",
        }
    })


@app.route("/detections")
def detections():
    return jsonify({"status": status().json, "detections": latest_detections})


@app.route("/set_game", methods=["GET", "POST"])
def set_game():
    payload = request.get_json(silent=True) or {}
    raw_game_id = payload.get("game_id", request.args.get("game_id"))

    # A null/empty game ID clears the current assignment.
    if raw_game_id is None or str(raw_game_id).strip().lower() in {"", "null", "none"}:
        result = apply_game_assignment(
            None,
            source="Website /set_game",
            force_reset=True,
        )

        return jsonify({
            "ok": True,
            "previous_game_id": result.get("previous_game_id"),
            "active_game_id": None,
            "sync_required": True,
            "detection_enabled": False,
            "message": last_message,
        })

    try:
        new_game_id = int(raw_game_id)
    except (TypeError, ValueError):
        return jsonify({
            "ok": False,
            "message": "game_id must be a positive integer or null.",
        }), 422

    if new_game_id <= 0:
        return jsonify({
            "ok": False,
            "message": "game_id must be a positive integer.",
        }), 422

    # force_reset=True preserves the existing Re-send button behaviour:
    # even the same game is placed back into safe setup mode and must sync.
    result = apply_game_assignment(
        new_game_id,
        source="Website /set_game",
        force_reset=True,
    )

    return jsonify({
        "ok": True,
        "previous_game_id": result.get("previous_game_id"),
        "active_game_id": new_game_id,
        "sync_required": True,
        "detection_enabled": False,
        "auto_enabled": False,
        "message": last_message,
    })


@app.route("/sync")
def sync():
    global reference_state, last_message, sync_required
    global detection_enabled, AUTO_ENABLED
    global last_sent_uci, last_sent_san, last_latency
    global last_changed_squares, last_auto_sent_time
    global reference_image_baseline
    try:
        game_id = require_active_game_id()

        if locked_board_corners is None:
            raise RuntimeError(
                "Board perspective is not locked yet. Keep the board and camera "
                "still until /status shows board_locked=true, then Sync again."
            )

        count, fen = sync_board_from_laravel()

        # Capture only fresh, post-setup frames. Old frames from while the user
        # was arranging pieces must not contaminate the move baseline.
        clear_warp_history()
        observed, _ = detect_current_state(make_views=True)
        time.sleep(1.8)
        baseline_image, baseline_frames = snapshot_warp_median(
            min_frames=2,
            max_age=WARP_HISTORY_MAX_AGE_SECONDS,
        )
        if baseline_image is None:
            raise RuntimeError("No clean warped board image is available for visual sync.")

        # IMPORTANT: use Laravel/python-chess FEN as the reference, not one YOLO frame.
        # A single frame may miss pieces or create false positives. Using the legal board
        # state keeps the source and destination squares correct for move validation.
        with state_lock:
            reference_state = state_from_board(board)

        expected_piece_count = len(reference_state)
        observed_piece_count = len(observed)
        sync_required = False
        detection_enabled = False
        AUTO_ENABLED = False

        # Sync means Laravel/MySQL is authoritative again. Clear any old move
        # result such as Ke7 so /status and the dashboard cannot display it as
        # though it was newly detected.
        last_sent_uci = None
        last_sent_san = None
        last_latency = None
        last_changed_squares = []
        last_auto_sent_time = 0.0
        reference_image_baseline = baseline_image.copy()

        reset_auto_tracking("disabled")
        last_message = (
            f"Game {game_id} synced from Laravel. Legal FEN is now the move reference "
            f"({expected_piece_count} expected pieces, {observed_piece_count} currently detected). "
            "Click Resume before detecting a move."
        )
        return jsonify({
            "ok": True,
            "active_game_id": game_id,
            "moves_synced": count,
            "fen": fen,
            "reference_source": "laravel_fen",
            "expected_piece_count": expected_piece_count,
            "observed_piece_count": observed_piece_count,
            "visual_baseline_frames": baseline_frames,
            "visual_engine": "locked-warp legal move matcher",
            "sync_required": False,
            "detection_enabled": detection_enabled,
            "message": last_message,
        })
    except Exception as e:
        last_message = f"Sync failed: {e}"
        return jsonify({"ok": False, "message": last_message}), 500


@app.route("/detect_now")
@app.route("/resume_detect")
def detect_now():
    try:
        current_image, _ = snapshot_warp_median(min_frames=1)
        observed, _, _ = snapshot_consensus_observed_state()
        result = perform_move_detection(
            trigger="manual_visual",
            observed_override=observed,
            image_override=current_image,
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({"ok": False, "message": f"Detect failed: {e}"}), 500


@app.route("/pause")
@app.route("/pause_setup")
def pause():
    global detection_enabled, AUTO_ENABLED, last_message
    detection_enabled = False
    AUTO_ENABLED = False
    reset_auto_tracking("disabled")
    last_message = "PAUSED / SETUP MODE."
    return jsonify({
        "ok": True,
        "detection_enabled": False,
        "auto_enabled": False,
        "message": last_message,
    })


@app.route("/resume")
def resume():
    global detection_enabled, AUTO_ENABLED, last_message
    game_id = get_active_game_id()
    if game_id is None:
        last_message = "Cannot resume: no game is assigned to this Raspberry Pi."
        return jsonify({"ok": False, "message": last_message}), 409
    if sync_required:
        last_message = f"Cannot resume: Game {game_id} must be synced first."
        return jsonify({"ok": False, "message": last_message}), 409

    # /resume is manual mode. AUTO is enabled only through /auto_on.
    AUTO_ENABLED = False
    detection_enabled = True
    reset_auto_tracking("disabled")
    last_message = (
        f"Manual detection resumed for Game {game_id}. "
        "Move one piece, remove your hand, then use Resume Detect."
    )
    return jsonify({
        "ok": True,
        "active_game_id": game_id,
        "detection_enabled": True,
        "auto_enabled": False,
        "message": last_message,
    })


@app.route("/auto_on")
def auto_on():
    global AUTO_ENABLED, detection_enabled, last_message
    game_id = get_active_game_id()
    if game_id is None:
        last_message = "Cannot enable AUTO: no game is assigned to this Raspberry Pi."
        return jsonify({"ok": False, "message": last_message}), 409
    if sync_required:
        last_message = f"Cannot enable AUTO: Game {game_id} must be synced first."
        return jsonify({"ok": False, "message": last_message}), 409
    if locked_board_corners is None:
        last_message = "Cannot enable AUTO: board perspective is not locked yet."
        return jsonify({"ok": False, "message": last_message}), 409
    if reference_image_baseline is None:
        last_message = "Cannot enable AUTO: click Sync Pi Moves to create the visual baseline."
        return jsonify({"ok": False, "message": last_message}), 409

    AUTO_ENABLED = True
    detection_enabled = True
    reset_auto_tracking("calibrating")
    last_message = (
        f"AUTO detection enabled for Game {game_id}. "
        "Keep the current board still while the visual baseline is calibrated."
    )
    return jsonify({
        "ok": True,
        "active_game_id": game_id,
        "detection_enabled": True,
        "auto_enabled": True,
        "auto_phase": auto_phase,
        "message": last_message,
    })


@app.route("/auto_off")
def auto_off():
    global AUTO_ENABLED, last_message
    AUTO_ENABLED = False
    reset_auto_tracking("disabled")
    last_message = "AUTO detection disabled. Manual detection remains available."
    return jsonify({
        "ok": True,
        "auto_enabled": False,
        "detection_enabled": detection_enabled,
        "message": last_message,
    })


@app.route("/flip")
def flip():
    global BOARD_FLIPPED, reference_state, reference_image_baseline
    global last_message, sync_required, detection_enabled, AUTO_ENABLED
    BOARD_FLIPPED = not BOARD_FLIPPED
    reference_state = None
    reference_image_baseline = None
    sync_required = True
    detection_enabled = False
    AUTO_ENABLED = False
    clear_warp_history()
    reset_auto_tracking("disabled")
    last_message = f"Board flip set to {BOARD_FLIPPED}. Click Sync Pi Moves again."
    return jsonify({"ok": True, "board_flipped": BOARD_FLIPPED, "message": last_message})


@app.route("/reset_calibration")
def reset_calibration():
    global reference_state, reference_image_baseline, last_message
    global sync_required, detection_enabled, AUTO_ENABLED
    reference_state = None
    reference_image_baseline = None
    sync_required = True
    detection_enabled = False
    AUTO_ENABLED = False
    unlock_board_corners()
    clear_warp_history()
    reset_auto_tracking("disabled")
    last_message = "Reference cleared. Click Sync Pi Moves."
    return jsonify({"ok": True, "message": last_message})


@app.route("/unlock_board")
def unlock_board():
    global reference_image_baseline, last_message, sync_required
    global detection_enabled, AUTO_ENABLED
    unlock_board_corners()
    clear_warp_history()
    reference_image_baseline = None
    sync_required = True
    detection_enabled = False
    AUTO_ENABLED = False
    reset_auto_tracking("disabled")
    last_message = (
        "Board perspective lock cleared. Keep the board still, wait for it to "
        "lock again, then click Sync Pi Moves."
    )
    return jsonify({
        "ok": True,
        "board_locked": False,
        "sync_required": True,
        "message": last_message,
    })


@app.route("/clear_last_detection")
def clear_last_detection():
    global last_sent_uci, last_sent_san, last_latency
    global last_changed_squares, last_auto_sent_time, last_message
    global auto_last_square_scores, auto_last_visual_candidates
    global auto_last_visual_top_squares

    last_sent_uci = None
    last_sent_san = None
    last_latency = None
    last_changed_squares = []
    last_auto_sent_time = 0.0
    auto_last_square_scores = {}
    auto_last_visual_candidates = []
    auto_last_visual_top_squares = []
    reset_auto_tracking("disabled")
    last_message = "Last detection display state cleared. Sync before enabling AUTO."

    return jsonify({
        "ok": True,
        "last_detected_move": "-",
        "last_move_uci": "-",
        "message": last_message,
    })


@app.route("/clear_change")
def clear_change():
    global last_changed_squares
    last_changed_squares = []
    return jsonify({"ok": True, "message": "Changed squares cleared."})


@app.route("/latency")
def latency():
    rows = []
    if LATENCY_CSV.exists():
        with open(LATENCY_CSV, "r", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))[-50:]
    return jsonify({"ok": True, "file": str(LATENCY_CSV), "records": rows})


# ---------- MAIN ----------
# ===== REGISSION AUTO V7 STATE CONSENSUS START =====
# REGISSION AUTO v7.2
# Faster final-state consensus with capture-aware legal transition matching.
AUTO_V7_STATUS = {
    "enabled": True,
    "version": "7.2",
    "engine": "fast capture-aware YOLO state consensus + python-chess",
    "phase": "disabled",
    "candidate": None,
    "confirmations": 0,
    "required_confirmations": 2,
    "stable_seconds": 0.0,
    "transition_squares": [],
    "changed_squares": [],
    "extras": [],
    "score": None,
    "margin": None,
    "last_result": None,
    "error": None,
}


def _auto_v72_safe_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _auto_v72_piece_color(label):
    value = str(label or "").strip().lower()
    if value and value[0] in ("w", "b"):
        return value[0]
    return None


def _auto_v72_transition_squares(board_before, move):
    """Return every square whose physical content changes for one legal move.

    Unlike an occupancy-only diff, this always includes the destination square
    of a capture, where occupied stays occupied but the colour/piece changes.
    """
    squares = {
        chess.square_name(move.from_square),
        chess.square_name(move.to_square),
    }

    if board_before.is_en_passant(move):
        captured_square = (
            move.to_square - 8
            if board_before.turn == chess.WHITE
            else move.to_square + 8
        )
        squares.add(chess.square_name(captured_square))

    if board_before.is_castling(move):
        rank = chess.square_rank(move.from_square)
        if chess.square_file(move.to_square) == 6:  # kingside
            rook_from = chess.square(7, rank)
            rook_to = chess.square(5, rank)
        else:  # queenside
            rook_from = chess.square(0, rank)
            rook_to = chess.square(3, rank)
        squares.add(chess.square_name(rook_from))
        squares.add(chess.square_name(rook_to))

    return sorted(squares)


def _auto_v72_candidate_for_move(board_before, move, observed_state, before_state):
    """Score one legal move using occupancy as the authoritative state.

    YOLO class and colour labels help ranking, but a temporary label mistake
    on an occupied capture square must not block the correct legal move.
    """
    after_board = board_before.copy()
    san = after_board.san(move)
    after_board.push(move)
    after_state = state_from_board(after_board)

    transition = _auto_v72_transition_squares(board_before, move)
    occupancy_changes = changed_squares_by_occupancy(
        before_state,
        observed_state,
    )
    extras = [
        square
        for square in occupancy_changes
        if square not in transition
    ]

    score = 0.0
    exact_labels = 0
    colour_matches = 0
    complete = True
    details = []

    for square in transition:
        expected_label = after_state.get(square)
        observed_label = observed_state.get(square)
        expected_occupied = expected_label is not None
        observed_occupied = observed_label is not None

        if expected_occupied == observed_occupied:
            score += 8.0
        else:
            score -= 14.0
            complete = False

        if expected_occupied and observed_occupied:
            expected_colour = _auto_v72_piece_color(expected_label)
            observed_colour = _auto_v72_piece_color(observed_label)

            if expected_colour and observed_colour == expected_colour:
                score += 5.0
                colour_matches += 1
            elif (
                expected_colour
                and observed_colour
                and observed_colour != expected_colour
            ):
                # Keep the move eligible when occupancy is correct.
                # Captures receive a separate source/destination pixel check.
                score -= 3.0

            if observed_label == expected_label:
                score += 2.0
                exact_labels += 1

        details.append({
            "square": square,
            "expected": expected_label,
            "observed": observed_label,
        })

    score -= 0.55 * len(extras)

    for square in chess.SQUARE_NAMES:
        if square in transition:
            continue
        expected_occupied = square in after_state
        observed_occupied = square in observed_state
        score += (
            0.04
            if expected_occupied == observed_occupied
            else -0.03
        )

    if move.promotion:
        destination = chess.square_name(move.to_square)
        expected_label = after_state.get(destination)
        observed_label = observed_state.get(destination)
        if expected_label == observed_label:
            score += 8.0
        elif move.promotion == chess.QUEEN:
            score += 0.5

    return {
        "move": move,
        "uci": move.uci(),
        "san": san,
        "after_board": after_board,
        "after_state": after_state,
        "transition": transition,
        "occupancy_changes": occupancy_changes,
        "extras": extras,
        "complete": complete,
        "score": round(score, 3),
        "exact_labels": exact_labels,
        "colour_matches": colour_matches,
        "details": details,
    }

def _auto_v72_choose_candidate(board_before, observed_state):
    """Select one legal move from an exact occupancy transition."""
    before_state = state_from_board(board_before)
    candidates = [
        _auto_v72_candidate_for_move(
            board_before,
            move,
            observed_state,
            before_state,
        )
        for move in list(board_before.legal_moves)
    ]
    candidates.sort(key=lambda item: item["score"], reverse=True)

    if not candidates:
        return None, []

    best = candidates[0]
    second_score = (
        candidates[1]["score"]
        if len(candidates) > 1
        else best["score"] - 20.0
    )
    best["margin"] = round(best["score"] - second_score, 3)

    if not best["complete"]:
        return None, candidates[:5]

    move = best["move"]
    source = chess.square_name(move.from_square)
    destination = chess.square_name(move.to_square)
    occupancy_changes = set(best["occupancy_changes"])
    transition = set(best["transition"])

    if board_before.is_castling(move) or board_before.is_en_passant(move):
        if not transition.issubset(occupancy_changes):
            return None, candidates[:5]
    elif board_before.is_capture(move):
        # A normal capture leaves the destination occupied, so occupancy alone
        # changes only at the source. The destination is verified by pixels.
        if source not in occupancy_changes:
            return None, candidates[:5]
        if destination not in observed_state:
            return None, candidates[:5]
    else:
        if not {source, destination}.issubset(occupancy_changes):
            return None, candidates[:5]

    if len(best["extras"]) > 4 or best["margin"] < 2.0:
        return None, candidates[:5]

    return best, candidates[:5]

def _auto_v72_capture_pixels_ready(
    board_before,
    move,
    baseline_image,
    current_image,
):
    """Confirm both source and destination pixels changed for a capture."""
    if not board_before.is_capture(move):
        return True, {}

    if board_before.is_en_passant(move):
        return True, {}

    if baseline_image is None or current_image is None:
        return False, {"reason": "capture_image_baseline_unavailable"}

    square_scores, diff_meta = calculate_square_difference_scores(
        baseline_image,
        current_image,
    )

    if not square_scores:
        return False, diff_meta

    raw_scores = diff_meta.get("raw_scores", {})
    pixel_ratios = diff_meta.get("pixel_ratios", {})
    source = chess.square_name(move.from_square)
    destination = chess.square_name(move.to_square)

    raw_floor = max(
        0.018,
        AUTO_IMAGE_RAW_SQUARE_MIN * 0.60,
    )
    pixel_floor = max(
        0.010,
        AUTO_IMAGE_PIXEL_RATIO_MIN * 0.55,
    )
    ranked_floor = max(
        0.12,
        AUTO_IMAGE_SQUARE_THRESHOLD * 0.55,
    )

    def square_ready(square):
        return (
            raw_scores.get(square, 0.0) >= raw_floor
            and pixel_ratios.get(square, 0.0) >= pixel_floor
            and square_scores.get(square, 0.0) >= ranked_floor
        )

    ready = square_ready(source) and square_ready(destination)

    return ready, {
        "source": source,
        "destination": destination,
        "source_score": round(square_scores.get(source, 0.0), 4),
        "destination_score": round(
            square_scores.get(destination, 0.0),
            4,
        ),
        "source_raw": round(raw_scores.get(source, 0.0), 4),
        "destination_raw": round(
            raw_scores.get(destination, 0.0),
            4,
        ),
        "source_pixels": round(
            pixel_ratios.get(source, 0.0),
            4,
        ),
        "destination_pixels": round(
            pixel_ratios.get(destination, 0.0),
            4,
        ),
    }

def _auto_v72_candidate_snapshot():
    """Build one fast 1/1 candidate from the latest completed YOLO state."""
    now = time.time()
    max_age = max(
        0.50,
        float(os.environ.get("REGISSION_AUTO_CACHE_MAX_AGE", "1.50")),
    )

    observed_state = dict(latest_observed_state or {})
    observed_at = float(latest_observed_at or 0.0)

    if (
        not observed_state
        or observed_at <= 0.0
        or (now - observed_at) > max_age
    ):
        return {
            "observed": observed_state,
            "observation_at": observed_at,
            "image": None,
            "board_fen": None,
            "best": None,
            "top": [],
            "changed": [],
            "key": (),
            "reason": "waiting_for_fresh_preview_yolo",
        }

    current_image, _ = snapshot_warp_median(
        min_frames=1,
        max_age=WARP_HISTORY_MAX_AGE_SECONDS,
    )

    with state_lock:
        current_board = board.copy()

    before_state = state_from_board(current_board)
    best, top = _auto_v72_choose_candidate(
        current_board,
        observed_state,
    )

    capture_meta = None
    if best is not None:
        capture_ready, capture_meta = (
            _auto_v72_capture_pixels_ready(
                current_board,
                best["move"],
                reference_image_baseline,
                current_image,
            )
        )
        if not capture_ready:
            best = None

    return {
        "observed": observed_state,
        "observation_at": observed_at,
        "image": (
            None
            if current_image is None
            else current_image.copy()
        ),
        "board_fen": current_board.fen(),
        "side_to_move": _regission_side_name(current_board),
        "ply_count": current_board.ply(),
        "best": best,
        "top": top,
        "changed": changed_squares_by_occupancy(
            before_state,
            observed_state,
        ),
        "key": tuple(
            sorted(
                (str(square), str(label))
                for square, label in observed_state.items()
            )
        ),
        "reason": None,
        "capture_visual": capture_meta,
    }

def _auto_v72_commit(snapshot):
    global last_committed_event_id
    """Save the already-verified legal move without running YOLO a third time."""
    global board, reference_state, reference_image_baseline
    global last_sent_uci, last_sent_san, last_latency
    global last_message, last_changed_squares, last_auto_sent_time

    best = snapshot.get("best")
    if best is None:
        return {"ok": False, "message": "No verified AUTO candidate."}

    game_id = get_active_game_id()
    if game_id is None:
        return {"ok": False, "message": "No game is assigned to this Raspberry Pi."}
    if sync_required:
        return {"ok": False, "message": f"Game {game_id} requires Sync Pi Board."}
    if not detection_enabled:
        return {"ok": False, "message": "Detection is paused."}

    started = time.perf_counter()

    with state_lock:
        current_board = board.copy()

    if current_board.fen() != snapshot.get("board_fen"):
        return {
            "ok": False,
            "message": "The legal board changed while AUTO was confirming. Retrying.",
        }

    move = chess.Move.from_uci(best["uci"])
    expected_side = _regission_side_name(current_board)
    moving_piece = current_board.piece_at(move.from_square)

    if move not in current_board.legal_moves:
        return {
            "ok": False,
            "message": (
                "AUTO candidate is no longer legal. "
                f"{expected_side.upper()} must move."
            ),
        }

    if moving_piece is None or moving_piece.color != current_board.turn:
        return {
            "ok": False,
            "message": (
                "Wrong-side move blocked. "
                f"{expected_side.upper()} must move."
            ),
        }

    snapshot_side = snapshot.get("side_to_move")
    if snapshot_side and snapshot_side != expected_side:
        return {
            "ok": False,
            "message": (
                "Stale turn snapshot blocked. "
                f"{expected_side.upper()} must move."
            ),
        }

    san = current_board.san(move)
    if best["uci"] == last_sent_uci and (time.time() - last_auto_sent_time) < 5.0:
        return {"ok": False, "message": f"Duplicate blocked: {san}"}

    fen_before = current_board.fen()
    ply_before = current_board.ply()

    new_board = current_board.copy()
    new_board.push(move)
    fen_after = new_board.fen()

    api_started = time.perf_counter()
    pre_api_ms = (time.perf_counter() - started) * 1000.0

    post_arg_count = getattr(
        getattr(post_move_to_laravel, "__code__", None),
        "co_argcount",
        0,
    )

    if post_arg_count >= 6:
        api_result = post_move_to_laravel(
            san,
            move.uci(),
            fen_before,
            fen_after,
            ply_before,
            pre_api_ms,
        )
    else:
        api_result = post_move_to_laravel(
            san,
            move.uci(),
            fen_after,
        )

    api_ms = (time.perf_counter() - api_started) * 1000.0

    with state_lock:
        board = new_board
        reference_state = state_from_board(new_board)

    image = snapshot.get("image")
    if image is not None:
        reference_image_baseline = image.copy()

    last_sent_uci = move.uci()
    last_sent_san = san
    last_auto_sent_time = time.time()

    if isinstance(api_result, dict):
        new_event_id = api_result.get("event_id")
        if new_event_id is not None:
            last_committed_event_id = new_event_id

    last_changed_squares = list(best.get("transition", []))
    last_latency = round((time.perf_counter() - started) * 1000.0, 2)
    next_side = _regission_side_name(new_board).upper()
    last_message = f"Move saved: {san}. {next_side} TO MOVE."

    try:
        clear_observation_history()
        reset_auto_motion()
    except Exception:
        pass

    try:
        log_latency({
            "time": time.strftime("%Y-%m-%d %H:%M:%S"),
            "trigger": "auto_v7_2",
            "move_san": san,
            "move_uci": move.uci(),
            "detect_ms": 0.0,
            "validate_ms": 0.0,
            "api_ms": round(api_ms, 2),
            "total_ms": last_latency,
            "changed_squares": ",".join(last_changed_squares),
        })
    except Exception as exc:
        print("[AUTO V7.2 LATENCY LOG WARNING]", repr(exc))

    return {
        "ok": True,
        "message": last_message,
        "move": san,
        "uci": move.uci(),
        "fen": fen_after,
        "latency_ms": last_latency,
        "api_result": api_result,
    }


def auto_loop_v7_state():
    """Fast automatic move detection using one verified final state."""
    global last_message

    required_confirmations = max(
        1,
        int(os.environ.get("REGISSION_AUTO_CONFIRMATIONS", "1")),
    )
    poll_seconds = 0.08
    post_send_cooldown = 0.45

    candidate_uci = None
    candidate_key = None
    candidate_count = 0
    candidate_since = 0.0

    while True:
        time.sleep(poll_seconds)

        try:
            if not AUTO_ENABLED or not detection_enabled:
                candidate_uci = None
                candidate_key = None
                candidate_count = 0
                candidate_since = 0.0
                AUTO_V7_STATUS.update({
                    "phase": "disabled",
                    "candidate": None,
                    "confirmations": 0,
                    "required_confirmations": required_confirmations,
                    "stable_seconds": 0.0,
                    "transition_squares": [],
                    "changed_squares": [],
                    "extras": [],
                    "score": None,
                    "margin": None,
                    "error": None,
                })
                continue

            if sync_required:
                candidate_uci = None
                candidate_key = None
                candidate_count = 0
                candidate_since = 0.0
                AUTO_V7_STATUS.update({
                    "phase": "sync_required",
                    "candidate": None,
                    "confirmations": 0,
                    "required_confirmations": required_confirmations,
                    "stable_seconds": 0.0,
                    "transition_squares": [],
                    "changed_squares": [],
                    "extras": [],
                    "score": None,
                    "margin": None,
                    "error": None,
                })
                continue

            snapshot = _auto_v72_candidate_snapshot()
            changed = snapshot["changed"]

            if not changed:
                candidate_uci = None
                candidate_key = None
                candidate_count = 0
                candidate_since = 0.0
                AUTO_V7_STATUS.update({
                    "phase": "ready",
                    "candidate": None,
                    "confirmations": 0,
                    "required_confirmations": required_confirmations,
                    "stable_seconds": 0.0,
                    "transition_squares": [],
                    "changed_squares": [],
                    "extras": [],
                    "score": None,
                    "margin": None,
                    "error": None,
                })
                last_message = (
                    "AUTO ready. Make one legal move and remove your hand."
                )
                continue

            best = snapshot["best"]

            if best is None:
                candidate_uci = None
                candidate_key = None
                candidate_count = 0
                candidate_since = 0.0
                top = snapshot.get("top") or []
                closest = top[0]["san"] if top else None
                AUTO_V7_STATUS.update({
                    "phase": "unclear",
                    "candidate": closest,
                    "confirmations": 0,
                    "required_confirmations": required_confirmations,
                    "stable_seconds": 0.0,
                    "transition_squares": (
                        top[0]["transition"] if top else []
                    ),
                    "changed_squares": changed,
                    "extras": top[0]["extras"] if top else changed,
                    "score": top[0]["score"] if top else None,
                    "margin": (
                        top[0].get("margin") if top else None
                    ),
                    "capture_visual": snapshot.get("capture_visual"),
                    "error": None,
                })
                last_message = (
                    (
                        f"AUTO sees {closest}, but the final board is not "
                        "complete yet. "
                    )
                    if closest
                    else (
                        "AUTO sees a changed board, but no legal move "
                        "matches yet. "
                    )
                ) + "Remove your hand and keep the board still."
                continue

            uci = best["uci"]
            san = best["san"]
            state_key = snapshot["key"]
            now = time.monotonic()

            if uci == candidate_uci and state_key == candidate_key:
                candidate_count += 1
            else:
                candidate_uci = uci
                candidate_key = state_key
                candidate_count = 1
                candidate_since = now

            stable_seconds = max(0.0, now - candidate_since)

            AUTO_V7_STATUS.update({
                "phase": "confirming",
                "candidate": san,
                "confirmations": candidate_count,
                "required_confirmations": required_confirmations,
                "stable_seconds": round(stable_seconds, 2),
                "transition_squares": best["transition"],
                "changed_squares": changed,
                "extras": best["extras"],
                "score": best["score"],
                "margin": best.get("margin"),
                "capture_visual": snapshot.get("capture_visual"),
                "error": None,
            })

            last_message = (
                f"AUTO confirming {san}: "
                f"{candidate_count}/{required_confirmations}. "
                "Keep the board still."
            )

            if candidate_count < required_confirmations:
                continue

            result = _auto_v72_commit(snapshot)
            AUTO_V7_STATUS["last_result"] = result
            AUTO_V7_STATUS["phase"] = (
                "saved" if result.get("ok") else "rejected"
            )
            AUTO_V7_STATUS["error"] = None
            last_message = result.get("message") or last_message

            candidate_uci = None
            candidate_key = None
            candidate_count = 0
            candidate_since = 0.0

            time.sleep(post_send_cooldown)

        except Exception as exc:
            candidate_uci = None
            candidate_key = None
            candidate_count = 0
            candidate_since = 0.0
            last_message = f"AUTO save failed: {exc}"
            AUTO_V7_STATUS.update({
                "phase": "error",
                "candidate": None,
                "confirmations": 0,
                "required_confirmations": required_confirmations,
                "stable_seconds": 0.0,
                "error": repr(exc),
            })
            print("[AUTO V7.2 ERROR]", repr(exc))
            time.sleep(0.75)

@app.route("/auto_v7_status")
def auto_v7_status():
    return jsonify({
        "ok": True,
        "auto_enabled": bool(AUTO_ENABLED),
        "detection_enabled": bool(detection_enabled),
        "sync_required": bool(sync_required),
        "active_game_id": get_active_game_id(),
        "side_to_move": _regission_side_name(),
        "turn": _regission_side_name(),
        "auto_v7": dict(AUTO_V7_STATUS),
    })
# ===== REGISSION AUTO V7 STATE CONSENSUS END =====


if __name__ == "__main__":
    pi_ip = get_pi_ip()

    t1 = threading.Thread(target=camera_loop, daemon=True)
    t2 = threading.Thread(target=preview_loop, daemon=True)
    t3 = threading.Thread(target=auto_loop_v7_state, daemon=True)
    t4 = threading.Thread(target=heartbeat_loop, daemon=True)
    t5 = threading.Thread(target=motion_monitor_loop, daemon=True)
    t6 = threading.Thread(target=locked_warp_capture_loop, daemon=True)
    t1.start()
    t2.start()
    t3.start()
    t4.start()
    t5.start()
    t6.start()

    print("====================================================")
    print(" REGISSION AUTO v6 EDGE-GUARDED SYSTEM")
    print("====================================================")
    print(f"Board model: {BOARD_MODEL_PATH}")
    print(f"Piece model: {PIECE_MODEL_PATH}")
    print(f"Laravel API: {API_BASE}")
    print(f"Laravel move token configured: {bool(API_TOKEN)}")
    print(f"Device heartbeat token configured: {bool(DEVICE_TOKEN)}")
    print(f"Heartbeat interval: {HEARTBEAT_INTERVAL_SECONDS:.0f} seconds")
    print(
        "AUTO timings: "
        f"baseline {AUTO_BASELINE_STABLE_SECONDS:.1f}s, "
        f"stable {AUTO_STABLE_SECONDS:.1f}s, "
        f"castling {AUTO_CASTLING_STABLE_SECONDS:.1f}s, "
        f"cooldown {AUTO_COOLDOWN_SECONDS:.1f}s"
    )
    print(
        "Temporal piece consensus: "
        f"{OBSERVATION_HISTORY_SIZE} frames, "
        f"minimum ratio {OBSERVATION_MIN_RATIO:.2f}, "
        f"piece confidence {PIECE_CONF:.2f}"
    )
    print(
        "Physical motion guard: "
        f"ratio {AUTO_MOTION_RATIO_THRESHOLD:.3f}, "
        f"pixel threshold {AUTO_MOTION_PIXEL_THRESHOLD}, "
        f"frames {AUTO_MOTION_REQUIRED_FRAMES}"
    )
    print(
        "Visual legal engine: locked perspective, "
        f"diff {DIFF_SIZE}px, stable {AUTO_POST_MOTION_STABLE_SECONDS:.1f}s, "
        f"score {AUTO_IMAGE_MOVE_SCORE_MIN:.2f}, margin {AUTO_IMAGE_MOVE_MARGIN:.2f}, "
        f"raw {AUTO_IMAGE_RAW_SQUARE_MIN:.3f}, pixels {AUTO_IMAGE_PIXEL_RATIO_MIN:.3f}"
    )
    print(f"Initial Game ID: {get_active_game_id()}")
    print("Assignment recovery: Laravel/MySQL heartbeat (automatic)")
    print(f"Open:          http://{pi_ip}:{PORT}")
    print(f"Original:      http://{pi_ip}:{PORT}/raw")
    print(f"Board view:    http://{pi_ip}:{PORT}/video")
    print(f"Warped clean:  http://{pi_ip}:{PORT}/warped_clean")
    print(f"Warped YOLO:   http://{pi_ip}:{PORT}/warped")
    print(f"Status:        http://{pi_ip}:{PORT}/status")
    print(f"Set game:      http://{pi_ip}:{PORT}/set_game?game_id=16")
    print("Press CTRL + C to stop.")
    print("====================================================")

    app.run(host="0.0.0.0", port=PORT, debug=False, threaded=True)
