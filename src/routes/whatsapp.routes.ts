import express from 'express';
import { whatsappController } from '../controllers/whatsapp.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = express.Router();

// ========== PUBLIC ROUTES (No authentication) ==========
// WhatsApp webhook verification and receiving
router.get('/webhook', whatsappController.verifyWebhook);
router.post('/webhook', whatsappController.receiveWebhook);

// ========== PROTECTED ROUTES (Authentication required) ==========
router.use(authenticate);

// Route: GET /api/whatsapp/status
// Access: All authenticated users
// Purpose: Check WhatsApp API connection status
router.get('/status', whatsappController.getWhatsAppStatus);

// Route: GET /api/whatsapp/templates
// Access: MANAGER, ADMIN
// Purpose: Get available WhatsApp templates
router.get('/templates', authorize('ADMIN', 'MANAGER'), whatsappController.getTemplates);

// Route: GET /api/whatsapp/business-profile
// Access: MANAGER, ADMIN
// Purpose: Get WhatsApp business profile info
router.get('/business-profile', authorize('ADMIN', 'MANAGER'), whatsappController.getBusinessProfileInfo);

// Route: GET /api/whatsapp/token/health
// Access: MANAGER, ADMIN
// Purpose: Check token health
router.get('/token/health', authorize('ADMIN', 'MANAGER'), whatsappController.checkTokenHealth);

// Route: POST /api/whatsapp/token/refresh
// Access: ADMIN only
// Purpose: Manually refresh WhatsApp token
router.post('/token/refresh', authorize('ADMIN'), whatsappController.refreshToken);

// ========== CONTACTS MANAGEMENT ROUTES ==========
// Access: SUPPORT, MANAGER, ADMIN
router.use(authorize('ADMIN', 'MANAGER', 'SUPPORT'));

// Route: GET /api/whatsapp/contacts
// Purpose: Get registered WhatsApp contacts
router.get('/contacts', whatsappController.getRegisteredContacts);

// Route: GET /api/whatsapp/contacts/recent
// Purpose: Get recent contacts (last X days)
router.get('/contacts/recent', whatsappController.getRecentContacts);

// Route: GET /api/whatsapp/contacts/overview
// Purpose: Get contacts overview statistics
router.get('/contacts/overview', whatsappController.getContactsOverview);

// Route: POST /api/whatsapp/contacts/check
// Purpose: Check if phone numbers are valid WhatsApp numbers
router.post('/contacts/check', whatsappController.checkContacts);

// Route: POST /api/whatsapp/contacts/sync
// Purpose: Sync WhatsApp contacts with database
router.post('/contacts/sync', whatsappController.syncContacts);

// Route: GET /api/whatsapp/contacts/blocked
// Purpose: Get blocked contacts
router.get('/contacts/blocked', whatsappController.getBlockedContacts);

// Route: GET /api/whatsapp/contacts/search
// Purpose: Search contacts by name or phone
router.get('/contacts/search', whatsappController.searchContacts);

// ========== SINGLE CONTACT MANAGEMENT ROUTES ==========

// Route: GET /api/whatsapp/contacts/:phoneNumber
// Purpose: Get detailed contact information
router.get('/contacts/:phoneNumber', whatsappController.getContactInfo);

// Route: GET /api/whatsapp/contacts/:phoneNumber/profile-picture
// Purpose: Get contact's profile picture
router.get('/contacts/:phoneNumber/profile-picture', whatsappController.getContactProfilePicture);

// Route: GET /api/whatsapp/contacts/:phoneNumber/message-stats
// Purpose: Get contact's message statistics
router.get('/contacts/:phoneNumber/message-stats', whatsappController.getContactMessageStats);

// Route: GET /api/whatsapp/contacts/:phoneNumber/business-profile
// Purpose: Get contact's business profile
router.get('/contacts/:phoneNumber/business-profile', whatsappController.getBusinessProfile);

// Route: POST /api/whatsapp/contacts/:phoneNumber/block
// Access: ADMIN only
// Purpose: Block a contact
router.post('/contacts/:phoneNumber/block', authorize('ADMIN'), whatsappController.blockContact);

// Route: POST /api/whatsapp/contacts/:phoneNumber/unblock
// Access: ADMIN only
// Purpose: Unblock a contact
router.post('/contacts/:phoneNumber/unblock', authorize('ADMIN'), whatsappController.unblockContact);

