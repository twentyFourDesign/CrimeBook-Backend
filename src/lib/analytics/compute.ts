import { CrimeCategory, ReportStatus } from "@prisma/client";
import { prisma } from "@/src/lib/prisma";

const PERIOD_HOURS = 168;
const GRID = 2;

export async function runAnalyticsComputation(): Promise<{
  hotspots: number;
  patterns: number;
  reportsInWindow: number;
}> {
  const now = new Date();
  const periodStart = new Date(now.getTime() - PERIOD_HOURS * 60 * 60 * 1000);

  await prisma.crimeHotspot.deleteMany({});
  await prisma.crimePattern.deleteMany({});
  await prisma.operationalMetric.deleteMany({});

  const reports = await prisma.incidentReport.findMany({
    where: {
      deletedAt: null,
      createdAt: { gte: periodStart },
    },
    select: {
      latitude: true,
      longitude: true,
      crimeCategory: true,
      incidentTime: true,
    },
  });

  const hotspotBuckets = new Map<
    string,
    { lat: number; lng: number; category: CrimeCategory | null; count: number }
  >();

  const patternBuckets = new Map<
    string,
    {
      category: CrimeCategory;
      day: number;
      hour: number;
      count: number;
      sumLat: number;
      sumLng: number;
    }
  >();

  for (const r of reports) {
    const lat = Math.round(r.latitude * 10 ** GRID) / 10 ** GRID;
    const lng = Math.round(r.longitude * 10 ** GRID) / 10 ** GRID;
    const hk = `${lat}_${lng}_${r.crimeCategory}`;
    const prev = hotspotBuckets.get(hk);
    if (prev) prev.count += 1;
    else
      hotspotBuckets.set(hk, {
        lat,
        lng,
        category: r.crimeCategory,
        count: 1,
      });

    const t = new Date(r.incidentTime);
    const day = t.getUTCDay();
    const hour = t.getUTCHours();
    const pk = `${r.crimeCategory}_${day}_${hour}`;
    const pp = patternBuckets.get(pk);
    if (pp) {
      pp.count += 1;
      pp.sumLat += r.latitude;
      pp.sumLng += r.longitude;
    } else {
      patternBuckets.set(pk, {
        category: r.crimeCategory,
        day,
        hour,
        count: 1,
        sumLat: r.latitude,
        sumLng: r.longitude,
      });
    }
  }

  for (const [, v] of hotspotBuckets) {
    const risk = Math.min(100, v.count * 8);
    await prisma.crimeHotspot.create({
      data: {
        latitude: v.lat,
        longitude: v.lng,
        radiusMeters: 500,
        crimeCategory: v.category,
        incidentCount: v.count,
        riskScore: risk,
        trendDirection: "stable",
        computedAt: now,
        periodHours: PERIOD_HOURS,
      },
    });
  }

  for (const [, v] of patternBuckets) {
    await prisma.crimePattern.create({
      data: {
        crimeCategory: v.category,
        dayOfWeek: v.day,
        hourOfDay: v.hour,
        avgIncidentCount: v.count,
        latitude: v.sumLat / v.count,
        longitude: v.sumLng / v.count,
        radiusKm: 5,
        computedAt: now,
      },
    });
  }

  const submitted = await prisma.incidentReport.count({
    where: { deletedAt: null, createdAt: { gte: periodStart } },
  });

  await prisma.operationalMetric.create({
    data: {
      metricName: "reports_submitted_window",
      metricValue: submitted,
      dimension: `last_${PERIOD_HOURS}h`,
      periodStart,
      periodEnd: now,
      computedAt: now,
    },
  });

  const histories = await prisma.reportStatusHistory.findMany({
    where: { createdAt: { gte: periodStart }, toStatus: ReportStatus.UNDER_INVESTIGATION },
    select: { reportId: true, createdAt: true },
  });

  let totalHours = 0;
  let n = 0;
  for (const h of histories) {
    const first = await prisma.incidentReport.findUnique({
      where: { id: h.reportId },
      select: { createdAt: true },
    });
    if (!first) continue;
    const diffMs = h.createdAt.getTime() - first.createdAt.getTime();
    if (diffMs >= 0) {
      totalHours += diffMs / (1000 * 60 * 60);
      n += 1;
    }
  }

  if (n > 0) {
    await prisma.operationalMetric.create({
      data: {
        metricName: "avg_hours_submit_to_investigation",
        metricValue: totalHours / n,
        dimension: null,
        periodStart,
        periodEnd: now,
        computedAt: now,
      },
    });
  }

  return {
    hotspots: hotspotBuckets.size,
    patterns: patternBuckets.size,
    reportsInWindow: submitted,
  };
}
