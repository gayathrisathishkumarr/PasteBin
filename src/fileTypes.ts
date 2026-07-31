export const fileLanguageByExtension: Record<string, string> = {
  txt: 'Plain Text',
  js: 'JavaScript',
  jsx: 'React',
  ts: 'TypeScript',
  tsx: 'React',
  java: 'Java',
  py: 'Python',
  sql: 'SQL',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  md: 'Markdown',
  sh: 'Bash',
  env: 'Environment Variables',
};

export const acceptedTextFiles = '.txt,.js,.jsx,.ts,.tsx,.java,.py,.sql,.json,.yaml,.yml,.md,.sh,.env,text/*,application/json';

export function languageForFile(file: File) {
  if (file.name.toLowerCase() === 'dockerfile') return 'Dockerfile';
  const extension = file.name.toLowerCase().split('.').pop() || '';
  return fileLanguageByExtension[extension] || 'Plain Text';
}

export function isSupportedTextFile(file: File) {
  if (file.name.toLowerCase() === 'dockerfile') return true;
  const extension = file.name.toLowerCase().split('.').pop() || '';
  return Boolean(fileLanguageByExtension[extension]) || file.type.startsWith('text/') || file.type === 'application/json';
}
