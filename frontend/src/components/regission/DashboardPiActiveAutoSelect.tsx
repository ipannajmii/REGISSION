"use client";

import { useEffect } from "react";

const REGISSION_DASHBOARD_PI_ACTIVE_AUTO_SELECT_V2 = true;

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function dashboardAlreadyOnPiGame(): boolean {
  const pageText = normalize(document.body.textContent);

  return (
    pageText.includes(
      "this game is connected to the raspberry pi",
    ) &&
    !pageText.includes(
      "viewing only: raspberry pi is assigned to game",
    )
  );
}

function findPiActiveBadge(): HTMLElement | null {
  const elements = Array.from(
    document.querySelectorAll<HTMLElement>(
      "span, strong, p, div, button",
    ),
  );

  const exactBadges = elements.filter((element) => {
    return normalize(element.textContent) === "pi active";
  });

  exactBadges.sort((left, right) => {
    const leftChildren = left.querySelectorAll("*").length;
    const rightChildren = right.querySelectorAll("*").length;

    return leftChildren - rightChildren;
  });

  return exactBadges[0] ?? null;
}

function clickPiActiveGame(): boolean {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    window.location.pathname !== "/dashboard"
  ) {
    return false;
  }

  if (dashboardAlreadyOnPiGame()) {
    return true;
  }

  const badge = findPiActiveBadge();

  if (!badge) {
    return false;
  }

  /*
   * React click handlers on the surrounding game card receive this bubbling
   * native click. This avoids guessing state-variable names or API formats.
   */
  badge.click();

  const event = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
  });

  badge.dispatchEvent(event);

  let parent: HTMLElement | null = badge.parentElement;

  for (let depth = 0; depth < 5; depth += 1) {
    if (!parent || parent === document.body) {
      break;
    }

    const text = normalize(parent.textContent);

    if (
      text.includes("pi active") &&
      !text.includes("ongoing games")
    ) {
      parent.click();
      parent.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          composed: true,
          view: window,
        }),
      );
    }

    parent = parent.parentElement;
  }

  return true;
}

export default function DashboardPiActiveAutoSelect() {
  useEffect(() => {
    let stopped = false;
    let attempts = 0;

    const tryOpen = (): void => {
      if (stopped || dashboardAlreadyOnPiGame()) {
        stopped = true;
        return;
      }

      attempts += 1;
      clickPiActiveGame();

      if (attempts >= 40) {
        stopped = true;
      }
    };

    tryOpen();

    const observer = new MutationObserver(() => {
      tryOpen();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    const timer = window.setInterval(tryOpen, 500);

    return () => {
      stopped = true;
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
