export interface FacebookPage {
  id: string;
  name: string;
  accessToken: string;
  tasks?: string[];
}

export interface FacebookForm {
  id: string;
  name: string;
  status?: string;
}

export interface FacebookFieldData {
  name: string;
  values: string[];
}

export interface FacebookLead {
  id: string;
  created_time?: string;
  form_id?: string;
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  is_organic?: boolean;
  platform?: string;
  field_data?: FacebookFieldData[];
}

export interface NormalizedLead {
  provider: "facebook_lead_ads";
  externalSubmissionId: string;
  externalFormId: string;
  submittedAt: Date;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  customFields: Record<string, unknown>;
  answers: Record<string, string | string[]>;
  attribution: Record<string, unknown>;
}
