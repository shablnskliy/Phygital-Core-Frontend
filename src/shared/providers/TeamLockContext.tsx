"use client";

import { createContext, useContext } from "react";

export const TeamLockContext = createContext<(teamId: string) => string>(() => "");
export function useTeamLock(teamId: string) {
  return useContext(TeamLockContext)(teamId);
}
