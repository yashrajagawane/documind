/**
 * Zero-dependency syntax highlighter for Markdown code blocks.
 * Safely tokenizes JSON, Python, JavaScript/TypeScript, SQL, and Bash.
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function highlightJson(code: string): string {
  // Regex to match JSON tokens: string/property, number, boolean/null
  const jsonTokenRegex = /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

  return code.replace(jsonTokenRegex, (match) => {
    let cls = "token-number";
    if (match.startsWith('"')) {
      if (match.endsWith(":")) {
        // Property key
        const key = match.slice(0, -1).trim();
        return `<span class="token-property">${escapeHtml(key)}</span>:`;
      }
      cls = "token-string";
    } else if (match === "true" || match === "false" || match === "null") {
      cls = "token-boolean";
    }
    return `<span class="${cls}">${escapeHtml(match)}</span>`;
  });
}

function highlightPython(code: string): string {
  const tokenRegex = /(#.*$)|("""[\s\S]*?"""|'''[\s\S]*?'''|f?"[^"\\]*(?:\\.[^"\\]*)*"|f?'[^'\\]*(?:\\.[^'\\]*)*')|(\b(?:def|class|import|from|return|if|elif|else|for|while|try|except|finally|with|as|pass|break|continue|yield|lambda|async|await|assert|raise|global|nonlocal|in|is|and|or|not)\b)|(\b(?:True|False|None)\b)|(\b(?:self|cls|int|str|float|bool|list|dict|set|tuple|len|print|range)\b)|(\b\d+(?:\.\d+)?\b)/gm;

  return code.replace(
    tokenRegex,
    (match, comment, string, keyword, bool, builtin, number) => {
      if (comment) return `<span class="token-comment">${escapeHtml(comment)}</span>`;
      if (string) return `<span class="token-string">${escapeHtml(string)}</span>`;
      if (keyword) return `<span class="token-keyword">${escapeHtml(keyword)}</span>`;
      if (bool) return `<span class="token-boolean">${escapeHtml(bool)}</span>`;
      if (builtin) return `<span class="token-builtin">${escapeHtml(builtin)}</span>`;
      if (number) return `<span class="token-number">${escapeHtml(number)}</span>`;
      return escapeHtml(match);
    }
  );
}

function highlightJsTs(code: string): string {
  const tokenRegex = /(\/\/.*$|\/\*[\s\S]*?\*\/)|(`[\s\S]*?`|"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')|(\b(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|class|extends|new|this|super|import|export|from|as|default|async|await|yield|type|interface|enum|implements|typeof|instanceof)\b)|(\b(?:true|false|null|undefined|NaN)\b)|(\b\d+(?:\.\d+)?\b)/gm;

  return code.replace(
    tokenRegex,
    (match, comment, string, keyword, bool, number) => {
      if (comment) return `<span class="token-comment">${escapeHtml(comment)}</span>`;
      if (string) return `<span class="token-string">${escapeHtml(string)}</span>`;
      if (keyword) return `<span class="token-keyword">${escapeHtml(keyword)}</span>`;
      if (bool) return `<span class="token-boolean">${escapeHtml(bool)}</span>`;
      if (number) return `<span class="token-number">${escapeHtml(number)}</span>`;
      return escapeHtml(match);
    }
  );
}

function highlightSql(code: string): string {
  const tokenRegex = /(--.*$|\/\*[\s\S]*?\*\/)|('(?:''|[^'])*')|(\b(?:SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|DROP|ALTER|ADD|INDEX|VIEW|JOIN|LEFT|RIGHT|INNER|OUTER|CROSS|ON|GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT|OFFSET|UNION|ALL|AS|AND|OR|NOT|IN|IS|NULL|LIKE|BETWEEN|EXISTS|CASE|WHEN|THEN|ELSE|END|PRIMARY\s+KEY|FOREIGN\s+KEY|REFERENCES|CASCADE|DEFAULT|CHECK|UNIQUE|ASC|DESC)\b)|(\b\d+(?:\.\d+)?\b)/gim;

  return code.replace(
    tokenRegex,
    (match, comment, string, keyword, number) => {
      if (comment) return `<span class="token-comment">${escapeHtml(comment)}</span>`;
      if (string) return `<span class="token-string">${escapeHtml(string)}</span>`;
      if (keyword) return `<span class="token-keyword">${escapeHtml(keyword)}</span>`;
      if (number) return `<span class="token-number">${escapeHtml(number)}</span>`;
      return escapeHtml(match);
    }
  );
}

function highlightBash(code: string): string {
  const tokenRegex = /(#.*$)|("[^"\\]*(?:\\.[^"\\]*)*"|'[^']*')|(\b(?:if|then|else|elif|fi|for|while|do|done|case|esac|function|select|export|source|alias)\b)|(\b(?:echo|cd|ls|cat|grep|mkdir|rm|cp|mv|git|docker|curl|npm|pip|python|chmod|chown)\b)|(\$\w+|\$\{[^}]+\})/gm;

  return code.replace(
    tokenRegex,
    (match, comment, string, keyword, cmd, variable) => {
      if (comment) return `<span class="token-comment">${escapeHtml(comment)}</span>`;
      if (string) return `<span class="token-string">${escapeHtml(string)}</span>`;
      if (keyword) return `<span class="token-keyword">${escapeHtml(keyword)}</span>`;
      if (cmd) return `<span class="token-builtin">${escapeHtml(cmd)}</span>`;
      if (variable) return `<span class="token-variable">${escapeHtml(variable)}</span>`;
      return escapeHtml(match);
    }
  );
}

/**
 * Highlights a snippet of source code according to its language identifier.
 */
export function highlightCode(code: string, language?: string): string {
  if (!code) return "";
  const lang = (language ?? "").toLowerCase().trim();

  switch (lang) {
    case "json":
      return highlightJson(code);
    case "python":
    case "py":
      return highlightPython(code);
    case "javascript":
    case "typescript":
    case "js":
    case "ts":
    case "jsx":
    case "tsx":
      return highlightJsTs(code);
    case "sql":
      return highlightSql(code);
    case "bash":
    case "sh":
    case "shell":
    case "zsh":
      return highlightBash(code);
    default:
      return escapeHtml(code);
  }
}
