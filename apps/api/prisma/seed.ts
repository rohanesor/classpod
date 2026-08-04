import { PrismaClient, UserRole } from '@prisma/client';
import * as bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = bcryptjs.hashSync('password123', 10);

  const users = [
    {
      email: 'student@classpod.com',
      name: 'Student User',
      role: UserRole.STUDENT,
      passwordHash,
      isActive: true,
    },
    {
      email: 'teacher@classpod.com',
      name: 'Teacher User',
      role: UserRole.TEACHER,
      passwordHash,
      isActive: true,
    },
    {
      email: 'admin@classpod.com',
      name: 'Admin User',
      role: UserRole.ADMIN,
      passwordHash,
      isActive: true,
    },
  ];

  console.log('Seeding default users...');

  for (const user of users) {
    const upsertedUser = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        passwordHash: user.passwordHash,
        isActive: user.isActive,
      },
      create: user,
    });
    console.log(`Upserted user: ${upsertedUser.email} (Role: ${upsertedUser.role})`);
  }

  console.log('Seeding default gateway node...');
  await prisma.gateway.upsert({
    where: { id: 'esp32-cam-node-1' },
    update: {
      name: 'Classroom ESP32-CAM Node 1',
      classroom: 'Room 101',
    },
    create: {
      id: 'esp32-cam-node-1',
      name: 'Classroom ESP32-CAM Node 1',
      classroom: 'Room 101',
      status: 'OFFLINE',
    },
  });

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
