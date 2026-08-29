'use strict';

const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const { listUsers, updateUserStatus } = require('../controllers/userController');

const router = express.Router();

// Both admin and super_admin can view pending users (scoping happens inside the controller)
router.get('/', verifyToken, requireRole('admin', 'super_admin'), listUsers);

// Both admin and super_admin can approve/reject (admin restricted to their own zone in controller)
router.patch('/:id/status', verifyToken, requireRole('admin', 'super_admin'), updateUserStatus);

module.exports = router;