"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const PANEL_HEADING = "MOVE HISTORY";
const ACTIVE_LABEL = "ACTIVE GAME:";

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function clearPreviousWholePanelScroll(): void {
  const previousPanels = document.querySelectorAll<HTMLElement>(
    '[data-regission-move-history-scrollable="true"],' +
      '[data-regission-move-history-scrollable]'
  );

  previousPanels.forEach((element) => {
    delete element.dataset.regissionMoveHistoryScrollable;
    element.style.removeProperty("max-height");
    element.style.removeProperty("overflow-y");
    element.style.removeProperty("overflow");
    element.style.removeProperty("overscroll-behavior");
    element.style.removeProperty("scrollbar-gutter");
    element.style.removeProperty("padding-right");
  });
}

function findMoveHistoryPanel(): HTMLElement | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      "h1,h2,h3,h4,h5,h6,div,span"
    )
  );

  const heading = candidates.find((element) => {
    return (
      normalize(element.textContent) === PANEL_HEADING &&
      element.children.length === 0
    );
  });

  if (!heading) {
    return null;
  }

  let current = heading.parentElement;

  for (let depth = 0; current && depth < 10; depth += 1) {
    const text = normalize(current.innerText);

    if (
      text.includes(PANEL_HEADING) &&
      text.includes(ACTIVE_LABEL)
    ) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function countMoveRows(text: string): number {
  const matches = text.match(
    /(?:^|\s)(?:[1-9]|[1-9][0-9]|1[0-9][0-9])\.\s/g
  );

  return matches?.length ?? 0;
}

function findInnerMoveCard(
  panel: HTMLElement
): HTMLElement | null {
  const candidates = Array.from(
    panel.querySelectorAll<HTMLElement>(
      "table,div,section,article"
    )
  )
    .filter((element) => {
      const text = normalize(element.innerText);

      return (
        text.includes("WHITE") &&
        text.includes("BLACK") &&
        countMoveRows(text) >= 2 &&
        !text.includes(ACTIVE_LABEL)
      );
    })
    .sort((a, b) => {
      const depth = (element: HTMLElement) => {
        let value = 0;
        let current: HTMLElement | null = element;

        while (current && current !== panel) {
          value += 1;
          current = current.parentElement;
        }

        return value;
      };

      const depthDifference = depth(b) - depth(a);

      if (depthDifference !== 0) {
        return depthDifference;
      }

      return a.innerText.length - b.innerText.length;
    });

  return candidates[0] ?? null;
}

function findHeaderInside(
  card: HTMLElement
): HTMLElement | null {
  const candidates = Array.from(
    card.querySelectorAll<HTMLElement>(
      "thead,tr,div,section"
    )
  )
    .filter((element) => {
      const text = normalize(element.innerText);

      return (
        text.includes("WHITE") &&
        text.includes("BLACK") &&
        (
          text === "# WHITE BLACK" ||
          (
            text.includes("#") &&
            countMoveRows(text) === 0
          )
        )
      );
    })
    .sort((a, b) => {
      return a.innerText.length - b.innerText.length;
    });

  return candidates[0] ?? null;
}

function applyMoveListOnlyScroll(): void {
  clearPreviousWholePanelScroll();

  const panel = findMoveHistoryPanel();

  if (!panel) {
    return;
  }

  panel.style.removeProperty("max-height");
  panel.style.removeProperty("overflow-y");
  panel.style.removeProperty("overflow");
  panel.style.removeProperty("overscroll-behavior");
  panel.style.removeProperty("scrollbar-gutter");
  panel.style.removeProperty("padding-right");

  const card = findInnerMoveCard(panel);

  if (!card) {
    return;
  }

  card.dataset.regissionMoveListOnly = "true";
  card.style.maxHeight = "min(520px, calc(100vh - 300px))";
  card.style.overflowY = "auto";
  card.style.overflowX = "hidden";
  card.style.overscrollBehavior = "contain";
  card.style.scrollbarGutter = "stable";

  const header = findHeaderInside(card);

  if (header) {
    const background = window.getComputedStyle(card).backgroundColor;

    header.dataset.regissionMoveListHeader = "true";
    header.style.position = "sticky";
    header.style.top = "0";
    header.style.zIndex = "4";
    header.style.backgroundColor =
      background && background !== "rgba(0, 0, 0, 0)"
        ? background
        : "#f8f8f8";
  }
}

export default function MoveHistoryScroller() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/dashboard") {
      return;
    }

    let animationFrame = 0;
    let timeout = 0;

    const scheduleApply = () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(timeout);

      timeout = window.setTimeout(() => {
        animationFrame = window.requestAnimationFrame(() => {
          applyMoveListOnlyScroll();
        });
      }, 80);
    };

    const observer = new MutationObserver(scheduleApply);

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    scheduleApply();
    window.addEventListener("resize", scheduleApply);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(timeout);
      window.removeEventListener("resize", scheduleApply);
    };
  }, [pathname]);

  return null;
}
