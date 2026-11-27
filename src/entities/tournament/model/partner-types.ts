import type { TournamentApplication } from "@/entities/tournament-application/@x/tournament";
import type { Tournament } from "./types";

export interface PartnerTournamentState {
  tournaments: Tournament[];
  applications: TournamentApplication[];
}

export interface PartnerTournamentSnapshot extends PartnerTournamentState {
  error: string | null;
}

// Minimal action contexts: the existing User and Team objects fit these shapes.
// They do not create a second user/team collection or change backend contracts.
export interface PartnerActor {
  id: string;
  role: "USER" | "ADMIN";
  firstName: string;
  lastName: string;
}

export interface PartnerTeam {
  id: string;
  members: { id: string; captain?: boolean }[];
}

export interface PartnerTournamentDraft {
  name: string;
  shortDescription: string;
  fullDescription?: string;
  city: string;
  startAt: string;
  endAt?: string | null;
  imageName?: string;
  imageUrl?: string;
}
