import { getToolDefs } from "./setup-tool-defs.js";

/**
 * POSIX/Bash template generators for automated setup and reset on macOS & Linux.
 * Supports tool-specific setup or all-in-one setup via toolId.
 */

export function renderBashSetup(baseUrl: string, apiKey: string, toolId?: string, modelsList?: Array<any>): string {
	const tools = getToolDefs(baseUrl, apiKey, modelsList, false);
	const targetTools = toolId && tools[toolId] ? [tools[toolId]!] : Object.values(tools);
	const tag = toolId && tools[toolId] ? `mnrouter ${toolId}` : "mnrouter config";
	const label = toolId && tools[toolId] ? tools[toolId]!.name : "all 11 AI harnesses";

	const exportLines = targetTools
		.flatMap((t) => t.vars.map(([k, v]) => `export ${k}="${v}"`))
		.filter((val, idx, arr) => arr.indexOf(val) === idx)
		.join("\n");

	const fileWrites = targetTools
		.flatMap((t) => t.files || [])
		.map((f) => `write_file_with_backup "${f.path}" '${f.content.replace(/'/g, "'\\''")}'`)
		.join("\n");

	return `#!/usr/bin/env sh
set -e
BASE_URL="${baseUrl}"
API_KEY="${apiKey}"

if [ -z "$API_KEY" ] || [ "$API_KEY" = "mr_YOUR_API_KEY" ]; then
  printf "\\033[1;33m[mnRouter]\\033[0m Enter your mnRouter API Key (mr_...): "
  read -r API_KEY
fi
[ -z "$API_KEY" ] && { printf "\\033[1;31m[mnRouter] Error: API Key cannot be empty.\\033[0m\\n" >&2; exit 1; }

printf "\\033[1;34m[mnRouter]\\033[0m Setting up %s for %s...\\n" "${label}" "$BASE_URL"

clean_profile() {
  t="$1"
  if [ -f "$t" ]; then
    awk '/# >>> ${tag} >>>/{f=1;next}/# <<< ${tag} <<</{f=0;next}!f' "$t" > "$t.tmp" && mv "$t.tmp" "$t"
  fi
}

append_config() {
  t="$1"; touch "$t"; clean_profile "$t"
  cat << 'EOF' >> "$t"
# >>> ${tag} >>>
${exportLines}
# <<< ${tag} <<<
EOF
  printf "  \\033[32m✓\\033[0m Updated %s\\n" "$t"
}

write_file_with_backup() {
  dest="$1"; content="$2"
  # Expand $HOME safely in POSIX sh
  case "$dest" in
    \\$HOME/*) dest="$HOME/\${dest#\\$HOME/}" ;;
  esac
  d="$(dirname "$dest")"; mkdir -p "$d"
  # Smart merge for Codex and OMP files (merge before overwriting)
  case "$dest" in
    */.codex/models_cache.json)
      if command -v python3 >/dev/null 2>&1 && [ -f "$dest" ]; then
        if [ ! -f "$dest.mnrouter.bak" ]; then cp "$dest" "$dest.mnrouter.bak"; fi
        python3 - "$dest" "$content" << 'PYEOF' 2>/dev/null || true
import json, sys
try:
    target, new_content = sys.argv[1], sys.argv[2]
    with open(target, 'r') as f:
        old = json.load(f)
    new = json.loads(new_content)
    new_slugs = {m.get('slug') for m in new.get('models', [])}
    rest = [m for m in old.get('models', []) if m.get('slug') not in new_slugs]
    for m in rest:
        if m.get('priority') is not None:
            m['priority'] += 50
    new['models'] = new.get('models', []) + rest
    with open(target, 'w') as f:
        json.dump(new, f, indent=2)
except Exception:
    with open(target, 'w') as f:
        f.write(new_content)
PYEOF
        printf "  \\033[32m✓\\033[0m Configured %s\\n" "$dest"
        return
      fi
      ;;
    */.codex/config.toml)
      if command -v python3 >/dev/null 2>&1 && [ -f "$dest" ]; then
        if [ ! -f "$dest.mnrouter.bak" ]; then cp "$dest" "$dest.mnrouter.bak"; fi
        python3 - "$dest" "$content" << 'PYEOF' 2>/dev/null || true
import sys
try:
    target, new_content = sys.argv[1], sys.argv[2]
    with open(target, 'r') as f:
        old = f.read()
    lines = old.splitlines()
    out_lines = [l for l in lines if not l.startswith(('model_provider =', 'model =', 'chatgpt_base_url ='))]
    cleaned = []
    in_mn = False
    for l in out_lines:
        if l.strip() == '[model_providers.mnrouter]':
            in_mn = True
            continue
        if in_mn and l.strip().startswith('['):
            in_mn = False
        if not in_mn:
            cleaned.append(l)
    final_cfg = new_content.strip() + '\n\n' + '\n'.join(cleaned).strip() + '\n'
    with open(target, 'w') as f:
        f.write(final_cfg)
except Exception:
    with open(target, 'w') as f:
        f.write(new_content)
PYEOF
        printf "  \\033[32m✓\\033[0m Configured %s\\n" "$dest"
        return
      fi
      ;;
    */.omp/agent/models.yml|*/.omp/models.yml)
      if command -v python3 >/dev/null 2>&1 && [ -f "$dest" ]; then
        if [ ! -f "$dest.mnrouter.bak" ]; then cp "$dest" "$dest.mnrouter.bak"; fi
        python3 - "$dest" "$content" << 'PYEOF' 2>/dev/null || true
import sys
try:
    target, new_content = sys.argv[1], sys.argv[2]
    with open(target, 'r') as f:
        old = f.read()
    lines = old.splitlines()
    out = []
    in_mn = False
    for l in lines:
        if l.strip() == 'mnrouter:' or l.startswith('  mnrouter:'):
            in_mn = True
            continue
        if in_mn:
            if (l.startswith('  ') and not l.startswith('    ') and l.strip().endswith(':')) or (len(l) > 0 and not l.startswith(' ')):
                in_mn = False
        if not in_mn:
            out.append(l)
    # Strip 'providers:' header from new_content
    new_lines = new_content.splitlines()
    mn_block = [l for l in new_lines if l.strip() != 'providers:']
    
    # Insert mn_block after 'providers:' line in out
    final_lines = []
    inserted = False
    for l in out:
        final_lines.append(l)
        if l.strip() == 'providers:' and not inserted:
            final_lines.extend(mn_block)
            inserted = True
    if not inserted:
        final_lines = new_lines
    with open(target, 'w') as f:
        f.write('\n'.join(final_lines).strip() + '\n')
except Exception:
    with open(target, 'w') as f:
        f.write(new_content)
PYEOF
        printf "  \\033[32m✓\\033[0m Configured %s\\n" "$dest"
        return
      fi
      ;;
    */.omp/agent/config.yml)
      if command -v python3 >/dev/null 2>&1 && [ -f "$dest" ]; then
        if [ ! -f "$dest.mnrouter.bak" ]; then cp "$dest" "$dest.mnrouter.bak"; fi
        python3 - "$dest" "$content" << 'PYEOF' 2>/dev/null || true
import sys
try:
    target, new_content = sys.argv[1], sys.argv[2]
    with open(target, 'r') as f:
        old = f.read()
    if 'mnrouter.ts' not in old:
        if 'extensions:' in old:
            lines = old.splitlines()
            out = []
            inserted = False
            for l in lines:
                out.append(l)
                if l.strip() == 'extensions:' and not inserted:
                    # extract the extension line from new_content
                    for nl in new_content.splitlines():
                        if 'mnrouter.ts' in nl:
                            out.append(nl)
                    inserted = True
            with open(target, 'w') as f:
                f.write('\n'.join(out).strip() + '\n')
        else:
            with open(target, 'w') as f:
                f.write(old.rstrip() + '\n' + new_content.strip() + '\n')
except Exception:
    pass
PYEOF
        printf "  \\033[32m✓\\033[0m Configured %s\\n" "$dest"
        return
      fi
      ;;
  esac

  if [ -f "$dest" ] && [ ! -f "$dest.mnrouter.bak" ]; then
    cp "$dest" "$dest.mnrouter.bak"
  fi
  printf "%s\\n" "$content" > "$dest"
  printf "  \\033[32m✓\\033[0m Configured %s\\n" "$dest"
}
[ -f "$HOME/.zshrc" ] && append_config "$HOME/.zshrc"
[ -f "$HOME/.bashrc" ] && append_config "$HOME/.bashrc"
[ -f "$HOME/.bash_profile" ] && append_config "$HOME/.bash_profile"

${fileWrites}

printf "\\033[1;32m[mnRouter] %s successfully configured!\\033[0m\\n" "${label}"
printf "Run \\033[1;36msource ~/.zshrc\\033[0m (or \\033[1;36msource ~/.bashrc\\033[0m) to apply.\\n"
`;
}

