import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ADMIN_USER_ID = "00000000-0000-0000-0000-000000000001";

// Using publicly available MP4 URLs that support CORS and direct embedding
const SAMPLE_REELS = [
  {
    author_id: ADMIN_USER_ID,
    video_url: "https://commondatastorage.googleapis.com/gtv-videos-library/sample/BigBuckBunny.mp4",
    thumbnail_url: "https://peach.blender.org/wp-content/uploads/image/poster_bunny.png?x11217",
    caption: "Perfect batting technique - watch how the player maintains balance throughout the shot",
    sport: "Cricket",
    like_count: 324,
    comment_count: 48,
    view_count: 5420
  },
  {
    author_id: ADMIN_USER_ID,
    video_url: "https://commondatastorage.googleapis.com/gtv-videos-library/sample/ElephantsDream.mp4",
    thumbnail_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Elephants_Dream.webm/440px--Elephants_Dream.webm.jpg",
    caption: "Fast bowling mechanics - follow through and release point are crucial",
    sport: "Cricket",
    like_count: 287,
    comment_count: 62,
    view_count: 4890
  },
  {
    author_id: ADMIN_USER_ID,
    video_url: "https://commondatastorage.googleapis.com/gtv-videos-library/sample/ForBiggerBlazes.mp4",
    thumbnail_url: "https://i.ytimg.com/vi/7B5JNbCzYRQ/maxresdefault.jpg",
    caption: "Fielding drills - improve your positioning and reaction time",
    sport: "Cricket",
    like_count: 215,
    comment_count: 31,
    view_count: 3560
  },
  {
    author_id: ADMIN_USER_ID,
    video_url: "https://commondatastorage.googleapis.com/gtv-videos-library/sample/ForBiggerEscapes.mp4",
    thumbnail_url: "https://i.ytimg.com/vi/aqz-KE-bpKQ/maxresdefault.jpg",
    caption: "Training session highlights - strength and conditioning work",
    sport: "Cricket",
    like_count: 156,
    comment_count: 27,
    view_count: 2890
  },
  {
    author_id: ADMIN_USER_ID,
    video_url: "https://commondatastorage.googleapis.com/gtv-videos-library/sample/ForBiggerFun.mp4",
    thumbnail_url: "https://i.ytimg.com/vi/Ks-_Mh1QhMc/maxresdefault.jpg",
    caption: "Match highlights - aggressive batting against pace bowling",
    sport: "Cricket",
    like_count: 423,
    comment_count: 89,
    view_count: 7230
  },
  {
    author_id: ADMIN_USER_ID,
    video_url: "https://commondatastorage.googleapis.com/gtv-videos-library/sample/ForBiggerJoyrides.mp4",
    thumbnail_url: "https://i.ytimg.com/vi/ME3svVEy_O0/maxresdefault.jpg",
    caption: "Spin bowling masterclass - learn variations and control",
    sport: "Cricket",
    like_count: 298,
    comment_count: 54,
    view_count: 5120
  },
  {
    author_id: ADMIN_USER_ID,
    video_url: "https://commondatastorage.googleapis.com/gtv-videos-library/sample/ForBiggerMeltdowns.mp4",
    thumbnail_url: "https://i.ytimg.com/vi/bEWyhU-r8RE/maxresdefault.jpg",
    caption: "Training tips - improve your fitness for cricket",
    sport: "Cricket",
    like_count: 178,
    comment_count: 35,
    view_count: 3045
  },
  {
    author_id: ADMIN_USER_ID,
    video_url: "https://commondatastorage.googleapis.com/gtv-videos-library/sample/Sintel.mp4",
    thumbnail_url: "https://durian.blender.org/wp-content/uploads/2010/07/01_compositing_00000.png",
    caption: "Wicket celebration - best moments from the match",
    sport: "Cricket",
    like_count: 512,
    comment_count: 112,
    view_count: 8945
  },
  {
    author_id: ADMIN_USER_ID,
    video_url: "https://commondatastorage.googleapis.com/gtv-videos-library/sample/SubaruOutbackOnRoad.mp4",
    thumbnail_url: "https://i.ytimg.com/vi/5wSSBJjTSMY/maxresdefault.jpg",
    caption: "Boundary hitting technique - timing and placement",
    sport: "Cricket",
    like_count: 389,
    comment_count: 76,
    view_count: 6234
  },
  {
    author_id: ADMIN_USER_ID,
    video_url: "https://commondatastorage.googleapis.com/gtv-videos-library/sample/TearsOfSteel.mp4",
    thumbnail_url: "https://mango.blender.org/wp-content/uploads/2013/05/13402_tears_of_steel_1080p.png",
    caption: "Night cricket action - lights and energy at the ground",
    sport: "Cricket",
    like_count: 267,
    comment_count: 43,
    view_count: 4567
  }
];

async function seedReels() {
  console.log("🌱 Starting to seed sample reels...");

  try {
    // Check or create admin user
    let adminUser = await prisma.user.findUnique({
      where: { email: "admin@sportivox.com" }
    });

    if (!adminUser) {
      console.log("👤 Creating admin user...");
      adminUser = await prisma.user.create({
        data: {
          id: ADMIN_USER_ID,
          email: "admin@sportivox.com",
          email_lower: "admin@sportivox.com",
          full_name: "Sportivox Official",
          full_name_lower: "sportivox official",
          password_hash: "seeded_admin", // Placeholder
          role: "admin" as any,
          email_verified: true
        }
      });
      console.log("✅ Admin user created");
    } else {
      console.log("✅ Admin user already exists");
    }

    // Delete existing reels
    const deleted = await prisma.reel.deleteMany({
      where: { author_id: ADMIN_USER_ID }
    });
    console.log(`🗑️  Deleted ${deleted.count} existing sample reels`);

    // Create new sample reels
    for (const reel of SAMPLE_REELS) {
      const created = await prisma.reel.create({
        data: {
          author_id: reel.author_id,
          video_url: reel.video_url,
          thumbnail_url: reel.thumbnail_url,
          caption: reel.caption,
          sport: reel.sport,
          like_count: reel.like_count,
          comment_count: reel.comment_count,
          view_count: reel.view_count
        }
      });
      console.log(`✅ Created reel: "${created.caption?.substring(0, 40)}..."`);
    }

    console.log(`\n🎉 Successfully seeded ${SAMPLE_REELS.length} sample reels!`);
  } catch (error) {
    console.error("❌ Error seeding reels:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedReels();
