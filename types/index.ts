// Delivery Partner Types
export interface DeliveryPartner {
  id: string;
  phone: string;
  email?: string;
  name?: string;
  avatar?: string;
  provider: 'phone_otp' | 'google' | 'firebase_phone' | 'email';
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  isApproved: boolean;
  onboardingStatus: OnboardingStatus;
  onboardingProgress: number;
  
  // Personal Information
  aadhaarNumber?: string;
  panNumber?: string;
  aadhaarPhoto?: string;
  panPhoto?: string;
  
  // Vehicle Information
  vehicleType?: 'bike' | 'scooter' | 'car' | 'bicycle';
  vehicleNumber?: string;
  rcPhoto?: string;
  drivingLicenseNumber?: string;
  drivingLicensePhoto?: string;
  profilePhoto?: string;
  
  // Bank Details
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankIFSC?: string;
  bankAccountPhoto?: string;
  upiId?: string;
  
  // Work Information
  rating: number;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  averageDeliveryTime?: number;
  isActive: boolean;
  lastActive?: Date;
  
  // Location
  lastLocation?: {
    latitude: number;
    longitude: number;
    timestamp: Date;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

export enum OnboardingStatus {
  PHONE_VERIFIED = 'phone_verified',
  PERSONAL_INFO = 'personal_info',
  DOCUMENTS = 'documents',
  VEHICLE_INFO = 'vehicle_info',
  BANK_DETAILS = 'bank_details',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
}

// Order Types
export interface Order {
  _id: string;
  user: {
    _id: string;
    name: string;
    phone: string;
    email?: string;
  };
  restaurant: {
    _id: string;
    name: string;
    address: string;
    phone: string;
    location?: {
      latitude: number;
      longitude: number;
    };
  };
  items: OrderItem[];
  deliveryAddress: {
    fullAddress: string;
    landmark?: string;
    location: {
      latitude: number;
      longitude: number;
    };
  };
  status: OrderStatus;
  paymentMethod: 'cash' | 'card' | 'upi';
  paymentStatus: 'pending' | 'paid' | 'failed';
  subtotal: number;
  tax: number;
  deliveryFee: number;
  totalAmount: number;
  estimatedDeliveryTime?: string;
  distance?: number;
  deliveryPartner?: string;
  specialInstructions?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  food: {
    _id: string;
    name: string;
    price: number;
    image?: string;
  };
  quantity: number;
  price: number;
  specialInstructions?: string;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready_for_pickup'
  | 'picked_up'
  | 'on_the_way'
  | 'delivered'
  | 'cancelled';

// Location Types
export interface Location {
  latitude: number;
  longitude: number;
}

export interface Address {
  fullAddress: string;
  landmark?: string;
  location: Location;
}

// Earnings Types
export interface Earnings {
  today: number;
  week: number;
  month: number;
  total?: number;
}

export interface EarningsBreakdown {
  date: string;
  orders: number;
  amount: number;
  tips?: number;
}

// Statistics Types
export interface Stats {
  deliveriesToday: number;
  shiftsCompleted: number;
  activeOrders: number;
  totalDeliveries?: number;
  completionRate?: number;
  averageRating?: number;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: {
    items: T[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      pages: number;
    };
  };
}

// Registration Types
export interface RegistrationStepData {
  step: number;
  totalSteps: number;
  isComplete: boolean;
  data: any;
}

export interface BasicDetailsFormData {
  name: string;
  email: string;
}

export interface KYCDocumentsFormData {
  aadhaarNumber: string;
  panNumber: string;
  aadhaarPhoto?: string;
  panPhoto?: string;
}

export interface VehicleDetailsFormData {
  vehicleType: 'bike' | 'scooter' | 'car';
  vehicleNumber: string;
  rcPhoto?: string;
  drivingLicenseNumber: string;
  drivingLicensePhoto?: string;
}

export interface BankDetailsFormData {
  bankAccountName: string;
  bankAccountNumber: string;
  bankIFSC: string;
  bankAccountPhoto?: string;
}

// Notification Types
export interface Notification {
  id: string;
  type: 'order' | 'payment' | 'system' | 'promotion';
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  createdAt: Date;
}

// Error Types
export interface ApiError {
  message: string;
  code?: string;
  field?: string;
  details?: any;
}
