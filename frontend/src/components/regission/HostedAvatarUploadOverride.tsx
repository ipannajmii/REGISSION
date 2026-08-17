"use client";

import { useEffect } from "react";

type JsonRecord = Record<string, unknown>;

const REGISSION_HOSTED_AVATAR_UPLOAD_V2 = true;
const TOAST_ID = "regission-avatar-upload-toast-v2";

let uploadBusy = false;

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object"
    ? (value as JsonRecord)
    : {};
}

function findToken(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim().replace(/^"|"$/g, "");

    if (
      trimmed.length >= 20 &&
      !trimmed.includes(" ") &&
      !trimmed.startsWith("{") &&
      !trimmed.startsWith("[")
    ) {
      return trimmed;
    }

    try {
      return findToken(JSON.parse(trimmed));
    } catch {
      return "";
    }
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const record = value as JsonRecord;

  for (const key of [
    "token",
    "access_token",
    "accessToken",
    "auth_token",
    "authToken",
    "bearer",
  ]) {
    const token = findToken(record[key]);

    if (token !== "") {
      return token;
    }
  }

  return "";
}

function getAuthToken(): string {
  const preferredKeys = [
    "regission_token",
    "auth_token",
    "access_token",
    "token",
    "regission-auth-token",
    "regissionAuthToken",
    "auth",
    "user",
  ];

  for (const storage of [
    window.localStorage,
    window.sessionStorage,
  ]) {
    for (const key of preferredKeys) {
      const value = storage.getItem(key);

      if (!value) {
        continue;
      }

      const token = findToken(value);

      if (token !== "") {
        return token;
      }
    }

    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);

      if (!key || !/token|auth|session/i.test(key)) {
        continue;
      }

      const value = storage.getItem(key);

      if (!value) {
        continue;
      }

      const token = findToken(value);

      if (token !== "") {
        return token;
      }
    }
  }

  return "";
}

function showToast(
  message: string,
  type: "success" | "error" | "info",
): void {
  let toast = document.getElementById(TOAST_ID);

  if (!toast) {
    toast = document.createElement("div");
    toast.id = TOAST_ID;

    Object.assign(toast.style, {
      position: "fixed",
      right: "24px",
      bottom: "24px",
      zIndex: "100000",
      maxWidth: "420px",
      padding: "15px 18px",
      borderRadius: "14px",
      fontWeight: "800",
      lineHeight: "1.45",
      boxShadow: "0 20px 60px rgba(0,0,0,0.38)",
    });

    document.body.appendChild(toast);
  }

  toast.textContent = message;

  if (type === "success") {
    toast.style.background = "#0f5132";
    toast.style.color = "#d1fae5";
    toast.style.border = "1px solid #34d399";
  } else if (type === "error") {
    toast.style.background = "#5a1d2b";
    toast.style.color = "#ffe4e6";
    toast.style.border = "1px solid #fb7185";
  } else {
    toast.style.background = "#172554";
    toast.style.color = "#dbeafe";
    toast.style.border = "1px solid #60a5fa";
  }
}

function extractError(payload: unknown): string {
  const record = asRecord(payload);

  if (typeof record.message === "string") {
    const message = record.message.trim();

    if (message !== "") {
      return message;
    }
  }

  const errors = asRecord(record.errors);

  for (const value of Object.values(errors)) {
    if (Array.isArray(value) && typeof value[0] === "string") {
      return value[0];
    }

    if (typeof value === "string") {
      return value;
    }
  }

  return "The avatar failed to upload.";
}

function findSaveButton(): HTMLButtonElement | null {
  return (
    Array.from(
      document.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) => {
      return normalize(button.textContent) === "save photo";
    }) ?? null
  );
}

function findSelectedFile(): File | null {
  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement>(
      'input[type="file"]',
    ),
  );

  for (const input of inputs) {
    const file = input.files?.[0];

    if (file) {
      return file;
    }
  }

  return null;
}

async function uploadAvatar(
  button: HTMLButtonElement | null,
): Promise<void> {
  if (uploadBusy) {
    return;
  }

  const file = findSelectedFile();

  if (!file) {
    showToast("Choose a profile image first.", "error");
    return;
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (!allowedTypes.includes(file.type)) {
    showToast("Use a JPG, PNG, or WEBP image.", "error");
    return;
  }

  if (file.size > 8 * 1024 * 1024) {
    showToast("The image must be 8 MB or smaller.", "error");
    return;
  }

  uploadBusy = true;

  const originalText = button?.textContent ?? "Save Photo";

  if (button) {
    button.disabled = true;
    button.textContent = "Uploading...";
  }

  showToast("Uploading profile photo...", "info");

  try {
    const formData = new FormData();
    formData.append("avatar", file, file.name);

    const token = getAuthToken();

    const response = await fetch(
      "/api/profile/avatar-upload",
      {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          ...(token
            ? { Authorization: `Bearer ${token}` }
            : {}),
        },
        body: formData,
      },
    );

    let payload: unknown = {};

    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    if (!response.ok) {
      throw new Error(extractError(payload));
    }

    showToast("Profile photo saved successfully.", "success");

    window.setTimeout(() => {
      window.location.reload();
    }, 700);
  } catch (error) {
    showToast(
      error instanceof Error
        ? error.message
        : "The avatar failed to upload.",
      "error",
    );
  } finally {
    uploadBusy = false;

    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

export default function HostedAvatarUploadOverride() {
  useEffect(() => {
    if (window.location.pathname !== "/profile") {
      return;
    }

    const handleClick = (event: MouseEvent): void => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const button = target.closest("button");

      if (
        !(button instanceof HTMLButtonElement) ||
        normalize(button.textContent) !== "save photo"
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      void uploadAvatar(button);
    };

    const handleSubmit = (event: SubmitEvent): void => {
      const form = event.target;

      if (!(form instanceof HTMLFormElement)) {
        return;
      }

      const button = findSaveButton();
      const fileInput = form.querySelector<HTMLInputElement>(
        'input[type="file"]',
      );

      if (!button || !fileInput) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      void uploadAvatar(button);
    };

    document.addEventListener("click", handleClick, true);
    document.addEventListener("submit", handleSubmit, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("submit", handleSubmit, true);
    };
  }, []);

  return null;
}
