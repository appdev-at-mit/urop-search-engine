import type { Listing, ListingFilters, PaginatedResponse, Lab, LabFilters, PaginatedLabResponse, LabFilterOptions } from '../types';

const API_BASE = '/api';

export async function fetchListings(filters: ListingFilters = {}): Promise<PaginatedResponse> {
  const params = new URLSearchParams();

  if (filters.q) params.set('q', filters.q);
  if (filters.department) params.set('department', filters.department);
  if (filters.pay_or_credit) params.set('pay_or_credit', filters.pay_or_credit);
  if (filters.opportunity) params.set('opportunity', filters.opportunity);
  if (filters.lab) params.set('lab', filters.lab);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.sort) params.set('sort', filters.sort);

  const res = await fetch(`${API_BASE}/listings?${params}`);
  if (!res.ok) throw new Error('Failed to fetch listings');
  return res.json();
}

export async function fetchListing(id: string): Promise<Listing> {
  const res = await fetch(`${API_BASE}/listings/${id}`);
  if (!res.ok) throw new Error('Listing not found');
  return res.json();
}

export async function fetchDepartments(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/listings/departments`);
  if (!res.ok) throw new Error('Failed to fetch departments');
  return res.json();
}

export async function fetchListingLabs(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/listings/labs`);
  if (!res.ok) throw new Error('Failed to fetch labs');
  return res.json();
}

export async function fetchLabs(filters: LabFilters = {}): Promise<PaginatedLabResponse> {
  const params = new URLSearchParams();

  if (filters.q) params.set('q', filters.q);
  if (filters.department) params.set('department', filters.department);
  if (filters.parent_org) params.set('parent_org', filters.parent_org);
  if (filters.research_area) params.set('research_area', filters.research_area);
  if (filters.page) params.set('page', String(filters.page));

  const res = await fetch(`${API_BASE}/labs?${params}`);
  if (!res.ok) throw new Error('Failed to fetch labs');
  return res.json();
}

export async function fetchLab(id: string): Promise<Lab> {
  const res = await fetch(`${API_BASE}/labs/${id}`);
  if (!res.ok) throw new Error('Lab not found');
  return res.json();
}

export async function fetchLabFilters(): Promise<LabFilterOptions> {
  const res = await fetch(`${API_BASE}/labs/filters`);
  if (!res.ok) throw new Error('Failed to fetch lab filters');
  const data = await res.json();
  return {
    parentOrgs: data.parentOrgs ?? [],
    researchAreas: data.researchAreas ?? [],
    departments: data.departments ?? [],
  };
}
