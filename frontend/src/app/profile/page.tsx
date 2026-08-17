"use client";
import { resolveAvatarUrl } from "@/lib/avatar-url";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import PageShell from "@/components/page-shell";
import ProtectedRoute from "@/components/auth/protected-route";
import {
  type AuthUser,
  getStoredToken,
  getStoredUser,
  saveSession,
} from "@/lib/auth";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "/api/proxy/api";

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const firstValidationError =
      payload &&
      typeof payload === "object" &&
      "errors" in payload &&
      typeof (payload as {
        errors?: Record<string, string[]>;
      }).errors === "object"
        ? Object.values(
            (payload as {
              errors: Record<string, string[]>;
            }).errors
          )
            .flat()
            .find(Boolean)
        : undefined;

    const message =
      firstValidationError ??
      (payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof (payload as { message?: unknown }).message === "string"
        ? (payload as { message: string }).message
        : `Request failed with status ${response.status}.`);

    throw new Error(message);
  }

  return payload as T;
}

async function apiRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = getStoredToken("user");

  if (!token) {
    throw new Error("Your user session has expired.");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  return parseResponse<T>(response);
}

function ProfileContent() {
  const storedUser = getStoredUser("user");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const personalInfoRef = useRef<HTMLFormElement>(null);

  const [user, setUser] = useState<AuthUser | null>(storedUser);
  const [name, setName] = useState(storedUser?.name ?? "");
  const [email, setEmail] = useState(storedUser?.email ?? "");
  const [editing, setEditing] = useState(false);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    resolveAvatarUrl(storedUser)
  );
  const [selectedAvatar, setSelectedAvatar] = useState<File | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] =
    useState("");
  const [showPasswords, setShowPasswords] = useState(false);

  const [profileLoading, setProfileLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [profileError, setProfileError] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [toast, setToast] = useState("");

  const initials = useMemo(
    () =>
      (user?.name ?? name)
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join(""),
    [name, user?.name]
  );

  function persistUser(nextUser: AuthUser) {
    const token = getStoredToken("user");

    saveSession(
      {
        token,
        user: nextUser,
      },
      true
    );

    setUser(nextUser);
    setName(nextUser.name);
    setEmail(nextUser.email);
    setAvatarPreview(resolveAvatarUrl(nextUser));
  }

  useEffect(() => {
    async function loadProfile() {
      try {
        const result = await apiRequest<{ user: AuthUser }>(
          "/profile"
        );

        persistUser(result.user);
      } catch (error) {
        setProfileError(
          error instanceof Error
            ? error.message
            : "Unable to load profile."
        );
      }
    }

    void loadProfile();
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => setToast(""), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    return () => {
      if (
        avatarPreview &&
        avatarPreview.startsWith("blob:")
      ) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  function cancelEditing() {
    setName(user?.name ?? "");
    setEmail(user?.email ?? "");
    setProfileError("");
    setEditing(false);
  }

  async function updateProfile(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setProfileError("");
    setProfileLoading(true);

    try {
      const result = await apiRequest<{
        message: string;
        user: AuthUser;
      }>("/profile", {
        method: "PUT",
        body: JSON.stringify({
          name,
          email,
        }),
      });

      persistUser(result.user);
      setEditing(false);
      setToast(result.message);
    } catch (error) {
      setProfileError(
        error instanceof Error
          ? error.message
          : "Unable to update profile."
      );
    } finally {
      setProfileLoading(false);
    }
  }

  function chooseAvatar(file: File | null) {
    setAvatarError("");

    if (!file) {
      setSelectedAvatar(null);
      return;
    }

    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowed.includes(file.type)) {
      setAvatarError(
        "Please choose a JPG, PNG, or WEBP image."
      );
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setAvatarError(
        "The profile photo must be 3 MB or smaller."
      );
      return;
    }

    if (
      avatarPreview &&
      avatarPreview.startsWith("blob:")
    ) {
      URL.revokeObjectURL(avatarPreview);
    }

    setSelectedAvatar(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function uploadAvatar() {
    if (!selectedAvatar) {
      setAvatarError("Choose a profile photo first.");
      return;
    }

    setAvatarError("");
    setAvatarLoading(true);

    try {
      const body = new FormData();
      body.append("avatar", selectedAvatar);

      const result = await apiRequest<{
        message: string;
        user: AuthUser;
      }>("/profile/avatar", {
        method: "POST",
        body,
      });

      persistUser(result.user);
      setSelectedAvatar(null);
      setToast(result.message);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      setAvatarError(
        error instanceof Error
          ? error.message
          : "Unable to upload profile photo."
      );
    } finally {
      setAvatarLoading(false);
    }
  }

  async function removeAvatar() {
    if (
      !window.confirm(
        "Remove your current profile photo?"
      )
    ) {
      return;
    }

    setAvatarError("");
    setAvatarLoading(true);

    try {
      const result = await apiRequest<{
        message: string;
        user: AuthUser;
      }>("/profile/avatar", {
        method: "DELETE",
      });

      persistUser(result.user);
      setSelectedAvatar(null);
      setToast(result.message);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      setAvatarError(
        error instanceof Error
          ? error.message
          : "Unable to remove profile photo."
      );
    } finally {
      setAvatarLoading(false);
    }
  }

  async function changePassword(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setPasswordError("");

    if (password !== passwordConfirmation) {
      setPasswordError(
        "The new password confirmation does not match."
      );
      return;
    }

    setPasswordLoading(true);

    try {
      const result = await apiRequest<{ message: string }>(
        "/profile/password",
        {
          method: "PUT",
          body: JSON.stringify({
            current_password: currentPassword,
            password,
            password_confirmation: passwordConfirmation,
          }),
        }
      );

      setCurrentPassword("");
      setPassword("");
      setPasswordConfirmation("");
      setToast(result.message);
    } catch (error) {
      setPasswordError(
        error instanceof Error
          ? error.message
          : "Unable to change password."
      );
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <PageShell>
      {toast && (
        <div className="fixed right-5 top-24 z-[100] rounded-2xl border border-emerald-400/20 bg-[#10271f] px-5 py-4 text-sm font-bold text-emerald-200 shadow-2xl">
          {toast}
        </div>
      )}

      <section className="mx-auto max-w-5xl px-4 py-10">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-400">
            Account Settings
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
            Profile & Security
          </h1>

          <p className="mt-3 max-w-2xl text-base leading-7 text-white/55">
            Edit your user information, upload a profile photo,
            and keep your password secure.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="self-start rounded-3xl border border-white/10 bg-[#0d1829]/85 p-6 lg:sticky lg:top-24">
            <div className="relative h-28 w-28 overflow-hidden rounded-full border-4 border-orange-400/20 bg-orange-500">
              {avatarPreview ? (
                <Image
                  src={avatarPreview}
                  alt="Profile"
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-black text-black">
                  {initials || "U"}
                </div>
              )}
            </div>

            <h2 className="mt-5 text-xl font-black text-white">
              {user?.name ?? name}
            </h2>

            <p className="mt-2 break-all text-sm text-white/45">
              {user?.email ?? email}
            </p>

            <div className="mt-5 rounded-2xl border border-emerald-400/15 bg-emerald-500/10 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                Account status
              </p>
              <p className="mt-2 text-sm font-bold text-emerald-100">
                Active user
              </p>
            </div>
          </aside>

          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-[#0d1829]/85 p-6">
              <h2 className="text-xl font-black text-white">
                Profile Photo
              </h2>

              <p className="mt-2 text-sm text-white/45">
                Upload a JPG, PNG, or WEBP image up to 3 MB.
              </p>

              <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-white/10 bg-orange-500">
                  {avatarPreview ? (
                    <Image
                      src={avatarPreview}
                      alt="Profile preview"
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-black text-black">
                      {initials || "U"}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) =>
                      chooseAvatar(
                        event.target.files?.[0] ?? null
                      )
                    }
                    className="block w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-bold file:text-black"
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={
                        avatarLoading || !selectedAvatar
                      }
                      onClick={() => void uploadAvatar()}
                      className="rounded-xl bg-[#5865F2] px-4 py-2.5 text-sm font-black text-white transition hover:brightness-110 disabled:opacity-40"
                    >
                      {avatarLoading
                        ? "Uploading..."
                        : "Save Photo"}
                    </button>

                    {(user?.avatar_url || selectedAvatar) && (
                      <button
                        type="button"
                        disabled={avatarLoading}
                        onClick={() => void removeAvatar()}
                        className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-200 transition hover:bg-red-500/20 disabled:opacity-40"
                      >
                        Remove Photo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {avatarError && (
                <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {avatarError}
                </div>
              )}
            </section>

            <form
              onSubmit={updateProfile}
              className="rounded-3xl border border-white/10 bg-[#0d1829]/85 p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-white">
                    Personal Information
                  </h2>

                  <p className="mt-2 text-sm text-white/45">
                    Your name and email identify your account and
                    game ownership.
                  </p>
                </div>

                {!editing && (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="rounded-xl border border-orange-400/20 bg-orange-500/10 px-4 py-2.5 text-sm font-bold text-orange-200"
                  >
                    Edit
                  </button>
                )}
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="text-sm font-bold text-white/70">
                    Full name
                  </label>

                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={255}
                    disabled={!editing}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-white outline-none focus:border-orange-400/50 disabled:cursor-not-allowed disabled:opacity-55"
                  />
                </div>

                <div>
                  <label className="text-sm font-bold text-white/70">
                    Email address
                  </label>

                  <input
                    type="email"
                    required
                    disabled={!editing}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-white outline-none focus:border-orange-400/50 disabled:cursor-not-allowed disabled:opacity-55"
                  />
                </div>

                {profileError && (
                  <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {profileError}
                  </div>
                )}

                {editing && (
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={profileLoading}
                      className="rounded-2xl bg-orange-500 px-6 py-3 text-sm font-black text-black transition hover:bg-orange-400 disabled:opacity-45"
                    >
                      {profileLoading
                        ? "Saving..."
                        : "Save Changes"}
                    </button>

                    <button
                      type="button"
                      disabled={profileLoading}
                      onClick={cancelEditing}
                      className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-bold text-white/70 transition hover:bg-white/10"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </form>

            <form
              onSubmit={changePassword}
              className="rounded-3xl border border-white/10 bg-[#0d1829]/85 p-6"
            >
              <h2 className="text-xl font-black text-white">
                Change Password
              </h2>

              <p className="mt-2 text-sm text-white/45">
                Enter your current password before choosing a new
                password.
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="text-sm font-bold text-white/70">
                    Current password
                  </label>

                  <input
                    type={showPasswords ? "text" : "password"}
                    required
                    value={currentPassword}
                    onChange={(event) =>
                      setCurrentPassword(event.target.value)
                    }
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-white outline-none focus:border-orange-400/50"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-bold text-white/70">
                      New password
                    </label>

                    <input
                      type={showPasswords ? "text" : "password"}
                      required
                      minLength={8}
                      value={password}
                      onChange={(event) =>
                        setPassword(event.target.value)
                      }
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-white outline-none focus:border-orange-400/50"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-bold text-white/70">
                      Confirm password
                    </label>

                    <input
                      type={showPasswords ? "text" : "password"}
                      required
                      minLength={8}
                      value={passwordConfirmation}
                      onChange={(event) =>
                        setPasswordConfirmation(event.target.value)
                      }
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-white outline-none focus:border-orange-400/50"
                    />
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-3 text-sm text-white/55">
                  <input
                    type="checkbox"
                    checked={showPasswords}
                    onChange={(event) =>
                      setShowPasswords(event.target.checked)
                    }
                    className="h-4 w-4 accent-orange-500"
                  />
                  Show passwords
                </label>

                {passwordError && (
                  <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {passwordError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="rounded-2xl bg-[#5865F2] px-6 py-3 text-sm font-black text-white transition hover:brightness-110 disabled:opacity-45"
                >
                  {passwordLoading
                    ? "Changing..."
                    : "Change Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute role="user">
      <ProfileContent />
    </ProtectedRoute>
  );
}