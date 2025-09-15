import { getAvailableModels } from './scripts/modules/task-manager/models.js';

const models = getAvailableModels('.');
console.log('Total models:', models.length);

const modelsByProvider = models.reduce((acc, model) => {
  if (!acc[model.provider]) {
    acc[model.provider] = [];
  }
  acc[model.provider].push(model);
  return acc;
}, {});

console.log('Providers:', Object.keys(modelsByProvider));
console.log('LM Studio models:', modelsByProvider.lmstudio?.length || 0);

if (modelsByProvider.lmstudio) {
  const lmstudioMainModels = modelsByProvider.lmstudio.filter(m => m.allowed_roles.includes('main'));
  console.log('LM Studio models for main role:', lmstudioMainModels.length);
  console.log('First few LM Studio main models:', lmstudioMainModels.slice(0, 3));
}

// Test the roleChoices construction
const role = 'main';
const roleChoices = Object.entries(modelsByProvider)
  .map(([provider, models]) => {
    const providerModels = models
      .filter((m) => m.allowed_roles.includes(role))
      .map((m) => ({
        name: `${provider} / ${m.id} ${
          m.cost_per_1m_tokens
            ? `($${m.cost_per_1m_tokens.input.toFixed(2)} input | $${m.cost_per_1m_tokens.output.toFixed(2)} output)`
            : ''
        }`,
        value: { id: m.id, provider },
        short: `${provider}/${m.id}`
      }));
    if (providerModels.length > 0) {
      return [...providerModels];
    }
    return null;
  })
  .filter(Boolean)
  .flat();

console.log('Total role choices:', roleChoices.length);
const lmstudioChoices = roleChoices.filter(c => c.value.provider === 'lmstudio');
console.log('LM Studio choices:', lmstudioChoices.length);
if (lmstudioChoices.length > 0) {
  console.log('First LM Studio choice:', lmstudioChoices[0]);
}
