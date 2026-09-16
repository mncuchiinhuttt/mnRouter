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
    rm -f "$dest"
    printf "  \\033[32m✓\\033[0m Removed %s\\n" "$dest"
  fi
}

[ -f "$HOME/.zshrc" ] && clean_profile "$HOME/.zshrc"
[ -f "$HOME/.bashrc" ] && clean_profile "$HOME/.bashrc"
[ -f "$HOME/.bash_profile" ] && clean_profile "$HOME/.bash_profile"

${fileRestores}

printf "\\033[1;32m[mnRouter] %s reset complete!\\033[0m\\n" "${label}"
`;
}
