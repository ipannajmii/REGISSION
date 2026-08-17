"use client";

import { useEffect } from "react";

export const REGISSION_SESSION_KEY =
  "regission_activated_pi_session_v1";

export const REGISSION_SESSION_EVENT =
  "regission-pi-session-change";

type StoredSession = {
  active: boolean;
  gameId: number | null;
  gameName: string | null;
  activatedAt: number;
};

function saveSession(session: StoredSession | null) {
  if (session) {
    window.localStorage.setItem(
      REGISSION_SESSION_KEY,
      JSON.stringify(session)
    );
  } else {
    window.localStorage.removeItem(
      REGISSION_SESSION_KEY
    );
  }

  window.dispatchEvent(
    new Event(REGISSION_SESSION_EVENT)
  );
}

function getButtonText(target: EventTarget | null) {
  if (!(target instanceof Element)) return "";

  const button = target.closest(
    "button, a, [role='button']"
  );

  return button?.textContent
    ?.replace(/\s+/g, " ")
    .trim()
    .toLowerCase() ?? "";
}

function extractGameFromPage(): {
  id: number | null;
  name: string | null;
} {
  const bodyText = document.body.innerText;

  const idMatch = bodyText.match(
    /GAME\s*#\s*(\d+)/i
  );

  const nameMatch = bodyText.match(
    /\b(Game\s+\d+|Test Game\s+\d+)\b/i
  );

  return {
    id: idMatch ? Number(idMatch[1]) : null,
    name: nameMatch ? nameMatch[1] : null,
  };
}

export default function SessionActivationBridge() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const text = getButtonText(event.target);

      if (
        text.includes("activate on raspberry pi") ||
        text.includes("assigned to raspberry pi")
      ) {
        const game = extractGameFromPage();

        /*
         * Store immediately after the user activates the game.
         * The home page will remain open until the user explicitly
         * clears the assignment or completes the game.
         */
        window.setTimeout(() => {
          saveSession({
            active: true,
            gameId: game.id,
            gameName: game.name,
            activatedAt: Date.now(),
          });
        }, 300);

        return;
      }

      if (
        text.includes("clear assignment") ||
        text.includes("complete game")
      ) {
        window.setTimeout(() => {
          saveSession(null);
        }, 300);
      }
    };

    document.addEventListener(
      "click",
      handleClick,
      true
    );

    return () => {
      document.removeEventListener(
        "click",
        handleClick,
        true
      );
    };
  }, []);

  return null;
}