import { z } from "zod/v4";
import { errorResponse } from "./errors";

const XSS_PATTERNS = [
  /<script[\s>]/i,
  /javascript:/i,
  /on\w+\s*=/i,
];

function sanitize(input: string): string {
  let cleaned = input.trim();
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(cleaned)) {
      cleaned = cleaned.replace(pattern, "[REDACTED]");
    }
  }
  return cleaned;
}

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .refine((p) => /[A-Z]/.test(p), "Password must contain an uppercase letter")
  .refine((p) => /[a-z]/.test(p), "Password must contain a lowercase letter")
  .refine((p) => /[0-9]/.test(p), "Password must contain a number")
  .refine(
    (p) => /[^A-Za-z0-9]/.test(p),
    "Password must contain a special character"
  );

export const registerSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters")
    .transform(sanitize),
  email: z.email("Invalid email address"),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});

export const ruleCreateSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must be at most 200 characters")
    .transform(sanitize),
  description: z.string().max(2000).default("").transform(sanitize),
  query: z
    .string()
    .min(1, "Detection query is required")
    .max(10000),
  ruleType: z.enum(["query", "eql", "threshold", "new_terms", "machine_learning"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  language: z.enum(["kuery", "eql", "lucene", "esql"]),
  riskScore: z.number().int().min(0).max(100).default(50),
  index: z.string().max(500).default(""),
  tags: z.array(z.string().max(100)).max(20).default([]),
  client: z.string().max(100).default("").transform(sanitize),
  category: z.string().max(50).default("").transform(sanitize),
  interval: z.string().regex(/^\d+[smh]$/, "Invalid interval format").default("5m"),
  fromTime: z.string().max(50).default("now-6m"),
  maxSignals: z.number().int().min(1).max(10000).default(100),
  investigationGuide: z.string().max(5000).default("").transform(sanitize),
  references: z.array(z.string().max(500)).max(20).default([]),
  falsePositives: z.array(z.string().max(500)).max(20).default([]),
  status: z.enum(["draft", "reviewed", "production", "deprecated"]).default("draft"),
});

export const ruleUpdateSchema = ruleCreateSchema.partial();

export type RuleCreateInput = z.infer<typeof ruleCreateSchema>;
export type RuleUpdateInput = z.infer<typeof ruleUpdateSchema>;

export const analyzeSchema = z.object({
  ruleId: z.string().uuid().optional(),
  query: z.string().min(1).max(10000).optional(),
  language: z.string().optional(),
  ruleType: z.string().optional(),
}).refine((data) => data.ruleId || data.query, {
  message: "Either ruleId or query is required",
});

export const enhanceSchema = z.object({
  ruleId: z.string().uuid(),
});

export const generateSchema = z.object({
  description: z.string().min(10, "Description must be at least 10 characters").max(5000),
  saveAsRule: z.boolean().default(false),
});

export const feedbackSchema = z.object({
  query: z.string().min(1, "Query is required").max(10000),
  language: z.string().default("kuery"),
});

export const settingUpdateSchema = z.object({
  value: z.string().min(1, "Value is required").max(10000),
});

export const providerUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  baseUrl: z.string().url().optional(),
  model: z.string().min(1).max(100).optional(),
  apiKey: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  maxTokens: z.number().int().min(100).max(32000).optional(),
  temperature: z.number().min(0).max(2).optional(),
});

export const promptUpdateSchema = z.object({
  systemPrompt: z.string().min(10).max(50000).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export const userUpdateSchema = z.object({
  role: z.enum(["ADMIN", "ANALYST"]).optional(),
  isActive: z.boolean().optional(),
});

export const projectCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(2000).default(""),
});

export const projectUpdateSchema = projectCreateSchema.partial();

export const projectRuleSchema = z.object({
  ruleId: z.string().uuid("Invalid rule ID"),
});

export const webhookCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(200).transform(sanitize),
  url: z.string().url("Invalid URL"),
  events: z.array(z.string()).min(1, "At least one event is required"),
  secret: z.string().max(500).default(""),
  headers: z.string().max(5000).default("{}"),
  isActive: z.boolean().default(true),
});

export const webhookUpdateSchema = webhookCreateSchema.partial();

export const customFieldCreateSchema = z.object({
  fieldName: z.string().min(1).max(100).regex(/^[a-z][a-z0-9_]*$/, "Must be lowercase snake_case"),
  label: z.string().min(1).max(200).transform(sanitize),
  fieldType: z.enum(["text", "textarea", "number", "select", "boolean"]),
  options: z.string().max(2000).default("[]"),
  required: z.boolean().default(false),
  defaultValue: z.string().max(1000).default(""),
  sortOrder: z.number().int().min(0).default(0),
});

export const customFieldUpdateSchema = customFieldCreateSchema.omit({ fieldName: true }).partial();

export const forgotPasswordSchema = z.object({
  email: z.email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  newPassword: passwordSchema,
});

export async function validateRequest<T>(
  schema: z.ZodType<T>,
  request: Request
): Promise<{ data: T } | { error: ReturnType<typeof errorResponse> }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      return { error: errorResponse(messages[0], 400) };
    }
    return { data: result.data };
  } catch {
    return { error: errorResponse("Invalid request body", 400) };
  }
}
