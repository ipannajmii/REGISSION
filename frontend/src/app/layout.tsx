// src/app/layout.tsx
import "./globals.css";

import type { Metadata } from "next";
import SessionActivationBridge from "@/components/regission/session-activation-bridge";
import SessionStorageCleanup from "@/components/regission/session-storage-cleanup";
import ProfileAvatarRepair from "@/components/regission/ProfileAvatarRepair";
import HostedAvatarUploadOverride from "@/components/regission/HostedAvatarUploadOverride";
import MoveHistoryScroller from "../components/MoveHistoryScroller";

export const metadata: Metadata = {
  title: "Regission",
  description: "Vision-powered chess notation for physical boards.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0f172a] text-white">
        {/* REGISSION_HOSTED_AVATAR_UPLOAD_V2 */}
        <HostedAvatarUploadOverride />
        {/* REGISSION_PROFILE_AVATAR_REPAIR_V2 */}
        <ProfileAvatarRepair />
<SessionActivationBridge />
        <SessionStorageCleanup />
{children}
      
        {/* REGISSION_MOVE_LIST_ONLY_SCROLL_V2 */}
        <MoveHistoryScroller />
      </body>
    </html>
  );
}
