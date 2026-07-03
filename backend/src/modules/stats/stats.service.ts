import { prisma } from "../../config/prisma";

export async function publicStats() {
  const [athletes, clubs, openOpportunities, selected] = await Promise.all([
    prisma.user.count({ where: { role: "athlete" } }),
    prisma.organization.count(),
    prisma.opportunity.count({ where: { status: "open" } }),
    prisma.application.count({ where: { status: "selected" } })
  ]);
  return { athletes, clubs, open_opportunities: openOpportunities, players_selected: selected };
}