export function renderBashReset(toolId?: string): string {
	const tools = getToolDefs("http://localhost", "mr_key", undefined, false);
	const targetTools = toolId && tools[toolId] ? [tools[toolId]!] : Object.values(tools);
	const tagPattern = toolId && tools[toolId] ? `mnrouter ${toolId}` : "mnrouter.*";
	const label = toolId && tools[toolId] ? tools[toolId]!.name : "all 11 AI harnesses";

	const fileRestores = targetTools
		.flatMap((t) => t.files || [])
		.map((f) => `restore_or_remove "${f.path}"`)
		.join("\n");

	return `#!/usr/bin/env sh
set -e
printf "\\033[1;34m[mnRouter]\\033[0m Cleaning up %s...\\n" "${label}"

clean_profile() {
  t="$1"
  if [ -f "$t" ]; then
    awk '/# >>> ${tagPattern} >>>/{f=1;next}/# <<< ${tagPattern} <<</{f=0;next}!f' "$t" > "$t.tmp" && mv "$t.tmp" "$t"
    printf "  \\033[32m✓\\033[0m Cleaned %s\\n" "$t"
  fi
}

restore_or_remove() {
  dest="$1"
  case "$dest" in
    \\$HOME/*) dest="$HOME/\${dest#\\$HOME/}" ;;
  esac
  b="$dest.mnrouter.bak"
  if [ -f "$b" ]; then
    mv "$b" "$dest"
    printf "  \\033[32m✓\\033[0m Restored original %s\\n" "$dest"
  elif [ -f "$dest" ]; then
    case "$dest" in
      */.codex/config.toml)
        if command -v python3 >/dev/null 2>&1; then
          python3 - "$dest" << 'PYEOF' 2>/dev/null || true
import sys
try:
    target = sys.argv[1]
    with open(target, 'r') as f:
        content = f.read()
    lines = content.splitlines()
    out_lines = [l for l in lines if not l.startswith(('model_provider = "mnrouter"', 'chatgpt_base_url ='))]
    cleaned = []
    in_mn = False
    for l in out_lines:
        if l.strip() == '[model_providers.mnrouter]':
            in_mn = True
            continue
        if in_mn and l.strip().startswith('['):
            in_mn = False
        if not in_mn:
            cleaned.append(l)
    with open(target, 'w') as f:
        f.write('\n'.join(cleaned).strip() + '\n')
except Exception:
    pass
PYEOF
          printf "  \\033[32m✓\\033[0m Cleaned mnRouter from %s\\n" "$dest"
        else
          rm -f "$dest"
          printf "  \\033[32m✓\\033[0m Removed %s\\n" "$dest"
        fi
        ;;
      */.codex/models_cache.json)
        if command -v python3 >/dev/null 2>&1; then
          python3 - "$dest" << 'PYEOF' 2>/dev/null || true
import json, sys
try:
    target = sys.argv[1]
    with open(target, 'r') as f:
        data = json.load(f)
    data['models'] = [m for m in data.get('models', []) if 'via mnRouter' not in m.get('description', '')]
    with open(target, 'w') as f:
        json.dump(data, f, indent=2)
except Exception:
    pass
PYEOF
          printf "  \\033[32m✓\\033[0m Cleaned mnRouter models from %s\\n" "$dest"
        else
          rm -f "$dest"
          printf "  \\033[32m✓\\033[0m Removed %s\\n" "$dest"
        fi
        ;;
      */.omp/agent/models.yml|*/.omp/models.yml)
        if command -v python3 >/dev/null 2>&1; then
          python3 - "$dest" << 'PYEOF' 2>/dev/null || true
import sys
try:
    target = sys.argv[1]
    with open(target, 'r') as f:
        old = f.read()
    lines = old.splitlines()
    out = []
    in_mn = False
    for l in lines:
        if l.strip() == 'mnrouter:' or l.startswith('  mnrouter:'):
            in_mn = True
            continue
        if in_mn:
            if (l.startswith('  ') and not l.startswith('    ') and l.strip().endswith(':')) or (len(l) > 0 and not l.startswith(' ')):
                in_mn = False
        if not in_mn:
            out.append(l)
    with open(target, 'w') as f:
        f.write('\n'.join(out).strip() + '\n')
except Exception:
    pass
PYEOF
          printf "  \\033[32m✓\\033[0m Cleaned mnRouter provider from %s\\n" "$dest"
        else
          rm -f "$dest"
          printf "  \\033[32m✓\\033[0m Removed %s\\n" "$dest"
        fi
        ;;
      */.omp/agent/config.yml)
        if command -v python3 >/dev/null 2>&1; then
          python3 - "$dest" << 'PYEOF' 2>/dev/null || true
import sys
try:
    target = sys.argv[1]
    with open(target, 'r') as f:
        old = f.read()
    lines = old.splitlines()
    out = []
    for l in lines:
        if 'mnrouter.ts' in l:
            continue
        if l.strip().startswith('default: mnrouter/'):
            continue
        out.append(l)
    with open(target, 'w') as f:
        f.write('\n'.join(out).strip() + '\n')
except Exception:
    pass
PYEOF
          printf "  \\033[32m✓\\033[0m Cleaned mnRouter extension from %s\\n" "$dest"
        else
          rm -f "$dest"
          printf "  \\033[32m✓\\033[0m Removed %s\\n" "$dest"
        fi
        ;;
      */.omp/agent/extensions/mnrouter.ts)
        rm -f "$dest"
        printf "  \\033[32m✓\\033[0m Removed %s\\n" "$dest"
        ;;
      *)
        rm -f "$dest"
        printf "  \\033[32m✓\\033[0m Removed %s\\n" "$dest"
        ;;
    esac
  fi
}

[ -f "$HOME/.zshrc" ] && clean_profile "$HOME/.zshrc"
[ -f "$HOME/.bashrc" ] && clean_profile "$HOME/.bashrc"
[ -f "$HOME/.bash_profile" ] && clean_profile "$HOME/.bash_profile"

${fileRestores}

printf "\\033[1;32m[mnRouter] %s reset complete!\\033[0m\\n" "${label}"
`;
}
