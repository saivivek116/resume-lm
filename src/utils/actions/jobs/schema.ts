export interface JobListingParams {
  page: number;
  pageSize: number;
  filters?: {
    workLocation?: 'remote' | 'in_person' | 'hybrid';
    employmentType?: 'full_time' | 'part_time' | 'co_op' | 'internship';
    keywords?: string[];
    discoveredAfter?: string; // ISO date string — filters by created_at >= value
  };
}
  