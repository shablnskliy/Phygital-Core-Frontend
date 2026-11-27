"use client";

import { useId, useState } from "react";
import { TelegramIcon } from "@/shared/ui/SocialIcon";

export function NoTeamHelp() {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <section className="no-team-help">
      <button
        type="button"
        className="no-team-help-trigger"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        Нет команды?
      </button>
      {open && (
        <div id={id} className="no-team-help-content">
          <p>
            Пока нет команды? Это не проблема! Создай свою или найди игроков для участия в турнире в
            нашем Telegram-чате.
          </p>
          <a href="https://t.me/phygitalcoretalk" target="_blank" rel="noopener noreferrer">
            <TelegramIcon /> Telegram-чат Phygital Core
          </a>
        </div>
      )}
    </section>
  );
}
