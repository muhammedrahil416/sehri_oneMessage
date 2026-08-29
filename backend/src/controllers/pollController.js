'use strict';

const { Op } = require('sequelize');
const db = require('../models');
const { success, error } = require('../utils/response');
const { resolveZone } = require('../utils/resolveZone');

const {
  getPollPhase,
  isVotingOpen,
  isSpecialCaseWindowOpen,
  PHASES,
  getNow,
} = require('../utils/pollPhase');

const { Poll, PollResponse, User } = db;

// ---------------------------------------------------------------------------
// Shared helper — fetch today's poll record.
// "Today" means the IST calendar date. We query by the `date` column which
// stores a DATEONLY value representing the Sehri date being voted for.
// The poll for tonight's Sehri opens at 10 PM the previous calendar night,
// so `date` is always tomorrow's date from the perspective of someone voting
// after 10 PM. The cron job that creates polls must set `date` to the Sehri
// date (tomorrow), not the creation date (today). This controller does not
// create polls — it only reads the one the cron produced.
// ---------------------------------------------------------------------------
const getTodaysPoll = async () => {
  // Get today's date string in IST (YYYY-MM-DD).
  const istDateStr = new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Kolkata',
  }); // en-CA locale gives YYYY-MM-DD format natively

  return Poll.findOne({ where: { date: istDateStr } });
};

// ---------------------------------------------------------------------------
// GET /api/polls/active
// Access: any authenticated user, admin, super_admin
//
// Returns today's poll plus the current phase so the mobile client knows
// which UI state to render without doing its own time math.
// ---------------------------------------------------------------------------
const getActivePoll = async (req, res) => {
  try {
    const poll = await getTodaysPoll();

    if (!poll) {
      return success(res, {
        statusCode: 200,
        message: 'No poll scheduled for today',
        data: { poll: null, phase: PHASES.CLOSED },
      });
    }

    const phase = getPollPhase(poll);

    // If the calling user is a regular user, also attach their own response
    // for today so the home screen can show "You voted: Yes" without a
    // separate request.
    let myResponse = null;
    if (req.auth.role === 'user') {
      myResponse = await PollResponse.findOne({
        where: { poll_id: poll.id, user_id: req.auth.id },
        attributes: ['response', 'is_special_case', 'special_case_type', 'sehri_allowed'],
      });
    }

    return success(res, {
      statusCode: 200,
      message: 'Active poll fetched',
      data: {
        poll: {
          id: poll.id,
          date: poll.date,
          question: poll.question,
          is_active: poll.is_active,
        },
        phase,
        my_response: myResponse,
      },
    });
  } catch (err) {
    console.error('getActivePoll error:', err);
    return error(res, { statusCode: 500, message: 'Server error' });
  }
};

// ---------------------------------------------------------------------------
// POST /api/polls/:id/respond
// Body: { response: 'yes' | 'no' }
// Access: approved users only
//
// Rules:
// • Voting window must be open (10 PM – 10 AM IST).
// • A user may vote only once per poll — duplicate returns 409.
// • Zone is snapshotted from the user's current location_id at vote time.
// ---------------------------------------------------------------------------
const submitVote = async (req, res) => {
  try {
    const { id: pollId } = req.params;
    const { response: vote } = req.body;

    // 1. Validate input
    if (!vote || !['yes', 'no'].includes(vote)) {
      return error(res, {
        statusCode: 400,
        message: "Response must be 'yes' or 'no'",
      });
    }

    // 2. Load the poll
    const poll = await Poll.findByPk(pollId);
    if (!poll) {
      return error(res, { statusCode: 404, message: 'Poll not found' });
    }

    // 3. Check the voting window
    if (!isVotingOpen(poll)) {
      return error(res, {
        statusCode: 403,
        message: 'Voting window is not open',
      });
    }

    // 4. Prevent duplicate votes
    const existing = await PollResponse.findOne({
      where: { poll_id: pollId, user_id: req.auth.id },
    });
    if (existing) {
      return error(res, {
        statusCode: 409,
        message: 'You have already voted on this poll',
      });
    }

    // 5. Resolve the user's zone from their location_id.
    //    Zone is stored as a snapshot so kitchen counts remain accurate
    //    even if the user changes zone later.
    const user = await User.findByPk(req.auth.id, {
      attributes: ['location_id'],
    });
    if (!user) {
      return error(res, { statusCode: 404, message: 'User not found' });
    }

    const zoneLocation = await resolveZone(user.location_id, db);
    if (!zoneLocation) {
      return error(res, {
        statusCode: 422,
        message: 'Could not resolve your zone from your registered location',
      });
    }

    // The zone ENUM in poll_responses matches the Location name column for
    // zone-type rows: 'masjid', 'boys_hostel', 'stanza', 'girls'.
    // resolveZone returns the Location row; we use its name lowercased as key.
    const zoneName = zoneLocation.name.toLowerCase().replace(/\s+/g, '_');
    const validZones = ['masjid', 'boys_hostel', 'stanza', 'girls'];
    if (!validZones.includes(zoneName)) {
      return error(res, {
        statusCode: 422,
        message: `Zone '${zoneName}' is not a recognised delivery zone`,
      });
    }

    // 6. Create the response
    const pollResponse = await PollResponse.create({
      poll_id: pollId,
      user_id: req.auth.id,
      response: vote,
      zone: zoneName,
    });

    return success(res, {
      statusCode: 201,
      message: 'Vote submitted successfully',
      data: {
        id: pollResponse.id,
        response: pollResponse.response,
        zone: pollResponse.zone,
      },
    });
  } catch (err) {
    console.error('submitVote error:', err);
    return error(res, { statusCode: 500, message: 'Server error' });
  }
};

