import { API_BASE_URL } from "./config";
import { CheckoutType, Discipline, LayerInfo, Project, TakeoffResult, User } from "./types";

type ApiOptions = {
  method?: "GET" | "POST" | "DELETE";
  token?: string | null;
  body?: any;
  isFormData?: boolean;
  responseType?: "json" | "blob" | "text";
};

async function apiRequest<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = "GET", token, body, isFormData = false, responseType = "json" } = options;
  const url = `${API_BASE_URL}${endpoint}`;
  const headers: HeadersInit = {};

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const parsed = await response.json();
      detail = parsed.detail || JSON.stringify(parsed);
    } catch {
      // ignore
    }
    throw new Error(detail || "Erro inesperado na API");
  }

  if (responseType === "blob") {
    return (await response.blob()) as T;
  }

  if (responseType === "text") {
    return (await response.text()) as T;
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

export async function registerUser(payload: {
  email: string;
  password: string;
  full_name?: string;
  company?: string;
}): Promise<User> {
  return apiRequest<User>("/auth/register", { method: "POST", body: payload });
}

export async function loginUser(payload: { email: string; password: string }): Promise<string> {
  const result = await apiRequest<{ access_token: string }>("/auth/login", {
    method: "POST",
    body: payload,
  });
  return result.access_token;
}

export async function fetchProfile(token: string): Promise<User> {
  return apiRequest<User>("/auth/me", { token });
}

export async function listProjects(token: string): Promise<Project[]> {
  return apiRequest<Project[]>("/projects", { token });
}

export async function uploadProject(file: File, token: string): Promise<{ project_id: number }> {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest<{ project_id: number; status: string }>("/upload", {
    method: "POST",
    token,
    isFormData: true,
    body: formData,
  });
}

export async function fetchLayers(projectId: number, token: string): Promise<LayerInfo[]> {
  return apiRequest<LayerInfo[]>(`/projects/${projectId}/layers`, { token });
}

export async function processProject(
  projectId: number,
  layerMap: Record<string, Discipline>,
  token: string,
  scaleRatio?: number
): Promise<TakeoffResult> {
  return apiRequest<TakeoffResult>(`/projects/${projectId}/process`, {
    method: "POST",
    token,
    body: {
      layer_map: layerMap,
      scale_ratio: scaleRatio,
    },
  });
}

export async function fetchResult(projectId: number, token: string): Promise<TakeoffResult> {
  return apiRequest<TakeoffResult>(`/projects/${projectId}/result`, { token });
}

export async function downloadResult(projectId: number, token: string): Promise<Blob> {
  return apiRequest<Blob>(`/projects/${projectId}/export`, {
    token,
    responseType: "blob",
  });
}

export async function createCheckout(checkout_type: CheckoutType, token: string) {
  return apiRequest<{ payment_id: string; invoice_url?: string | null; status: string }>(
    "/billing/checkout",
    {
      method: "POST",
      token,
      body: { checkout_type },
    }
  );
}
