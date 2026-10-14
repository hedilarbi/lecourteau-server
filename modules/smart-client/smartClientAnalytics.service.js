const SmartClientLog = require("./smartClientLog.model");
const SmartClientExposure = require("./smartClientExposure.model");
const mongoose = require("mongoose");

const DEFAULT_PERIOD_DAYS = 30;
const MAX_PERIOD_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

const safeRate = (numerator, denominator) =>
  denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(2)) : 0;

const parseDateRange = ({ from, to } = {}) => {
  const end = to ? new Date(to) : new Date();
  const start = from
    ? new Date(from)
    : new Date(end.getTime() - DEFAULT_PERIOD_DAYS * DAY_MS);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    const error = new Error("Les dates 'from' et 'to' doivent être valides.");
    error.statusCode = 400;
    throw error;
  }
  if (start > end) {
    const error = new Error("La date 'from' doit précéder la date 'to'.");
    error.statusCode = 400;
    throw error;
  }
  if (end.getTime() - start.getTime() > MAX_PERIOD_DAYS * DAY_MS) {
    const error = new Error(`La période maximale est de ${MAX_PERIOD_DAYS} jours.`);
    error.statusCode = 400;
    throw error;
  }

  return { start, end };
};

const sessionGroupStage = {
  $group: {
    _id: "$sessionId",
    userId: { $first: "$userId" },
    startedAt: { $min: "$timestamp" },
    endedAt: { $max: "$timestamp" },
    eventCount: { $sum: 1 },
    checkoutIntent: {
      $max: {
        $cond: [
          {
            $and: [
              { $eq: ["$event", "tappable_clicked"] },
              { $eq: ["$payload.trackId", "checkout_btn"] },
            ],
          },
          1,
          0,
        ],
      },
    },
    abandonedWithCart: {
      $max: {
        $cond: [
          {
            $and: [
              { $eq: ["$event", "app_backgrounded"] },
              { $gt: [{ $ifNull: ["$signals.cart.lines", 0] }, 0] },
            ],
          },
          1,
          0,
        ],
      },
    },
    frustrated: {
      $max: {
        $cond: [
          {
            $or: [
              { $eq: ["$state", "Frustré"] },
              { $eq: ["$payload.current", "Frustré"] },
            ],
          },
          1,
          0,
        ],
      },
    },
    offerTriggered: {
      $max: { $cond: [{ $eq: ["$event", "smart_offer_triggered"] }, 1, 0] },
    },
    offerAccepted: {
      $max: { $cond: [{ $eq: ["$event", "smart_offer_accepted"] }, 1, 0] },
    },
    offerRefused: {
      $max: { $cond: [{ $eq: ["$event", "smart_offer_refused"] }, 1, 0] },
    },
    lastState: { $last: "$state" },
  },
};

