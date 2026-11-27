import type { Tournament, TournamentPageContent } from "@/entities/tournament";

export interface DemoDocument {
  version: 1;
  tournaments: Tournament[];
  pages: Record<string, TournamentPageContent>;
}

export interface DemoSnapshot extends DemoDocument {
  error: string | null;
}
