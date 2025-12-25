import { Role } from '@prisma/client';

export const PERMISSIONS = {
  // Merchant permissions
  MERCHANT: [
    'manage_own_products',
    'manage_own_orders',
    'view_own_analytics',
    'manage_own_profile',
  ],

  // Admin permissions (full access)
  ADMIN: [
    'manage_all_merchants',
    'manage_all_products',
    'manage_all_orders',
    'manage_team_members',
    'manage_platform_settings',
    'view_all_reports',
    'manage_integrations',
    'process_refunds',
    'delete_orders',
  ],

  // Manager permissions
  MANAGER: [
    'view_all_orders',
    'process_orders',
    'manage_inventory',
    'view_reports',
    'manage_customers',
    'handle_disputes',
    'export_data',
  ],

  // Support permissions
  SUPPORT: [
    'view_orders',
    'update_order_status',
    'chat_with_customers',
    'view_customer_details',
    'create_support_tickets',
  ],
};

export const hasPermission = (role: Role, permission: string): boolean => {
  return PERMISSIONS[role]?.includes(permission) || false;
};