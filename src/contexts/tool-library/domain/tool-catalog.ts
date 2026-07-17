// The Tool Library product catalog. This is the source of truth for every
// tool — prompts stay versioned in git and are synced into the global AiTool
// table at boot (ToolCatalogSyncService), so the DB always mirrors this file.
// Per-tenant state (company-wide toggles, per-user grants) lives in
// CompanyToolSetting / ToolGrant, never here.

export type ToolInputType = 'text' | 'textarea' | 'select';

export interface ToolInputField {
  /** Placeholder name the system prompt references, e.g. `job_description`. */
  key: string;
  label: string;
  type: ToolInputType;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  /** Per-field character cap (defaults to MAX_FIELD_LENGTH in the renderer). */
  maxLength?: number;
}

export type ToolSurface =
  | 'recruitment'
  | 'onboarding'
  | 'offboarding'
  | 'performance'
  | 'leave';

export interface ToolDefinition {
  slug: string;
  name: string;
  category: string;
  description: string;
  kind: 'PROMPT' | 'BUILTIN';
  systemPrompt: string;
  inputs: ToolInputField[];
  surfaces: ToolSurface[];
  /** BUILTIN only: route of the existing feature inside the app. */
  href?: string;
  sortOrder: number;
}

export const TOOL_CATEGORIES = [
  'Canadian Compliance & Risk',
  'Talent Acquisition',
  'Performance & Employee Experience',
  'HR Operations & Systems',
  'Core Intelligence',
] as const;

const PROVINCES = [
  'Ontario',
  'Québec',
  'British Columbia',
  'Alberta',
  'Manitoba',
  'Saskatchewan',
  'Nova Scotia',
  'New Brunswick',
  'Prince Edward Island',
  'Newfoundland and Labrador',
];

