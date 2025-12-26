export interface CreateMerchantProfileDTO {
  businessName: string;
  category: string;
  location: string;
  phone: string;
}

export interface MerchantProfileResponse {
  id: string;
  businessName: string;
  category: string;
  location: string;
  phone: string;
  verificationStatus: string;
  createdAt: Date;
}