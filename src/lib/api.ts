export type FeatureOption = { value: number; label: string };

export type FeatureDefinition = {
  name: keyof ClinicalInput;
  label: string;
  type: 'number' | 'categorical';
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: FeatureOption[];
  description: string;
};

export type ClinicalInput = {
  age: number;
  sex: number;
  cp: number;
  trestbps: number;
  chol: number;
  fbs: number;
  restecg: number;
  thalach: number;
  exang: number;
  oldpeak: number;
  slope: number;
  ca: number;
  thal: number;
};

export type ModelInfo = {
  name: string;
  model_type: string;
  features: FeatureDefinition[];
  target_definition: string;
  dataset: {
    rows: number;
    features: number;
    target_positive_count: number;
    target_negative_count: number;
    missing_values: Record<string, number>;
    license: string;
  };
  split: { strategy: string; train_rows: number; test_rows: number };
  limitations: string[];
};

export type VesselRiskInfo = {
  vessel: string;
  name: string;
  probability: number;
  risk_level: string;
  territory: string;
  clinical_note: string;
};

export type Prediction = {
  prediction: number;
  probability: number;
  threshold: number;
  label: string;
  target_definition: string;
  limitations: string[];
  vessels?: Record<string, VesselRiskInfo>;
};

export type DoctorProfile = {
  id: string;
  name: string;
  title: string;
  email: string;
};

export type AuthTokenResponse = {
  token: string;
  doctor: DoctorProfile;
};

export type Explanation = {
  probability: number;
  logit: number;
  intercept: number;
  method: string;
  caution: string;
  contributions: Array<{
    feature: string;
    contribution: number;
    direction: string;
    absolute: number;
  }>;
  detailed_contributions?: Array<{
    transformed_feature: string;
    base_feature: string;
    value: number;
    coefficient: number;
    contribution: number;
  }>;
  global_importance?: Array<{
    feature: string;
    importance: number;
    coefficients: number[];
  }>;
};

export type Evaluation = {
  dataset: ModelInfo['dataset'] & { source_url: string };
  split: ModelInfo['split'];
  cross_validation: Record<string, { mean: number; std: number }>;
  holdout: {
    metrics: Record<string, number>;
    confusion_matrix: { tn: number; fp: number; fn: number; tp: number };
    roc_curve: Array<{ fpr: number; tpr: number; threshold: number | string }>;
    calibration: Array<{ bin: string; mean_predicted_probability: number; observed_rate: number; count: number }>;
  };
  vessels?: Record<
    string,
    {
      holdout: {
        metrics: Record<string, number>;
        confusion_matrix: { tn: number; fp: number; fn: number; tp: number };
      };
      cross_validation: Record<string, { mean: number; std: number }>;
    }
  >;
  limitations: string[];
};

export type ClinicianReview = {
  id: string;
  doctor_name: string;
  doctor_title: string;
  summary: string;
  advice: string;
  follow_up: string;
  status: string;
  created_at: string;
};

export type Assessment = {
  id: string;
  created_at: string;
  patient_name: string;
  inputs: ClinicalInput;
  prediction: Prediction;
  explanation?: Explanation;
  report_source?: string;
  review?: ClinicianReview | null;
  is_reviewed?: boolean;
  doctor_name?: string;
  review_status?: string;
};

export type ReportUploadResult = {
  filename: string;
  file_size: number;
  raw_text_preview: string;
  is_ocr: boolean;
  extracted_values: Partial<ClinicalInput>;
  extraction_notes: string[];
  status: string;
  notice: string;
};

export type PatientProfile = {
  id: string;
  full_name: string;
  phone: string;
  age: number;
  email?: string | null;
  created_at: string;
};

export type PatientAuthResponse = {
  token: string;
  expires_at: string;
  patient: PatientProfile;
};

export type PatientRegisterRequest = {
  full_name: string;
  phone: string;
  age: number;
  password: string;
  email?: string | null;
};

export type PatientLoginRequest = {
  phone: string;
  password: string;
};

export type PatientAssessmentRecord = {
  id: string;
  created_at: string;
  patient_name: string;
  report_source: string;
  prediction: {
    probability: number;
    risk_level: string;
    explanation_summary: string;
    vessels?: Record<string, VesselRiskInfo>;
  };
  explanation?: {
    top_factors: Array<{ feature: string; impact: string; description: string }>;
  };
  doctor_advice: ClinicianReview | null;
  inputs?: ClinicalInput;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

let currentDoctorToken: string | null = typeof window !== 'undefined' ? localStorage.getItem('cardiovision_doctor_token') : null;
let currentPatientToken: string | null = typeof window !== 'undefined' ? localStorage.getItem('cardiovision_patient_token') : null;

export const setDoctorToken = (token: string | null) => {
  currentDoctorToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('cardiovision_doctor_token', token);
    } else {
      localStorage.removeItem('cardiovision_doctor_token');
    }
  }
};

export const getDoctorToken = () => currentDoctorToken;

export const setPatientToken = (token: string | null) => {
  currentPatientToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('cardiovision_patient_token', token);
    } else {
      localStorage.removeItem('cardiovision_patient_token');
    }
  }
};