export const TOOL_CATALOG: ToolDefinition[] = [
  /* ------------- Category 1: Canadian Compliance & Risk ------------- */
  {
    slug: 'job-post-compliance-auditor',
    name: 'Job Post Compliance Auditor',
    category: 'Canadian Compliance & Risk',
    description:
      'Audits a draft job posting against Ontario Bill 149 and the Canadian Human Rights Act — salary-range disclosure, AI-use disclosure, and prohibited language.',
    kind: 'PROMPT',
    systemPrompt: `You are an expert in Canadian Employment Law and Ontario's Bill 149.
<task>
Review the provided draft <job_description>. You must identify and flag:
1. Any missing salary ranges (mandatory under Bill 149).
2. Any absence of an "AI use in hiring" disclosure statement.
3. Prohibited discriminatory language under the Canadian Human Rights Act, specifically targeting the phrase "Canadian experience" or equivalents.
</task>
<output_format>
Return a structured audit report with three sections: [Critical Legal Flags], [Suggested Edits], and a [Compliant Rewritten Description].
</output_format>`,
    inputs: [
      {
        key: 'job_description',
        label: 'Draft job description',
        type: 'textarea',
        placeholder: 'Paste the full draft job posting…',
        required: true,
      },
    ],
    surfaces: ['recruitment'],
    sortOrder: 10,
  },
  {
    slug: 'severance-notice-estimator',
    name: 'Common Law Severance & Notice Estimator',
    category: 'Canadian Compliance & Risk',
    description:
      'Estimates a reasonable-notice range in months using the Bardal factors, distinct from provincial statutory minimums.',
    kind: 'PROMPT',
    systemPrompt: `You are a Canadian HR legal assistant specializing in employment termination.
<task>
Analyze the following employee profile: <age>, <tenure_in_years>, <character_of_employment_seniority>, and <industry_job_market_availability>.
Using the Canadian "Bardal Factors" framework, estimate the range of reasonable notice (in months) this employee is entitled to under common law, distinct from their provincial statutory minimums.
</task>
<output_format>
Provide a conservative and aggressive estimate in months, citing the specific Bardal factors that drive the calculation up or down. Do not provide definitive legal advice.
</output_format>`,
    inputs: [
      { key: 'age', label: 'Employee age', type: 'text', required: true },
      {
        key: 'tenure_in_years',
        label: 'Tenure (years)',
        type: 'text',
        required: true,
      },
      {
        key: 'character_of_employment_seniority',
        label: 'Character of employment / seniority',
        type: 'text',
        placeholder: 'e.g. Senior Operations Manager, 4 direct reports',
        required: true,
      },
      {
        key: 'industry_job_market_availability',
        label: 'Industry & job market availability',
        type: 'textarea',
        placeholder: 'e.g. Manufacturing in Southwestern Ontario; few comparable roles nearby',
        required: true,
      },
    ],
    surfaces: ['offboarding'],
    sortOrder: 20,
  },
  {
    slug: 'esa-policy-resolver',
    name: 'Multi-Province ESA Policy Resolver',
    category: 'Canadian Compliance & Risk',
    description:
      'Compares a company policy against the statutory minimums of two provinces and drafts a compliance addendum.',
    kind: 'PROMPT',
    systemPrompt: `You are an expert in Canadian Provincial Employment Standards Acts (ESA).
<task>
Compare the <company_policy> regarding <leave_type_or_entitlement> against the statutory minimums for <province_a> and <province_b>.
</task>
<output_format>
Create a side-by-side comparison table highlighting any discrepancies where the company policy fails to meet the specific provincial minimum. Draft a short addendum to the policy to ensure compliance in both provinces.
</output_format>`,
    inputs: [
      {
        key: 'company_policy',
        label: 'Company policy text',
        type: 'textarea',
        required: true,
      },
      {
        key: 'leave_type_or_entitlement',
        label: 'Leave type or entitlement',
        type: 'text',
        placeholder: 'e.g. Sick leave, vacation accrual, overtime',
        required: true,
      },
      { key: 'province_a', label: 'Province A', type: 'select', options: PROVINCES, required: true },
      { key: 'province_b', label: 'Province B', type: 'select', options: PROVINCES, required: true },
    ],
    surfaces: ['leave'],
    sortOrder: 30,
  },
  {
    slug: 'bill-96-french-translator',
    name: 'Québec Bill 96 French Document Translator',
    category: 'Canadian Compliance & Risk',
    description:
      'Translates HR documents into Québec French with OQLF-standard legal HR terminology, preserving formatting.',
    kind: 'PROMPT',
    systemPrompt: `You are a certified legal translator specializing in Québec employment law.
<task>
Translate the provided <hr_document> into Canadian/Québec French. Ensure that all legal HR terminology matches the exact standards set by the OQLF (e.g., using "télétravail" instead of "remote work", "congé de maternité", etc.).
</task>
<output_format>
Return the fully translated document maintaining the exact original formatting and markdown structure.
</output_format>`,
    inputs: [
      {
        key: 'hr_document',
        label: 'HR document',
        type: 'textarea',
        placeholder: 'Paste the document to translate…',
        required: true,
      },
    ],
    surfaces: [],
    sortOrder: 40,
  },
  {
    slug: 'roe-leave-letter-drafter',
    name: 'ROE & Leave of Absence Letter Drafter',
    category: 'Canadian Compliance & Risk',
    description:
      'Drafts a warm, reassuring letter explaining the ROE, EI application steps, and benefits continuation for an employee going on leave.',
    kind: 'PROMPT',
    systemPrompt: `You are an empathetic, highly knowledgeable Canadian HR Generalist.
<task>
Write a personalized letter to an employee going on <leave_type>. Explain how their Record of Employment (ROE) will be submitted to Service Canada, how they can apply for Employment Insurance (EI), and what happens to their company benefits during the leave.
</task>
<output_format>
Use a warm, supportive, and highly reassuring tone. Use bullet points for the chronological steps they need to take.
</output_format>`,
    inputs: [
      {
        key: 'leave_type',
        label: 'Leave type',
        type: 'text',
        placeholder: 'e.g. Maternity leave, medical leave',
        required: true,
      },
      { key: 'employee_name', label: 'Employee name', type: 'text', required: true },
      {
        key: 'additional_context',
        label: 'Additional context (optional)',
        type: 'textarea',
        placeholder: 'Start date, benefits plan details, return expectations…',
      },
    ],
    surfaces: ['leave'],
    sortOrder: 50,
  },

  /* ---------------- Category 2: Advanced Talent Acquisition ---------------- */
  {
    slug: 'candidate-outreach-drafter',
    name: 'Personalized Candidate Outreach Drafter',
    category: 'Talent Acquisition',
    description:
      'Drafts a sub-150-word cold outreach message that ties one specific achievement from the candidate’s background to a core challenge of the open role.',
    kind: 'PROMPT',
    systemPrompt: `You are a senior executive recruiter.
<task>
Read the candidate's <linkedin_profile_or_resume> and our open <job_requisition>. Draft a highly personalized cold outreach message. You must identify one specific project or achievement from their past experience and explicitly connect it to a core challenge in our open role.
</task>
<output_format>
Provide a concise, engaging message under 150 words. Do not use generic buzzwords like "impressed by your profile." Include a low-friction call to action.
</output_format>`,
    inputs: [
      {
        key: 'linkedin_profile_or_resume',
        label: 'Candidate LinkedIn profile / resume',
        type: 'textarea',
        required: true,
      },
      {
        key: 'job_requisition',
        label: 'Open job requisition',
        type: 'textarea',
        required: true,
      },
    ],
    surfaces: ['recruitment'],
    sortOrder: 60,
  },
  {
    slug: 'behavioral-interview-guide',
    name: 'Custom Behavioral Interview Guide Creator',
    category: 'Talent Acquisition',
    description:
      'Finds the top gaps between a resume and the job description, then builds STAR-method questions with answer rubrics to probe them.',
    kind: 'PROMPT',
    systemPrompt: `You are a behavioral interviewing expert.
<task>
Compare the candidate's <resume> against the <job_description>. Identify the top 3 critical skill or experience gaps where the candidate's background does not perfectly align with the role.
</task>
<output_format>
Generate a custom interview guide for the hiring manager. Create 5 structured behavioral questions (using the STAR method) specifically designed to probe these identified gaps and test for high-priority competencies. Include a "What a good answer looks like" rubric for each.
</output_format>`,
    inputs: [
      { key: 'resume', label: 'Candidate resume', type: 'textarea', required: true },
      { key: 'job_description', label: 'Job description', type: 'textarea', required: true },
    ],
    surfaces: ['recruitment'],
    sortOrder: 70,
  },
  {
    slug: 'salary-benchmarker',
    name: 'Canadian Market Salary Benchmarker',
    category: 'Talent Acquisition',
    description:
      'Suggests 25th/50th/75th percentile base salary for a role in a specific Canadian market, plus locally valued perks.',
    kind: 'PROMPT',
    systemPrompt: `You are a compensation analyst.
<task>
Analyze the <job_description> and <seniority_level>. Based on current market trends for <city_and_province_in_canada>, suggest a competitive base salary range.
</task>
<output_format>
Provide the 25th, 50th, and 75th percentile salary estimates. Briefly list 3 unique perks or non-monetary compensation strategies that are highly valued in this specific local market.
</output_format>`,
    inputs: [
      { key: 'job_description', label: 'Job description', type: 'textarea', required: true },
      {
        key: 'seniority_level',
        label: 'Seniority level',
        type: 'text',
        placeholder: 'e.g. Senior, Staff, Director',
        required: true,
      },
      {
        key: 'city_and_province_in_canada',
        label: 'City & province',
        type: 'text',
        placeholder: 'e.g. Waterloo, Ontario',
        required: true,
      },
    ],
    surfaces: ['recruitment'],
    sortOrder: 80,
  },

  /* ----------- Category 3: Performance & Employee Experience ----------- */
  {
    slug: 'peer-review-summarizer',
    name: '360-Degree Peer Review Summarizer',
    category: 'Performance & Employee Experience',
    description:
      'Synthesizes raw peer feedback into an objective review summary — key wins, growth areas, and next steps — with biased language stripped out.',
    kind: 'PROMPT',
    systemPrompt: `You are a neutral, constructive HR business partner.
<task>
Review the raw <peer_feedback_comments> for <employee_name>. Identify the recurring themes regarding their communication, teamwork, and output. You must strip out highly emotional or biased language.
</task>
<output_format>
Synthesize the feedback into a structured performance review summary with [Key Wins], [Opportunities for Growth], and [Actionable Next Steps]. Maintain an objective, professional tone.
</output_format>`,
    inputs: [
      { key: 'employee_name', label: 'Employee name', type: 'text', required: true },
      {
        key: 'peer_feedback_comments',
        label: 'Raw peer feedback comments',
        type: 'textarea',
        required: true,
      },
    ],
    surfaces: ['performance'],
    sortOrder: 90,
  },
  {
    slug: 'one-on-one-prep-assistant',
    name: 'Manager 1:1 Meeting Prep Assistant',
    category: 'Performance & Employee Experience',
    description:
      'Builds a 3-minute briefing dossier for an upcoming 1:1 — blockers, milestones, and coaching questions from recent goals and review notes.',
    kind: 'PROMPT',
    systemPrompt: `You are an executive assistant to a department manager.
<task>
Review the employee's <recent_goals>, <leave_balances>, <tenure_milestones>, and <last_review_notes>.
</task>
<output_format>
Generate a 3-minute briefing dossier for the manager's upcoming 1:1. Highlight any urgent blockers, remind the manager of any upcoming work anniversaries, and suggest two coaching questions based on the employee's recent goal progress.
</output_format>`,
    inputs: [
      { key: 'recent_goals', label: 'Recent goals & progress', type: 'textarea', required: true },
      { key: 'leave_balances', label: 'Leave balances', type: 'text' },
      {
        key: 'tenure_milestones',
        label: 'Tenure milestones',
        type: 'text',
        placeholder: 'e.g. 3-year anniversary on Aug 2',
      },
      { key: 'last_review_notes', label: 'Last review notes', type: 'textarea' },
    ],
    surfaces: ['performance'],
    sortOrder: 100,
  },
  {
    slug: 'onboarding-plan-builder',
    name: 'Custom 30-60-90 Day Onboarding Plan Builder',
    category: 'Performance & Employee Experience',
    description:
      'Builds a phased 30-60-90 day plan — learning objectives, deliverables, and success metrics — from the job description and tech stack.',
    kind: 'PROMPT',
    systemPrompt: `You are a Director of Learning and Development.
<task>
Using the <job_description> and the <company_tech_stack>, build a comprehensive 30-60-90 day onboarding plan for a new hire.
</task>
<output_format>
Structure the plan into three phases. For each 30-day block, provide:
1. Key Learning Objectives (Systems & People)
2. Tangible Deliverables
3. Metrics for Success
Ensure the plan moves progressively from "Learning" to "Executing" to "Innovating."
</output_format>`,
    inputs: [
      { key: 'job_description', label: 'Job description', type: 'textarea', required: true },
      {
        key: 'company_tech_stack',
        label: 'Company tech stack / systems',
        type: 'textarea',
        placeholder: 'e.g. Salesforce, Slack, Notion, internal tooling…',
        required: true,
      },
    ],
    surfaces: ['onboarding'],
    sortOrder: 110,
  },
  {
    slug: 'pip-drafter',
    name: 'Performance Improvement Plan (PIP) Drafter',
    category: 'Performance & Employee Experience',
    description:
      'Turns raw manager notes into a SMART, objective 30-day PIP with expectations, support resources, and consequences.',
    kind: 'PROMPT',
    systemPrompt: `You are a seasoned HR risk mitigation specialist.
<task>
Draft a 30-day Performance Improvement Plan (PIP) using the manager's <raw_performance_notes>.
</task>
<output_format>
The PIP must be highly specific, measurable, achievable, relevant, and time-bound (SMART). Use objective language. Include clear expectations, the resources the company will provide to help them succeed, and the consequences of failing to meet the objectives.
</output_format>`,
    inputs: [
      {
        key: 'raw_performance_notes',
        label: 'Manager’s raw performance notes',
        type: 'textarea',
        required: true,
      },
    ],
    surfaces: ['performance'],
    sortOrder: 120,
  },

  /* --------------- Category 4: HR Operations & Systems --------------- */
  {
    slug: 'policy-qa-assistant',
    name: 'Employee Policy Q&A Assistant',
    category: 'HR Operations & Systems',
    description:
      'Answers an employee question strictly from the provided handbook text, with section citations — never invents policy.',
    kind: 'PROMPT',
    systemPrompt: `You are a helpful, accurate internal HR support agent.
<task>
Answer the employee's <question> strictly using the provided <company_employee_handbook_text>. Do not invent policies or use outside knowledge. If the handbook does not explicitly cover the question, you must state that and advise them to contact their HR rep.
</task>
<output_format>
Provide a direct, conversational answer and cite the specific section/page of the handbook you pulled the answer from.
</output_format>`,
    inputs: [
      { key: 'question', label: 'Employee question', type: 'text', required: true },
      {
        key: 'company_employee_handbook_text',
        label: 'Employee handbook text',
        type: 'textarea',
        required: true,
        maxLength: 60000,
      },
    ],
    surfaces: [],
    sortOrder: 130,
  },
  {
    slug: 'exit-interview-analyzer',
    name: 'Exit Interview Trends & Turnover Analyzer',
    category: 'HR Operations & Systems',
    description:
      'Mines exit-interview transcripts for systemic patterns and produces a Turnover Risk Report with anonymized supporting quotes.',
    kind: 'PROMPT',
    systemPrompt: `You are an organizational psychologist.
<task>
Analyze the transcripts from the last <number> of exit interviews within <department_name>. Look for hidden patterns regarding management style, workload, compensation, or company culture. The transcripts are provided in <exit_interview_transcripts>.
</task>
<output_format>
Produce a "Turnover Risk Report." Identify the top 3 systemic reasons for departure. Pull anonymized quotes from the transcripts to support your findings, and recommend one structural change to improve retention.
</output_format>`,
    inputs: [
      { key: 'number', label: 'Number of interviews', type: 'text', required: true },
      { key: 'department_name', label: 'Department', type: 'text', required: true },
      {
        key: 'exit_interview_transcripts',
        label: 'Exit interview transcripts',
        type: 'textarea',
        required: true,
        maxLength: 60000,
      },
    ],
    surfaces: ['offboarding'],
    sortOrder: 140,
  },
  {
    slug: 'offboarding-access-revocation',
    name: 'IT Offboarding & Access Revocation Trigger',
    category: 'HR Operations & Systems',
    description:
      'Extracts departure date, role, and access inventory from an offboarding notice and emits a strict JSON payload for the IT ticketing system.',
    kind: 'PROMPT',
    systemPrompt: `You are a data extraction workflow agent.
<task>
Read the <offboarding_notice> or <resignation_letter>. Extract the exact date of departure, the employee's role, and the hardware/software they currently have access to.
</task>
<output_format>
Output the data STRICTLY as a JSON payload formatted for an IT ticketing system (e.g. Jira or ServiceNow) to trigger automatic access revocation and hardware return shipping labels. Do not include any conversational text.
</output_format>`,
    inputs: [
      {
        key: 'offboarding_notice',
        label: 'Offboarding notice / resignation letter',
        type: 'textarea',
        required: true,
      },
    ],
    surfaces: ['offboarding'],
    sortOrder: 150,
  },
  {
    slug: 'accommodation-request-evaluator',
    name: 'Workplace Accommodation Request Evaluator',
    category: 'HR Operations & Systems',
    description:
      'Evaluates an accommodation request against the undue-hardship standard, proposes compromise options, and drafts a compliant response letter.',
    kind: 'PROMPT',
    systemPrompt: `You are an HR compliance advisor trained in the Canadian Human Rights Act.
<task>
Review the employee's <accommodation_request>. Evaluate it against the standard of "undue hardship" (considering cost, health, and safety risks).
</task>
<output_format>
Provide a neutral assessment of the request. Suggest three potential compromise solutions that would accommodate the employee while minimizing operational disruption. Draft a polite, compliant response letter opening the dialogue with the employee.
</output_format>`,
    inputs: [
      {
        key: 'accommodation_request',
        label: 'Accommodation request',
        type: 'textarea',
        required: true,
      },
    ],
    surfaces: [],
    sortOrder: 160,
  },
  {
    slug: 'policy-announcement-writer',
    name: 'Employee Policy Announcement Writer',
    category: 'HR Operations & Systems',
    description:
      'Rewrites a dry policy update into an upbeat, skimmable Slack/Teams announcement covering the why, the impact, and the ask.',
    kind: 'PROMPT',
    systemPrompt: `You are an expert internal communications manager.
<task>
Take the attached dry, legalistic <policy_update> and rewrite it into a company-wide Slack/Teams announcement.
</task>
<output_format>
The tone should be upbeat, transparent, and easy to skim. Highlight the "Why" behind the change, what it means for the average employee, and exactly what action they need to take. Use appropriate emojis and markdown formatting.
</output_format>`,
    inputs: [
      { key: 'policy_update', label: 'Policy update text', type: 'textarea', required: true },
    ],
    surfaces: [],
    sortOrder: 170,
  },

  /* ----------- Core Intelligence (pre-existing built-in tools) ----------- */
  {
    slug: 'hr-assistant',
    name: 'HR Assistant',
    category: 'Core Intelligence',
    description: 'Conversational HR co-pilot grounded in your live company data and policy handbook.',
    kind: 'BUILTIN',
    systemPrompt: '',
    inputs: [],
    surfaces: [],
    href: '/admin/assistant',
    sortOrder: 200,
  },
  {
    slug: 'reports',
    name: 'Reports',
    category: 'Core Intelligence',
    description: 'Workforce analytics and AI moderation reporting.',
    kind: 'BUILTIN',
    systemPrompt: '',
    inputs: [],
    surfaces: [],
    href: '/admin/reports',
    sortOrder: 210,
  },
  {
    slug: 'tracker',
    name: 'Tracker',
    category: 'Core Intelligence',
    description: 'Cross-module task and progress tracking.',
    kind: 'BUILTIN',
    systemPrompt: '',
    inputs: [],
    surfaces: [],
    href: '/admin/tracker',
    sortOrder: 220,
  },
  {
    slug: 'ai-agents',
    name: 'AI Agents',
    category: 'Core Intelligence',
    description: 'Long-running autonomous agent runs with human approval gates.',
    kind: 'BUILTIN',
    systemPrompt: '',
    inputs: [],
    surfaces: [],
    href: '/admin/agents',
    sortOrder: 230,
  },
  {
    slug: 'letter-lab',
    name: 'Letter Lab',
    category: 'Core Intelligence',
    description: 'Template-driven HR letter drafting, issuing, and mass generation.',
    kind: 'BUILTIN',
    systemPrompt: '',
    inputs: [],
    surfaces: [],
    href: '/admin/letter-lab',
    sortOrder: 240,
  },
  {
    slug: 'calculator',
    name: 'Calculator',
    category: 'Core Intelligence',
    description: 'Custom HR calculation rules engine (leave accruals, thresholds, payouts).',
    kind: 'BUILTIN',
    systemPrompt: '',
    inputs: [],
    surfaces: [],
    href: '/admin/calculator',
    sortOrder: 250,
  },
];

export function findToolBySlug(slug: string): ToolDefinition | undefined {
  return TOOL_CATALOG.find((t) => t.slug === slug);
}
