import { getConfig } from "./config";
import { createApp } from "./app";
import { createRepositoryStore } from "./services/repositoryStore";
import { startRepositoryWatcher } from "./services/watchRepository";

const config = getConfig();
const store = createRepositoryStore(config);
const app = createApp(config, store);

startRepositoryWatcher(config, () => store.refresh());

app.listen(config.port, () => {
  console.log(`note-viewer listening on ${config.port}`);
});
