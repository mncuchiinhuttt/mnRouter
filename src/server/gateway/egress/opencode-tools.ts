export const OPENCODE_AGENT_TOOLS = [
	{
		type: "function",
		name: "edit",
		description: "Edit the contents of a file by finding and replacing exact text matches.",
		parameters: {
			type: "object",
			properties: {
				filePath: { type: "string", description: "The path of the file to edit." },
				oldString: { type: "string", description: "The exact text to find and replace." },
				newString: { type: "string", description: "The replacement text." }
			},
			required: ["filePath", "oldString", "newString"]
		}
	},
	{
		type: "function",
		name: "glob",
		description: "Search file paths using a glob pattern (examples: \"**/*.ts\", \"src/**/*.tsx\").",
		parameters: {
			type: "object",
			properties: {
				pattern: { type: "string", description: "The glob pattern to search for." },
				directory: { type: "string", description: "The directory to search in." }
			},
			required: ["pattern"]
		}
	},
	{
		type: "function",
		name: "grep",
		description: "Search file contents using regular expressions.",
		parameters: {
			type: "object",
			properties: {
				pattern: { type: "string", description: "The regular expression to search for." },
				path: { type: "string", description: "File or directory to search in." }
			},
			required: ["pattern"]
		}
	},
	{
		type: "function",
		name: "read",
		description: "Read the contents of a file or directory.",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "Path to read." },
				offset: { type: "number", description: "Line offset to start reading from." },
				limit: { type: "number", description: "Max lines to read." }
			},
			required: ["path"]
		}
	},
	{
		type: "function",
		name: "write",
		description: "Write content to a file, creating parent directories if needed.",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "The file path to write to." },
				content: { type: "string", description: "The text content to write." }
			},
			required: ["path", "content"]
		}
	},
	{
		type: "function",
		name: "shell",
		description: "Execute a shell command and return its output.",
		parameters: {
			type: "object",
			properties: {
				command: { type: "string", description: "The shell command to run." },
				cwd: { type: "string", description: "Working directory." }
			},
			required: ["command"]
		}
	},
	{
		type: "function",
		name: "question",
		description: "Ask the user a clarifying question.",
		parameters: {
			type: "object",
			properties: {
				question: { type: "string", description: "The question to ask." }
			},
			required: ["question"]
		}
	},
	{
		type: "function",
		name: "skill",
		description: "Load a specialized skill instructions and resources.",
		parameters: {
			type: "object",
			properties: {
				name: { type: "string", description: "Name of the skill to load." }
			},
			required: ["name"]
		}
	},
	{
		type: "function",
		name: "subagent",
		description: "Spawns a child agent to work on the specified task in isolation.",
		parameters: {
			type: "object",
			properties: {
				prompt: { type: "string", description: "Task prompt for the agent." }
			},
			required: ["prompt"]
		}
	},
	{
		type: "function",
		name: "webfetch",
		description: "Fetch content from an HTTP or HTTPS URL.",
		parameters: {
			type: "object",
			properties: {
				url: { type: "string", description: "The URL to fetch." }
			},
			required: ["url"]
		}
	},
	{
		type: "function",
		name: "websearch",
		description: "Search the web using live search index.",
		parameters: {
			type: "object",
			properties: {
				query: { type: "string", description: "The search query." }
			},
			required: ["query"]
		}
	},
	{
		type: "function",
		name: "execute",
		description: "Run JavaScript code to orchestrate tasks.",
		parameters: {
			type: "object",
			properties: {
				code: { type: "string", description: "JavaScript code." }
			},
			required: ["code"]
		}
	}
];
