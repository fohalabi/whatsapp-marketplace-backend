import { Router } from 'express';
import { broadcastController } from '../controllers/broadcast.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.post('/templates', authenticate, broadcastController.createTemplate);
router.get('/templates', authenticate, broadcastController.getTemplates);
router.get('/templates/:id', authenticate, broadcastController.getTemplate);
router.put('/templates/:id', authenticate, broadcastController.updateTemplate);
router.delete('/templates/:id', authenticate, broadcastController.deleteTemplate);

router.post('/templates/:id/submit', authenticate, broadcastController.submitTemplateForApproval);

router.post('/broadcasts', authenticate, broadcastController.createBroadcast);
router.get('/broadcasts', authenticate, broadcastController.getBroadcasts);
router.get('/broadcasts/:id', authenticate, broadcastController.getBroadcast);
router.put('/broadcasts/:id', authenticate, broadcastController.updateBroadcast);

router.post('/broadcasts/:id/submit', authenticate, broadcastController.submitBroadcastForApproval);
router.post('/broadcasts/:id/approve', authenticate, authorize('ADMIN', 'MANAGER'), broadcastController.approveBroadcast);
router.post('/broadcasts/:id/reject', authenticate, authorize('ADMIN', 'MANAGER'), broadcastController.rejectBroadcast);

router.post('/broadcasts/:id/send', authenticate, authorize('ADMIN', 'MANAGER'), broadcastController.sendBroadcast);
router.post('/broadcasts/:id/cancel', authenticate, broadcastController.cancelBroadcast);
router.get('/broadcasts/:id/stats', authenticate, broadcastController.getBroadcastStats);

router.post('/segments', authenticate, broadcastController.createSegment);
router.get('/segments', authenticate, broadcastController.getSegments);
router.get('/segments/tags', authenticate, broadcastController.getSegmentTags);
router.post('/segments/estimate', authenticate, broadcastController.estimateSegmentSize);
router.get('/segments/:id', authenticate, broadcastController.getSegment);
router.put('/segments/:id', authenticate, broadcastController.updateSegment);
router.delete('/segments/:id', authenticate, broadcastController.deleteSegment);
router.get('/segments/:id/stats', authenticate, broadcastController.getSegmentStats);
router.post('/segments/:id/duplicate', authenticate, broadcastController.duplicateSegment);

export default router;