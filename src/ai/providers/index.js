import gemini from './gemini.js';
import openai from './openai.js';
import anthropic from './anthropic.js';
import ollama from './ollama.js';

/**
 * The model backends.
 *
 * Each one exposes the same shape, so everything above this layer works the
 * same whether the diff goes to a hosted API or never leaves the machine:
 *
 *   id           the value used in .committerrc under ai.provider
 *   label        shown in the setup walkthrough
 *   local        true when nothing leaves the machine
 *   needsKey     false when there is no credential to collect
 *   defaultModel used when ai.model is not set
 *   generate({prompt, apiKey, model, baseUrl}) -> string
 */
export const PROVIDERS = {
    [gemini.id]: gemini,
    [openai.id]: openai,
    [anthropic.id]: anthropic,
    [ollama.id]: ollama,
};

export const DEFAULT_PROVIDER = gemini.id;

export const getProvider = (id) => PROVIDERS[id] ?? PROVIDERS[DEFAULT_PROVIDER];

export const providerList = () => Object.values(PROVIDERS);

export default {PROVIDERS, getProvider, providerList, DEFAULT_PROVIDER};