// ---------------------------------------------------------------------------
// POST /api/polls/:id/special-case
// Body: { type: 'want' | 'dont_want' }
// Access: user
//
// Users may raise a special case only during the 10AM–5PM IST window.
// The user must already have voted on this poll.
// ---------------------------------------------------------------------------
const submitSpecialCase = async (req, res) => {
  try {
    const { id: pollId } = req.params;
    const { type } = req.body;

    // 1. Validate input
    if (!type || !['want', 'dont_want'].includes(type)) {
      return error(res, {
        statusCode: 400,
        message: "Type must be 'want' or 'dont_want'",
      });
    }

    // 2. Load poll
    const poll = await Poll.findByPk(pollId);

    if (!poll) {
      return error(res, {
        statusCode: 404,
        message: 'Poll not found',
      });
    }

    // 3. Check special-case window
    if (!isSpecialCaseWindowOpen(poll)) {
      return error(res, {
        statusCode: 403,
        message: 'Special case window is not open',
      });
    }

    // 4. Find the user's existing vote
    const pollResponse = await PollResponse.findOne({
      where: {
        poll_id: pollId,
        user_id: req.auth.id,
      },
    });

    if (!pollResponse) {
      return error(res, {
        statusCode: 400,
        message: 'You must vote on this poll before raising a special case',
      });
    }

    // 5. Validate special-case type against original vote
    if (type === 'want' && pollResponse.response !== 'no') {
      return error(res, {
        statusCode: 400,
        message: "Special case 'want' is only valid for a 'no' vote",
      });
    }

    if (type === 'dont_want' && pollResponse.response !== 'yes') {
      return error(res, {
        statusCode: 400,
        message: "Special case 'dont_want' is only valid for a 'yes' vote",
      });
    }

    // 6. Prevent duplicate special case
    if (pollResponse.is_special_case) {
      return error(res, {
        statusCode: 409,
        message: 'A special case has already been raised for this vote',
      });
    }

    // 7. Update the existing response row
    pollResponse.is_special_case = true;
    pollResponse.special_case_type = type;
    pollResponse.special_case_at = getNow();

    await pollResponse.save();

    // 8. Return updated special-case information
    return success(res, {
      statusCode: 200,
      message: 'Special case submitted successfully',
      data: {
        response_id: pollResponse.id,
        response: pollResponse.response,
        is_special_case: pollResponse.is_special_case,
        special_case_type: pollResponse.special_case_type,
        special_case_at: pollResponse.special_case_at,
        sehri_allowed: pollResponse.sehri_allowed,
      },
    });
  } catch (err) {
    console.error('submitSpecialCase error:', err);

    return error(res, {
      statusCode: 500,
      message: 'Server error',
    });
  }
};