class SmartClientAnalyticsService {
  async getSummary(query = {}, scope = {}) {
    const { start, end } = parseDateRange(query);
    const dateMatch = { timestamp: { $gte: start, $lte: end } };
    if (query.ruleId) {
      if (!mongoose.isValidObjectId(query.ruleId)) {
        const error = new Error("Règle invalide."); error.statusCode = 400; throw error;
      }
      dateMatch.ruleId = new mongoose.Types.ObjectId(query.ruleId);
    }

    const [
      sessionSummaryRows,
      eventCounts,
      stateCounts,
      screenDurations,
      screenIdleCounts,
      tappableCounts,
      offerRows,
      timeline,
      uniqueUserRows,
      rulePerformance,
    ] = await Promise.all([
      SmartClientLog.aggregate([
        { $match: dateMatch },
        { $sort: { timestamp: 1 } },
        sessionGroupStage,
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            totalEvents: { $sum: "$eventCount" },
            averageSessionDurationMs: {
              $avg: { $subtract: ["$endedAt", "$startedAt"] },
            },
            checkoutIntentSessions: { $sum: "$checkoutIntent" },
            abandonedSessions: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$abandonedWithCart", 1] },
                      { $eq: ["$checkoutIntent", 0] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            frustratedSessions: { $sum: "$frustrated" },
          },
        },
      ]),
      SmartClientLog.aggregate([
        { $match: dateMatch },
        { $group: { _id: "$event", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      SmartClientLog.aggregate([
        { $match: { ...dateMatch, event: "state_changed" } },
        {
          $group: {
            _id: { $ifNull: ["$payload.current", "$state"] },
            count: { $sum: 1 },
          },
        },
        { $match: { _id: { $ne: null } } },
        { $sort: { count: -1 } },
      ]),
      SmartClientLog.aggregate([
        { $match: { ...dateMatch, event: "screen_duration" } },
        {
          $group: {
            _id: "$payload.screen",
            visits: { $sum: 1 },
            totalDurationMs: { $sum: { $ifNull: ["$payload.durationMs", 0] } },
            averageDurationMs: { $avg: { $ifNull: ["$payload.durationMs", 0] } },
          },
        },
        { $match: { _id: { $ne: null } } },
        { $sort: { totalDurationMs: -1 } },
      ]),
      SmartClientLog.aggregate([
        { $match: { ...dateMatch, event: "screen_idle" } },
        { $group: { _id: "$payload.screen", idleCount: { $sum: 1 } } },
      ]),
      SmartClientLog.aggregate([
        { $match: { ...dateMatch, event: "tappable_clicked" } },
        { $group: { _id: "$payload.trackId", count: { $sum: 1 } } },
        { $match: { _id: { $ne: null } } },
        { $sort: { count: -1 } },
        { $limit: 30 },
      ]),
      SmartClientLog.aggregate([
        {
          $match: {
            ...dateMatch,
            event: {
              $in: [
                "smart_offer_triggered",
                "smart_offer_accepted",
                "smart_offer_refused",
              ],
            },
          },
        },
        { $group: { _id: "$event", count: { $sum: 1 } } },
      ]),
      SmartClientLog.aggregate([
        { $match: dateMatch },
        {
          $group: {
            _id: {
              day: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
              sessionId: "$sessionId",
            },
            events: { $sum: 1 },
            checkoutIntent: {
              $max: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$event", "tappable_clicked"] },
                      { $eq: ["$payload.trackId", "checkout_btn"] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        {
          $group: {
            _id: "$_id.day",
            sessions: { $sum: 1 },
            events: { $sum: "$events" },
            checkoutIntentSessions: { $sum: "$checkoutIntent" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      SmartClientLog.aggregate([
        {
          $match: {
            ...dateMatch,
            userId: { $nin: [null, "", "anonymous"] },
          },
        },
        { $group: { _id: "$userId" } },
        { $count: "count" },
      ]),
      SmartClientExposure.aggregate([
        { $match: {
          createdAt: { $gte: start, $lte: end },
        } },
        { $group: {
          _id: { rule: "$rule", group: "$group" },
          assigned: { $sum: 1 },
          displayed: { $sum: { $cond: [{ $in: ["$status", ["displayed", "accepted", "refused", "converted", "ignored"]] }, 1, 0] } },
          accepted: { $sum: { $cond: [{ $in: ["$status", ["accepted", "converted"]] }, 1, 0] } },
          converted: { $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] } },
          ignored: { $sum: { $cond: [{ $eq: ["$status", "ignored"] }, 1, 0] } },
          discountCost: { $sum: "$discountCost" },
          revenue: { $sum: "$revenue" },
        } },
        { $lookup: { from: "smartclientrules", localField: "_id.rule", foreignField: "_id", as: "rule" } },
        { $unwind: { path: "$rule", preserveNullAndEmptyArrays: true } },
        { $project: {
          _id: 0, ruleId: "$_id.rule", group: "$_id.group", ruleName: "$rule.ruleName",
          assigned: 1, displayed: 1, accepted: 1, converted: 1, ignored: 1, discountCost: 1, revenue: 1,
        } },
        { $sort: { converted: -1, accepted: -1 } },
      ]),
    ]);

    const sessionSummary = sessionSummaryRows[0] || {};
    const totalSessions = sessionSummary.totalSessions || 0;
    const checkoutIntentSessions = sessionSummary.checkoutIntentSessions || 0;
    const offerCounts = Object.fromEntries(
      offerRows.map(({ _id, count }) => [_id, count]),
    );
    const triggeredOffers = offerCounts.smart_offer_triggered || 0;
    const acceptedOffers = offerCounts.smart_offer_accepted || 0;
    const idleByScreen = Object.fromEntries(
      screenIdleCounts.map(({ _id, idleCount }) => [_id, idleCount]),
    );

    return {
      period: { from: start, to: end },
      overview: {
        totalEvents: sessionSummary.totalEvents || 0,
        totalSessions,
        uniqueAuthenticatedUsers: uniqueUserRows[0]?.count || 0,
        averageSessionDurationMs: Math.round(
          sessionSummary.averageSessionDurationMs || 0,
        ),
        checkoutIntentSessions,
        checkoutIntentRate: safeRate(checkoutIntentSessions, totalSessions),
        abandonedSessions: sessionSummary.abandonedSessions || 0,
        abandonmentRate: safeRate(
          sessionSummary.abandonedSessions || 0,
          totalSessions,
        ),
        frustratedSessions: sessionSummary.frustratedSessions || 0,
        frustrationRate: safeRate(
          sessionSummary.frustratedSessions || 0,
          totalSessions,
        ),
      },
      offers: {
        triggered: triggeredOffers,
        accepted: acceptedOffers,
        refused: offerCounts.smart_offer_refused || 0,
        acceptanceRate: safeRate(acceptedOffers, triggeredOffers),
      },
      events: eventCounts.map(({ _id, count }) => ({ event: _id, count })),
      states: stateCounts.map(({ _id, count }) => ({ state: _id, count })),
      screens: screenDurations.map((screen) => ({
        screen: screen._id,
        visits: screen.visits,
        totalDurationMs: screen.totalDurationMs,
        averageDurationMs: Math.round(screen.averageDurationMs || 0),
        idleCount: idleByScreen[screen._id] || 0,
      })),
      tappables: tappableCounts.map(({ _id, count }) => ({
        trackId: _id,
        count,
      })),
      timeline: timeline.map((row) => ({
        date: row._id,
        sessions: row.sessions,
        events: row.events,
        checkoutIntentSessions: row.checkoutIntentSessions,
      })),
      rulePerformance: rulePerformance.map((row) => ({
        ...row,
        acceptanceRate: safeRate(row.accepted, row.displayed),
        conversionRate: safeRate(row.converted, row.displayed),
        roi: row.discountCost > 0 ? Number(((row.revenue - row.discountCost) / row.discountCost).toFixed(2)) : null,
      })),
    };
  }

  async getSessions(query = {}, scope = {}) {
    const { start, end } = parseDateRange(query);
    const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 50, 1), 100);
    const skip = Math.max(Number.parseInt(query.skip, 10) || 0, 0);

    const sessionMatch = { timestamp: { $gte: start, $lte: end } };
    const rows = await SmartClientLog.aggregate([
      { $match: sessionMatch },
      { $sort: { timestamp: 1 } },
      sessionGroupStage,
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          userName: "$user.name",
          userEmail: "$user.email",
        },
      },
      {
        $addFields: {
          durationMs: { $subtract: ["$endedAt", "$startedAt"] },
          abandoned: {
            $and: [
              { $eq: ["$abandonedWithCart", 1] },
              { $eq: ["$checkoutIntent", 0] },
            ],
          },
        },
      },
      { $sort: { startedAt: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          metadata: [{ $count: "total" }],
        },
      },
    ]);

    return {
      period: { from: start, to: end },
      pagination: {
        skip,
        limit,
        total: rows[0]?.metadata[0]?.total || 0,
      },
      sessions: (rows[0]?.data || []).map((session) => ({
        sessionId: session._id,
        userId: session.userId,
        userName: session.userName || "",
        userEmail: session.userEmail || "",
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        durationMs: session.durationMs,
        eventCount: session.eventCount,
        lastState: session.lastState,
        checkoutIntent: Boolean(session.checkoutIntent),
        abandoned: Boolean(session.abandoned),
        frustrated: Boolean(session.frustrated),
        offerTriggered: Boolean(session.offerTriggered),
        offerAccepted: Boolean(session.offerAccepted),
        offerRefused: Boolean(session.offerRefused),
      })),
    };
  }

  async getSessionEvents(sessionId, query = {}) {
    if (!sessionId || String(sessionId).length > 100) {
      const error = new Error("Session invalide."); error.statusCode = 400; throw error;
    }
    const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 200, 1), 500);
    return SmartClientLog.find({ sessionId })
      .sort({ timestamp: 1 })
      .limit(limit)
      .select("event state payload signals timestamp ruleId exposureId")
      .lean();
  }
}

module.exports = new SmartClientAnalyticsService();
