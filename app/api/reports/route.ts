import { NextRequest } from "next/server";
import { CrimeCategory, MediaType, ReportStatus, ReportVisibility } from "@prisma/client";
import { z } from "zod";
import { getBearerToken } from "@/src/lib/auth/request";
import { verifyAccessToken } from "@/src/lib/auth/jwt";
import { fail, ok } from "@/src/lib/http/response";
import { awardPoints } from "@/src/lib/gamification/award";
import { prisma } from "@/src/lib/prisma";

const slugToCategory: Record<string, CrimeCategory> = {
  theft: CrimeCategory.ROBBERY,
  assault: CrimeCategory.ASSAULT,
  vehicle: CrimeCategory.TRAFFIC_CRIME,
  arson: CrimeCategory.OTHER,
  vandalism: CrimeCategory.VANDALISM,
  disturbance: CrimeCategory.SUSPICIOUS_ACTIVITY,
};

const reportMediaItemSchema = z.object({
  fileUrl: z.string().url(),
  fileName: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(200),
  fileSizeBytes: z.number().int().min(0).max(50_000_000),
  mediaType: z.nativeEnum(MediaType),
});

const bodySchema = z.object({
  crimeSlug: z.enum(["theft", "assault", "vehicle", "arson", "vandalism", "disturbance"]),
  description: z.string().min(1).max(20000),
  title: z.string().max(500).optional(),
  locationText: z.string().max(2000).optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  incidentTime: z.coerce.date(),
  isHappeningNow: z.boolean().optional(),
  isAnonymous: z.boolean().optional(),
  /** Populated after uploading files to Supabase `crime-media` via POST /api/media/upload */
  media: z.array(reportMediaItemSchema).max(12).optional(),
});

/** Default map pin (Lagos) if client sends no coords — location still stored as text. */
const DEFAULT_LAT = 6.5244;
const DEFAULT_LNG = 3.3792;

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return fail("Missing access token", 401);
  }

  let userId: string;
  try {
    const payload = verifyAccessToken(token);
    userId = payload.sub;
  } catch {
    return fail("Invalid access token", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, trustScore: true, role: true },
  });
  if (!user) {
    return fail("User not found", 404);
  }

  const privacy = await prisma.privacySettings.findUnique({
    where: { userId: user.id },
  });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return fail("Validation failed", 400, parsed.error.flatten());
  }

  const data = parsed.data;
  const crimeCategory = slugToCategory[data.crimeSlug];
  if (!crimeCategory) {
    return fail("Invalid crime type", 400);
  }

  const lat = data.latitude ?? DEFAULT_LAT;
  const lng = data.longitude ?? DEFAULT_LNG;

  const isAnonymous = data.isAnonymous ?? privacy?.defaultAnonymousReporting ?? false;

  const reporterId = isAnonymous ? null : user.id;
  const visibility = isAnonymous ? ReportVisibility.ANONYMOUS : ReportVisibility.IDENTIFIED;

  let locationPrecision: "exact" | "approximate" =
    data.latitude == null || data.longitude == null ? "approximate" : "exact";
  if (privacy?.locationPrecision === "approximate") {
    locationPrecision = "approximate";
  }

  const report = await prisma.$transaction(async (tx) => {
    const created = await tx.incidentReport.create({
      data: {
        reporterId,
        crimeCategory,
        title: data.title ?? null,
        description: data.description,
        status: ReportStatus.SUBMITTED,
        visibility,
        isAnonymous,
        latitude: lat,
        longitude: lng,
        locationAddress: data.locationText ?? null,
        locationLabel: data.locationText ?? null,
        locationPrecision,
        incidentTime: data.incidentTime,
        isHappeningNow: data.isHappeningNow ?? false,
        reporterTrustScore: data.isAnonymous ? null : user.trustScore,
      },
    });

    if (data.media?.length) {
      await tx.reportMedia.createMany({
        data: data.media.map((m) => ({
          reportId: created.id,
          mediaType: m.mediaType,
          fileUrl: m.fileUrl,
          fileName: m.fileName,
          fileSizeBytes: m.fileSizeBytes,
          mimeType: m.mimeType,
        })),
      });
    }

    return created;
  });

  if (reporterId) {
    const priorCount = await prisma.incidentReport.count({
      where: { reporterId: user.id, deletedAt: null, id: { not: report.id } },
    });
    if (priorCount === 0) {
      await awardPoints({
        userId: user.id,
        points: 10,
        reason: "First incident report",
        referenceId: `first_report:${user.id}`,
      });
    }
  }

  const y = new Date().getFullYear();
  const short = report.id.replace(/-/g, "").slice(0, 6).toUpperCase();
  const displayCaseId = `CB-${y}-${short}`;

  return ok("Report submitted", {
    report: {
      id: report.id,
      displayCaseId,
      status: report.status,
    },
  });
}
