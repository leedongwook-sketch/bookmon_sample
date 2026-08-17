import { API_BASE_URL } from "./env";

/** API 통신 오류 (상태코드 포함) */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * 공통 fetch 래퍼. baseURL·기본 헤더·에러 처리를 한 곳에서 담당.
 * (스프링의 WebClient 공통 설정에 해당)
 */
export async function http<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw new ApiError(res.status, `API 오류 (${res.status})`);
  }

  // 204 No Content 대응
  return res.status === 204 ? (undefined as T) : (res.json() as Promise<T>);
}
