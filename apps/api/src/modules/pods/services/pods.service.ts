import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/common/database/prisma.service';
import { EventLoggerService } from '@/common/observability/event-logger.service';
import { CreatePodDto } from '../dtos/create-pod.dto';
import { UpdatePodDto } from '../dtos/update-pod.dto';
import { POD_EVENT_NAMES, POD_AUDIT_ACTIONS } from '../constants/pod-events';
import { PodStatus, EnrollmentStatus } from '@prisma/client';
import { validateGeoBoundary } from '../utils/geo-boundary.util';

function generateJoinCode(length = 7): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

@Injectable()
export class PodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventLogger: EventLoggerService,
  ) {}

  async create(teacherId: string, dto: CreatePodDto) {
    if (dto.geoBoundary) {
      const val = validateGeoBoundary(dto.geoBoundary);
      if (!val.valid) {
        throw new BadRequestException(val.error || 'Invalid classroom geospatial boundary.');
      }
    }

    let joinCode = '';
    let isUnique = false;

    while (!isUnique) {
      joinCode = generateJoinCode();
      const existing = await this.prisma.pod.findUnique({
        where: { joinCode },
      });
      if (!existing) {
        isUnique = true;
      }
    }

    const pod = await this.prisma.pod.create({
      data: {
        name: dto.name,
        subjectCode: dto.subjectCode,
        description: dto.description,
        semester: dto.semester,
        section: dto.section,
        geoBoundary: dto.geoBoundary ? (dto.geoBoundary as any) : undefined,
        joinCode,
        teacherId,
        status: PodStatus.ACTIVE,
      },
    });

    this.eventLogger.audit(POD_AUDIT_ACTIONS.CREATE, {
      actorUserId: teacherId,
      entityType: 'Pod',
      entityId: pod.id,
      name: pod.name,
      subjectCode: pod.subjectCode,
      joinCode: pod.joinCode,
    });

    this.eventLogger.event(POD_EVENT_NAMES.CREATED, {
      podId: pod.id,
      teacherId,
      name: pod.name,
      subjectCode: pod.subjectCode,
      joinCode: pod.joinCode,
    });

    return pod;
  }

  async update(teacherId: string, id: string, dto: UpdatePodDto) {
    const pod = await this.prisma.pod.findUnique({
      where: { id },
    });

    if (!pod) {
      throw new NotFoundException('Pod not found');
    }

    if (pod.teacherId !== teacherId) {
      throw new ForbiddenException('You do not own this pod');
    }

    if (dto.geoBoundary !== undefined) {
      if (dto.geoBoundary !== null) {
        const val = validateGeoBoundary(dto.geoBoundary);
        if (!val.valid) {
          throw new BadRequestException(val.error || 'Invalid classroom geospatial boundary.');
        }
      }
    }

    const updatedPod = await this.prisma.pod.update({
      where: { id },
      data: {
        name: dto.name,
        subjectCode: dto.subjectCode,
        description: dto.description,
        semester: dto.semester,
        section: dto.section,
        geoBoundary: dto.geoBoundary !== undefined ? (dto.geoBoundary as any) : undefined,
      },
    });

    this.eventLogger.audit(POD_AUDIT_ACTIONS.UPDATE, {
      actorUserId: teacherId,
      entityType: 'Pod',
      entityId: updatedPod.id,
      name: updatedPod.name,
      subjectCode: updatedPod.subjectCode,
    });

    this.eventLogger.event(POD_EVENT_NAMES.UPDATED, {
      podId: updatedPod.id,
      teacherId,
      name: updatedPod.name,
      subjectCode: updatedPod.subjectCode,
    });

    return updatedPod;
  }

  async archive(teacherId: string, id: string) {
    const pod = await this.prisma.pod.findUnique({
      where: { id },
    });

    if (!pod) {
      throw new NotFoundException('Pod not found');
    }

    if (pod.teacherId !== teacherId) {
      throw new ForbiddenException('You do not own this pod');
    }

    const archivedPod = await this.prisma.pod.update({
      where: { id },
      data: {
        status: PodStatus.ARCHIVED,
      },
    });

    this.eventLogger.audit(POD_AUDIT_ACTIONS.ARCHIVE, {
      actorUserId: teacherId,
      entityType: 'Pod',
      entityId: archivedPod.id,
    });

    this.eventLogger.event(POD_EVENT_NAMES.ARCHIVED, {
      podId: archivedPod.id,
      teacherId,
    });

    return archivedPod;
  }

  async findAllByTeacher(teacherId: string) {
    return this.prisma.pod.findMany({
      where: { teacherId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, role: string, id: string) {
    const pod = await this.prisma.pod.findUnique({
      where: { id },
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        enrollments: {
          select: {
            status: true,
            joinedAt: true,
            leftAt: true,
            student: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!pod) {
      throw new NotFoundException('Pod not found');
    }

    if (role === 'TEACHER' && pod.teacherId !== userId) {
      throw new ForbiddenException('You do not own this pod');
    }

    if (role === 'STUDENT') {
      const isEnrolled = pod.enrollments.some(
        (e) => e.student.id === userId && e.status === EnrollmentStatus.ACTIVE
      );
      if (!isEnrolled) {
        throw new ForbiddenException('You are not enrolled in this pod');
      }
    }

    return pod;
  }

  async join(studentId: string, joinCode: string) {
    const pod = await this.prisma.pod.findFirst({
      where: {
        joinCode,
        status: PodStatus.ACTIVE,
      },
    });

    if (!pod) {
      throw new NotFoundException('Pod not found or archived');
    }

    const existingEnrollment = await this.prisma.enrollment.findUnique({
      where: {
        podId_studentId: {
          podId: pod.id,
          studentId,
        },
      },
    });

    let enrollment;

    if (existingEnrollment) {
      if (existingEnrollment.status === EnrollmentStatus.ACTIVE) {
        throw new BadRequestException('You are already enrolled in this pod');
      }

      enrollment = await this.prisma.enrollment.update({
        where: { id: existingEnrollment.id },
        data: {
          status: EnrollmentStatus.ACTIVE,
          joinedAt: new Date(),
          leftAt: null,
        },
      });
    } else {
      enrollment = await this.prisma.enrollment.create({
        data: {
          podId: pod.id,
          studentId,
          status: EnrollmentStatus.ACTIVE,
        },
      });
    }

    this.eventLogger.audit(POD_AUDIT_ACTIONS.JOIN, {
      actorUserId: studentId,
      entityType: 'Enrollment',
      entityId: enrollment.id,
      podId: pod.id,
      studentId,
    });

    this.eventLogger.event(POD_EVENT_NAMES.STUDENT_JOINED, {
      podId: pod.id,
      studentId,
    });

    return enrollment;
  }

  async leave(studentId: string, podId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        podId_studentId: {
          podId,
          studentId,
        },
      },
    });

    if (!enrollment || enrollment.status !== EnrollmentStatus.ACTIVE) {
      throw new NotFoundException('Enrollment not found');
    }

    const updatedEnrollment = await this.prisma.enrollment.update({
      where: { id: enrollment.id },
      data: {
        status: EnrollmentStatus.LEFT,
        leftAt: new Date(),
      },
    });

    this.eventLogger.audit(POD_AUDIT_ACTIONS.LEAVE, {
      actorUserId: studentId,
      entityType: 'Enrollment',
      entityId: updatedEnrollment.id,
      podId,
      studentId,
    });

    this.eventLogger.event(POD_EVENT_NAMES.STUDENT_LEFT, {
      podId,
      studentId,
    });

    return updatedEnrollment;
  }

  async findAllByStudent(studentId: string) {
    return this.prisma.pod.findMany({
      where: {
        status: PodStatus.ACTIVE,
        enrollments: {
          some: {
            studentId,
            status: EnrollmentStatus.ACTIVE,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
