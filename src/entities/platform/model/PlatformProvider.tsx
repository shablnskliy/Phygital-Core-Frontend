"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { type User, type authService } from "@/entities/user/@x/platform";
import { platformService } from "../api/platformService";
import { createPlatformActions } from "../api/createPlatformActions";
import { initialState } from "./initialState";
import { type PlatformActions } from "./types";

const PlatformContext = createContext<PlatformActions | null>(null);
const PlatformLoadingContext = createContext(true);

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      if (active) setLoading(true);
      const token = localStorage.getItem("jwt_token");

      let backendTeams = null;
      let backendLogs = null;
      let backendUsers = null;
      let backendFeedback = null;
      let backendTournaments = null;
      let backendApplications = null;
      let backendInvitations = null;
      let backendNotifications = null;

      // ==========================================
      // 1. ПУБЛИЧНЫЕ ДАННЫЕ (Грузим ВСЕГДА, даже без токена)
      // ==========================================
      try {
        const resTeams = await fetch("https://phygitalcore.ru/api/v1/teams");
        if (resTeams.ok) backendTeams = await resTeams.json();
      } catch (e) {
        console.error("Ошибка загрузки команд:", e);
      }

      try {
        const resTournaments = await fetch("https://phygitalcore.ru/api/v1/tournaments");
        if (resTournaments.ok) backendTournaments = await resTournaments.json();
      } catch (e) {
        console.error("Ошибка загрузки турниров:", e);
      }

      // ==========================================
      // 2. ПРИВАТНЫЕ ДАННЫЕ (Только с токеном)
      // ==========================================
      if (token) {
        try {
          const resLogs = await fetch("https://phygitalcore.ru/api/v1/admin-logs", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (resLogs.ok) backendLogs = await resLogs.json();
        } catch (e) { console.error("Ошибка логов:", e); }

        try {
          const resUsers = await fetch("https://phygitalcore.ru/api/v1/admin/users", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (resUsers.ok) backendUsers = await resUsers.json();
        } catch (e) { console.error("Ошибка юзеров:", e); }

        try {
          const resFeedback = await fetch("https://phygitalcore.ru/api/v1/feedback", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (resFeedback.ok) backendFeedback = await resFeedback.json();
        } catch (e) { console.error("Ошибка фидбека:", e); }

        try {
          const resApps = await fetch("https://phygitalcore.ru/api/v1/tournament-applications", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (resApps.ok) backendApplications = await resApps.json();
        } catch (e) { console.error("Ошибка заявок:", e); }

        try {
          const resInvitations = await fetch("https://phygitalcore.ru/api/v1/invitations", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (resInvitations.ok) backendInvitations = await resInvitations.json();
        } catch (e) { console.error("Ошибка приглашений:", e); }

        try {
          const resNotifications = await fetch("https://phygitalcore.ru/api/v1/notifications", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (resNotifications.ok) backendNotifications = await resNotifications.json();
        } catch (e) { console.error("Ошибка уведомлений:", e); }
      }

      // ==========================================
      // 3. ОБНОВЛЕНИЕ СТЕЙТА
      // ==========================================
      try {
        const saved = await platformService.getState(initialState);
        if (active) {
          setState({
            ...saved,
            teams: backendTeams ?? [],
            logs: backendLogs ?? [],
            users: backendUsers ?? [],
            feedback: backendFeedback ?? [],
            tournaments: backendTournaments ?? [],
            tournamentApplications: backendApplications ?? [],
            invitations: backendInvitations ?? [],
            notifications: backendNotifications ?? [],
          });
          setStorageError("");
        }
      } catch (err) {
        if (active) {
          setStorageError(
              "Не удалось загрузить локальные данные. Проверьте доступ к хранилищу и перезагрузите страницу.",
          );
        }
      } finally {
        if (active) setLoading(false);
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
      <PlatformLoadingContext.Provider value={loading}>
      <PlatformContext.Provider value={actions}>
        {storageError && (
            <p className="storage-error" role="alert">
              {storageError}
            </p>
        )}
        {children}
      </PlatformContext.Provider>
      </PlatformLoadingContext.Provider>
  );
}

// App-level features may decorate actions without changing their API implementation.
export function PlatformActionsProvider({ value, children }: { value: PlatformActions; children: ReactNode }) {
  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function usePlatformLoading() {
  return useContext(PlatformLoadingContext);
}

export function usePlatformStore() {
  const value = useContext(PlatformContext);
  if (!value) throw new Error("usePlatformStore requires PlatformProvider");
  return value;
}