export const getPatientToken = () => currentPatientToken;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const isFormData = options?.body instanceof FormData;
  const headers: Record<string, string> = isFormData
    ? { ...(options?.headers as Record<string, string>) }
    : { 'Content-Type': 'application/json', ...(options?.headers as Record<string, string>) };

  if (!headers['Authorization']) {
    if (path.startsWith('/patient') || path.startsWith('/patients')) {
      if (currentPatientToken) {
        headers['Authorization'] = `Bearer ${currentPatientToken}`;
      }
    } else {
      if (currentDoctorToken) {
        headers['Authorization'] = `Bearer ${currentDoctorToken}`;
      } else if (currentPatientToken) {
        headers['Authorization'] = `Bearer ${currentPatientToken}`;
      }
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers,
    ...options,
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(Array.isArray(detail.detail) ? 'Please correct the highlighted clinical inputs.' : detail.detail);
  }
  return response.json() as Promise<T>;
}

export const api = {
  modelInfo: () => request<ModelInfo>('/model-info'),
  evaluation: () => request<Evaluation>('/evaluation'),
  predict: (payload: ClinicalInput) => request<Prediction>('/predict', { method: 'POST', body: JSON.stringify(payload) }),
  explain: (payload: ClinicalInput) => request<Explanation>('/explain', { method: 'POST', body: JSON.stringify(payload) }),
  createAssessment: (patientName: string, inputs: ClinicalInput, reportSource?: string) =>
    request<{ assessment_id: string; prediction: Prediction; explanation: Explanation; patient_name: string; status: string }>(
      '/assessments',
      { method: 'POST', body: JSON.stringify({ patient_name: patientName, inputs, report_source: reportSource }) }
    ),
  listAssessments: () => request<Assessment[]>('/assessments'),
  getAssessment: (id: string) => request<Assessment>(`/assessments/${id}`),
  addReview: (assessmentId: string, review: Omit<ClinicianReview, 'id' | 'created_at'>) =>
    request<ClinicianReview>(`/assessments/${assessmentId}/review`, { method: 'POST', body: JSON.stringify(review) }),
  uploadReport: async (file: File): Promise<ReportUploadResult> => {
    const data = new FormData();
    data.append('file', file);
    return request<ReportUploadResult>('/upload-report', { method: 'POST', body: data });
  },
  loginDoctor: (credentials: { email: string; password: string }) =>
    request<AuthTokenResponse>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  getDoctorMe: () => request<DoctorProfile>('/auth/me'),
  logoutDoctor: () => request<{ status: string }>('/auth/logout', { method: 'POST' }),
  registerPatient: (data: PatientRegisterRequest) =>
    request<PatientAuthResponse>('/patient/register', { method: 'POST', body: JSON.stringify(data) }),
  loginPatient: (data: PatientLoginRequest) =>
    request<PatientAuthResponse>('/patient/login', { method: 'POST', body: JSON.stringify(data) }),
  getPatientMe: () => request<PatientProfile>('/patient/me'),
  logoutPatient: () => request<{ status: string }>('/patient/logout', { method: 'POST' }),
  listPatientAssessments: () => request<PatientAssessmentRecord[]>('/patient/assessments'),
  getPatientAssessment: (id: string) => request<PatientAssessmentRecord>(`/patient/assessments/${id}`),
  createPatientAssessment: (inputs: ClinicalInput, reportSource?: string) =>
    request<PatientAssessmentRecord & { duplicate?: boolean }>('/patient/assessments', {
      method: 'POST',
      body: JSON.stringify({ inputs, report_source: reportSource }),
    }),
  notifyPatient: (assessmentId: string, payload: { recipient_email: string; patient_consent: boolean; patient_name?: string }) =>
    request<{ id: string; assessment_id: string; recipient_email: string; status: string; provider: string; sent_at: string }>(
      `/assessments/${assessmentId}/notify`,
      { method: 'POST', body: JSON.stringify(payload) }
    ),
  getNotifications: (assessmentId: string) =>
    request<Array<{ id: string; assessment_id: string; recipient_email: string; status: string; provider: string; sent_at: string }>>(
      `/assessments/${assessmentId}/notifications`
    ),
  getPatientAssessments: (sessionId: string) =>
    request<Assessment[]>(`/patients/${sessionId}/assessments`),
};

export const syntheticExamples: Record<string, ClinicalInput> = {
  lower_probability: {
    age: 41,
    sex: 0,
    cp: 2,
    trestbps: 120,
    chol: 204,
    fbs: 0,
    restecg: 0,
    thalach: 172,
    exang: 0,
    oldpeak: 0,
    slope: 1,
    ca: 0,
    thal: 3,
  },
  higher_probability: {
    age: 63,
    sex: 1,
    cp: 4,
    trestbps: 145,
    chol: 233,
    fbs: 1,
    restecg: 2,
    thalach: 150,
    exang: 0,
    oldpeak: 2.3,
    slope: 3,
    ca: 0,
    thal: 6,
  },
};
