import express from 'express';
import { whatsappController } from '../controllers/whatsapp.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = express.Router();

router.get('/webhook', whatsappController.verifyWebhook);
router.post('/webhook', whatsappController.receiveWebhook);


router.use(authenticate);
router.get('/status', whatsappController.getWhatsAppStatus);
router.get('/templates', authorize('ADMIN', 'MANAGER'), whatsappController.getTemplates);
router.get('/business-profile', authorize('ADMIN', 'MANAGER'), whatsappController.getBusinessProfileInfo);
router.get('/token/health', authorize('ADMIN', 'MANAGER'), whatsappController.checkTokenHealth);
router.post('/token/refresh', authorize('ADMIN'), whatsappController.refreshToken);
router.use(authorize('ADMIN', 'MANAGER', 'SUPPORT'));
router.get('/contacts', whatsappController.getRegisteredContacts);
router.get('/contacts/recent', whatsappController.getRecentContacts);
router.get('/contacts/overview', whatsappController.getContactsOverview);
router.post('/contacts/check', whatsappController.checkContacts);
router.post('/contacts/sync', whatsappController.syncContacts);
router.get('/contacts/blocked', whatsappController.getBlockedContacts);
router.get('/contacts/search', whatsappController.searchContacts);
router.get('/contacts/:phoneNumber', whatsappController.getContactInfo);
router.get('/contacts/:phoneNumber/profile-picture', whatsappController.getContactProfilePicture);
router.get('/contacts/:phoneNumber/message-stats', whatsappController.getContactMessageStats);
router.get('/contacts/:phoneNumber/business-profile', whatsappController.getBusinessProfile);
router.post('/contacts/:phoneNumber/block', authorize('ADMIN'), whatsappController.blockContact);
router.post('/contacts/:phoneNumber/unblock', authorize('ADMIN'), whatsappController.unblockContact);
router.use(authorize('ADMIN', 'MANAGER', 'SUPPORT'));
router.post('/send', whatsappController.sendMessage);
router.post('/send-media', whatsappController.sendMediaMessage);
router.post('/send-catalog', whatsappController.sendCatalogMessage);
router.post('/send/list', whatsappController.sendInteractiveList);
router.use(authorize('ADMIN', 'MANAGER'));
router.post('/catalog/sync', whatsappController.syncProductToCatalog);
router.get('/catalog/products', whatsappController.getCatalogProducts);
router.put('/catalog/products/:productId', whatsappController.updateCatalogProduct);
router.delete('/catalog/products/:productId', whatsappController.deleteCatalogProduct);
router.use(authorize('ADMIN', 'MANAGER', 'SUPPORT'));
router.get('/conversations', whatsappController.getConversations);
router.get('/conversations/:id', whatsappController.getConversation);
router.get('/conversations/phone/:phone', whatsappController.getConversationByPhone);
router.put('/conversations/:id', whatsappController.updateConversation);
router.post('/conversations/:id/assign', whatsappController.assignConversation);
router.post('/conversations/:id/resolve', whatsappController.markAsResolved);
router.put('/conversations/:id/tags', whatsappController.updateTags);
router.put('/conversations/:id/customer', whatsappController.updateCustomerInfo);
router.post('/conversations/:id/message', whatsappController.sendChatMessage);
router.get('/conversations/:id/messages', whatsappController.getMessages);
router.post('/conversations/:id/read', whatsappController.markMessagesAsRead);
router.use(authorize('ADMIN'));
router.post('/broadcast', whatsappController.sendBroadcast);
router.use(authorize('ADMIN', 'MANAGER'));
router.get('/statistics', whatsappController.getChatStatistics);

export default router;