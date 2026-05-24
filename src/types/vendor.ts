// ─── Auth / Users ───

export interface Profile {
  id: string;
  role: "parent" | "vendor" | "admin";
  displayName: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Vendors ───

export interface Vendor {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: "draft" | "live" | "paused" | "rejected";
  ownerId: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  instagram: string | null;
  whatsapp: string | null;
  basePostcode: string | null;
  coverageRadiusMiles: number;
  priceFrom: number | null;
  priceTo: number | null;
  priceNotes: string | null;
  bio: string | null;
  faq: Record<string, string>[] | null;
  cancellationPolicy: string | null;
  minLeadDays: number;
  maxAdvanceDays: number;
  ratingAvg: number | null;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Services ───

export interface VendorService {
  id: string;
  vendorId: string;
  serviceType: string;
  title: string;
  description: string | null;
  position: number;
  ageMin: number | null;
  ageMax: number | null;
  capacityMin: number | null;
  capacityMax: number | null;
  setting: "indoor" | "outdoor" | "either";
  durationMinutes: number | null;
  priceFrom: number | null;
  priceTo: number | null;
}

export interface ServicePricing {
  id: string;
  serviceId: string;
  label: string;
  durationMinutes: number | null;
  dayType: "weekday" | "weekend" | "any";
  price: number;
  perChild: boolean;
  minChildren: number | null;
  maxChildren: number | null;
  notes: string | null;
  position: number;
}

// ─── Photos ───

export interface VendorPhoto {
  id: string;
  vendorId: string;
  serviceId: string | null;
  url: string;
  altText: string | null;
  position: number;
  createdAt: string;
}

// ─── Reviews ───

export interface Review {
  id: string;
  vendorId: string;
  serviceId: string | null;
  authorId: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  partyDate: string | null;
  childAge: number | null;
  guestCount: number | null;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Availability ───

export interface VendorSchedule {
  id: string;
  vendorId: string;
  dayOfWeek: number;
  available: boolean;
}

export interface VendorBlockedDate {
  id: string;
  vendorId: string;
  blockedDate: string;
  reason: "booked" | "holiday" | "personal" | null;
  note: string | null;
}

// ─── Coverage ───

export interface VendorCoverageArea {
  id: string;
  vendorId: string;
  postcodeDistrict: string;
}

// ─── Enquiries ───

export interface Enquiry {
  id: string;
  vendorId: string;
  serviceId: string | null;
  parentId: string | null;
  queryId: string | null;
  status: "sent" | "viewed" | "replied" | "booked" | "declined" | "expired";
  partyDate: string | null;
  partyPostcode: string | null;
  childAge: number | null;
  guestCount: number | null;
  setting: "indoor" | "outdoor" | "either" | null;
  budget: number | null;
  message: string | null;
  parentName: string | null;
  parentEmail: string | null;
  parentPhone: string | null;
  vendorResponse: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Tags ───

export interface Tag {
  id: string;
  slug: string;
  name: string;
  category: "theme" | "style" | "credential";
}

// ─── Search / AI (runtime, not stored) ───

export interface VendorMatch {
  vendor: Vendor;
  rank: number;
  featured: boolean;
  adjacent: boolean;
  matchReason: string;
  matchedTags: MatchedTag[];
  category: string;
  distance: string;
  metaLine: string;
  photoUrl: string;
  photoCount: number;
  rating: number;
  bookingCount: number;
  priceLabel: string;
  priceUnit: string;
}

export interface MatchedTag {
  label: string;
  good: boolean;
}
