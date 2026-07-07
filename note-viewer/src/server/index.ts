import { getConfig } from "./config";
import { createApp } from "./app";
import { startRepositoryWatcher } from "./services/watchRepository";

const config = getConfig();
const app = createApp(config);

startRepositoryWatcher(config);

app.listen(config.port, () => {
  console.log(`note-viewer listening on ${config.port}`);
});
