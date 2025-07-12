export function fillTemplate(str: string, data: Record<string, any>) {
  return str.replace(/{([^}]+)}/g, (_, key) => {
    // Erlaubt z.B. data.0.name als Platzhalter
    return key.split('.').reduce((o: any, k: any) => (o ? o[k] : ''), data) || '';
  });
}