import { api, apiNamespace, app, page, route } from "@wasp.sh/spec";
import { MainPage } from "./src/MainPage" with { type: "ref" };
import { studioHealth, listStudioProjects, getStudioProject, saveStudioProject, studioMiddleware, repoHealth, repoQuestion } from "./src/apis" with { type: "ref" };

export default app({
  name: "waspStudio",
  wasp: { version: "^0.26.1" },
  title: "Second Cursor — Wasp project archive",
  head: ["<link rel='icon' href='/favicon.ico' />"],
  spec: [
    route("RootRoute", "/", page(MainPage)),
    apiNamespace("/studio-api", { middlewareConfigFn: studioMiddleware }),
    api("GET", "/studio-api/repo/health", repoHealth),
    api("POST", "/studio-api/repo/question", repoQuestion),
    api("GET", "/studio-api/health", studioHealth, { entities: ["DesignProject"] }),
    api("GET", "/studio-api/projects", listStudioProjects, { entities: ["DesignProject"] }),
    api("GET", "/studio-api/projects/:id", getStudioProject, { entities: ["DesignProject"] }),
    api("PUT", "/studio-api/projects/:id", saveStudioProject, { entities: ["DesignProject"] }),
  ],
});
