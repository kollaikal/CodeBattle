
import { CodeSnippet } from '../types';

const POPULAR_REPOS = [
  { owner: 'facebook', repo: 'react', lang: 'javascript' },
  { owner: 'python', repo: 'cpython', lang: 'python' },
  { owner: 'microsoft', repo: 'vscode', lang: 'typescript' },
  { owner: 'tensorflow', repo: 'tensorflow', lang: 'python' },
  { owner: 'django', repo: 'django', lang: 'python' },
  { owner: 'nodejs', repo: 'node', lang: 'javascript' },
  { owner: 'golang', repo: 'go', lang: 'go' },
  { owner: 'rust-lang', repo: 'rust', lang: 'rust' }
];

const FALLBACK_SNIPPETS: CodeSnippet[] = [
  {
    code: "function useInterval(callback, delay) {\n  const savedCallback = useRef();\n  useEffect(() => {\n    savedCallback.current = callback;\n  }, [callback]);\n  useEffect(() => {\n    if (delay !== null) {\n      let id = setInterval(() => savedCallback.current(), delay);\n      return () => clearInterval(id);\n    }\n  }, [delay]);\n}",
    language: "javascript",
    repo: "facebook/react",
    fileName: "useInterval.js",
    gitUrl: "fallback-1"
  },
  {
    code: "const calculateDistance = (p1, p2) => {\n  const dx = p1.x - p2.x;\n  const dy = p1.y - p2.y;\n  return Math.sqrt(dx * dx + dy * dy);\n};\n\nexport const getNearestNeighbor = (point, others) => {\n  return others.reduce((prev, curr) => {\n    const d = calculateDistance(point, curr);\n    return d < prev.dist ? { point: curr, dist: d } : prev;\n  }, { point: null, dist: Infinity });\n};",
    language: "javascript",
    repo: "algorithms/geo",
    fileName: "geoUtils.js",
    gitUrl: "fallback-2"
  },
  {
    code: "def fetch_data(api_url, timeout=30):\n    try:\n        response = requests.get(api_url, timeout=timeout)\n        response.raise_for_status()\n        return response.json()\n    except RequestException as e:\n        logging.error(f\"API request failed: {e}\")\n        return None\n\n@app.route(\"/api/v1/resource\")\ndef get_resource():\n    data = fetch_data(RESOURCE_URL)\n    return jsonify(data) if data else (404, \"Not Found\")",
    language: "python",
    repo: "django/core",
    fileName: "api.py",
    gitUrl: "fallback-3"
  }
];

export async function fetchRandomSnippet(excludeUrls: string[] = []): Promise<CodeSnippet> {
  try {
    const target = POPULAR_REPOS[Math.floor(Math.random() * POPULAR_REPOS.length)];
    const langExt = target.lang === 'python' ? 'py' : target.lang === 'typescript' ? 'ts' : target.lang === 'rust' ? 'rs' : 'js';
    
    // Attempt to fetch from GitHub Search API
    const randomPage = Math.floor(Math.random() * 5) + 1;
    const searchRes = await fetch(`https://api.github.com/search/code?q=extension:${langExt}+repo:${target.owner}/${target.repo}+size:>2000&page=${randomPage}`);
    
    if (!searchRes.ok) throw new Error('GitHub API Limit or Network Error');
    
    const searchData = await searchRes.json();
    if (!searchData.items || searchData.items.length === 0) throw new Error('No items found');

    const availableItems = searchData.items.filter((item: any) => !excludeUrls.includes(item.git_url));
    const selectionItems = availableItems.length > 0 ? availableItems : searchData.items;

    const randomFile = selectionItems[Math.floor(Math.random() * Math.min(10, selectionItems.length))];
    const rawRes = await fetch(randomFile.git_url);
    const rawData = await rawRes.json();
    const decoded = atob(rawData.content);

    const lines = decoded.split('\n');
    let startIndex = lines.findIndex(l => 
      l.trim().startsWith('function') || 
      l.trim().startsWith('class') || 
      l.trim().startsWith('def') || 
      l.trim().startsWith('const ') ||
      l.trim().startsWith('pub fn') ||
      l.trim().startsWith('export ')
    );
    
    if (startIndex === -1) startIndex = Math.floor(Math.random() * Math.max(1, lines.length - 15));

    const cleaned = lines
      .slice(startIndex, startIndex + 15)
      .filter(line => {
        const t = line.trim();
        return t.length > 0 && !t.startsWith('//') && !t.startsWith('#') && !t.startsWith('*') && !t.startsWith('/*');
      })
      .join('\n')
      .replace(/\t/g, '  ');

    if (cleaned.length < 50) throw new Error('Snippet too small');

    return {
      code: cleaned.trim(),
      language: target.lang,
      repo: `${target.owner}/${target.repo}`,
      fileName: randomFile.name,
      gitUrl: randomFile.git_url
    };
  } catch (error) {
    // If anything fails (API limit, network, etc), pick a distinct fallback
    const filteredFallbacks = FALLBACK_SNIPPETS.filter(s => !excludeUrls.includes(s.gitUrl));
    const finalFallback = filteredFallbacks.length > 0 
      ? filteredFallbacks[Math.floor(Math.random() * filteredFallbacks.length)]
      : FALLBACK_SNIPPETS[Math.floor(Math.random() * FALLBACK_SNIPPETS.length)];
    return finalFallback;
  }
}
