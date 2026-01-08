// WhatsApp API Types
export interface WhatsAppMessage {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: string;
  [key: string]: any;
}

export interface WhatsAppTextMessage extends WhatsAppMessage {
  type: 'text';
  text: {
    preview_url?: boolean;
    body: string;
  };
}

export interface WhatsAppTemplateMessage extends WhatsAppMessage {
  type: 'template';
  template: {
    name: string;
    language: {
      code: string;
    };
    components?: TemplateComponent[];
  };
}

export interface TemplateComponent {
  type: string;
  parameters: TemplateParameter[];
}

export interface TemplateParameter {
  type: string;
  text: string;
}

export interface WhatsAppMediaObject {
  id?: string;
  link?: string;
  caption?: string;
}

export interface WhatsAppMediaMessage extends WhatsAppMessage {
  type: 'image' | 'document' | 'audio' | 'video' | 'sticker';
  image?: WhatsAppMediaObject;
  document?: WhatsAppMediaObject;
  audio?: WhatsAppMediaObject;
  video?: WhatsAppMediaObject;
  sticker?: WhatsAppMediaObject;
}

export interface WhatsAppInteractiveMessage extends WhatsAppMessage {
  type: 'interactive';
  interactive: {
    type: 'button' | 'list' | 'product' | 'product_list';
    body: {
      text: string;
    };
    action: any;
  };
}

export interface WhatsAppAPIResponse {
  messaging_product: 'whatsapp';
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
  }>;
}

export interface WebhookPayload {
  object: string;
  entry: WebhookEntry[];
}

export interface WebhookEntry {
  id: string;
  changes: WebhookChange[];
}

export interface WebhookChange {
  value: WebhookValue;
  field: string;
}

export interface WebhookValue {
  messaging_product: 'whatsapp';
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WhatsAppContact[];
  messages?: IncomingMessage[];
  errors?: any[];
}

export interface WhatsAppContact {
  wa_id: string;
  profile: {
    name: string;
  };
}

export interface IncomingMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: {
    body: string;
  };
  button?: {
    text: string;
    payload: string;
  };
  interactive?: any;
  order?: any;
}