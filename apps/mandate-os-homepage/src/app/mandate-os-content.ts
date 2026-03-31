const LIVE_PACKAGE_VERSIONS = {
  sdk: '0.1.4',
  mcp: '0.1.4',
  openclaw: '0.1.7',
} as const;

export const MANDATE_OS_CONTENT = {
  brandTagline: 'Operational guardrails for AI agents',
  headerCta: 'Install',
  navLinks: [
    { id: 'problem', label: 'Why MandateOS' },
    { id: 'loop', label: 'How it works' },
    { id: 'integrations', label: 'Integrations' },
    { id: 'surfaces', label: 'For teams' },
    { id: 'security', label: 'Security' },
    { id: 'deploy', label: 'Install' },
  ],
  hero: {
    eyebrow: 'MandateOS / operational guardrails',
    title: 'Put real guardrails around agent action.',
    lede: 'MandateOS gives teams an open-source trust layer for agent integrations, policy checks, and local installation, plus a managed control plane for hosted approvals, workspace operations, and retained audit history.',
    primaryLabel: 'See how it works',
    primaryHref: '#loop',
    secondaryLabel: 'Install without cloning',
    secondaryHref: '#deploy',
  },
  proofStrip: [
    {
      label: 'Open source',
      value: 'SDK, MCP server, installers',
      detail: 'Control higher-risk actions without slowing down routine work.',
    },
    {
      label: 'Managed control plane',
      value: 'Approvals, workspaces, audit retention',
      detail:
        'Run operator workflows centrally when teams need managed review and history.',
    },
    {
      label: 'Integrations',
      value: 'Cursor, Claude Code, OpenClaw',
      detail:
        'Apply one authority model across the shells your team already uses.',
    },
  ],
  heroPanel: {
    eyebrow: 'Operators need clear answers',
    questions: [
      'Who delegated this action, for which workspace, and under what budget?',
      'Did the request stay inside mandate scope, zone, and tool boundaries?',
      'When risk rises, what approval or execution grant is required first?',
      'What receipt proves what happened after the action completed?',
    ],
    noteLabel: 'What teams get',
    noteTitle: 'Open packages at the edge, managed operations for the team',
    noteBody:
      'Use the public packages to inspect and install the guardrail layer. Use the hosted control plane when you want shared approvals, workspace admin, and retained evidence across teams.',
  },
  problem: {
    eyebrow: 'Why MandateOS',
    title: 'AI agents need enforceable limits, not just instructions.',
    body: 'As agents gain access to repositories, browsers, terminals, and external systems, teams need a consistent way to express allowed actions, escalation thresholds, and audit requirements.',
    cards: [
      {
        label: 'Without guardrails',
        title: 'Approval logic lives in chat logs',
        body: 'Teams end up improvising policy in prompts, docs, or screenshots, which makes sensitive work hard to review and harder to trust.',
      },
      {
        label: 'With MandateOS',
        title: 'Authority is enforced at runtime',
        body: 'Tool scope, budgets, risk zones, and approval thresholds are checked before sensitive work continues.',
      },
      {
        label: 'For users',
        title: 'Operators keep visibility',
        body: 'Teams can review what the agent asked to do, what was approved, and what was actually executed without reconstructing the story later.',
      },
    ],
  },
  loop: {
    eyebrow: 'How it works',
    title: 'MandateOS keeps agent work inside a reviewable operating loop.',
    body: 'Teams define the operating rules once, let agents request room to act, escalate only when needed, and keep receipts behind the outcome.',
    steps: [
      {
        id: '01',
        title: 'Define the mandate',
        body: 'Capture budget, tools, regions, risk zones, and approval thresholds in a form operators can inspect and update.',
      },
      {
        id: '02',
        title: 'Evaluate proposed actions',
        body: 'Agents bring intended work to the runtime before touching code, docs, browsers, or external systems.',
      },
      {
        id: '03',
        title: 'Grant or escalate',
        body: 'Routine work can continue immediately. Higher-risk work stops for explicit approval or execution grants.',
      },
      {
        id: '04',
        title: 'Review the receipts',
        body: 'Every meaningful decision leaves evidence that can be exported, verified, and audited later.',
      },
    ],
  },
  integrations: {
    eyebrow: 'Where it fits',
    title: 'Use MandateOS alongside the agent tools your team already runs.',
    body: 'MandateOS is designed to sit between the agent and the actions that matter: code changes, approvals, external tools, and higher-risk execution.',
    items: [
      {
        name: 'Cursor',
        status: 'Available',
        summary:
          'Bring Cursor sessions under the same approval, tool-scope, and receipt model as the rest of your agent operations.',
        details: [
          'Operator-defined policy boundaries',
          'Approval checks before sensitive actions',
          'Receipts attached to meaningful work',
        ],
      },
      {
        name: 'Claude Code',
        status: 'Available',
        summary:
          'Use the same operating model in Claude Code so teams do not have to reinvent policy for each shell.',
        details: [
          'Shared mandate model across environments',
          'Consistent escalation behavior',
          'Receipts and audit history',
        ],
      },
      {
        name: 'OpenClaw',
        status: 'Active testing',
        summary:
          'OpenClaw is a strong fit for MandateOS because local agent power needs explicit tool boundaries, approvals, and receipts.',
        details: [
          'Guide higher-risk workflows',
          'Apply receipts before sensitive tool use',
          'Use one authority model across shells',
        ],
      },
      {
        name: 'GitHub enforcement',
        status: 'Planned',
        summary:
          'Bring repository actions such as triage, drafting, and workflow execution under the same approval model.',
        details: [
          'One policy model across integrations',
          'Consistent review for repo operations',
          'Designed to grow without duplicating guardrail logic',
        ],
      },
    ],
  },
  surfaces: {
    eyebrow: 'For teams',
    title: 'Give operators one place to define, run, and review authority.',
    body: 'MandateOS separates the open-source trust layer from the managed control plane operators use to run teams day to day.',
    items: [
      {
        label: 'Define',
        title: 'Mandates',
        body: 'Set the operating rules for agent work: tool scope, budgets, thresholds, approvals, and escalation policy.',
      },
      {
        label: 'Operate',
        title: 'Workspaces',
        body: 'Use the managed control plane to run hosted workspaces, operator access, integrations, and approval flows.',
      },
      {
        label: 'Review',
        title: 'Receipts and audit history',
        body: 'Keep signed evidence, execution grants, and retained audit records attached to the agent actions that actually mattered.',
      },
    ],
  },
  security: {
    eyebrow: 'Built-in security',
    title: 'Every layer is cryptographically protected.',
    body: 'MandateOS uses proven cryptographic primitives at every level — signing, encryption, hashing, and chaining — so teams can verify integrity, protect secrets, and detect tampering without bolting on external tools.',
    items: [
      {
        label: 'Signed payloads',
        title: 'HMAC-SHA256 signatures on mandates, receipts, and grants',
        body: 'Every mandate, receipt, and execution grant is digitally signed at creation. The payload is canonicalized, hashed, and signed with a server-held secret. Key rotation is built in, so old signatures stay valid when you roll credentials.',
      },
      {
        label: 'Encrypted secrets',
        title: 'AES-256-GCM encryption for tokens at rest',
        body: 'Sensitive credentials like OAuth tokens are encrypted before storage using AES-256-GCM with a unique initialization vector per value. Ciphertext and authentication tags are stored together so decryption also verifies data integrity.',
      },
      {
        label: 'Hashed credentials',
        title: 'scrypt-based API key storage with timing-safe comparison',
        body: 'API key secrets are never stored in plain text. Each key is hashed with scrypt using a random salt, and verification uses constant-time comparison to prevent timing attacks.',
      },
      {
        label: 'Tamper-evident audit',
        title: 'SHA-256 hash chain across all audit events',
        body: 'Audit events are linked in a hash chain where each entry includes the hash of the previous one. Any modification to a past event breaks the chain, making tampering immediately detectable.',
      },
      {
        label: 'Verified requests',
        title: 'HMAC-signed inter-service authentication',
        body: 'Service-to-service requests are authenticated with HMAC-SHA256 signatures that cover the method, path, body, and expiry. Mutating requests require an idempotency key, and all checks use timing-safe comparison.',
      },
    ],
  },
  deploy: {
    eyebrow: 'Install without cloning',
    title: 'Install MandateOS directly into the agent shell you already use.',
    body: 'The open-source packages and bootstrap scripts below let teams wire Cursor, Claude Code, and OpenClaw into local workflows without cloning this repository first. The hosted control plane is where teams manage approvals, workspaces, and retained audit history.',
    steps: [
      {
        step: 'A',
        title: 'Export your MandateOS connection values',
        body: 'Set your MandateOS base URL and agent token in the shell where you plan to run an installer. Add a default mandate id when you want one workspace mandate preselected.',
      },
      {
        step: 'B',
        title: 'Run the host installer',
        body: 'Use the package entrypoint or download the shell script for Cursor, Claude Code, or OpenClaw. Each installer writes the files that host needs locally.',
      },
      {
        step: 'C',
        title: 'Open the shell and verify the tools',
        body: 'Start the guarded workspace, approve the MandateOS MCP if the host asks, and confirm the MandateOS tools are available before doing sensitive work.',
      },
    ],
    envTitle: 'Shell environment',
    envBody:
      'Set these once before running any installer. `MANDATE_OS_MCP_DEFAULT_MANDATE_ID` is optional and only needed when you want the host to start with a project mandate already selected.',
    envCommand: `export MANDATE_OS_BASE_URL="https://mandateos.example.com"
export MANDATE_OS_AGENT_TOKEN="key_id.secret"
export MANDATE_OS_MCP_DEFAULT_MANDATE_ID="mdt_123"`,
    packagesTitle: 'Packages',
    packagesBody:
      'These open-source packages are the trust and installation layer. Teams typically pair them with the managed control plane for hosted approvals and operator workflows.',
    packages: [
      {
        name: '@mandate-os/sdk',
        install: `npm install @mandate-os/sdk@${LIVE_PACKAGE_VERSIONS.sdk}`,
        npmHref: 'https://www.npmjs.com/package/@mandate-os/sdk',
        npmLabel: 'View on npm',
        summary:
          'Use the SDK when you want to call MandateOS from your own services, hooks, or custom host integrations.',
        details: [
          'Typed client for mandates, receipts, and execution grants',
          'Fits internal tools, host gateways, and policy-aware services',
        ],
      },
      {
        name: '@mandate-os/mcp',
        install: `npm install @mandate-os/mcp@${LIVE_PACKAGE_VERSIONS.mcp}`,
        npmHref: 'https://www.npmjs.com/package/@mandate-os/mcp',
        npmLabel: 'View on npm',
        summary:
          'Registers the MandateOS MCP server and ships the installer CLIs for Cursor and Claude Code.',
        details: [
          'Binaries: mandate-os-mcp, mandate-os-cursor-install, mandate-os-claude-install',
          'Writes MCP entries plus host hooks for guarded execution',
        ],
      },
      {
        name: '@mandate-os/openclaw',
        install: `npm install @mandate-os/openclaw@${LIVE_PACKAGE_VERSIONS.openclaw}`,
        npmHref: 'https://www.npmjs.com/package/@mandate-os/openclaw',
        npmLabel: 'View on npm',
        summary:
          'Installs the OpenClaw bridge, bundle, and guarded agent setup without copying repo files by hand.',
        details: [
          'Binaries: mandate-os-openclaw-install, mandate-os-openclaw-bridge',
          'Adds the MandateOS plugin bundle under the local OpenClaw state directory',
        ],
      },
    ],
    installersTitle: 'Host installers',
    installersBody:
      'Run the package CLI directly with `npx`, or download the matching shell wrapper and pass your workspace path as the first argument.',
    installers: [
      {
        name: 'Cursor',
        packageName: '@mandate-os/mcp',
        packageHref: 'https://www.npmjs.com/package/@mandate-os/mcp',
        packageLinkLabel: 'View package on npm',
        summary:
          'Configures Cursor user and workspace MCP entries, then writes `beforeShellExecution` and `beforeMCPExecution` hooks for the target repository.',
        command: `npx --yes --package @mandate-os/mcp@${LIVE_PACKAGE_VERSIONS.mcp} mandate-os-cursor-install install \\
  --workspace "/absolute/path/to/your/repo"`,
        scriptHref: '/install/mandate-os-cursor-install.sh',
        scriptFileName: 'mandate-os-cursor-install.sh',
        scriptLabel: 'Download shell script',
        notes: [
          'Reads `MANDATE_OS_BASE_URL`, `MANDATE_OS_AGENT_TOKEN`, and optional `MANDATE_OS_MCP_DEFAULT_MANDATE_ID` from your shell.',
          `Status check: \`npx --yes --package @mandate-os/mcp@${LIVE_PACKAGE_VERSIONS.mcp} mandate-os-cursor-install status --workspace "/absolute/path/to/your/repo"\``,
        ],
      },
      {
        name: 'Claude Code',
        packageName: '@mandate-os/mcp',
        packageHref: 'https://www.npmjs.com/package/@mandate-os/mcp',
        packageLinkLabel: 'View package on npm',
        summary:
          'Writes the local-scoped `mandateos` MCP entry into `~/.claude.json` and creates workspace hooks in `.claude/settings.local.json`.',
        command: `npx --yes --package @mandate-os/mcp@${LIVE_PACKAGE_VERSIONS.mcp} mandate-os-claude-install install \\
  --workspace "/absolute/path/to/your/repo"`,
        scriptHref: '/install/mandate-os-claude-install.sh',
        scriptFileName: 'mandate-os-claude-install.sh',
        scriptLabel: 'Download shell script',
        notes: [
          'Reads `MANDATE_OS_BASE_URL`, `MANDATE_OS_AGENT_TOKEN`, and optional `MANDATE_OS_MCP_DEFAULT_MANDATE_ID` from your shell.',
          `Status check: \`npx --yes --package @mandate-os/mcp@${LIVE_PACKAGE_VERSIONS.mcp} mandate-os-claude-install status --workspace "/absolute/path/to/your/repo"\``,
        ],
      },
      {
        name: 'OpenClaw',
        packageName: '@mandate-os/openclaw',
        packageHref: 'https://www.npmjs.com/package/@mandate-os/openclaw',
        packageLinkLabel: 'View package on npm',
        summary:
          'Installs the OpenClaw extension bundle, configures the local MCP server, and creates a guarded agent profile for the selected workspace.',
        command: `MANDATE_OS_OPENCLAW_WORKSPACE_PATH="/absolute/path/to/your/repo" \\
npx --yes --package @mandate-os/openclaw@${LIVE_PACKAGE_VERSIONS.openclaw} mandate-os-openclaw-install install`,
        scriptHref: '/install/mandate-os-openclaw-install.sh',
        scriptFileName: 'mandate-os-openclaw-install.sh',
        scriptLabel: 'Download shell script',
        notes: [
          'Reads `MANDATE_OS_BASE_URL` and optional `MANDATE_OS_MCP_DEFAULT_MANDATE_ID` during installation.',
          `Status check: \`MANDATE_OS_OPENCLAW_WORKSPACE_PATH="/absolute/path/to/your/repo" npx --yes --package @mandate-os/openclaw@${LIVE_PACKAGE_VERSIONS.openclaw} mandate-os-openclaw-install status\``,
        ],
      },
    ],
    runtimeNoteTitle: 'OpenClaw runtime note',
    runtimeNoteBody:
      'Keep `MANDATE_OS_AGENT_TOKEN` available in the environment that launches OpenClaw so the guarded plugin can evaluate actions at runtime.',
  },
  finalCta: {
    eyebrow: 'Give operators confidence',
    title: 'MandateOS helps teams trust agent action without losing control.',
    body: 'If agents can write code, call tools, and make changes, operators need a way to limit, approve, and verify those actions. MandateOS gives you open-source guardrails at the edge and managed operations when your team needs them.',
    primaryLabel: 'Open install guide',
    primaryHref: '#deploy',
    secondaryLabel: 'See integrations',
    secondaryHref: '#integrations',
  },
  footer: 'Operational guardrails, approvals, and receipts for AI agents.',
} as const;
