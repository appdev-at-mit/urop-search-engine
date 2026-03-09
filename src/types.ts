export interface Listing {
  id: number;
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
  is_active: number;
  created_at: string;
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
  page?: number;
  sort?: 'recent' | 'title';
}
