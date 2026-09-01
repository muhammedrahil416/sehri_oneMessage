'use strict';
const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const {
  createAdmin,
  createSuperAdmin,
  listAdmins,
  deleteAdmin,
  linkUserToAdmin,
} = require('../controllers/adminController');

// All routes here are super_admin only.

// POST /api/admin/create-admin
// Body (Mode A — promote existing user): { user_id, zone_location_id }
// Body (Mode B — standalone):            { name, phone, password, zone_location_id }
router.post('/create-admin', verifyToken, requireRole('super_admin'), createAdmin);

// POST /api/admin/create-super-admin
// Body (Mode A — promote existing user): { user_id }
// Body (Mode B — standalone):            { name, phone, password }
router.post('/create-super-admin', verifyToken, requireRole('super_admin'), createSuperAdmin);

// GET /api/admin/list-admins
// Returns all zone admins with zone name and linked user_id.
router.get('/list-admins', verifyToken, requireRole('super_admin'), listAdmins);

// DELETE /api/admin/admins/:id
// Removes the admin row. Does NOT delete the linked users row.
router.delete('/admins/:id', verifyToken, requireRole('super_admin'), deleteAdmin);

// PATCH /api/admin/admins/:id/link-user
// Links or unlinks a users row to an existing admin account.
// Body: { user_id: "<uuid>" | null }
router.patch('/admins/:id/link-user', verifyToken, requireRole('super_admin'), linkUserToAdmin);

module.exports = router;