//undo sp case
// ---------------------------------------------------------------------------
// POST /api/polls/:id/special-case/undo
// Access: user
//
// Users may undo a special case only during the 10AM–5PM IST window.
// Once the super admin has reviewed the case, it cannot be undone.
// ---------------------------------------------------------------------------
const undoSpecialCase = async (req, res) => {
  try {
    const { id: pollId } = req.params;

    // 1. Load poll
    const poll = await Poll.findByPk(pollId);

    if (!poll) {
      return error(res, {
        statusCode: 404,
        message: 'Poll not found',
      });
    }

    // 2. Check special-case window
    if (!isSpecialCaseWindowOpen(poll)) {
      return error(res, {
        statusCode: 403,
        message: 'Special case window is not open',
      });
    }

    // 3. Find the user's response
    const pollResponse = await PollResponse.findOne({
      where: {
        poll_id: pollId,
        user_id: req.auth.id,
      },
    });

    if (!pollResponse) {
      return error(res, {
        statusCode: 404,
        message: 'You have not voted on this poll',
      });
    }

    // 4. Check whether a special case exists
    if (!pollResponse.is_special_case) {
      return error(res, {
        statusCode: 400,
        message: 'No active special case found',
      });
    }

    // 5. Cannot undo after super admin has reviewed it
    if (pollResponse.sehri_allowed !== null) {
      return error(res, {
        statusCode: 409,
        message: 'Special case has already been reviewed and cannot be undone',
      });
    }

    // 6. Reset special-case fields
    pollResponse.is_special_case = false;
    pollResponse.special_case_type = null;
    pollResponse.special_case_at = null;

    await pollResponse.save();

    // 7. Return updated response
    return success(res, {
      statusCode: 200,
      message: 'Special case undone successfully',
      data: {
        response_id: pollResponse.id,
        response: pollResponse.response,
        is_special_case: pollResponse.is_special_case,
        special_case_type: pollResponse.special_case_type,
        special_case_at: pollResponse.special_case_at,
        sehri_allowed: pollResponse.sehri_allowed,
      },
    });
  } catch (err) {
    console.error('undoSpecialCase error:', err);

    return error(res, {
      statusCode: 500,
      message: 'Server error',
    });
  }
};

// ---------------------------------------------------------------------------
// GET /api/polls/my-responses
// Access: authenticated users
//
// Returns the calling user's full vote history across all polls, newest first.
// Useful for the "Poll History" screen.
// ---------------------------------------------------------------------------
const getMyResponses = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const { count, rows } = await PollResponse.findAndCountAll({
      where: { user_id: req.auth.id },
      include: [
        {
          model: Poll,
          as: 'poll',
          attributes: ['id', 'date', 'question'],
        },
      ],
      attributes: [
        'id',
        'response',
        'zone',
        'is_special_case',
        'special_case_type',
        'sehri_allowed',
        'created_at',
      ],
      order: [[{ model: Poll, as: 'poll' }, 'date', 'DESC']],
      limit,
      offset,
    });

    return success(res, {
      statusCode: 200,
      message: 'Vote history fetched',
      data: {
        total: count,
        page,
        limit,
        responses: rows,
      },
    });
  } catch (err) {
    console.error('getMyResponses error:', err);
    return error(res, { statusCode: 500, message: 'Server error' });
  }
};

