'use strict';

const express = require('express');
const router = express.Router();

const { verifyToken, requireRole } = require('../middleware/auth');
const {
  getActivePoll,
  submitVote,
  getMyResponses,
  getActiveStats,
  getZoneVoters,
} = require('../controllers/pollController');

// ---------------------------------------------------------------------------
// Person 1 — core voting flow
// ---------------------------------------------------------------------------

// GET /api/polls/active
// Returns today's poll + current phase + the calling user's own response.
// All authenticated roles may call this.
router.get('/active', verifyToken, getActivePoll);

// GET /api/polls/active/stats
// Zone-by-zone yes/no counts for today's poll.
// Must be declared BEFORE /:id routes to avoid Express matching 'active'
// as a poll ID parameter.
router.get('/active/stats', verifyToken, requireRole('admin', 'super_admin'), getActiveStats);

// GET /api/polls/my-responses
// Paginated personal vote history for the calling user.
// ?page=1&limit=20
router.get('/my-responses', verifyToken, requireRole('user'), getMyResponses);

// POST /api/polls/:id/respond
// Submit a yes/no vote. Only approved users may vote.
// Body: { response: 'yes' | 'no' }
router.post('/:id/respond', verifyToken, requireRole('user'), submitVote);

// GET /api/polls/:id/zone-voters
// Names of Yes voters in a zone for the given poll.
// Admin sees own zone only; super_admin may pass ?zone=<name> or omit for all.
// Must be declared AFTER /active and /my-responses to avoid conflicts.
router.get('/:id/zone-voters', verifyToken, requireRole('admin', 'super_admin'), getZoneVoters);

// ---------------------------------------------------------------------------
// Person 2 — special cases, admin controls (stubs — handlers added separately)
// ---------------------------------------------------------------------------

// POST  /api/polls/:id/special-case
// POST  /api/polls/:id/special-case/undo
// GET   /api/polls/special-cases
// POST  /api/polls/special-cases/allot
// PATCH /api/polls/active/toggle
// GET   /api/polls/history
// GET   /api/polls/date/:date/stats

module.exports = router;
