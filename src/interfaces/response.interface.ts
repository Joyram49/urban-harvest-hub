export interface ApiMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  meta?: ApiMeta;
  errors?: ApiError[];
}

export interface ApiError {
  field?: string;
  message: string;
}
