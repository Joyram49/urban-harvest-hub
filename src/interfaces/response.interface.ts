export interface IApiMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IApiResponse<T = unknown> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  meta?: IApiMeta;
  errors?: IApiError[];
}

export interface IApiError {
  field?: string;
  message: string;
}
