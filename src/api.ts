// src/api.ts
import axios from 'axios';
import { JSONPath } from 'jsonpath-plus';

type APIConfig = {
  url: string;
  method: string;
  query?: Record<string, any>;
  body?: Record<string, any>;
};

type OutputConfig = {
  type: string;
  title?: string;
  description?: string;
  image?: string;
  fields?: Array<{ name: string; value: string }>;
};

export async function handleAPI(apiConf: APIConfig, input: Record<string, string>) {
  const url = apiConf.url;
  const method = apiConf.method.toUpperCase();

  // Query-Parameter ersetzen (z.B. $character durch tatsächlichen Wert)
  let params: Record<string, any> = {};
  if (apiConf.query) {
    params = {};
    for (const key of Object.keys(apiConf.query)) {
      const val = apiConf.query[key];
      params[key] = typeof val === 'string' && val.startsWith('$')
        ? input[val.substring(1)] || ''
        : val;
    }
  }

  // Body ersetzen falls vorhanden
  let body: Record<string, any> = {};
  if (apiConf.body) {
    body = {};
    for (const key of Object.keys(apiConf.body)) {
      const val = apiConf.body[key];
      body[key] = typeof val === 'string' && val.startsWith('$')
        ? input[val.substring(1)] || ''
        : val;
    }
  }

  // Request senden
  let res;
  if (method === 'GET') {
    res = await axios.get(url, { params });
  } else {
    res = await axios({ method, url, params, data: body });
  }
  return res.data;
}

export async function handleAutocompleteAPI(apiConf: any, input: string) {
  // Für Autocomplete z.B. chars suchen
  const url = apiConf.url;
  const method = (apiConf.method || 'GET').toUpperCase();

  let params: Record<string, any> = {};
  if (apiConf.query) {
    params = {};
    for (const key of Object.keys(apiConf.query)) {
      const val = apiConf.query[key];
      params[key] = typeof val === 'string' && val === '$input'
        ? input
        : val;
    }
  }

  let res;
  if (method === 'GET') {
    res = await axios.get(url, { params });
  } else {
    res = await axios({ method, url, params });
  }
  // Mapping auf label/value (nach API-Config)
  const items = res.data;
  const mapConf = apiConf.map || { label: '$.name', value: '$.id' };
  // Falls Ergebnis ein Array:
  return (Array.isArray(items) ? items : items.data || []).map((item: any) => ({
    name: JSONPath({ path: mapConf.label, json: item })[0] || '',
    value: JSONPath({ path: mapConf.value, json: item })[0] || '',
  }));
}

// Mapping von API-Response zu Discord Output
export function parseOutput(outputConf: OutputConfig, result: any) {
  if (outputConf.type === 'embed') {
    // Titel, Beschreibung, Bild und Felder parsen
    const embed: any = {};
    if (outputConf.title)
      embed.title = parseJSONPath(outputConf.title, result);
    if (outputConf.description)
      embed.description = parseJSONPath(outputConf.description, result);
    if (outputConf.image)
      embed.image = { url: parseJSONPath(outputConf.image, result) };
    if (outputConf.fields)
      embed.fields = outputConf.fields.map(f => ({
        name: f.name,
        value: parseJSONPath(f.value, result),
        inline: true,
      }));
    return { embeds: [embed] };
  }
  // Plaintext (falls gewünscht)
  if (outputConf.type === 'text') {
    return { content: parseJSONPath(outputConf.description || '', result) };
  }
  return { content: 'Kein gültiger Output definiert.' };
}

function parseJSONPath(template: string, data: any) {
  // Falls Template mit $ beginnt: JSONPath
  if (template.startsWith('$.')) {
    const out = JSONPath({ path: template, json: data });
    return Array.isArray(out) && out.length ? out[0] : '';
  }
  return template;
}
