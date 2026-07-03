// One-off: finds matches stuck at status="live"/"upcoming" whose final innings
// already finished (all out / overs done / target chased) and completes them,
// so they stop being invisible on the Results tab. Safe to re-run.
import { prisma } from "../src/config/prisma";

async function main() {
  const matches = await prisma.match.findMany({
    where: { status: { in: ["live", "upcoming"] } },
    include: { tournament: { select: { overs_per_innings: true, number_of_innings: true } }, innings: true }
  });

  let fixed = 0;

  for (const match of matches) {
    const totalInnings = match.tournament?.number_of_innings ?? 2;
    const last = match.innings.find(i => i.innings_number === totalInnings);
    if (!last) continue;

    const battingSquad = await prisma.matchPlayer.count({
      where: { match_id: match.id, team_id: last.batting_team_id }
    });
    const maxWickets = Math.min(Math.max((battingSquad || 11) - 1, 1), 10);
    const oversTotal = match.tournament?.overs_per_innings ?? null;

    const allOut   = last.total_wickets >= maxWickets;
    const oversDone = oversTotal != null && last.total_balls >= oversTotal * 6;
    const chaseDone = last.target != null && last.total_runs >= last.target;
    if (!(allOut || oversDone || chaseDone)) continue;

    const data: any = { status: "completed" };

    if (totalInnings === 2) {
      const inn1 = match.innings.find(i => i.innings_number === 1);
      const inn2 = match.innings.find(i => i.innings_number === 2);
      if (inn1 && inn2) {
        if (inn2.total_runs > inn1.total_runs) {
          const team = await prisma.team.findUnique({ where: { id: inn2.batting_team_id }, select: { name: true } });
          data.winner_team_id = inn2.batting_team_id;
          data.result_summary = `${team?.name ?? "Team"} won by ${maxWickets - inn2.total_wickets} wicket(s)`;
        } else if (inn1.total_runs > inn2.total_runs) {
          const team = await prisma.team.findUnique({ where: { id: inn1.batting_team_id }, select: { name: true } });
          data.winner_team_id = inn1.batting_team_id;
          data.result_summary = `${team?.name ?? "Team"} won by ${inn1.total_runs - inn2.total_runs} run(s)`;
        } else {
          data.result_summary = "Match tied";
        }
      }
    }

    await prisma.match.update({ where: { id: match.id }, data });
    await prisma.innings.updateMany({
      where: { match_id: match.id, innings_number: { lte: totalInnings } },
      data: { is_completed: true }
    });
    fixed++;
    console.log(`Completed match ${match.id}${data.result_summary ? `: ${data.result_summary}` : ""}`);
  }

  console.log(`Done. ${fixed} match(es) backfilled.`);
}

main().finally(() => prisma.$disconnect());
