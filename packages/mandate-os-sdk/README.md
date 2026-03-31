# `@mandate-os/sdk`

Tiny TypeScript SDK for MandateOS agent integrations.

It provides:

- `MandateOsAgentClient` for issuing mandates, evaluating actions, minting execution grants, and calling enforced execute routes
- `MandateOsAgentMiddleware` for the common evaluate -> require -> grant -> execute control loop
- The minimal public types needed by agent-side integrations

Current enforced GitHub helpers cover issue labeling and keeping pull requests in draft through MandateOS-owned execute routes.

Example:

```ts
import { MandateOsAgentClient, MandateOsAgentMiddleware } from '@mandate-os/sdk';

const client = new MandateOsAgentClient({
  baseUrl: 'http://localhost:4330',
  bearerToken: process.env.MANDATE_OS_AGENT_TOKEN!,
  defaultSource: 'codex.repo_steward',
});

const mandate = new MandateOsAgentMiddleware(client, {
  mandateId: 'mdt_123',
  source: 'codex.repo_steward',
});
```
