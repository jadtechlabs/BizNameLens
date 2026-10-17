import { initBotId } from "botid/client/core";

initBotId({
  protect: [
    {
      path: "/api/check",
      method: "POST",
    },
  ],
});