// ---------------------------------------------------------------------------
// GET /api/polls/active/stats
// Access: admin, super_admin
//
// Returns a zone-by-zone breakdown of today's votes.
// Used by the admin dashboard to know how many meals to prepare per zone.
// ---------------------------------------------------------------------------
const getActiveStats = async (req, res) => {
  try {
    const poll = await getTodaysPoll();

    if (!poll) {
      return success(res, {
        statusCode: 200,
        message: 'No poll scheduled for today',
        data: { poll: null, stats: null },
      });
    }

    // Aggregate yes/no counts per zone in one query using GROUP BY.
    // sequelize.fn + sequelize.col lets us do COUNT(*) without raw SQL.
    const { sequelize } = db;

    const rows = await PollResponse.findAll({
      where: { poll_id: poll.id },
      attributes: [
        'zone',
        'response',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      group: ['zone', 'response'],
      raw: true,
    });

    // Shape the raw rows into a clean zone-keyed map:
    // { masjid: { yes: 5, no: 2, total: 7 }, boys_hostel: { ... }, ... }
    const zones = ['masjid', 'boys_hostel', 'stanza', 'girls'];
    const stats = Object.fromEntries(
      zones.map((z) => [z, { yes: 0, no: 0, total: 0 }])
    );

    for (const row of rows) {
      if (stats[row.zone]) {
        stats[row.zone][row.response] = parseInt(row.count, 10);
      }
    }

    // Compute totals per zone
    for (const zone of zones) {
      stats[zone].total = stats[zone].yes + stats[zone].no;
    }

    // Grand totals across all zones
    const grandTotal = {
      yes: zones.reduce((s, z) => s + stats[z].yes, 0),
      no: zones.reduce((s, z) => s + stats[z].no, 0),
      total: zones.reduce((s, z) => s + stats[z].total, 0),
    };

    return success(res, {
      statusCode: 200,
      message: 'Poll stats fetched',
      data: {
        poll: { id: poll.id, date: poll.date },
        phase: getPollPhase(poll),
        by_zone: stats,
        grand_total: grandTotal,
      },
    });
  } catch (err) {
    console.error('getActiveStats error:', err);
    return error(res, { statusCode: 500, message: 'Server error' });
  }
};

// ---------------------------------------------------------------------------
// GET /api/polls/:id/zone-voters
// Query param: ?zone=masjid  (optional — defaults to the calling admin's zone)
// Access: admin, super_admin
//
// Returns the names of users who voted 'yes' in a specific zone for a given
// poll. Admins see only their own zone unless they are super_admin.
// ---------------------------------------------------------------------------
const getZoneVoters = async (req, res) => {
  try {
    const { id: pollId } = req.params;

    // Determine which zone to query.
    // - super_admin may pass ?zone=<name> or omits it to get all zones.
    // - admin is restricted to their own zone (resolved from zone_location_id
    //   on their token, then resolved to a zone name via resolveZone).
    let targetZone = req.query.zone || null;

    if (req.auth.role === 'admin') {
      // Admin's token carries zone_location_id — resolve it to a zone name.
      const adminZoneLocation = await resolveZone(req.auth.zone_location_id, db);
      if (!adminZoneLocation) {
        return error(res, {
          statusCode: 422,
          message: 'Could not resolve your admin zone',
        });
      }
      const adminZoneName = adminZoneLocation.name.toLowerCase().replace(/\s+/g, '_');

      // If the admin tried to pass a different zone, reject it.
      if (targetZone && targetZone !== adminZoneName) {
        return error(res, {
          statusCode: 403,
          message: 'You can only view voters in your own zone',
        });
      }
      targetZone = adminZoneName;
    }

    // Validate zone value if provided
    const validZones = ['masjid', 'boys_hostel', 'stanza', 'girls'];
    if (targetZone && !validZones.includes(targetZone)) {
      return error(res, {
        statusCode: 400,
        message: `Invalid zone '${targetZone}'. Must be one of: ${validZones.join(', ')}`,
      });
    }

    const poll = await Poll.findByPk(pollId);
    if (!poll) {
      return error(res, { statusCode: 404, message: 'Poll not found' });
    }

    // Build the where clause
    const where = {
      poll_id: pollId,
      response: 'yes',
    };
    if (targetZone) {
      where.zone = targetZone;
    }

    const responses = await PollResponse.findAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'phone'],
        },
      ],
      attributes: ['id', 'zone', 'is_special_case', 'sehri_allowed'],
      order: [['zone', 'ASC']],
    });

    // Group by zone for cleaner consumption by the admin UI
    const grouped = {};
    for (const r of responses) {
      const z = r.zone;
      if (!grouped[z]) grouped[z] = [];
      grouped[z].push({
        response_id: r.id,
        is_special_case: r.is_special_case,
        sehri_allowed: r.sehri_allowed,
        user: r.user,
      });
    }

    return success(res, {
      statusCode: 200,
      message: 'Zone voters fetched',
      data: {
        poll: { id: poll.id, date: poll.date },
        zone: targetZone || 'all',
        voters: grouped,
        total_yes: responses.length,
      },
    });
  } catch (err) {
    console.error('getZoneVoters error:', err);
    return error(res, { statusCode: 500, message: 'Server error' });
  }
};

module.exports = {
  getActivePoll,
  submitVote,
  submitSpecialCase, // code at 190th line above getMyResponses 
  undoSpecialCase, // code at 297 fr undo case
  getMyResponses,
  getActiveStats,
  getZoneVoters,
  submitSpecialCase, // code at 190th line above getMyResponses 
};
