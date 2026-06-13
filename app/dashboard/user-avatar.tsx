"use client";

import { useAppSelector } from "../store/hooks";

interface UserAvatarProps {
  className?: string;
}

export function UserAvatar({
  className = "size-11 rounded-full object-cover",
}: Readonly<UserAvatarProps>) {
  const { user } = useAppSelector((state) => state.auth);
  const { data: profile } = useAppSelector((state) => state.profile);

  const src =
    profile?.profile_image || user?.photoURL || "/profile-avatar.svg";
  const name = profile?.name ?? user?.displayName ?? user?.email ?? "User";

  return <img alt={`${name} profile photo`} className={className} src={src} />;
}
