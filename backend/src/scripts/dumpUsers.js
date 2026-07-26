import prisma from "../config/prismaClient.js";

const run = async () => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        createdAt: true
      }
    });
    console.log("Users in Database:");
    console.log(JSON.stringify(users, null, 2));
  } catch (err) {
    console.error("Error querying users:", err.message);
  }
  process.exit(0);
};

run();
