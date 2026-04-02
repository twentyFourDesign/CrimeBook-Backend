import { UserRole, VerificationStatus } from "@prisma/client";
import { prisma } from "@/src/lib/prisma";

export type AppUserPayload = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isEmailVerified: boolean;
  identityVerificationStatus: "none" | "pending" | "approved" | "rejected";
  communityVerification: {
    status: VerificationStatus;
    submittedAt: string;
  } | null;
};

export async function buildAppUserPayload(userId: string): Promise<AppUserPayload | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isEmailVerified: true,
      communityVerification: {
        select: {
          verificationStatus: true,
          submittedAt: true,
        },
      },
    },
  });

  if (!user) return null;

  let identityVerificationStatus: AppUserPayload["identityVerificationStatus"];

  if (user.role === UserRole.VERIFIED_COMMUNITY_MEMBER) {
    identityVerificationStatus = "approved";
  } else if (!user.communityVerification) {
    identityVerificationStatus = "none";
  } else {
    switch (user.communityVerification.verificationStatus) {
      case VerificationStatus.PENDING:
        identityVerificationStatus = "pending";
        break;
      case VerificationStatus.APPROVED:
        identityVerificationStatus = "approved";
        break;
      case VerificationStatus.REJECTED:
        identityVerificationStatus = "rejected";
        break;
      default:
        identityVerificationStatus = "none";
    }
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    identityVerificationStatus,
    communityVerification: user.communityVerification
      ? {
          status: user.communityVerification.verificationStatus,
          submittedAt: user.communityVerification.submittedAt.toISOString(),
        }
      : null,
  };
}
