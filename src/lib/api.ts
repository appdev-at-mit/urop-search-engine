import type { Listing, ListingFilters, PaginatedResponse } from '../types';

const API_BASE = '/api';

export async function fetchListings(filters: ListingFilters = {}): Promise<PaginatedResponse> {
  const params = new URLSearchParams();

  if (filters.q) params.set('q', filters.q);
  if (filters.department) params.set('department', filters.department);
  if (filters.pay_or_credit) params.set('pay_or_credit', filters.pay_or_credit);
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
