import type { ReactNode } from "react";
import { Crown } from "lucide-react";
import { Badge } from "@/shared/ui/Badge";
import type { TeamMember } from "../model/types";
import { initials } from "../lib/presentation";

export function TeamRoster({
  members,
  renderMemberAction,
}: {
  members: readonly TeamMember[];
  renderMemberAction?: (member: TeamMember) => ReactNode;
}) {
  return (
    <div className="team-roster" aria-label="Состав команды">
      {members.map((member) => (
        <div className="roster-member" key={member.id}>
          <span className="roster-avatar" aria-hidden="true">
            {initials(member.name)}
          </span>
          <span className="roster-name">
            <b>{member.name}</b>
            <small>{member.captain ? "Капитан команды" : "Участник"}</small>
          </span>
          {member.captain ? (
            <Badge>
              <Crown aria-hidden="true" />
              Капитан
            </Badge>
          ) : (
            renderMemberAction?.(member)
          )}
        </div>
      ))}
      {!members.length && <p>Игроки пока не добавлены.</p>}
    </div>
  );
}
