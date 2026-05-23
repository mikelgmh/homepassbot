import { Composer } from "grammy";
import type { MyContext } from "@/types";
import { middleware } from "./middleware";
import { commandHandlers } from "./commands";
import { entityManagementHandlers } from "./entity-management";
import { adminMenuHandlers } from "./admin-menu";
import { userManagementHandlers } from "./user-management";
import { catchAll } from "./catch-all";

const commands = new Composer<MyContext>();
commands.use(middleware);
commands.use(commandHandlers);
commands.use(entityManagementHandlers);
commands.use(adminMenuHandlers);
commands.use(userManagementHandlers);
commands.use(catchAll);

// Noop handler for page indicators
commands.callbackQuery("noop", async (ctx) => {
  await ctx.answerCallbackQuery();
});

export { commands };
