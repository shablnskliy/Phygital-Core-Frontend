"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { type User, type authService } from "@/entities/user/@x/platform";
import { platformService } from "../api/platformService";
import { createPlatformActions } from "../api/createPlatformActions";
import { initialState } from "./initialState";
import { type PlatformActions } from "./types";

const PlatformContext = createContext<PlatformActions | null>(null);

export function PlatformProvider({
  children,
  actor: signedInUser,
  accountService,
}: {
  children: ReactNode;
  actor: User | null;
  accountService: typeof authService;
}) {
  const [state, setState] = useState(initialState);
  const [storageError, setStorageError] = useState("");

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      const token = localStorage.getItem("jwt_token");

      let backendTeams = null;
      let backendLogs = null;
      let backendUsers = null;
      let backendFeedback = null;
      let backendTournaments = null;
      let backendApplications = null;

      if (token) {
        try {
          const resTeams = await fetch("http://localhost:8080/api/teams", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (resTeams.ok) backendTeams = await resTeams.json();

          const resLogs = await fetch("http://localhost:8080/api/admin-logs", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (resLogs.ok) backendLogs = await resLogs.json();

          const resUsers = await fetch("http://localhost:8080/api/users", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (resUsers.ok) backendUsers = await resUsers.json();

          const resFeedback = await fetch("http://localhost:8080/api/feedback", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (resFeedback.ok) backendFeedback = await resFeedback.json();

          const resTournaments = await fetch("http://localhost:8080/api/tournaments", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (resTournaments.ok) backendTournaments = await resTournaments.json();

          const resApps = await fetch("http://localhost:8080/api/tournament-applications", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (resApps.ok) backendApplications = await resApps.json();
        } catch (error) {
          console.error("Ошибка загрузки с сервера:", error);
        }
      }

      try {
        const saved = await platformService.getState(initialState);
        if (active) {
          setState({
            ...saved,
            teams: backendTeams !== null ? backendTeams : saved.teams,
            logs: backendLogs !== null ? backendLogs : saved.logs,
            users: backendUsers !== null ? backendUsers : saved.users,
            feedback: backendFeedback !== null ? backendFeedback : saved.feedback,
            tournaments: backendTournaments !== null ? backendTournaments : saved.tournaments,
            tournamentApplications:
              backendApplications !== null ? backendApplications : saved.tournamentApplications,
          });
          setStorageError("");
        }
      } catch (err) {
        if (active) {
          setStorageError(
            "Не удалось загрузить локальные данные. Проверьте доступ к хранилищу и перезагрузите страницу.",
          );
        }
      }
    };

    const handleRefresh = () => {
      void refresh();
    };

    const unsubscribe = platformService.subscribe(handleRefresh);
    handleRefresh();

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<User>).detail;
      if (!detail?.id) return;
      void platformService
        .updateState((previous) => {
          const exists = previous.users.some((item) => item.id === detail.id);
          const users = exists
            ? previous.users.map((item) => (item.id === detail.id ? { ...item, ...detail } : item))
            : [...previous.users, { ...detail, createdAt: new Date().toISOString() }];
          return { ...previous, users };
        }, initialState)
        .then(setState)
        .catch(() => setStorageError("Не удалось сохранить данные пользователя"));
    };
    window.addEventListener("phygital:user-sync", sync);
    return () => window.removeEventListener("phygital:user-sync", sync);
  }, []);

  const actions = useMemo(
    () =>
      createPlatformActions(
        state,
        signedInUser,
        accountService,
        async (change) => {
          const next = await platformService.updateState(change, initialState);
          setState(next);
        },
        setStorageError,
      ),
    [state, signedInUser, accountService],
  );

  return (
    <PlatformContext.Provider value={actions}>
      {storageError && (
        <p className="storage-error" role="alert">
          {storageError}
        </p>
      )}
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatformStore() {
  const value = useContext(PlatformContext);
  if (!value) throw new Error("usePlatformStore requires PlatformProvider");
  return value;
}
