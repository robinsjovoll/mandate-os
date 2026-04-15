export const MANDATE_OS_CONTENT = {
  brandTagline: 'Guardrails, approvals, and receipts for agent action',
  headerCta: 'Install in a Repo',
  navLinks: [
    { id: 'proof', label: 'Proof' },
    { id: 'trust', label: 'Trust Boundary' },
    { id: 'integrations', label: 'Integrations' },
    { id: 'deploy', label: 'Install Guide' },
    { id: 'evidence', label: 'Evidence' },
    { id: 'faq', label: 'FAQ' },
  ],
  hero: {
    eyebrow: 'MandateOS / runtime guardrails for AI agents',
    title: 'Install approvals, guardrails, and receipts into agent workflows.',
    lede:
      'MandateOS gives teams using Codex, Cursor, Claude Code, OpenClaw, and MCP-based workflows a concrete operating loop: define a mandate, intercept risky actions, escalate when needed, and keep signed evidence behind what ran.',
    practical:
      'When an agent wants to run a shell command, push code, or call an external tool, MandateOS evaluates the request before it runs, shows operators what was requested, and records the outcome as approval events, receipts, and evidence.',
    audience:
      'For platform, security, and engineering teams running agents inside real repositories, shells, and operator-reviewed workflows.',
    publicProofLabel: 'Public proof',
    publicProof: [
      'Open repo and install path',
      '3 published npm packages',
      '4 hosts available today',
    ],
    verification:
      'Signed receipts, execution grants, and audit-chain verification are inspectable from the first guarded action.',
    verificationLinkLabel: 'See verification details',
    highlights: [
      'No-clone install into an existing repo',
      'Open-source trust layer at the edge',
      'Managed approvals, workspaces, and audit retention',
      'Codex, Cursor, Claude Code, OpenClaw, and MCP workflows',
    ],
    primaryLabel: 'Install Guardrails in a Repo',
    primaryHref: '#deploy',
    secondaryLabel: 'See Approval Flow',
    secondaryHref: '#proof',
    ctaNote:
      'Export your connection values, run the host installer, and MandateOS writes local host config plus a status path into that workspace. No repo clone required.',
    trustLinks: [
      {
        label: 'Public Repo',
        href: 'https://github.com/robinsjovoll/mandate-os',
      },
      {
        label: 'npm Packages',
        href: 'https://www.npmjs.com/search?q=%40mandate-os',
      },
      {
        label: 'Installer Docs',
        href: 'https://github.com/robinsjovoll/mandate-os/tree/main/packages/mandate-os-mcp#readme',
      },
    ],
  },
  proofStrip: [
    {
      label: 'What Gets Written',
      value: 'Local MCP + hook config',
      detail:
        'MandateOS writes host-scoped files such as `.codex/config.toml`, `.codex/hooks.json`, Cursor hooks, and Claude workspace settings.',
    },
    {
      label: 'What Gets Checked',
      value: 'Mandate, tool, zone, approval path',
      detail:
        'Before risky actions continue, the runtime evaluates scope, budget, risk zone, and whether an operator decision is required.',
    },
    {
      label: 'What Operators Keep',
      value: 'Receipts, approval events, audit chain',
      detail:
        'Teams can review signed receipts, execution grants, approval events, and retained audit history after the action completes.',
    },
    {
      label: 'What You Can Inspect',
      value: 'Public repo, packages, installers',
      detail:
        'The trust layer is open source, so teams can inspect the host integration path instead of relying on a black box.',
    },
  ],
  heroPanel: {
    eyebrow: 'What happens after install',
    title: 'The product becomes visible immediately.',
    body:
      'MandateOS should feel tangible within minutes, not after a long setup project.',
    steps: [
      'Install into an existing repository without cloning this repo first.',
      'MandateOS writes the local MCP and hook config for the selected host.',
      'The agent brings risky actions to the runtime before they continue.',
      'Operators review approval events, receipts, and retained evidence in the control plane.',
    ],
    noteLabel: 'Available now',
    noteTitle:
      'Codex, Cursor, Claude Code, OpenClaw, and managed MCP flows are ready today',
    noteBody:
      'GitHub-side enforcement is planned next. The public packages and the managed control plane are both already live.',
  },
  proof: {
    eyebrow: 'How it looks in practice',
    title: 'Inspectable proof beats abstract claims.',
    body:
      'MandateOS is easiest to trust when you can see the local files it writes, the approval event it creates, and the evidence operators keep after the run.',
    media: {
      label: 'Product preview',
      title: 'Approval review, receipts, and verification in one operating loop',
      body:
        'This is the part first-time visitors need to picture quickly: a risky request reaches the runtime before it executes, an operator sees the exact request and mandate context, and the resulting receipt stays attached to the action for later review.',
      hint: 'Click the preview to inspect it at a larger size.',
      imageSrc: '/proof/operator-review-preview.svg',
      imageAlt:
        'MandateOS operator preview showing a requested production migration, approval review details, and a signed receipt verification panel.',
      points: [
        'The request includes the host, workspace, mandate id, and risk context before the tool continues.',
        'Approval review keeps the operator decision, reasons, and escalation state in one place instead of scattered across chat and logs.',
        'Receipt verification keeps the signed evidence, approval event, and audit chain attached to the action itself.',
      ],
      caption:
        'Representative product preview based on the live MandateOS approval and evidence flow.',
    },
    previews: [
      {
        label: 'Install Preview',
        title: 'Writes host-scoped files into the workspace you already use',
        body:
          'The installer configures the host locally instead of asking teams to copy files around by hand.',
        windowTitle: 'Workspace bootstrap',
        windowMeta: 'project-scoped config',
        rows: [
          {
            title: '.codex/config.toml',
            detail: 'Registers the `mandateos` MCP server and runtime env vars.',
          },
          {
            title: '.codex/hooks.json',
            detail: 'Adds PreToolUse guardrails for Bash-side execution.',
          },
          {
            title: '.git/info/exclude',
            detail: 'Keeps generated host config out of normal commits.',
          },
        ],
        footer:
          'Cursor and Claude Code use the same pattern with their own local MCP and hook entries.',
      },
      {
        label: 'Approval Preview',
        title: 'Shows the exact action, mandate, and escalation path',
        body:
          'When an agent asks for something higher risk, operators get a concrete event to review instead of a vague chat summary.',
        windowTitle: 'Approval event',
        windowMeta: 'runtime decision',
        rows: [
          {
            title: 'Requested action',
            detail: '`run migration against production`',
          },
          {
            title: 'Mandate check',
            detail: 'Tool scope allowed, but risk zone requires approval.',
          },
          {
            title: 'Operator outcome',
            detail: 'Approval requested before the command can continue.',
          },
        ],
        footer:
          'Routine actions continue immediately. Higher-risk actions stop for explicit review.',
      },
      {
        label: 'Evidence Preview',
        title: 'Receipts and audit events stay attached to the action itself',
        body:
          'After execution, teams can review the signed record instead of reconstructing what happened from logs and screenshots.',
        windowTitle: 'Receipt & audit view',
        windowMeta: 'verifiable evidence',
        rows: [
          {
            title: 'Receipt',
            detail: 'Signed result with mandate id, decision, and timestamps.',
          },
          {
            title: 'Approval event',
            detail: 'Operator review and any execution grant stay in the chain.',
          },
          {
            title: 'Audit verification',
            detail: 'Hash chain and signature status can be checked later.',
          },
        ],
        footer:
          'This is where the security story becomes useful: teams can verify artifacts, not just read summaries.',
      },
    ],
    links: [
      {
        label: 'View the public repository',
        href: 'https://github.com/robinsjovoll/mandate-os',
      },
      {
        label: 'Browse the published packages',
        href: 'https://www.npmjs.com/search?q=%40mandate-os',
      },
    ],
    example: {
      title: 'One realistic end-to-end flow',
      body:
        'A platform team installs MandateOS into a repo, defines a mandate for allowed tools and escalation thresholds, lets the agent request a production-sensitive action, stops that action for approval, then reviews the receipt and audit chain afterward.',
      steps: [
        {
          id: '01',
          title: 'Install into the repo',
          body:
            'Run the host installer for Codex, Cursor, Claude Code, or OpenClaw against an existing workspace path.',
          artifact:
            'Result: local MCP and hook files are written for that host.',
        },
        {
          id: '02',
          title: 'Define the mandate',
          body:
            'Set allowed tools, budgets, risk zones, approval thresholds, and receipt requirements.',
          artifact:
            'Result: the runtime has a concrete policy boundary to evaluate.',
        },
        {
          id: '03',
          title: 'Agent requests action',
          body:
            'The agent proposes a risky command before touching the shell or other sensitive tools.',
          artifact:
            'Example: `run migration against production` reaches the runtime first.',
        },
        {
          id: '04',
          title: 'Approve or escalate',
          body:
            'Routine work continues. Higher-risk work stops for explicit approval or a grant.',
          artifact:
            'Result: an approval event is created for operator review.',
        },
        {
          id: '05',
          title: 'Keep the evidence',
          body:
            'The action record stays attached to receipts, approval events, and audit verification.',
          artifact:
            'Result: operators can review what was requested, approved, and executed later.',
        },
      ],
    },
  },
  adoption: {
    eyebrow: 'Why teams adopt this',
    title: 'Practical operator benefits matter more than abstract governance.',
    body:
      'MandateOS is useful when teams need runtime guardrails, shared approvals, and evidence they can review after the agent run finishes.',
    items: [
      {
        label: 'Approvals',
        title: 'Stop sensitive work for explicit operator review',
        body:
          'Teams do not have to rely on prompt instructions or chat etiquette when an action needs approval before it continues.',
      },
      {
        label: 'Visibility',
        title: 'See what the agent asked to do before and after execution',
        body:
          'Operators can review the requested action, the runtime decision, the approval event, and the final receipt in one place.',
      },
      {
        label: 'Auditability',
        title: 'Keep retained evidence instead of reconstructing history later',
        body:
          'Receipts, grants, and audit events stay attached to the action so review does not depend on scattered logs or screenshots.',
      },
    ],
  },
  useCases: {
    eyebrow: 'Best first use cases',
    title: 'Start where runtime guardrails are immediately valuable.',
    body:
      'MandateOS works best when teams begin with narrow, high-consequence workflows rather than trying to govern every agent action on day one.',
    items: [
      {
        title: 'Production-sensitive shell commands',
        body:
          'Require approval before commands that touch production data, migrations, or higher-risk environments.',
        outcome: 'Outcome: risky commands stop for operator review instead of slipping through normal agent flow.',
      },
      {
        title: 'Repository write controls',
        body:
          'Gate specific repo-changing workflows so teams can separate routine edits from higher-risk changes.',
        outcome: 'Outcome: one operating model across Codex, Cursor, Claude Code, and future GitHub-side enforcement.',
      },
      {
        title: 'External tool escalation',
        body:
          'Use receipts and approval thresholds when agents move beyond local edits into external systems and managed tools.',
        outcome: 'Outcome: the runtime boundary stays explicit as integrations grow.',
      },
      {
        title: 'Early multi-team rollouts',
        body:
          'Start with the open packages locally, then add the managed control plane when teams need shared approvals and retained evidence.',
        outcome: 'Outcome: adoption can begin small without hiding the trust layer.',
      },
    ],
  },
  boundary: {
    eyebrow: 'Trust boundary',
    title: 'The open-source trust layer and the managed control plane do different jobs.',
    body:
      'MandateOS is easier to evaluate when the boundary is explicit. The public packages handle local host integration and runtime enforcement. The managed control plane handles shared operator workflows, approvals, workspace administration, and retained evidence.',
    columns: [
      {
        label: 'Open-source trust layer',
        title: 'What runs close to the host',
        points: [
          'Installer CLIs and package entrypoints',
          'Local MCP registration and host hook wiring',
          'Runtime request path into MandateOS',
          'Inspectability through the public repo and packages',
        ],
      },
      {
        label: 'Managed control plane',
        title: 'What operators use centrally',
        points: [
          'Workspaces and operator access',
          'Approval inbox and escalation review',
          'Retained audit history and evidence export',
          'Shared operations across teams and repos',
        ],
      },
      {
        label: 'Evidence boundary',
        title: 'What teams can verify afterward',
        points: [
          'Signed receipts and execution grants',
          'Approval events attached to the request path',
          'Audit chain verification and retained history',
          'Public package surface plus operator-visible outcomes',
        ],
      },
    ],
    diagram: {
      title: 'How the boundary works',
      nodes: [
        'Agent host (Codex, Cursor, Claude Code, OpenClaw)',
        'MandateOS runtime checks',
        'Operator review, receipts, and audit evidence',
      ],
    },
    links: [
      {
        label: 'Open-source repo',
        href: 'https://github.com/robinsjovoll/mandate-os',
      },
      {
        label: 'SDK on npm',
        href: 'https://www.npmjs.com/package/@mandate-os/sdk',
      },
      {
        label: 'MCP package on npm',
        href: 'https://www.npmjs.com/package/@mandate-os/mcp',
      },
    ],
  },
  integrations: {
    eyebrow: 'Where it fits',
    title: 'Use one approval and evidence model across the host tools your team already runs.',
    body:
      'MandateOS sits between the agent and the actions that matter: shell execution, code changes, approvals, and higher-risk tool use.',
    statusSummary: [
      'Available today: Codex, Cursor, Claude Code, OpenClaw, and managed MCP flows',
      'Same mandate, approval, and receipt model across local hosts',
      'Planned: GitHub-side enforcement',
    ],
    items: [
      {
        name: 'Codex',
        status: 'Available Today',
        summary:
          'Use project-scoped Codex MCP and hook config to bring Bash-side actions under the same approval and receipt model.',
        details: [
          'Writes `.codex/config.toml` with the MandateOS MCP entry',
          'Adds Bash PreToolUse guardrails in `.codex/hooks.json`',
          'Blocks conservatively when approval is still required',
        ],
      },
      {
        name: 'Cursor',
        status: 'Available Today',
        summary:
          'Bring Cursor sessions under the same approval, tool-scope, and receipt model as the rest of your agent operations.',
        details: [
          'Configures local MCP entries for the repo',
          'Writes guarded shell and MCP hooks for the workspace',
          'Keeps the runtime path aligned with the rest of the trust layer',
        ],
      },
      {
        name: 'Claude Code',
        status: 'Available Today',
        summary:
          'Use the same operating model in Claude Code so teams do not have to reinvent policy for each shell.',
        details: [
          'Adds the local `mandateos` MCP entry',
          'Creates workspace-scoped settings for the selected repo',
          'Preserves a consistent approval and receipt path',
        ],
      },
      {
        name: 'OpenClaw',
        status: 'Available Today',
        summary:
          'Designed for OpenClaw’s flexible host surface so teams can keep explicit tool boundaries, approvals, and receipts around local agent power.',
        details: [
          'Installs the OpenClaw bridge and plugin bundle',
          'Creates a guarded local profile for the selected workspace',
          'Uses the same mandate, approval, and evidence model as the other hosts',
        ],
      },
      {
        name: 'GitHub Enforcement',
        status: 'Planned',
        summary:
          'Repository-side actions are a natural next extension of the same policy and approval model.',
        details: [
          'Designed to reuse the same mandate logic',
          'Lets teams extend review and evidence past local shell actions',
          'Explicitly not presented as fully available today',
        ],
      },
    ],
  },
  deploy: {
    eyebrow: 'Install without cloning',
    title: 'The shortest path is: export two values, run one installer, open your shell.',
    body:
      'MandateOS is already packaged for Codex, Cursor, Claude Code, and OpenClaw. You do not need to clone this repository to try it.',
    quickStartTitle: 'Before you start',
    quickStartBody:
      'You only need the basics that connect the local host to the runtime and a repo path where you want the guardrails installed.',
    quickStartChecklist: [
      'A `MANDATE_OS_BASE_URL`',
      'A `MANDATE_OS_AGENT_TOKEN`',
      'A repo path for the workspace you want to guard',
      'One host: Codex, Cursor, Claude Code, or OpenClaw',
      'Optional: `MANDATE_OS_MCP_DEFAULT_MANDATE_ID`',
    ],
    fastestPathTitle: 'Fastest first try',
    fastestPathBody:
      'Choose one host, export the base URL and agent token, run the matching `npx` installer, then run the host status command before doing sensitive work.',
    fastestPathSteps: [
      'Export the connection values once in the shell you plan to use.',
      'Run the matching installer against your repo path.',
      'Open the guarded workspace and confirm the host sees MandateOS.',
    ],
    afterInstallTitle: 'What you see after install',
    afterInstallBody:
      'MandateOS becomes concrete immediately because the host now has local config, a status command, and a runtime path for risky actions.',
    afterInstallItems: [
      'Local MCP and hook files written for that host',
      'A status command to confirm the setup',
      'A host-scoped runtime path for approvals and receipts',
    ],
    splitTitle: 'Open-source trust layer vs managed control plane',
    splitBody:
      'The packages and installers are open source. Teams usually connect them to the managed control plane when they want shared approvals, workspace administration, and retained audit history.',
    splitItems: [
      'Open source: SDK, MCP server, installers, starter bundles, and docs',
      'Managed: workspaces, approvals, retained evidence, and operator review',
    ],
    steps: [
      {
        step: 'A',
        title: 'Export your MandateOS connection values',
        body:
          'Set your base URL and agent token in the shell where you plan to run an installer. Add a default mandate id only when you want one project mandate preselected.',
      },
      {
        step: 'B',
        title: 'Run the host installer',
        body:
          'Use the package entrypoint or download the shell script for Codex, Cursor, Claude Code, or OpenClaw. Each installer writes the local files that host needs.',
      },
      {
        step: 'C',
        title: 'Open the shell and verify the host',
        body:
          'Start the guarded workspace, approve the MandateOS MCP if the host asks, and confirm the status command before you move into sensitive work.',
      },
    ],
    envTitle: 'Shell environment',
    envBody:
      'Copy the runtime URL and agent token from your MandateOS control plane. `MANDATE_OS_MCP_DEFAULT_MANDATE_ID` is optional and only needed when you want the host to start with a project mandate already selected.',
    envCommand: `# Replace with the runtime URL and agent token from your MandateOS control plane.
export MANDATE_OS_BASE_URL="https://your-mandateos-runtime-url"
export MANDATE_OS_AGENT_TOKEN="key_id.secret"
# Optional: preselect one mandate for this repo.
export MANDATE_OS_MCP_DEFAULT_MANDATE_ID="mdt_123"`,
    packagesTitle: 'Packages',
    packagesBody:
      'These open-source packages are the install and trust layer. Teams pair them with the managed control plane when they want hosted approvals and operator workflows.',
    packages: [
      {
        name: '@mandate-os/sdk',
        install: 'npm install @mandate-os/sdk@latest',
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
        install: 'npm install @mandate-os/mcp@latest',
        npmHref: 'https://www.npmjs.com/package/@mandate-os/mcp',
        npmLabel: 'View on npm',
        summary:
          'Registers the MandateOS MCP server and ships the installer CLIs for Codex, Cursor, and Claude Code.',
        details: [
          'Binaries: mandate-os-mcp, mandate-os-codex-install, mandate-os-cursor-install, mandate-os-claude-install',
          'Writes MCP entries plus host hooks for guarded execution',
        ],
      },
      {
        name: '@mandate-os/openclaw',
        install: 'npm install @mandate-os/openclaw@latest',
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
      'Run the package CLI directly with `npx`, or download the matching shell script and pass your workspace path as the first argument.',
    installers: [
      {
        name: 'Codex',
        packageName: '@mandate-os/mcp',
        packageHref: 'https://www.npmjs.com/package/@mandate-os/mcp',
        packageLinkLabel: 'View package on npm',
        summary:
          'Writes project-scoped `.codex/config.toml` and `.codex/hooks.json` so Codex loads the MandateOS MCP server and Bash guardrails inside that repository.',
        command: `npx --yes --package @mandate-os/mcp@latest mandate-os-codex-install install \\
  --workspace "/absolute/path/to/your/repo"`,
        scriptHref: '/install/mandate-os-codex-install.sh',
        scriptFileName: 'mandate-os-codex-install.sh',
        scriptLabel: 'Download shell script',
        notes: [
          'Reads `MANDATE_OS_BASE_URL`, `MANDATE_OS_AGENT_TOKEN`, and optional `MANDATE_OS_MCP_DEFAULT_MANDATE_ID` from your shell, then forwards the runtime values through Codex `env_vars`.',
          'Status check: `npx --yes --package @mandate-os/mcp@latest mandate-os-codex-install status --workspace "/absolute/path/to/your/repo"`',
        ],
      },
      {
        name: 'Cursor',
        packageName: '@mandate-os/mcp',
        packageHref: 'https://www.npmjs.com/package/@mandate-os/mcp',
        packageLinkLabel: 'View package on npm',
        summary:
          'Configures Cursor user and workspace MCP entries, then writes `beforeShellExecution` and `beforeMCPExecution` hooks for the target repository.',
        command: `npx --yes --package @mandate-os/mcp@latest mandate-os-cursor-install install \\
  --workspace "/absolute/path/to/your/repo"`,
        scriptHref: '/install/mandate-os-cursor-install.sh',
        scriptFileName: 'mandate-os-cursor-install.sh',
        scriptLabel: 'Download shell script',
        notes: [
          'Reads `MANDATE_OS_BASE_URL`, `MANDATE_OS_AGENT_TOKEN`, and optional `MANDATE_OS_MCP_DEFAULT_MANDATE_ID` from your shell.',
          'Status check: `npx --yes --package @mandate-os/mcp@latest mandate-os-cursor-install status --workspace "/absolute/path/to/your/repo"`',
        ],
      },
      {
        name: 'Claude Code',
        packageName: '@mandate-os/mcp',
        packageHref: 'https://www.npmjs.com/package/@mandate-os/mcp',
        packageLinkLabel: 'View package on npm',
        summary:
          'Writes the local-scoped `mandateos` MCP entry into `~/.claude.json` and creates workspace hooks in `.claude/settings.local.json`.',
        command: `npx --yes --package @mandate-os/mcp@latest mandate-os-claude-install install \\
  --workspace "/absolute/path/to/your/repo"`,
        scriptHref: '/install/mandate-os-claude-install.sh',
        scriptFileName: 'mandate-os-claude-install.sh',
        scriptLabel: 'Download shell script',
        notes: [
          'Reads `MANDATE_OS_BASE_URL`, `MANDATE_OS_AGENT_TOKEN`, and optional `MANDATE_OS_MCP_DEFAULT_MANDATE_ID` from your shell.',
          'Status check: `npx --yes --package @mandate-os/mcp@latest mandate-os-claude-install status --workspace "/absolute/path/to/your/repo"`',
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
npx --yes --package @mandate-os/openclaw@latest mandate-os-openclaw-install install`,
        scriptHref: '/install/mandate-os-openclaw-install.sh',
        scriptFileName: 'mandate-os-openclaw-install.sh',
        scriptLabel: 'Download shell script',
        notes: [
          'Reads `MANDATE_OS_BASE_URL` and optional `MANDATE_OS_MCP_DEFAULT_MANDATE_ID` during installation.',
          'Status check: `MANDATE_OS_OPENCLAW_WORKSPACE_PATH="/absolute/path/to/your/repo" npx --yes --package @mandate-os/openclaw@latest mandate-os-openclaw-install status`',
        ],
      },
    ],
    runtimeNoteTitle: 'Runtime environment note',
    runtimeNoteBody:
      'Keep `MANDATE_OS_BASE_URL` and `MANDATE_OS_AGENT_TOKEN` available in the environment that launches Codex or OpenClaw so the guarded runtime can evaluate actions when those hosts execute tools.',
  },
  security: {
    eyebrow: 'Trust, security, and evidence',
    title: 'Security claims should end in artifacts operators can review.',
    body:
      'MandateOS is stronger when the security story is tied to receipts, approval events, execution grants, and a tamper-evident audit chain rather than broad promises alone.',
    evidencePoints: [
      'Verifiable receipts for meaningful actions',
      'Approval events attached to the request path',
      'Execution grants for escalated work',
      'Audit chain verification for retained history',
    ],
    items: [
      {
        label: 'Signed payloads',
        title: 'Mandates, receipts, and grants are signed when they are created',
        body:
          'The runtime signs mandates, receipts, and execution grants so teams can verify integrity and keep older signatures valid through key rotation.',
      },
      {
        label: 'Encrypted secrets',
        title: 'Sensitive tokens are encrypted before storage',
        body:
          'At-rest credential storage uses authenticated encryption so the control plane can protect secrets and detect tampering.',
      },
      {
        label: 'Hashed credentials',
        title: 'API keys are stored as hashes, not raw secrets',
        body:
          'Key verification uses timing-safe comparison so the runtime does not have to keep plain-text secrets on disk.',
      },
      {
        label: 'Tamper-evident audit',
        title: 'Audit events are chained so later modification is visible',
        body:
          'A SHA-256 audit chain makes review stronger because historical edits break verification instead of staying invisible.',
      },
      {
        label: 'Verified requests',
        title: 'Inter-service requests are signed and scoped',
        body:
          'Service-to-service calls are authenticated across method, path, body, and expiry. Mutating requests also require idempotency keys.',
      },
      {
        label: 'Operator review',
        title: 'Evidence is organized for approval and later review',
        body:
          'The security model becomes practical when operators can see the request, the escalation decision, and the receipt together.',
      },
    ],
    links: [
      {
        label: 'Inspect the public repo',
        href: 'https://github.com/robinsjovoll/mandate-os',
      },
      {
        label: 'Browse MandateOS packages',
        href: 'https://www.npmjs.com/search?q=%40mandate-os',
      },
      {
        label: 'Read installer docs',
        href: 'https://github.com/robinsjovoll/mandate-os/tree/main/packages/mandate-os-mcp#readme',
      },
    ],
  },
  faq: {
    eyebrow: 'FAQ',
    title: 'Questions teams ask before they trust agent guardrails.',
    body:
      'Direct answers for teams evaluating MandateOS for approvals, runtime visibility, auditability, and inspectable host integration.',
    items: [
      {
        question: 'What is MandateOS?',
        answer:
          'MandateOS is an AI agent guardrails system for teams using Codex, Cursor, Claude Code, OpenClaw, and MCP-based workflows. It evaluates tool scope, budgets, approvals, and receipt requirements before sensitive actions continue.',
      },
      {
        question: 'What do I see after install?',
        answer:
          'You see local host config for the selected repo, a status command for the installer, and a concrete runtime path for risky actions. In practice that means files such as `.codex/config.toml`, `.codex/hooks.json`, Cursor hooks, or Claude workspace settings, depending on the host.',
      },
      {
        question: 'Is MandateOS open source?',
        answer:
          'The developer-facing trust layer is open source: the SDK, MCP server, installer CLIs, starter policy bundles, docs, and homepage live in the public repo. The managed control plane handles shared approvals, workspace operations, retained audit history, and operator administration.',
      },
      {
        question: 'Do I need the managed control plane?',
        answer:
          'No. The public packages and installers can be used on their own when you want local host integration and runtime checks. Teams add the managed control plane when they want shared approvals, workspace administration, retained evidence, and operator review across repos.',
      },
      {
        question: 'What happens if MandateOS cannot reach the runtime?',
        answer:
          'MandateOS does not silently waive guardrails. For live guarded actions, the host surfaces a MandateOS failure or blocks the action until the runtime is available again. A few local paths, such as read-only shell commands and MandateOS self-calls, can still short-circuit locally without calling the runtime.',
      },
      {
        question: 'How is this different from system prompts?',
        answer:
          'System prompts tell the agent what it should do. MandateOS evaluates what the agent actually requested before the sensitive tool runs, then keeps receipts, approval events, and audit evidence behind the outcome.',
      },
      {
        question: 'Which integrations are available today?',
        answer:
          'Today MandateOS provides integrations for Codex, Cursor, Claude Code, OpenClaw, and managed MCP flows. GitHub-side enforcement is planned next, but is not presented as fully available today.',
      },
      {
        question: 'Where should a team start?',
        answer:
          'Start with one host and one concrete workflow, usually a risky shell action or repo write path. Install the matching public package locally first, then connect that setup to the managed control plane when you want shared approvals, workspace operations, and retained evidence.',
      },
    ],
  },
  finalCta: {
    eyebrow: 'Start with a concrete workflow',
    title: 'Install MandateOS into one repo, then watch the first approval and receipt happen.',
    body:
      'The fastest way to evaluate MandateOS is to wire one host into one real repo, define one clear mandate, and inspect the evidence trail yourself.',
    primaryLabel: 'Open Install Guide',
    primaryHref: '#deploy',
    secondaryLabel: 'Inspect the Public Repo',
    secondaryHref: 'https://github.com/robinsjovoll/mandate-os',
  },
  footer: 'Operational guardrails, approvals, and evidence for AI agents.',
  footerLinks: [
    {
      label: 'GitHub',
      href: 'https://github.com/robinsjovoll/mandate-os',
    },
    {
      label: 'npm packages',
      href: 'https://www.npmjs.com/search?q=%40mandate-os',
    },
    {
      label: 'LLMs.txt',
      href: '/llms.txt',
    },
    {
      label: 'Sitemap',
      href: '/sitemap.xml',
    },
  ],
} as const;
