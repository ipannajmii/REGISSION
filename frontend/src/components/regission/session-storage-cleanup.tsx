"use client";

import { useEffect } from "react";

export default function SessionStorageCleanup() {
  useEffect(() => {
    [
      "regission_final_stable_status_v1",
      "regission_stable_active_session_v1",
      "regission_home_ultra_stable_v7",
      "regission_home_device_stable_v6",
      "regission_user_connected_raspberry_pi",
    ].forEach((key) => {
      window.localStorage.removeItem(key);
    });
  }, []);

  return null;
}