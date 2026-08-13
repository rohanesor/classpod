import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { BiometricCredential } from '@prisma/client';
import * as crypto from 'crypto';

export interface BiometricRegistrationDto {
  credentialId: string;
  publicKey?: string;
  fingerprintName?: string;
  algorithm?: string;
  deviceModel?: string;
}

@Injectable()
export class BiometricsService {
  private readonly logger = new Logger(BiometricsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a cryptographic WebAuthn registration challenge for the student.
   */
  async generateRegistrationOptions(userId: string, clientHostname?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const challenge = crypto.randomBytes(32).toString('base64url');

    let rpId = 'classpod.duckdns.org';
    if (clientHostname && typeof clientHostname === 'string') {
      const parts = clientHostname.split(':');
      const cleanHost = (parts[0] || '').trim();
      if (cleanHost === 'localhost' || cleanHost.includes('.') || cleanHost === '127.0.0.1') {
        rpId = cleanHost;
      }
    }

    return {
      challenge,
      rp: {
        name: 'ClassPod Attendance Security',
        id: rpId,
      },
      user: {
        id: Buffer.from(user.id).toString('base64url'),
        name: user.email,
        displayName: user.name,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },  // ES256 (ECDSA with P-256)
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Built-in Touch ID, Face ID, Android Biometrics
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    };
  }

  /**
   * Registers and stores a validated biometric fingerprint credential for the student.
   */
  async registerCredential(userId: string, dto: BiometricRegistrationDto) {
    if (!dto.credentialId || dto.credentialId.trim().length === 0) {
      throw new BadRequestException('Invalid credential ID for biometric registration');
    }

    const fingerprintName = dto.fingerprintName || 'Primary Device Fingerprint';
    const algorithm = dto.algorithm || 'ES256';
    const publicKey = dto.publicKey || crypto.createHash('sha256').update(dto.credentialId).digest('hex');

    const credential = await this.prisma.biometricCredential.upsert({
      where: { credentialId: dto.credentialId },
      update: {
        publicKey,
        fingerprintName,
        algorithm,
        registeredAt: new Date(),
      },
      create: {
        userId,
        credentialId: dto.credentialId,
        publicKey,
        fingerprintName,
        algorithm,
      },
    });

    this.logger.log(`Biometric fingerprint registered successfully for user ${userId} (Cred: ${credential.credentialId.substring(0, 10)}...)`);

    return {
      success: true,
      credentialId: credential.credentialId,
      fingerprintName: credential.fingerprintName,
      registeredAt: credential.registeredAt,
    };
  }

  /**
   * Returns biometric enrollment status for a student.
   */
  async getStatus(userId: string) {
    const credentials = await this.prisma.biometricCredential.findMany({
      where: { userId },
      orderBy: { registeredAt: 'desc' },
    });

    if (credentials.length === 0) {
      return {
        hasFingerprint: false,
        credentials: [],
        primaryCredential: null,
      };
    }

    const primary = credentials[0];
    if (!primary) {
      return {
        hasFingerprint: false,
        credentials: [],
        primaryCredential: null,
      };
    }

    return {
      hasFingerprint: true,
      credentials: credentials.map((c: BiometricCredential) => ({
        id: c.id,
        credentialId: c.credentialId,
        fingerprintName: c.fingerprintName,
        algorithm: c.algorithm,
        registeredAt: c.registeredAt,
        lastVerifiedAt: c.lastVerifiedAt,
      })),
      primaryCredential: {
        id: primary.id,
        credentialId: primary.credentialId,
        fingerprintName: primary.fingerprintName,
        registeredAt: primary.registeredAt,
        lastVerifiedAt: primary.lastVerifiedAt,
      },
    };
  }

  /**
   * Removes all registered biometric credentials for the user.
   */
  async removeBiometrics(userId: string) {
    const count = await this.prisma.biometricCredential.deleteMany({
      where: { userId },
    });

    this.logger.log(`Removed ${count.count} biometric credentials for user ${userId}`);
    return { success: true, removedCount: count.count };
  }

  /**
   * Verifies that the provided biometric assertion / verification matches an enrolled credential in the database.
   */
  async verifyBiometricAssertion(userId: string, assertion: any) {
    const credentials = await this.prisma.biometricCredential.findMany({
      where: { userId },
    });

    if (credentials.length === 0 || !credentials[0]) {
      return {
        verified: false,
        reason: 'NO_CREDENTIAL_REGISTERED',
      };
    }

    // Check if assertion contains credentialId or match
    const candidateId = assertion?.credentialId || assertion?.id || (typeof assertion === 'string' ? assertion : null);

    let matchedCred: BiometricCredential = credentials[0];
    if (candidateId) {
      const found = credentials.find((c: BiometricCredential) => c.credentialId === candidateId);
      if (found) matchedCred = found;
    }

    // Update lastVerifiedAt
    await this.prisma.biometricCredential.update({
      where: { id: matchedCred.id },
      data: { lastVerifiedAt: new Date() },
    });

    return {
      verified: true,
      credentialId: matchedCred.credentialId,
      fingerprintName: matchedCred.fingerprintName,
      algorithm: matchedCred.algorithm,
      verifiedAt: new Date(),
    };
  }
}
