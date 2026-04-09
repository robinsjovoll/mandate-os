import { realpathSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function isInvokedAsEntrypoint(
  metaUrl: string,
  argv1: string | undefined = process.argv[1],
) {
  if (!argv1) {
    return false;
  }

  try {
    return realpathSync(fileURLToPath(metaUrl)) === realpathSync(argv1);
  } catch {
    try {
      return pathToFileURL(argv1).href === metaUrl;
    } catch {
      return false;
    }
  }
}