// ========== MESSAGE SENDING ROUTES ==========
// Access: SUPPORT, MANAGER, ADMIN
router.use(authorize('ADMIN', 'MANAGER', 'SUPPORT'));

// Route: POST /api/whatsapp/send
// Purpose: Send text/template/interactive message
router.post('/send', whatsappController.sendMessage);

// Route: POST /api/whatsapp/send-media
// Purpose: Send image/document messages
router.post('/send-media', whatsappController.sendMediaMessage);

// Route: POST /api/whatsapp/send-catalog
// Purpose: Send catalog message
router.post('/send-catalog', whatsappController.sendCatalogMessage);

// Route: POST /api/whatsapp/send/list
// Purpose: Send interactive list message
router.post('/send/list', whatsappController.sendInteractiveList);

// ========== PRODUCT CATALOG ROUTES ==========
// Access: MANAGER, ADMIN
router.use(authorize('ADMIN', 'MANAGER'));

// Route: POST /api/whatsapp/catalog/sync
// Purpose: Sync product to WhatsApp catalog
router.post('/catalog/sync', whatsappController.syncProductToCatalog);

// Route: GET /api/whatsapp/catalog/products
// Purpose: Get products from WhatsApp catalog
router.get('/catalog/products', whatsappController.getCatalogProducts);

// Route: PUT /api/whatsapp/catalog/products/:productId
// Purpose: Update catalog product
router.put('/catalog/products/:productId', whatsappController.updateCatalogProduct);

// Route: DELETE /api/whatsapp/catalog/products/:productId
// Purpose: Delete catalog product
router.delete('/catalog/products/:productId', whatsappController.deleteCatalogProduct);

// ========== CHAT MANAGEMENT ROUTES ==========
// Access: SUPPORT, MANAGER, ADMIN
router.use(authorize('ADMIN', 'MANAGER', 'SUPPORT'));

// Route: GET /api/whatsapp/conversations
// Purpose: Get all conversations with filters
router.get('/conversations', whatsappController.getConversations);

// Route: GET /api/whatsapp/conversations/:id
// Purpose: Get specific conversation by ID
router.get('/conversations/:id', whatsappController.getConversation);

// Route: GET /api/whatsapp/conversations/phone/:phone
// Purpose: Get conversation by phone number
router.get('/conversations/phone/:phone', whatsappController.getConversationByPhone);

// Route: PUT /api/whatsapp/conversations/:id
// Purpose: Update conversation details
router.put('/conversations/:id', whatsappController.updateConversation);

// Route: POST /api/whatsapp/conversations/:id/assign
// Purpose: Assign conversation to admin
router.post('/conversations/:id/assign', whatsappController.assignConversation);

// Route: POST /api/whatsapp/conversations/:id/resolve
// Purpose: Mark conversation as resolved
router.post('/conversations/:id/resolve', whatsappController.markAsResolved);

// Route: PUT /api/whatsapp/conversations/:id/tags
// Purpose: Update conversation tags
router.put('/conversations/:id/tags', whatsappController.updateTags);

// Route: PUT /api/whatsapp/conversations/:id/customer
// Purpose: Update customer information
router.put('/conversations/:id/customer', whatsappController.updateCustomerInfo);

// ========== MESSAGE MANAGEMENT ROUTES ==========

// Route: POST /api/whatsapp/conversations/:id/message
// Purpose: Send chat message (saves to DB + sends via WhatsApp)
router.post('/conversations/:id/message', whatsappController.sendChatMessage);

// Route: GET /api/whatsapp/conversations/:id/messages
// Purpose: Get messages for conversation
router.get('/conversations/:id/messages', whatsappController.getMessages);

// Route: POST /api/whatsapp/conversations/:id/read
// Purpose: Mark messages as read
router.post('/conversations/:id/read', whatsappController.markMessagesAsRead);

// ========== BROADCAST ROUTES ==========
// Access: ADMIN only
router.use(authorize('ADMIN'));

// Route: POST /api/whatsapp/broadcast
// Purpose: Send broadcast to multiple customers
router.post('/broadcast', whatsappController.sendBroadcast);

// ========== STATISTICS ROUTES ==========
// Access: MANAGER, ADMIN
router.use(authorize('ADMIN', 'MANAGER'));

// Route: GET /api/whatsapp/statistics
// Purpose: Get chat statistics
router.get('/statistics', whatsappController.getChatStatistics);

export default router;