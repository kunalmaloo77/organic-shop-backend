import * as oidc from "openid-client";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleServer = new URL("https://accounts.google.com");

const googleConfig = await oidc.discovery(
  googleServer,
  googleClientId,
  googleClientSecret
);

export { googleConfig, oidc };
