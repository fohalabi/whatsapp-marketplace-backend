

export interface VerificationData {
  businessName: string;
  category: string;
  location: string;
  phone: string;
  businessAddress: string;
  registrationNumber?: string | undefined;
  profilePictureUrl?: string | undefined;
  governmentIdUrl: string;
  businessLicenseUrl?: string | undefined;
  productSampleUrl: string;
}