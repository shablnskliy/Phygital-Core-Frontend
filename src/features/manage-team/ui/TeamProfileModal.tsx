"use client";

import { useState, type FormEvent } from "react";
import { Crown, Plus, Trash2, Pencil, LogOut } from "lucide-react";
import { type Team, TeamRoster, participants, initials } from "@/entities/team";
import { usePlatformStore } from "@/entities/platform";
import { useAuth } from "@/entities/user";
import { useApp, useTeamLock } from "@/shared/providers";
import { Button, GlowButton, SecondaryButton } from "@/shared/ui/Button";
import { Modal } from "@/shared/ui/Modal";
export function TeamProfileModal({
  team,
  close,
  invite,
}: {
  team: Team;
  close: () => void;
  invite: () => void;
}) {
  const store = usePlatformStore(),
    { user } = useAuth(),
    { notify } = useApp();
  const lockReason = useTeamLock(team.id);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [captainId, setCaptainId] = useState(""),
    [changeCaptain, setChangeCaptain] = useState(false);
  const [editing, setEditing] = useState(false),
    [name, setName] = useState(team.name);
  const [confirm, setConfirm] = useState<{
    kind: "delete" | "remove" | "captain" | "leave";
    id?: string;
    name: string;
  } | null>(null);
  const isMember = Boolean(user && team.members.some((member) => member.id === user.id));
  const canManage = Boolean(
    user && team.members.some((member) => member.id === user.id && member.captain),
  );
  const run = async () => {
    if (lockReason) {
      setError(lockReason);
      return;
    }
    if (!confirm || busy || (confirm.kind === "leave" ? !isMember || canManage : !canManage))
      return;
    setBusy(true);
    setError("");
    try {
      if (confirm.kind === "leave") {
        await store.leaveTeam(team.id);
        notify("Вы вышли из команды");
        close();
      }
      if (confirm.kind === "delete") {
        await store.deleteTeam(team.id);
        notify("Команда удалена");
        close();
      }
      if (confirm.kind === "remove") {
        await store.removeTeamMember(team.id, confirm.id!);
        notify("Участник удалён из команды");
      }
      if (confirm.kind === "captain") {
        await store.assignCaptain(team.id, confirm.id!);
        notify("Капитан команды изменён");
        setChangeCaptain(false);
      }
      setConfirm(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить изменения");
    } finally {
      setBusy(false);
    }
  };
  const saveName = async (event: FormEvent) => {
    event.preventDefault();
    if (lockReason) {
      setError(lockReason);
      return;
    }
    if (busy || !canManage) return;
    setBusy(true);
    setError("");
    try {
      await store.updateTeam(team.id, { name });
      notify("Название команды сохранено");
      setEditing(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить название");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={editing ? "Редактировать команду" : team.name}
      subtitle={participants(team.members.length)}
      onClose={close}
      busy={busy}
    >
      <div className="team-profile-summary">
        <span className="team-monogram">{initials(team.name)}</span>
        <div>
          <span className="eyebrow">СОСТАВ КОМАНДЫ</span>
          <p>Одна команда. Общая цель.</p>
        </div>
      </div>
      {lockReason && (
        <p className="team-lock-notice" role="status">
          {lockReason}
        </p>
      )}
      <TeamRoster
        members={team.members}
        renderMemberAction={(member) =>
          canManage && (
            <button
              className="icon-button danger-icon"
              disabled={busy || Boolean(lockReason)}
              aria-label={`Удалить игрока ${member.name}`}
              onClick={() => {
                setError("");
                setConfirm({ kind: "remove", id: member.id, name: member.name });
              }}
            >
              <Trash2 />
            </button>
          )
        }
      />
      {canManage && (
        <div className="team-edit-actions">
          <Button
            type="button"
            onClick={() => {
              setName(team.name);
              setEditing(!editing);
              setError("");
            }}
            disabled={busy || Boolean(lockReason)}
          >
            <Pencil />
            Редактировать команду
          </Button>
        </div>
      )}
      {editing && canManage && (
        <form className="team-rename" onSubmit={saveName}>
          <label>
            Название команды
            <input
              required
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={busy || Boolean(lockReason)}
            />
          </label>
          <div className="form-actions">
            <Button
              type="button"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setError("");
              }}
            >
              Отмена
            </Button>
            <Button variant="primary" type="submit" loading={busy} disabled={Boolean(lockReason)}>
              Сохранить
            </Button>
          </div>
        </form>
      )}
      {isMember && !canManage && (
        <div className="team-edit-actions">
          <Button
            type="button"
            variant="danger"
            disabled={busy || Boolean(lockReason)}
            onClick={() => {
              setError("");
              setConfirm({ kind: "leave", name: team.name });
            }}
          >
            <LogOut />
            Выйти из команды
          </Button>
        </div>
      )}
      {canManage && (
        <div className="team-management">
          <GlowButton onClick={invite} disabled={busy || Boolean(lockReason)}>
            <Plus />
            Пригласить игрока
          </GlowButton>
          <SecondaryButton
            onClick={() => setChangeCaptain(!changeCaptain)}
            disabled={busy || Boolean(lockReason) || team.members.length < 2}
          >
            <Crown />
            Изменить капитана
          </SecondaryButton>
          <button
            className="text-button team-delete"
            disabled={busy || Boolean(lockReason)}
            onClick={() => {
              setError("");
              setConfirm({ kind: "delete", name: team.name });
            }}
          >
            <Trash2 />
            Удалить команду
          </button>
        </div>
      )}
      {changeCaptain && canManage && (
        <form
          className="captain-transfer"
          onSubmit={(event) => {
            event.preventDefault();
            const member = team.members.find((item) => item.id === captainId);
            if (member) setConfirm({ kind: "captain", id: member.id, name: member.name });
          }}
        >
          <label>
            Новый капитан
            <select
              required
              value={captainId}
              disabled={busy || Boolean(lockReason)}
              onChange={(event) => setCaptainId(event.target.value)}
            >
              <option value="" disabled>
                Выберите участника
              </option>
              {team.members
                .filter((member) => !member.captain)
                .map((member) => (
                  <option value={member.id} key={member.id}>
                    {member.name}
                  </option>
                ))}
            </select>
          </label>
          <Button variant="secondary" className="secondary" disabled={busy || Boolean(lockReason)}>
            Назначить капитана
          </Button>
        </form>
      )}
      {confirm && (canManage || (confirm.kind === "leave" && isMember)) && (
        <div className="team-confirm" role="alert">
          <h3>
            {confirm.kind === "leave"
              ? "Покинуть команду?"
              : confirm.kind === "delete"
                ? "Удалить команду?"
                : confirm.kind === "remove"
                  ? "Удалить участника?"
                  : "Передать капитанство?"}
          </h3>
          <p>
            {confirm.kind === "leave"
              ? "Вы будете удалены из текущего состава."
              : confirm.kind === "delete"
                ? "Команда будет удалена, а ожидающие приглашения отменены."
                : confirm.kind === "remove"
                  ? `${confirm.name} будет удалён из состава.`
                  : `${confirm.name} получит управление командой. Вы останетесь участником.`}
          </p>
          <div className="form-actions">
            <SecondaryButton
              disabled={busy}
              onClick={() => {
                setConfirm(null);
                setError("");
              }}
            >
              Отмена
            </SecondaryButton>
            <Button
              type="button"
              variant={confirm.kind === "captain" ? "primary" : "danger"}
              loading={busy}
              disabled={Boolean(lockReason)}
              onClick={() => void run()}
            >
              {confirm.kind === "leave" ? "Выйти" : "Подтвердить"}
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
