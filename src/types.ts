export interface Listing {
  _id: string;
  title: string;
  professor: string | null;
  department: string | null;
  lab: string | null;
  description: string | null;
  requirements: string | null;
  pay_or_credit: string | null;
  posted_date: string | null;
  source_url: string | null;
  contact_email: string | null;
  is_active: boolean;
  created_at: string;
  theme?: string | null;
  terms?: string | null;
  location?: string | null;
  city?: string | null;
  deadline_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  source?: string | null;
}

export interface PaginatedResponse {
  listings: Listing[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ListingFilters {
  q?: string;
  department?: string;
  pay_or_credit?: string;
  /** urop | global | not_urop — matches ELx primary_theme */
  opportunity?: string;
  /** Case-insensitive substring match on listing lab name */
  lab?: string;
  page?: number;
  sort?: 'recent' | 'title';
}

export interface Lab {
  _id: string;
  name: string;
  acronym?: string | null;
  department: string | null;
  pi: string | null;
  research_areas: string[];
  description: string | null;
  website: string | null;
  contact_email?: string | null;
  parent_org: string | null;
  is_active: boolean;
}

export interface PaginatedLabResponse {
  labs: Lab[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LabFilters {
  q?: string;
  department?: string;
  parent_org?: string;
  research_area?: string;
  page?: number;
}

export interface LabFilterOptions {
  parentOrgs: string[];
  researchAreas: string[];
}
