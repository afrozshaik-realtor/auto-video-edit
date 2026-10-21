// Tool buttons shown on workflow steps. All open in a new tab.
// `url: null` means the link is built per reel (the reel's Drive folder).

export interface Tool {
  id: string;
  name: string;
  url: string | null;
  icon: string;
  /** Button text, e.g. "Open Claude". */
  label: string;
}

export const tools: Tool[] = [
  { id: 'claude', name: 'Claude', url: 'https://claude.ai/new', icon: 'spark', label: 'Open Claude' },
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com', icon: 'chat', label: 'Open ChatGPT' },
  { id: 'canva', name: 'Canva', url: 'https://www.canva.com', icon: 'brush', label: 'Open Canva' },
  { id: 'capcut', name: 'CapCut', url: 'https://www.capcut.com', icon: 'scissors', label: 'Open CapCut' },
  { id: 'instagram', name: 'Instagram', url: 'https://www.instagram.com', icon: 'camera', label: 'Open Instagram' },
  { id: 'drive', name: 'Google Drive', url: null, icon: 'folder', label: 'Open reel folder in Drive' },
];

export function getTool(id: string): Tool | undefined {
  return tools.find((t) => t.id === id);
}
