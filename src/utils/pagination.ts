export interface PaginationInput {
  page: number;
  limit: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function toSkipTake({ page, limit }: PaginationInput) {
  return { skip: (page - 1) * limit, take: limit };
}

export function buildPaginationMeta(
  total: number,
  { page, limit }: PaginationInput,
): PaginationMeta {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
