// routes/broadcast.routes.ts
import { Router } from 'express';
import { broadcastController } from '../controllers/broadcast.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// ========== TEMPLATE ROUTES ==========

// Template CRUD operations (authenticated users)
router.post('/templates', authenticate, broadcastController.createTemplate);
router.get('/templates', authenticate, broadcastController.getTemplates);
router.get('/templates/:id', authenticate, broadcastController.getTemplate);
router.put('/templates/:id', authenticate, broadcastController.updateTemplate);
router.delete('/templates/:id', authenticate, broadcastController.deleteTemplate);

// Template submission for WhatsApp approval
router.post('/templates/:id/submit', authenticate, broadcastController.submitTemplateForApproval);

// ========== BROADCAST ROUTES ==========

// Broadcast CRUD operations
router.post('/broadcasts', authenticate, broadcastController.createBroadcast);
router.get('/broadcasts', authenticate, broadcastController.getBroadcasts);
router.get('/broadcasts/:id', authenticate, broadcastController.getBroadcast);
router.put('/broadcasts/:id', authenticate, broadcastController.updateBroadcast);

// Broadcast approval workflow
router.post('/broadcasts/:id/submit', authenticate, broadcastController.submitBroadcastForApproval);
router.post('/broadcasts/:id/approve', authenticate, authorize('ADMIN', 'MANAGER'), broadcastController.approveBroadcast);
router.post('/broadcasts/:id/reject', authenticate, authorize('ADMIN', 'MANAGER'), broadcastController.rejectBroadcast);

// Broadcast actions
router.post('/broadcasts/:id/send', authenticate, authorize('ADMIN', 'MANAGER'), broadcastController.sendBroadcast);
router.post('/broadcasts/:id/cancel', authenticate, broadcastController.cancelBroadcast);
router.get('/broadcasts/:id/stats', authenticate, broadcastController.getBroadcastStats);

// ========== SEGMENT ROUTES ==========
router.post('/segments', authenticate, broadcastController.createSegment);
router.get('/segments', authenticate, broadcastController.getSegments);
router.get('/segments/:id', authenticate, broadcastController.getSegment);
router.put('/segments/:id', authenticate, broadcastController.updateSegment);
router.delete('/segments/:id', authenticate, broadcastController.deleteSegment);
router.post('/segments/estimate', authenticate, broadcastController.estimateSegmentSize);
router.get('/segments/:id/stats', authenticate, broadcastController.getSegmentStats);
router.post('/segments/:id/duplicate', authenticate, broadcastController.duplicateSegment);
router.get('/segments/tags', authenticate, broadcastController.getSegmentTags);

export default router;