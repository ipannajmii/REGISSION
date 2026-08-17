"use client";

type PiStatus = {
  fen?: string;
  side_to_move?: string;
  turn?: string;
  expected_side?: string;
};

declare global {
  interface Window {
    __regissionTurnUiInstalled?: boolean;
  }
}

const BADGE_ID = "regission-side-to-move-badge";
const STYLE_ID = "regission-turn-ui-style";

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${BADGE_ID} {
      display: block;
      width: 100%;
      box-sizing: border-box;
      margin: 12px 0 14px;
      padding: 12px 14px;
      border-radius: 12px;
      text-align: center;
      font-weight: 900;
      letter-spacing: 0.07em;
      color: #102033;
      background: #fff0a8;
      border: 1px solid rgba(176, 119, 0, 0.35);
    }

    [data-regission-move-table-scroll="true"] {
      max-height: 355px !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
      overscroll-behavior: contain !important;
      scrollbar-gutter: stable !important;
      min-height: 0 !important;
      padding-right: 4px !important;
    }

    [data-regission-move-table-scroll="true"] thead {
      position: sticky !important;
      top: 0 !important;
      z-index: 40 !important;
    }
  `;

  document.head.appendChild(style);
}

function findDetectionHeading(): HTMLElement | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      "h1, h2, h3, h4, h5, h6, div, span, p",
    ),
  ).filter((element) => {
    return normalize(element.textContent) === "DETECTION STATUS";
  });

  candidates.sort((left, right) => {
    return (
      left.querySelectorAll("*").length -
      right.querySelectorAll("*").length
    );
  });

  return candidates[0] ?? null;
}

function sideFromStatus(status: PiStatus): string | null {
  const direct = (
    status.side_to_move ??
    status.turn ??
    status.expected_side ??
    ""
  ).toLowerCase();

  if (direct === "white" || direct === "black") {
    return direct;
  }

  const parts = (status.fen ?? "").trim().split(/\s+/);

  if (parts.length >= 2) {
    if (parts[1] === "w") return "white";
    if (parts[1] === "b") return "black";
  }

  return null;
}

function renderTurn(side: string | null): void {
  const heading = findDetectionHeading();

  if (!heading) {
    return;
  }

  let badge = document.getElementById(BADGE_ID);

  if (!badge) {
    badge = document.createElement("div");
    badge.id = BADGE_ID;
    heading.insertAdjacentElement("afterend", badge);
  }

  if (side === "white" || side === "black") {
    badge.textContent = `${side.toUpperCase()} TO MOVE`;
    badge.setAttribute("data-side", side);
  } else {
    badge.textContent = "CHECKING SIDE TO MOVE...";
    badge.removeAttribute("data-side");
  }
}

function applyMoveTableScroll(): void {
  const tables = Array.from(
    document.querySelectorAll<HTMLTableElement>("table"),
  );

  const moveTable = tables.find((table) => {
    const headers = Array.from(
      table.querySelectorAll("th"),
    ).map((header) => normalize(header.textContent));

    return headers.includes("WHITE") && headers.includes("BLACK");
  });

  if (!moveTable) {
    return;
  }

  const wrapper = moveTable.parentElement;

  if (!wrapper) {
    return;
  }

  wrapper.dataset.regissionMoveTableScroll = "true";

  const header = moveTable.querySelector<HTMLElement>("thead");

  if (header) {
    header.style.position = "sticky";
    header.style.top = "0";
    header.style.zIndex = "40";
  }
}

async function refreshTurn(): Promise<void> {
  try {
    const response = await fetch(
      `/api/pi/status?t=${Date.now()}`,
      {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const status = (await response.json()) as PiStatus;
    renderTurn(sideFromStatus(status));
  } catch {
    renderTurn(null);
  }
}

function install(): void {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined"
  ) {
    return;
  }

  ensureStyles();

  if (window.__regissionTurnUiInstalled) {
    applyMoveTableScroll();
    void refreshTurn();
    return;
  }

  window.__regissionTurnUiInstalled = true;

  let scheduled = false;

  const apply = (): void => {
    if (scheduled) return;

    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      applyMoveTableScroll();
    });
  };

  apply();
  void refreshTurn();

  const observer = new MutationObserver(apply);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  window.addEventListener("resize", apply);

  window.setInterval(() => {
    apply();
    void refreshTurn();
  }, 2000);
}

if (
  typeof window !== "undefined" &&
  typeof document !== "undefined"
) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, {
      once: true,
    });
  } else {
    install();
  }
}

export {};
