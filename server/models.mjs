// Verified against OpenRouter's model catalogue when this feature was added.
// Task-specific environment variables let the team change providers without a UI key.
export function aiModels(env = {}) {
  return {
    prep: env.OPENROUTER_PREP_MODEL || env.OPENROUTER_REASONING_MODEL || 'openai/gpt-6.1-terra',
    inventory: env.OPENROUTER_INVENTORY_MODEL || env.OPENROUTER_REASONING_MODEL || 'openai/gpt-6.1-terra',
    staff: env.OPENROUTER_STAFF_MODEL || 'anthropic/claude-opus-5.5',
    finance: env.OPENROUTER_FINANCE_MODEL || 'anthropic/claude-opus-5.5',
    receipt: env.OPENROUTER_RECEIPT_MODEL || env.OPENROUTER_VISION_MODEL || 'google/gemini-4-argon',
    packing: env.OPENROUTER_VISION_MODEL || 'google/gemini-4-argon',
  };
}
