import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Demo user stats data
const demoStats = [
  {
    scenariosCompleted: 42,
    scenariosStarted: 45,
    totalPoints: 2850,
    averageScore: 68,
    currentStreak: 7,
    bestStreak: 15,
  },
  {
    scenariosCompleted: 28,
    scenariosStarted: 35,
    totalPoints: 2100,
    averageScore: 75,
    currentStreak: 3,
    bestStreak: 12,
  },
  {
    scenariosCompleted: 15,
    scenariosStarted: 18,
    totalPoints: 1200,
    averageScore: 80,
    currentStreak: 5,
    bestStreak: 8,
  },
  {
    scenariosCompleted: 65,
    scenariosStarted: 70,
    totalPoints: 4550,
    averageScore: 70,
    currentStreak: 12,
    bestStreak: 20,
  },
  {
    scenariosCompleted: 8,
    scenariosStarted: 12,
    totalPoints: 640,
    averageScore: 80,
    currentStreak: 1,
    bestStreak: 4,
  },
  {
    scenariosCompleted: 35,
    scenariosStarted: 40,
    totalPoints: 2450,
    averageScore: 70,
    currentStreak: 9,
    bestStreak: 14,
  },
  {
    scenariosCompleted: 52,
    scenariosStarted: 55,
    totalPoints: 3900,
    averageScore: 75,
    currentStreak: 6,
    bestStreak: 18,
  },
  {
    scenariosCompleted: 20,
    scenariosStarted: 25,
    totalPoints: 1600,
    averageScore: 80,
    currentStreak: 4,
    bestStreak: 10,
  },
  {
    scenariosCompleted: 90,
    scenariosStarted: 95,
    totalPoints: 6300,
    averageScore: 70,
    currentStreak: 15,
    bestStreak: 25,
  },
  {
    scenariosCompleted: 5,
    scenariosStarted: 8,
    totalPoints: 375,
    averageScore: 75,
    currentStreak: 0,
    bestStreak: 3,
  },
];

// To seed run
// npx convex run seedUserStats:seedUserStats
export const seedUserStats = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all users
    const users = await ctx.db.query("users").collect();

    if (users.length === 0) {
      console.log(
        "No users found. Please ensure users exist before seeding stats."
      );
      return { success: false, message: "No users found" };
    }

    let statsCreated = 0;

    // Assign stats to users
    for (let i = 0; i < users.length && i < demoStats.length; i++) {
      const user = users[i];

      // Check if user already has stats
      const existingStats = await ctx.db
        .query("userStats")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .first();

      if (!existingStats) {
        await ctx.db.insert("userStats", {
          userId: user._id,
          ...demoStats[i],
        });
        statsCreated++;
        console.log(`Created stats for user: ${user.name} (${user.email})`);
      } else {
        console.log(`User ${user.name} already has stats, skipping...`);
      }
    }

    return {
      success: true,
      message: `Created stats for ${statsCreated} users`,
      totalUsers: users.length,
      statsCreated,
    };
  },
});
